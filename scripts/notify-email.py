#!/usr/bin/env python3
"""
Email notification helper for agy-opendesign upstream compatibility checks.
Uses Python 3 standard library only (zero external dependencies).

Supports:
  1. SMTP (SSL on port 465 or STARTTLS on port 587)
  2. Resend HTTPS API (https://api.resend.com/emails)

Credentials are loaded from $HOME/.config/agy-opendesign/notify.env (mode 0600)
or environment variables. Secrets are never printed.
"""

from __future__ import annotations

import argparse
import json
import os
import smtplib
import ssl
import sys
import urllib.error
import urllib.request
from email.message import EmailMessage
from pathlib import Path
from typing import Any


DEFAULT_ENV_FILE = Path.home() / ".config" / "agy-opendesign" / "notify.env"


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if not key:
            continue
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        values[key] = val
    return values


def load_report(report_json: str | None) -> dict[str, Any] | None:
    raw = ""
    if report_json == "-":
        raw = sys.stdin.read().strip()
    elif report_json:
        raw = Path(report_json).read_text(encoding="utf-8").strip()
    elif not sys.stdin.isatty():
        raw = sys.stdin.read().strip()

    if not raw:
        return None
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Report JSON must be an object")
    return data


def format_report_email(report: dict[str, Any] | None) -> tuple[str, str]:
    if report is None:
        return (
            "[agy-opendesign] Upstream check notification",
            "No JSON report payload was supplied.\n",
        )

    status = str(report.get("status", "UNKNOWN"))
    checked_at = str(report.get("checkedAt", "unknown"))
    lock = report.get("lock", {}) if isinstance(report.get("lock"), dict) else {}
    lock_up = lock.get("upstream", {}) if isinstance(lock.get("upstream"), dict) else {}
    remote = report.get("remote", {}) if isinstance(report.get("remote"), dict) else {}
    local = report.get("local", {}) if isinstance(report.get("local"), dict) else {}
    app = local.get("app", {}) if isinstance(local.get("app"), dict) else {}
    compat = report.get("compat", {}) if isinstance(report.get("compat"), dict) else {}
    mcp = compat.get("mcp", {}) if isinstance(compat.get("mcp"), dict) else {}
    drift = compat.get("driftReasons", []) if isinstance(compat.get("driftReasons"), list) else []
    checklist = report.get("checklist", []) if isinstance(report.get("checklist"), list) else []

    repo = lock_up.get("repo", "nexu-io/open-design")
    lock_tag = lock_up.get("releaseTag", "unknown")
    latest_tag = remote.get("latestTag") or ("skipped (offline)" if remote.get("skipped") else "unavailable")

    subject = f"[agy-opendesign] {status} — {repo} ({latest_tag})"

    lines = [
        f"Status: {status}",
        f"Checked at: {checked_at}",
        f"Locked upstream: {repo} @ {lock_tag} (app {lock_up.get('appVersion', 'n/a')}, MCP {lock_up.get('mcpServerVersion', 'n/a')}, {lock_up.get('expectedMcpToolCount', 'n/a')} tools)",
        f"Latest remote tag: {latest_tag}",
        f"Local Open Design.app: installed={app.get('installed')} version={app.get('version')}",
        f"Live MCP wrapper: ok={mcp.get('ok')} server={mcp.get('serverName')}@{mcp.get('serverVersion')} tools={mcp.get('toolCount')}",
    ]

    watched = remote.get("watchedChanges") or []
    if watched:
        lines.append("")
        lines.append(f"Watched upstream file changes ({len(watched)}):")
        for item in watched[:20]:
            lines.append(f"  - {item}")
        if len(watched) > 20:
            lines.append(f"  ... (+{len(watched) - 20} more)")

    if drift:
        lines.append("")
        lines.append("Compatibility drift details:")
        for reason in drift:
            lines.append(f"  - {reason}")

    if checklist:
        lines.append("")
        lines.append("Recommended next steps:")
        for step in checklist:
            lines.append(f"  * {step}")

    return subject, "\n".join(lines) + "\n"


