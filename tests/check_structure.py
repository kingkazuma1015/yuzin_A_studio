"""Offline structural, semantic and lightweight performance checks."""
from pathlib import Path
import re
import struct
from urllib.parse import urlparse
from html_document import Document

ROOT = Path(__file__).resolve().parents[1]


def check():
    html = (ROOT / 'index.html').read_text(encoding='utf-8-sig')
    parser = Document()
    parser.feed(html)
    assert len(parser.stack) == 1, 'Unclosed HTML elements'
    nodes = parser.all_nodes()
    ids = [n['attrs']['id'] for n in nodes if 'id' in n['attrs']]
    assert len(ids) == len(set(ids)), 'Duplicate IDs'
    assert len([n for n in nodes if n['tag'] == 'h1']) == 1, 'Exactly one document h1'
    assert len([n for n in nodes if n['tag'] == 'main']) == 1, 'Exactly one main landmark'
    assert len([n for n in nodes if n['tag'] == 'details']) == 6, 'Six native FAQ accordions'
    assert len([n for n in nodes if n['tag'] == 'dialog']) == 2, 'Mail and video dialogs'
    for node in nodes:
        attrs = node['attrs']
        for key in ['aria-controls', 'aria-labelledby', 'aria-describedby']:
            for ref in (attrs.get(key) or '').split():
                assert ref in ids, (key, ref)
        href = attrs.get('href', '')
        if href.startswith('#'):
            assert href[1:] in ids, f'Broken fragment: {href}'
        for key in ['src', 'href']:
            value = attrs.get(key, '')
            if value and not urlparse(value).scheme and not value.startswith('#'):
                assert (ROOT / urlparse(value).path).is_file(), f'Missing local asset: {value}'
        if attrs.get('target') == '_blank':
            assert 'noopener' in attrs.get('rel', '').split()
        if node['tag'] == 'img':
            assert 'alt' in attrs, 'Every image needs explicit alt text'
            assert int(attrs.get('width', 0)) > 0 and int(attrs.get('height', 0)) > 0, 'Reserve image dimensions'
            assert attrs.get('loading') == 'lazy', 'Below-fold work imagery must lazy-load'
        if node['tag'] == 'iframe':
            assert attrs.get('title'), 'Embedded video requires accessible title'
            assert 'autoplay=1' not in attrs.get('src', ''), 'No autoplay media'
        if node['tag'] == 'button':
            text = attrs.get('aria-label') or attrs.get('aria-labelledby') or node.get('text', '').strip()
            assert text or node['children'], f'Unnamed button: {attrs}'
            assert attrs.get('type') in {'button', 'submit'}, f'Explicit button type required: {attrs}'
    canonical = [n['attrs'].get('href') for n in nodes
                 if n['tag'] == 'link' and n['attrs'].get('rel') == 'canonical']
    assert canonical == ['https://kingkazuma1015.github.io/yuzin_A_studio/']
    skip = next(n for n in nodes if 'skip-link' in n['attrs'].get('class', '').split())
    assert skip['attrs']['href'].startswith('#')
    assert '®' not in html, 'No invented registered-trademark claim'
    png = (ROOT / 'assets/social-card.png').read_bytes()
    assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1200, 630)

    css = (ROOT / 'style.css').read_text()
    assert 'prefers-reduced-motion' in css, 'Reduced-motion CSS required'
    assert ':focus-visible' in css, 'Keyboard focus styling required'
    assert 'overflow-x:auto' in css.replace(' ', ''), 'Native portfolio horizontal scrolling required'
    assert 'touch-action:pan-x pan-y' in css, 'Touch must preserve native horizontal and vertical panning'
    for url in re.findall(r'url\([\"\']?([^\)\"\']+)', css):
        if not urlparse(url).scheme and not url.startswith('#'):
            assert (ROOT / urlparse(url).path).is_file(), f'Missing CSS asset: {url}'
    plain = re.sub(r'/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '', css)
    depth = 0
    for char in plain:
        depth += (char == '{') - (char == '}')
        assert depth >= 0, 'CSS closing brace without opening brace'
    assert depth == 0, 'Unbalanced CSS blocks'
    # Deliberately generous budgets constrain accidental bundles/data URIs while
    # allowing a custom vector hero. Browser performance remains separate QA.
    sizes = {name: (ROOT / name).stat().st_size for name in ['index.html', 'style.css', 'script.js']}
    assert sizes['index.html'] < 350_000, sizes
    assert sizes['style.css'] < 100_000 and sizes['script.js'] < 100_000, sizes
    print(f'PASS: strict HTML nesting / IDs / ARIA / local assets; semantic landmarks; '
          f'FAQ / dialogs; lazy reserved imagery; keyboard / reduced-motion CSS; source budgets {sizes}')
    return parser.root


if __name__ == '__main__':
    check()
