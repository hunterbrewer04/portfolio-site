#!/usr/bin/env python3
"""A nicer terminal front-end for Ookla's official `speedtest` CLI."""

import argparse
import json
import shutil
import subprocess
import sys


class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"


BAR_WIDTH = 28
LINE_WIDTH = 52
INSTALL_URL = "https://www.speedtest.net/apps/cli"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run a network speed test (powered by Ookla speedtest CLI)."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--simple", action="store_true", help="one-line summary")
    group.add_argument(
        "--json",
        action="store_true",
        help="compact JSON: download_mbps, upload_mbps, ping_ms, server fields",
    )
    group.add_argument(
        "--raw-json",
        action="store_true",
        help="Ookla's full raw JSON result (every field)",
    )
    parser.add_argument("--server-id", type=int, help="use a specific Ookla server ID")
    parser.add_argument("--no-color", action="store_true", help="disable ANSI colors")
    return parser.parse_args()


def disable_colors():
    for name in dir(C):
        if not name.startswith("_") and name.isupper():
            setattr(C, name, "")


def ensure_speedtest():
    path = shutil.which("speedtest")
    if path is None:
        sys.stderr.write(
            f"{C.RED}Error:{C.RESET} Ookla's `speedtest` CLI is not installed or not on PATH.\n"
            f"       Install it from {INSTALL_URL}\n"
        )
        sys.exit(1)

    try:
        version = subprocess.run(
            [path, "--version"], capture_output=True, text=True, timeout=5
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        sys.stderr.write(
            f"{C.RED}Error:{C.RESET} could not run `{path} --version`: {exc}\n"
        )
        sys.exit(1)

    if "Ookla" not in (version.stdout or "") + (version.stderr or ""):
        sys.stderr.write(
            f"{C.RED}Error:{C.RESET} `{path}` is not Ookla's official speedtest CLI.\n"
            "       (The Python `speedtest-cli` pip package installs a conflicting `speedtest` command.)\n"
            f"       Install Ookla's CLI from {INSTALL_URL}\n"
        )
        sys.exit(1)

    return path


def bytes_per_sec_to_mbps(bytes_per_sec):
    return bytes_per_sec * 8 / 1_000_000


def bar(progress):
    progress = max(0.0, min(1.0, progress))
    filled = int(progress * BAR_WIDTH)
    return "█" * filled + "░" * (BAR_WIDTH - filled)


def render_progress(color, marker, label, progress, value, unit):
    line = (
        f"\r  {color}{marker} {label:<8}{C.RESET} "
        f"{bar(progress)} {value:>7.2f} {C.DIM}{unit}{C.RESET}  "
    )
    sys.stdout.write(line)
    sys.stdout.flush()


def stream_run(server_id):
    cmd = [
        "speedtest",
        "--format=jsonl",
        "--progress=yes",
        "--accept-license",
        "--accept-gdpr",
    ]
    if server_id is not None:
        cmd += ["--server-id", str(server_id)]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True, bufsize=1)

    header_printed = False
    current_phase = None
    result = None

    for raw in proc.stdout:
        raw = raw.strip()
        if not raw:
            continue
        try:
            evt = json.loads(raw)
        except json.JSONDecodeError:
            continue

        kind = evt.get("type")

        if kind == "testStart" and not header_printed:
            print_header(evt)
            header_printed = True

        elif kind == "ping":
            if current_phase != "ping":
                current_phase = "ping"
            ping = evt.get("ping", {})
            render_progress(
                C.YELLOW,
                "●",
                "Ping",
                ping.get("progress", 0),
                ping.get("latency", 0),
                "ms",
            )

        elif kind == "download":
            if current_phase != "download":
                if current_phase is not None:
                    sys.stdout.write("\n")
                current_phase = "download"
            dl = evt.get("download", {})
            render_progress(
                C.GREEN,
                "↓",
                "Download",
                dl.get("progress", 0),
                bytes_per_sec_to_mbps(dl.get("bandwidth", 0)),
                "Mbps",
            )

        elif kind == "upload":
            if current_phase != "upload":
                if current_phase is not None:
                    sys.stdout.write("\n")
                current_phase = "upload"
            up = evt.get("upload", {})
            render_progress(
                C.BLUE,
                "↑",
                "Upload",
                up.get("progress", 0),
                bytes_per_sec_to_mbps(up.get("bandwidth", 0)),
                "Mbps",
            )

        elif kind == "result":
            if current_phase is not None:
                sys.stdout.write("\n")
                current_phase = None
            result = evt

    proc.wait()
    if proc.returncode != 0:
        sys.exit(proc.returncode)

    return result


