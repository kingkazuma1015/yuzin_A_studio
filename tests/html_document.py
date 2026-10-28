"""Small strict HTML tree parser shared by offline structural and VM tests."""
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
        'meta', 'param', 'source', 'track', 'wbr'}


class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = {'tag': 'document', 'attrs': {}, 'children': []}
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = {'tag': tag, 'attrs': dict(attrs), 'children': []}
        self.stack[-1]['children'].append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        assert self.stack[-1]['tag'] == tag, ('HTML nesting', self.stack[-1]['tag'], tag)
        self.stack.pop()

    def handle_data(self, data):
        node = self.stack[-1]
        node['text'] = node.get('text', '') + data

    def all_nodes(self):
        result = []

        def walk(node):
            result.append(node)
            for child in node['children']:
                walk(child)

        walk(self.root)
        return result
