"""Offline preservation checks against the public custom-domain snapshot.

published-baseline.json was captured before motion editing on 2026-11-09.
The older content-baseline.json retains historical links, work order and assets.
"""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import re
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = json.loads((ROOT / 'tests/content-baseline.json').read_text())
PUBLISHED = json.loads((ROOT / 'tests/published-baseline.json').read_text())
# User-authorized copy change on 2026-11-12. Keep both historical baselines
# immutable and allow only this exact replacement in the three existing places.
OLD_LEAD_TIME = '5〜7日程度'
NEW_LEAD_TIME = '2週間前後'
# User-supplied SOFT YA logo replacement on 2026-11-20. Restore only this
# exact header markup when comparing with the immutable historical snapshot.
OLD_HEADER_LOGO = '<a class="logo" href="#top" aria-label="YuzinA Studio トップへ"><span class="logo-mark" aria-hidden="true">Y<span>A</span></span><span>YuzinA Studio</span></a>'
NEW_HEADER_LOGO = '<a class="logo" href="#top" aria-label="YuzinA Studio ホーム"><img class="brand-monogram" src="assets/yuzina-logo.svg" width="650" height="450" alt="" loading="eager"><span>YuzinA Studio</span></a>'
# User-authorized intake copy change on 2026-11-20.
OLD_MATERIALS = '            <li>歌詞</li>\n            <li>ご希望の仕上がりイメージ、ご要望</li>'
NEW_MATERIALS = '            <li>ご希望の仕上がりイメージ、ご要望（あれば）</li>'
# The user requested removing the swipe hint from HTML, not only hiding it.
OLD_WORKS_END = '    <p class="works-hint"><span aria-hidden="true">↔</span> スワイプ・ドラッグで作品を見る</p></section>\n\n<section class="playlist-section'
NEW_WORKS_END = '    </section>\n\n<section class="playlist-section'
NEW_ABOUT_END = '      </div>\n    </section>\n\n<section class="section-shell service-section"'
OLD_ABOUT_END = '''        <div class="about-points">
          <span>MIX歴11年</span>
          <span>担当作品2,000本以上</span>
          <span>レコーディング経験あり</span>
          <span>テクノポップ</span>
          <span>バラード</span>
        </div>
''' + NEW_ABOUT_END
# Exact user-provided biography from the 2026-11-20 screenshot.
OLD_ABOUT_COPY = '''        <p>
          MIX歴11年、これまでに累計2,000本以上の歌ってみた作品を担当してきました。
          ボーカルの質感や楽曲の方向性を見ながら、投稿作品として聴きやすいバランスへ整えます。
        </p>
        <p>
          レコーディングオペレーションの経験もあり、録り音の状態を踏まえた調整や
          制作前の相談にも対応できます。特にテクノポップやバラードのMIXを得意としています。
        </p>'''
NEW_ABOUT_COPY = '''        <p>
          2015年にMIX活動を始め、これまでに2,000本の作品のMIXを担当してきました。<br>
          音質や録音環境に不安がある場合でも、これまでの経験を活かして対応いたしますので、安心してご依頼ください。
        </p>
        <p>
          福岡ではレコーディングエンジニアやテレビ局の音響効果などの仕事も経験し、現在は東京で個人として活動を続けております。
        </p>
        <p>
          一人でも多くの人に音楽を楽しんでもらうことを第一に考えております。<br>
          初めて「歌ってみた」に挑戦する方や、始め方がわからず悩んでいる方にも、一から丁寧に対応いたします。
        </p>
        <p>
          ご依頼者様にとって過去一番の作品を作れるよう、一つひとつの作業に最善を尽くしています。
        </p>'''