def send_via_smtp(
    *,
    host: str,
    port: int,
    user: str,
    password: str,
    sender: str,
    recipient: str,
    subject: str,
    body: str,
) -> None:
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = recipient
    msg["Subject"] = subject
    msg.set_content(body)

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=20, context=context) as server:
            server.login(user, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(user, password)
            server.send_message(msg)


def send_via_resend(
    *,
    api_key: str,
    sender: str,
    recipient: str,
    subject: str,
    body: str,
) -> None:
    payload = json.dumps(
        {
            "from": sender,
            "to": [recipient],
            "subject": subject,
            "text": body,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "agy-opendesign-notify/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status < 200 or resp.status >= 300:
                raise RuntimeError(f"Resend API returned HTTP {resp.status}")
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Resend API failed (HTTP {err.code}): {detail}") from None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Send upstream-check email alerts via SMTP or Resend (stdlib only)."
    )
    parser.add_argument(
        "--env-file",
        default=str(DEFAULT_ENV_FILE),
        help="Path to env file (default: $HOME/.config/agy-opendesign/notify.env)",
    )
    parser.add_argument("--to", dest="to_addr", help="Recipient email address (overrides NOTIFY_TO)")
    parser.add_argument("--subject", help="Email subject override")
    parser.add_argument(
        "--report-json",
        help="Path to check-upstream.mjs --json output (use '-' or pipe stdin)",
    )
    parser.add_argument(
        "--only-on-change",
        action="store_true",
        help="Exit 0 without sending when report status is UP_TO_DATE",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print formatted email headers and body without sending",
    )
    args = parser.parse_args(argv)

    env_path = Path(args.env_file).expanduser()
    file_env = parse_env_file(env_path)

    def get_cfg(key: str, default: str = "") -> str:
        # Process env overrides env-file when non-empty
        if os.environ.get(key):
            return os.environ[key].strip()
        return file_env.get(key, default).strip()

    try:
        report = load_report(args.report_json)
    except Exception as exc:
        print(f"Error: failed to read report JSON: {exc}", file=sys.stderr)
        return 2

    status = str(report.get("status", "")) if report else ""
    if args.only_on_change and status == "UP_TO_DATE":
        print("Status is UP_TO_DATE (--only-on-change); skipping email notification.")
        return 0

    default_subject, body = format_report_email(report)
    subject = args.subject or default_subject
    recipient = (args.to_addr or get_cfg("NOTIFY_TO")).strip()

    smtp_host = get_cfg("SMTP_HOST")
    smtp_port_raw = get_cfg("SMTP_PORT", "465")
    smtp_user = get_cfg("SMTP_USER")
    smtp_pass = get_cfg("SMTP_PASS")
    resend_key = get_cfg("RESEND_API_KEY")
    notify_from = get_cfg("NOTIFY_FROM")

    if resend_key:
        transport = "resend"
        sender = notify_from or "onboarding@resend.dev"
    elif smtp_host and smtp_user and smtp_pass:
        transport = "smtp"
        sender = notify_from or smtp_user
    else:
        transport = "unconfigured"
        sender = notify_from or smtp_user or "noreply@example.com"

    if args.dry_run:
        print(f"[dry-run] Transport: {transport}")
        print(f"From: {sender}")
        print(f"To: {recipient or '(unset)'}")
        print(f"Subject: {subject}")
        print("")
        print(body, end="")
        return 0

    if not recipient:
        print(
            f"Error: recipient address missing. Set NOTIFY_TO in {env_path} or pass --to you@example.com.",
            file=sys.stderr,
        )
        return 1

    if transport == "unconfigured":
        print(
            f"Error: no email transport credentials configured in {env_path}.\n"
            f"Fill either:\n"
            f"  - SMTP_HOST, SMTP_USER, and SMTP_PASS (e.g. a Gmail App Password for smtp.gmail.com:465), OR\n"
            f"  - RESEND_API_KEY (and optional NOTIFY_FROM) for Resend HTTPS delivery.",
            file=sys.stderr,
        )
        return 1

    try:
        if transport == "resend":
            send_via_resend(
                api_key=resend_key,
                sender=sender,
                recipient=recipient,
                subject=subject,
                body=body,
            )
            print(f"Sent alert via Resend to {recipient} (subject: {subject})")
        else:
            try:
                smtp_port = int(smtp_port_raw)
            except ValueError:
                print(f"Error: invalid SMTP_PORT value: {smtp_port_raw!r}", file=sys.stderr)
                return 2
            send_via_smtp(
                host=smtp_host,
                port=smtp_port,
                user=smtp_user,
                password=smtp_pass,
                sender=sender,
                recipient=recipient,
                subject=subject,
                body=body,
            )
            print(f"Sent alert via SMTP ({smtp_host}:{smtp_port}) to {recipient} (subject: {subject})")
        return 0
    except Exception as exc:
        print(f"Error: email delivery failed via {transport}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
