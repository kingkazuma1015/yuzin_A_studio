"""Dependency-light structural checks. Run: python3 tests/check_site.py"""
from pathlib import Path
from html.parser import HTMLParser
import json, re, struct, subprocess
root=Path(__file__).resolve().parents[1]
class Document(HTMLParser):
    def __init__(self):
        super().__init__(); self.root={'tag':'document','attrs':{},'children':[]}; self.stack=[self.root]
    def handle_starttag(self,tag,attrs):
        node={'tag':tag,'attrs':dict(attrs),'children':[]}
        self.stack[-1]['children'].append(node)
        if tag not in {'meta','link','img','input','br','hr'}: self.stack.append(node)
    def handle_endtag(self,tag):
        assert self.stack[-1]['tag']==tag, (self.stack[-1]['tag'],tag)
        self.stack.pop()
    def handle_data(self,data):
        self.stack[-1]['text']=self.stack[-1].get('text','')+data
p=Document(); html=(root/'index.html').read_text(); p.feed(html)
assert len(p.stack)==1
nodes=[]
def walk(node):
    nodes.append(node)
    for child in node['children']: walk(child)
walk(p.root)
ids=[n['attrs']['id'] for n in nodes if 'id' in n['attrs']]
assert len(ids)==len(set(ids)), 'Duplicate IDs'
for node in nodes:
    a=node['attrs']
    for key in ['aria-controls','aria-labelledby','aria-describedby']:
        for ref in (a.get(key) or '').split(): assert ref in ids, (key,ref)
    if a.get('href','').startswith('#'): assert a['href'][1:] in ids
    for key in ['src','href']:
        value=a.get(key,'')
        if value and not value.startswith(('http:','https:','#','mailto:')): assert (root/value).is_file(), value
    if a.get('target')=='_blank': assert 'noopener' in a.get('rel','')
cards=[n for n in nodes if 'work-card' in n['attrs'].get('class','').split()]
assert len(cards)==7 and len({n['attrs']['href'] for n in cards})==7
expected=['nPdiQRCIZgU','ff8gzBQj97k','C5pBFTSH80U','NhQCRpMjMsk','x0Gb0TiSjYA','FeaVQIexvTI','D45YV-ZJ2Yc']
assert [n['attrs']['href'].split('=')[-1] for n in cards]==expected
assert len([n for n in nodes if n['tag']=='dialog'])==1
assert '¥15,000（MIX込み総額）' in html
assert '音源とご入金が揃ってから' in html
for name in ['og:image','twitter:image']:
    match=next(n for n in nodes if n['attrs'].get('property',n['attrs'].get('name'))==name)
    assert match['attrs']['content']=='https://kingkazuma1015.github.io/yuzin_A_studio/assets/social-card.png'
png=(root/'assets/social-card.png').read_bytes()
assert png[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',png[16:24])==(1200,630)
css=(root/'style.css').read_text()
for url in re.findall(r'url\([\"\']?([^\)\"\']+)',css): assert (root/url).is_file(), url
assert 'is-vertical-works' not in css and '--work-rotate' not in css
# Check balanced rule/declaration blocks (not a CSS rendering test).
plain=re.sub(r'/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', '',css)
depth=0
for c in plain:
    depth+=(c=='{')-(c=='}'); assert depth>=0
assert depth==0
print('PASS: HTML nesting, IDs, local references, seven original videos, confirmed business text, social PNG, CSS blocks')
subprocess.run(['node','--check',str(root/'script.js')],check=True)
subprocess.run(['node',str(root/'tests/check_interactions.cjs')],input=json.dumps(p.root),text=True,check=True)
