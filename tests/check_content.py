"""Offline, immutable-source content checks. Never contacts a remote service.

The fixture was extracted before editing from main 3a21d94. Layout, decorative
elements and whitespace may change; original copy, destinations and assets may not.
"""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import re
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = json.loads((ROOT / 'tests/content-baseline.json').read_text())


def compact(text):
    return re.sub(r'\s+', '', text)


class Content(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.fragments = []
        self.elements = []
        self.skipping = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag in {'script', 'style'}:
            self.skipping += 1

    def handle_endtag(self, tag):
        if tag in {'script', 'style'}:
            self.skipping -= 1

    def handle_data(self, text):
        if not self.skipping:
            self.fragments.append(text)


def check():
    html = (ROOT / 'index.html').read_text(encoding='utf-8-sig')
    script = (ROOT / 'script.js').read_text()
    p = Content()
    p.feed(html)
    text = compact(''.join(p.fragments))
    # Clone removal is deliberate: compare unique original copy, not presentation
    # counts. The close glyph and year are UI values, not business-copy contracts.
    original = [s for s in FIXTURE['original_text'] if s not in {'×', '2026', '©'}]
    missing = [s for s in original if compact(s) not in text]
    assert not missing, 'Original copy changed or missing:\n' + '\n'.join(missing)

    anchors = [a for tag, a in p.elements if tag == 'a']
    links = {a.get('href') for a in anchors}
    missing_links = set(FIXTURE['original_links']) - links
    assert not missing_links, f'Original destinations missing: {missing_links}'
    video_links = [a for a in anchors if 'work-card' in a.get('class', '').split()
                   and a.get('aria-hidden') != 'true']
    video_ids = [parse_qs(urlparse(a.get('href', '')).query).get('v', [None])[0]
                 for a in video_links]
    assert video_ids == FIXTURE['video_ids'], f'Nine original works/order changed: {video_ids}'
    assert len(video_ids) == len(set(video_ids)) == 9
    assert '星月夜' not in html, 'Unapproved tenth work added'

    alts = {a.get('alt') for tag, a in p.elements if tag == 'img'}
    missing_alts = set(FIXTURE['original_image_alts']) - alts
    assert not missing_alts, f'Original image descriptions missing: {missing_alts}'
    for filename, expected in FIXTURE['asset_sha256'].items():
        actual = hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()
        assert actual == expected, f'Original source asset changed: {filename}'
    meta = [a for tag, a in p.elements if tag == 'meta']
    for expected in FIXTURE['meta']:
        assert expected in meta, f'Original metadata changed: {expected}'

    # An explicit noJS contact path is independent of a generated mail dialog.
    assert any(a.get('href') == 'mailto:yuzinamix@gmail.com' and 'hidden' not in a
               for a in anchors), 'Missing static, visible mailto fallback'
    assert any(a.get('href') == 'https://x.com/yuzin_A_' for a in anchors)
    for tag, attrs in p.elements:
        if tag == 'script':
            assert attrs.get('src') in {None, 'script.js'}, 'Unreviewed external script'
    active = html + '\n' + script
    for forbidden in [r'docs\.google\.com/spreadsheets', r'sheets\.googleapis\.com',
                      r'/gviz/', r'\bXMLHttpRequest\b', r'\bfetch\s*\(',
                      r'\bWebSocket\s*\(', r'\bEventSource\s*\(']:
        assert not re.search(forbidden, active, re.I), f'Unexpected data/network feed: {forbidden}'
    print(f'PASS: {len(original)} unique original text fragments; all original destinations; '
          'nine ordered works including KING / 東京駅; source image descriptions; '
          'three byte-identical original assets; metadata; static contact fallback; no data feed')


if __name__ == '__main__':
    check()