# User-requested removal of the portfolio counter and arrow buttons.
WORKS_HEADING_ANCHOR = '<h2 id="works-title">担当作品</h2></div>'
OLD_WORKS_TOOLS = '<div class="works-tools" hidden><span class="works-count" aria-live="off"><span data-work-index>01</span> <span class="count-total">/ 09</span></span><button class="circle-control" type="button" data-works-prev aria-label="前の作品">←</button><button class="circle-control" type="button" data-works-next aria-label="次の作品">→</button></div>'


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
    assert html.count(NEW_HEADER_LOGO) == 1, 'Expected the authorized header logo and home link'
    assert html.count(NEW_MATERIALS) == 1 and '<li>歌詞</li>' not in html, 'Expected optional requests without lyrics'
    assert 'works-hint' not in html and 'スワイプ・ドラッグで作品を見る' not in html, 'Swipe hint must be removed from HTML'
    assert 'about-points' not in html, 'About summary tags must be removed from HTML'
    assert html.count(NEW_ABOUT_COPY) == 1, 'Expected the user-provided biography'
    preserved = Content()
    preserved.feed(html.replace(WORKS_HEADING_ANCHOR, WORKS_HEADING_ANCHOR + OLD_WORKS_TOOLS)
                  .replace(NEW_HEADER_LOGO, OLD_HEADER_LOGO)
                  .replace(NEW_MATERIALS, OLD_MATERIALS)
                  .replace(NEW_WORKS_END, OLD_WORKS_END)
                  .replace(NEW_ABOUT_END, OLD_ABOUT_END)
                  .replace(NEW_ABOUT_COPY, OLD_ABOUT_COPY))
    text = compact(''.join(preserved.fragments))
    # Clone removal is deliberate: compare unique original copy, not presentation
    # counts. The close glyph and year are UI values, not business-copy contracts.
    original = [s.replace(OLD_LEAD_TIME, NEW_LEAD_TIME)
                for s in PUBLISHED['published_text'] if s not in {'×', '2026', '©'}]
    missing = [s for s in original if compact(s) not in text]
    assert not missing, 'Original copy changed or missing:\n' + '\n'.join(missing)
    assert html.count(NEW_LEAD_TIME) == 3, 'Lead time must agree in guide, flow and FAQ'
    assert OLD_LEAD_TIME not in html, 'Outdated lead time remains in displayed copy'

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
    for expected in PUBLISHED['meta']:
        assert expected in meta, f'Original metadata changed: {expected}'
    for filename, expected in PUBLISHED['asset_sha256'].items():
        assert hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() == expected, filename
    for source in PUBLISHED['source_files']:
        data = (ROOT / source['path']).read_bytes()
        if source['path'] == 'index.html':
            data = data.replace(WORKS_HEADING_ANCHOR.encode(), (WORKS_HEADING_ANCHOR + OLD_WORKS_TOOLS).encode())
            data = data.replace(NEW_HEADER_LOGO.encode(), OLD_HEADER_LOGO.encode())
            data = data.replace(NEW_MATERIALS.encode(), OLD_MATERIALS.encode())
            data = data.replace(NEW_WORKS_END.encode(), OLD_WORKS_END.encode())
            data = data.replace(NEW_ABOUT_END.encode(), OLD_ABOUT_END.encode())
            data = data.replace(NEW_ABOUT_COPY.encode(), OLD_ABOUT_COPY.encode())
            data = data.replace(b'  <link rel="stylesheet" href="logo.css">\n', b'')
            data = data.replace(b'  <link rel="stylesheet" href="design-review.css">\n', b'')
            data = data.replace(NEW_LEAD_TIME.encode(), OLD_LEAD_TIME.encode())
            data = data.replace(b'  <link rel="stylesheet" href="motion.css">\n', b'')
            data = data.replace(b'  <link rel="stylesheet" href="works.css">\n', b'')
            data = data.replace(b'<script src="motion.js" defer></script>\n', b'')
            # Only the verified metadata blocks are new; preserve the surrounding
            # published card markup, source images, order and destinations.
            data = re.sub(rb'^            <span class="work-details">\n.*?^            </span>\n',
                          b'', data, flags=re.M | re.S)
        assert hashlib.sha256(data).hexdigest() == source['sha256'], \
            f'Published layout, styles or original interaction code changed: {source["path"]}'

    # An explicit noJS contact path is independent of a generated mail dialog.
    assert any(a.get('href') == 'mailto:yuzinamix@gmail.com' and 'hidden' not in a
               for a in anchors), 'Missing static, visible mailto fallback'
    assert any(a.get('href') == 'https://x.com/yuzin_A_' for a in anchors)
    for tag, attrs in p.elements:
        if tag == 'script':
            assert attrs.get('src') in {None, 'script.js', 'motion.js'}, 'Unreviewed external script'
    active = html + '\n' + script + '\n' + (ROOT / 'motion.js').read_text()
    for forbidden in [r'docs\.google\.com/spreadsheets', r'sheets\.googleapis\.com',
                      r'/gviz/', r'\bXMLHttpRequest\b', r'\bfetch\s*\(',
                      r'\bWebSocket\s*\(', r'\bEventSource\s*\(']:
        assert not re.search(forbidden, active, re.I), f'Unexpected data/network feed: {forbidden}'
    print(f'PASS: {len(original)} unique original text fragments; all original destinations; '
          'nine ordered works including KING / 東京駅; source image descriptions; '
          'original and published assets; authorized two-week lead time in three places; '
          'preserved copy/metadata; static contact fallback; no data feed')


if __name__ == '__main__':
    check()