def quiet_run(server_id):
    cmd = [
        "speedtest",
        "--format=json",
        "--progress=no",
        "--accept-license",
        "--accept-gdpr",
    ]
    if server_id is not None:
        cmd += ["--server-id", str(server_id)]

    completed = subprocess.run(cmd, capture_output=True, text=True)
    if completed.returncode != 0:
        sys.stderr.write(completed.stderr)
        sys.exit(completed.returncode)
    return json.loads(completed.stdout)


def print_header(evt):
    server = evt.get("server", {}) or {}
    isp = evt.get("isp") or "Unknown ISP"
    name = server.get("name", "?")
    location = server.get("location", "?")
    country = server.get("country", "?")
    sponsor_bits = [b for b in (name, location, country) if b and b != "?"]
    server_str = ", ".join(sponsor_bits) if sponsor_bits else "?"

    print(f"{C.BOLD}{C.CYAN}Speedtest{C.RESET} {C.DIM}by Ookla{C.RESET}")
    print(f"  {C.DIM}ISP   :{C.RESET} {isp}")
    print(f"  {C.DIM}Server:{C.RESET} {server_str}")
    print()


def print_summary(result):
    download = bytes_per_sec_to_mbps(result["download"]["bandwidth"])
    upload = bytes_per_sec_to_mbps(result["upload"]["bandwidth"])
    ping_data = result.get("ping", {}) or {}
    ping = ping_data.get("latency", 0)
    jitter = ping_data.get("jitter", 0)
    packet_loss = result.get("packetLoss")
    server = result.get("server", {}) or {}
    isp = result.get("isp", "?")
    url = (result.get("result", {}) or {}).get("url", "")

    rule = "─" * LINE_WIDTH
    print(f"{C.DIM}{rule}{C.RESET}")
    print(f"  {C.GREEN}{C.BOLD}↓ Download{C.RESET}  {download:>9.2f} {C.DIM}Mbps{C.RESET}")
    print(f"  {C.BLUE}{C.BOLD}↑ Upload  {C.RESET}  {upload:>9.2f} {C.DIM}Mbps{C.RESET}")
    print(
        f"  {C.YELLOW}{C.BOLD}⚡ Latency{C.RESET}  {ping:>9.2f} {C.DIM}ms "
        f"(jitter {jitter:.2f} ms){C.RESET}"
    )
    if isinstance(packet_loss, (int, float)):
        print(
            f"  {C.MAGENTA}{C.BOLD}⊘ Loss    {C.RESET}  {packet_loss:>9.2f} {C.DIM}%{C.RESET}"
        )
    print(f"{C.DIM}{rule}{C.RESET}")
    server_bits = [
        s for s in (server.get("name"), server.get("location"), server.get("country")) if s
    ]
    print(f"  {C.DIM}Server:{C.RESET} {', '.join(server_bits) if server_bits else '?'}")
    print(f"  {C.DIM}ISP   :{C.RESET} {isp}")
    if url:
        print(f"  {C.DIM}Result:{C.RESET} {url}")


def to_compact_schema(result):
    server = result.get("server", {}) or {}
    return {
        "download_mbps": round(bytes_per_sec_to_mbps(result["download"]["bandwidth"]), 2),
        "upload_mbps": round(bytes_per_sec_to_mbps(result["upload"]["bandwidth"]), 2),
        "ping_ms": round((result.get("ping") or {}).get("latency", 0), 2),
        "server_name": server.get("location"),
        "server_country": server.get("country"),
        "server_sponsor": server.get("name"),
    }


def main():
    args = parse_args()
    if args.no_color or not sys.stdout.isatty():
        disable_colors()
    ensure_speedtest()

    if args.raw_json:
        result = quiet_run(args.server_id)
        print(json.dumps(result, indent=2))
        return

    if args.json:
        result = quiet_run(args.server_id)
        print(json.dumps(to_compact_schema(result), indent=2))
        return

    if args.simple:
        result = quiet_run(args.server_id)
        download = bytes_per_sec_to_mbps(result["download"]["bandwidth"])
        upload = bytes_per_sec_to_mbps(result["upload"]["bandwidth"])
        ping = (result.get("ping") or {}).get("latency", 0)
        print(
            f"Ping: {ping:.2f} ms  Down: {download:.2f} Mbps  Up: {upload:.2f} Mbps"
        )
        return

    result = stream_run(args.server_id)
    if result is not None:
        print_summary(result)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.stderr.write("\nAborted.\n")
        sys.exit(130)
