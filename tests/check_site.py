"""Run all offline regression checks with Python 3 + Node.js (no packages/network).

The historical test suite is retained with the immutable pre-redesign baseline.
Its seven-work and old-hero-layout assertions are superseded by the explicit
nine-work source baseline and the user-authorized full visual redesign.
"""
from pathlib import Path
import json
import subprocess
from check_content import check as check_content
from check_structure import check as check_structure

root = Path(__file__).resolve().parents[1]
check_content()
tree = check_structure()
subprocess.run(['node', '--check', str(root / 'script.js')], check=True)
subprocess.run(['node', str(root / 'tests/check_interactions.cjs')],
               input=json.dumps(tree, ensure_ascii=False), text=True, check=True)
print('PASS: all offline checks. Browser rendering, native touch, embeds and actual clipboard/mail clients require separate QA.')
