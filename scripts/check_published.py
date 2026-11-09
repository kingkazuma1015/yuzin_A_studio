"""Compare the saved production snapshot with local and public static files.

Read-only. A mismatch returns a nonzero status and never overwrites a file.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath
from urllib.request import Request, urlopen
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--offline', action='store_true', help='Check only local files')
    mode.add_argument('--live-only', action='store_true', help='Check production while local edits are in progress')
    args = parser.parse_args()
    production = json.loads((ROOT / '.deployment/production.json').read_text())
    base = production['public_url']
    if base != 'https://yuzin-a-studio.com/':
        parser.error('Unexpected public domain in production record')
    entries = production['files']
    names = [entry['path'] for entry in entries]
    if len(names) != len(set(names)) or 'index.html' not in names:
        parser.error('Invalid production file list')
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or '\\' in name:
            parser.error('Invalid production file path')

    def check(entry):
        name = entry['path']
        problems = []
        if not args.live_only:
            path = ROOT / name
            if not path.is_file():
                problems.append('local file missing')
            elif hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
                problems.append('local content differs from published snapshot')
        if not args.offline:
            url = base + ('' if name == 'index.html' else name)
            try:
                request = Request(url, headers={'Cache-Control': 'no-cache', 'User-Agent': 'YuzinA-source-check'})
                with urlopen(request, timeout=30) as response:
                    if not response.url.startswith(base):
                        raise ValueError('Unexpected redirect')
                    data = response.read(2_000_001)
                    if len(data) > 2_000_000:
                        raise ValueError('Unexpected file size')
                if hashlib.sha256(data).hexdigest() != entry['sha256']:
                    problems.append('public content differs from published snapshot')
            except Exception as error:
                problems.append(f'public check failed: {error}')
        return name, problems

    results = list(ThreadPoolExecutor(max_workers=4).map(check, entries))
    failed = [(name, problems) for name, problems in results if problems]
    if failed:
        for name, problems in failed:
            print(f'DIFFERENT: {name}: {"; ".join(problems)}', file=sys.stderr)
        print('Stop and reconcile the differences before editing or publishing.', file=sys.stderr)
        return 1
    scope = 'local files' if args.offline else 'public files' if args.live_only else 'local and public files'
    print(f'PASS: {len(entries)} {scope} match the saved production hashes.')
    print(f'Published source: {production["published_source_commit"]}')
    print(f'Netlify deploy: {production["deploy_id"]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
