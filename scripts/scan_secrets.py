#!/usr/bin/env python3
"""Blocks API keys and other secrets from being committed.

    python scripts/scan_secrets.py --staged     # what is about to be committed (used by the git hook)
    python scripts/scan_secrets.py              # every tracked file
    python scripts/scan_secrets.py --history    # every commit ever made (finds keys that were committed once and later removed)
    python scripts/scan_secrets.py --build      # frontend/build (secrets must never reach the browser bundle)

Exit code 1 when something is found. Matches are printed redacted (first 6 characters only).
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "Google API key": re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),
    "Google/Gemini key (AQ. format)": re.compile(r"\bAQ\.[0-9A-Za-z_\-]{30,}"),
    "Emergent/OpenAI-style key": re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}"),
    "Google OAuth token": re.compile(r"\bya29\.[0-9A-Za-z_\-]{20,}"),
    "Private key block": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "Database URL with password": re.compile(r"mongodb(?:\+srv)?://[^\s:@/]+:[^\s@/]+@"),
    "Assigned secret": re.compile(r"""(?ix)\b(?:api[_-]?key|secret|token|passwd|password)\b["']?\s*[:=]\s*["'](?!\s*["'])[A-Za-z0-9_\-/+=.]{20,}["']"""),
}
# files that legitimately contain only placeholders
ALLOW_FILES = {".env.example", ".gitignore", "scan_secrets.py", "test_security_offline.py"}
SKIP_SUFFIX = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".mp4", ".webm", ".woff", ".woff2", ".pdf", ".lock", ".pyc", ".map"}
FORBIDDEN_NAMES = re.compile(r"(^|/)\.env(\.[^/]*)?$")   # any real env file (".env.example" is allowed)


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, errors="replace").stdout


def scan_text(label: str, text: str, hits: list):
    for name, rx in PATTERNS.items():
        for m in rx.finditer(text):
            line = text.count("\n", 0, m.start()) + 1
            hits.append(f"{label}:{line}  {name}  {m.group(0)[:6]}...")


def scan_files(paths, hits):
    for rel in paths:
        p = ROOT / rel
        name = Path(rel).name
        if FORBIDDEN_NAMES.search(rel) and name != ".env.example":
            hits.append(f"{rel}  an environment file must never be committed")
            continue
        if name in ALLOW_FILES or p.suffix.lower() in SKIP_SUFFIX or not p.is_file():
            continue
        try:
            scan_text(rel, p.read_text(encoding="utf-8", errors="ignore"), hits)
        except OSError:
            pass


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "--tracked"
    hits: list = []
    if mode == "--staged":
        names = git("diff", "--cached", "--name-only", "--diff-filter=ACM").splitlines()
        scan_files(names, hits)
        # also catch secrets in the staged *content* of files that were edited
        for rel in names:
            if Path(rel).name in ALLOW_FILES or Path(rel).suffix.lower() in SKIP_SUFFIX:
                continue
            scan_text(f"{rel} (staged)", git("show", f":{rel}"), hits)
        hits = sorted(set(hits))
    elif mode == "--history":
        for commit in git("rev-list", "--all").split():
            for rel in git("ls-tree", "-r", "--name-only", commit).splitlines():
                if Path(rel).name in ALLOW_FILES or Path(rel).suffix.lower() in SKIP_SUFFIX:
                    continue
                tmp: list = []
                scan_text(f"{commit[:8]}:{rel}", git("show", f"{commit}:{rel}"), tmp)
                hits.extend(tmp)
        hits = sorted(set(hits))
    elif mode == "--build":
        for f in (ROOT / "frontend" / "build").rglob("*"):
            if f.is_file() and f.suffix.lower() in {".js", ".css", ".html", ".json", ".txt", ".webmanifest"}:
                scan_text(str(f.relative_to(ROOT)), f.read_text(encoding="utf-8", errors="ignore"), hits)
    else:
        scan_files(git("ls-files").splitlines(), hits)
    if hits:
        print("Possible secrets found:")
        for h in hits[:40]:
            print("  -", h)
        print("\nRemove them (keep secrets in backend/.env, which is git-ignored) and rotate any key that was exposed.")
        return 1
    print("No secrets found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
