#!/usr/bin/env python3
"""Check what is actually deployed on the site, and whether a change is live.

Usage:
    python3 scripts/verify-deployed.py
    python3 scripts/verify-deployed.py --grep "get canSave" --grep "T00:00:00.000Z"
    python3 scripts/verify-deployed.py --not-grep "ejs-dropdownlist"

Why this exists
---------------
Pushing to `main` runs `.github/workflows/ci.yml`, which builds and tests but
does **not** deploy. Vercel's GitHub integration deploys separately, so a green
CI run says nothing about the live site. This script asks the site directly.

The Angular bundle filename is content-hashed (`main-<hash>.js`), so a changed
filename means a new deploy landed. The --grep markers then confirm your
specific change is inside that bundle.

If the bundle is new but the browser still shows the old behaviour, suspect the
service worker (it caches assets under `ngsw:/:db:<hash>:assets:app:cache`),
not the deploy.
"""

import argparse
import datetime
import re
import sys
import urllib.request

DEFAULT_URL = "https://financemanager.muhit.dev"


def fetch(url: str) -> tuple[str, dict]:
    request = urllib.request.Request(url, headers={"User-Agent": "verify-deployed"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", errors="replace"), dict(response.headers)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--grep", action="append", default=[],
                        help="substring that must appear in the main bundle "
                             "(repeatable)")
    parser.add_argument("--not-grep", action="append", default=[],
                        help="substring that must NOT appear in the main bundle "
                             "(repeatable) - use for removed code")
    args = parser.parse_args()

    html, headers = fetch(args.url)

    last_modified = headers.get("last-modified", "?")
    print(f"site      : {args.url}")
    print(f"deployed  : {last_modified}")
    if last_modified != "?":
        try:
            ts = datetime.datetime.strptime(last_modified, "%a, %d %b %Y %H:%M:%S %Z")
            print(f"            {ts.isoformat()} UTC")
        except ValueError:
            pass

    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    print("scripts   :")
    for s in scripts:
        print(f"            {s}")

    bundles = [s for s in scripts if "/main-" in s or s.startswith("main-")]
    if not bundles:
        print("\nerror: no main bundle found - is this the Angular app?", file=sys.stderr)
        return 1

    main_bundle = bundles[0]
    url = args.url.rstrip("/") + "/" + main_bundle.lstrip("/")
    js, _ = fetch(url)
    print(f"main      : {main_bundle} ({len(js):,} bytes)")

    if not args.grep and not args.not_grep:
        print("\n(no --grep / --not-grep markers given - nothing to check inside "
              "the bundle)")
        return 0

    failed = False

    if args.grep:
        print("\nmarkers that must be present :")
        for marker in args.grep:
            found = marker in js
            if not found:
                failed = True
            print(f"            {'FOUND  ' if found else 'MISSING'}  {marker!r}")

    if args.not_grep:
        print("markers that must be absent  :")
        for marker in args.not_grep:
            present = marker in js
            if present:
                failed = True
            print(f"            {'PRESENT' if present else 'ABSENT '}  {marker!r}")

    if failed:
        print("\nThe deployed bundle does not match the expected state.", file=sys.stderr)
        return 1

    print("\nThe deployed bundle matches the expected state - the change is live.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
