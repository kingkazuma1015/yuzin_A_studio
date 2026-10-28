// Deliberately small DOM double for deterministic logic tests, not browser QA.
const vm = require('node:vm');

class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(callback);
  }
  removeEventListener(name, callback) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter(x => x !== callback));
  }
  dispatchEvent(event) { event.target ||= this; for (const callback of this.listeners.get(event.type) || []) callback(event); return !event.defaultPrevented; }
  async emit(name, values = {}) {
    const event = { type: name, target: this, currentTarget: this, bubbles: false,
      cancelable: true, defaultPrevented: false, detail: 1, button: 0,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() {}, stopImmediatePropagation() { this.stopped = true; }, ...values };
    for (const callback of this.listeners.get(name) || []) {
      await callback(event);
      if (event.stopped) break;
    }
    return event;
  }
}

function setup(tree, { reduced = false, mobile = false, fine = true, observers = true, dialogs = true } = {}) {
  let doc;
  class Element extends Target {
    constructor(data = { tag: 'div', attrs: {} }) {
      super(); this.tag = data.tag; this.tagName = data.tag.toUpperCase();
      this.attrs = { ...data.attrs }; this.children = []; this.parentElement = null;
      this._text = data.text || ''; this._scrollLeft = 0; this.scrollTop = 0;
      this.dataset = {}; this.style = { overflow: '', setProperty(k, v) { this[k] = String(v); }, removeProperty(k) { delete this[k]; } };
      this.classes = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean));
      this.classList = { add: (...items) => items.forEach(x => this.classes.add(x)),
        remove: (...items) => items.forEach(x => this.classes.delete(x)),
        contains: x => this.classes.has(x),
        toggle: (x, force) => { const next = force === undefined ? !this.classes.has(x) : force;
          next ? this.classes.add(x) : this.classes.delete(x); return next; } };
      for (const [key, value] of Object.entries(this.attrs)) if (key.startsWith('data-')) {
        this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value || '';
      }
      this.hidden = Object.hasOwn(this.attrs, 'hidden'); this.disabled = Object.hasOwn(this.attrs, 'disabled');
      this.open = false; this.value = this.attrs.value ?? this._text;
      this._tabIndex = this.attrs.tabindex === undefined ? undefined : Number(this.attrs.tabindex);
      for (const child of data.children || []) this.appendChild(new Element(child));
      if (!dialogs && this.tag === 'dialog') this.showModal = undefined;
    }
    get textContent() { return this._text + this.children.map(x => x.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    get innerHTML() { return this._text; }
    set innerHTML(value) { this._text = String(value); this.children = []; }
    get parentNode() { return this.parentElement; }
    get childNodes() { return this.children; }
    get firstElementChild() { return this.children[0] || null; }
    get id() { return this.attrs.id || ''; }
    get href() { return this.attrs.href || ''; }
    set href(value) { this.attrs.href = String(value); }
    get src() { return this.attrs.src || ''; }
    set src(value) { this.attrs.src = String(value); }
    get alt() { return this.attrs.alt || ''; }
    set alt(value) { this.attrs.alt = String(value); }
    get tabIndex() { return this._tabIndex ?? (['a', 'button', 'input', 'textarea', 'select'].includes(this.tag) ? 0 : -1); }
    set tabIndex(value) { this._tabIndex = Number(value); }
    get isConnected() { return doc.contains(this); }
    setAttribute(key, value) { this.attrs[key] = String(value); if (key === 'tabindex') this._tabIndex = Number(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    hasAttribute(key) { if (key === 'open') return this.open;
      if (key.startsWith('data-')) return Object.hasOwn(this.dataset, key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
      return Object.hasOwn(this.attrs, key); }
    removeAttribute(key) { delete this.attrs[key]; if (key.startsWith('data-')) delete this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; }
    appendChild(child) { if (child.tag === 'fragment') { for (const entry of child.children.slice()) this.appendChild(entry); return child; }
      child.parentElement = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    prepend(child) { child.parentElement = this; this.children.unshift(child); }
    insertBefore(child, before) { const i = this.children.indexOf(before); const incoming = child.tag === 'fragment' ? child.children.slice() : [child];
      incoming.forEach(node => { node.parentElement = this; }); this.children.splice(i, 0, ...incoming); }
    replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this); this.parentElement = null; }
    serialize() { return { tag: this.tag, attrs: { ...this.attrs, class: [...this.classes].join(' ') }, text: this._text, children: this.children.map(x => x.serialize()) }; }
    cloneNode() { return new Element(this.serialize()); }
    contains(other) { return this === other || this.children.some(x => x.contains(other)); }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(x => this.matches(x.trim()));
      selector = selector.trim();
      // All application selectors are simple/compound selectors or descendants.
      const tokens = selector.match(/(?:\[[^\]]*\]|[^\s])+/g) || [];
      if (tokens.length > 1) {
        if (!this.matches(tokens.pop())) return false;
        let ancestor = this.parentElement;
        while (tokens.length) { const token = tokens.pop(); while (ancestor && !ancestor.matches(token)) ancestor = ancestor.parentElement;
          if (!ancestor) return false; ancestor = ancestor.parentElement; }
        return true;
      }
      let okay = true;
      selector = selector.replace(/:not\(([^)]+)\)/g, (_, inner) => { okay &&= !this.matches(inner); return ''; });
      selector = selector.replace(/:focus-visible|:focus-within|:focus|:hover/g, pseudo => {
        okay &&= pseudo === ':hover' ? !!this.hovered : pseudo === ':focus-within' ? this.contains(doc.activeElement) : doc.activeElement === this;
        return ''; });
      selector = selector.replace(/\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]/g, (_, key, value) => {
        okay &&= this.hasAttribute(key) && (value === undefined || this.getAttribute(key) === value); return ''; });
      selector = selector.replace(/\.([\w-]+)|#([\w-]+)/g, (_, cls, id) => { okay &&= cls ? this.classes.has(cls) : this.id === id; return ''; });
      return okay && (!selector || selector === '*' || selector.toLowerCase() === this.tag);
    }
    querySelectorAll(selector) { return this.children.flatMap(x => [...(x.matches(selector) ? [x] : []), ...x.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getBoundingClientRect() {
      const width = this.classes.has('work-card') ? 420 : this.classes.has('works-marquee') ? this.clientWidth : 600;
      const scroll = doc.querySelector('.works-marquee')?.scrollLeft || 0;
      const left = this.classes.has('work-card') ? this.offsetLeft - scroll : this.classes.has('works-track') ? -scroll : 0;
      return { left, top: this._top ?? 0, right: left + width, bottom: (this._top ?? 0) + 500, width, height: 500 };
    }
    getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
    get offsetLeft() { return this.classes.has('work-card') ? (this.parentElement?.children.indexOf(this) || 0) * 444 : 0; }
    get offsetTop() { return this._top || 0; }
    get offsetWidth() { return this.getBoundingClientRect().width; }
    get clientWidth() { return this.viewportWidth ?? (this.classes.has('works-marquee') ? 1000 : 600); }
    get scrollWidth() { return this.classes.has('works-marquee') ? (this.querySelectorAll('.work-card').length * 444 - 24) : this.clientWidth; }
    get scrollLeft() { return this._scrollLeft; }
    set scrollLeft(value) { this._scrollLeft = Math.max(0, Math.min(value, this.scrollWidth - this.clientWidth)); }
    scrollTo({ left = this.scrollLeft, top = this.scrollTop }) { this.scrollLeft = left; this.scrollTop = top; }
    scrollBy({ left = 0, top = 0 }) { this.scrollTo({ left: this.scrollLeft + left, top: this.scrollTop + top }); }
    scrollIntoView(options) { this.lastScrollIntoView = options; }
    focus() { doc.activeElement = this; }
    select() { this.selected = true; }
    setSelectionRange(a, b) { this.selection = [a, b]; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    setPointerCapture(id) { this.pointerCapture = id; }
    hasPointerCapture(id) { return this.pointerCapture === id; }
    releasePointerCapture(id) { if (this.pointerCapture === id) this.pointerCapture = null; }
    get elements() { return { namedItem: name => this.querySelector(`[name="${name}"]`) }; }
    animate() { return { finished: Promise.resolve(), cancel() {} }; }
  }
  doc = new Element(tree); doc.body = doc.querySelector('body'); doc.documentElement = doc.querySelector('html');
  doc.documentElement.scrollHeight = 6500; doc.activeElement = doc.body; doc.hidden = false; doc.visibilityState = 'visible';
  doc.createElement = tag => new Element({ tag, attrs: {} }); doc.createDocumentFragment = () => new Element({ tag: 'fragment', attrs: {} });
  doc.getElementById = id => doc.querySelector(`#${id}`);
  class Query extends Target { constructor(matches) { super(); this.matches = matches; }
    async set(matches) { this.matches = matches; await this.emit('change', { matches }); } }
  const queries = { motion: new Query(reduced), mobile: new Query(mobile), fine: new Query(fine) };
  const window = new Target(); const frames = new Map(); const timers = new Map(); let nextId = 0;
  const requestAnimationFrame = callback => { frames.set(++nextId, callback); return nextId; };
  const cancelAnimationFrame = id => frames.delete(id);
  const setTimeout = (callback, ms) => { timers.set(++nextId, { callback, ms, repeat: false }); return nextId; };
  const setInterval = (callback, ms) => { timers.set(++nextId, { callback, ms, repeat: true }); return nextId; };
  const clearTimeout = id => timers.delete(id); const clearInterval = clearTimeout;
  Object.assign(window, { document: doc, innerWidth: mobile ? 390 : 1440, innerHeight: 900, scrollY: 0,
    location: { href: 'http://offline.test/' }, matchMedia: text => text.includes('reduced-motion') ? queries.motion : text.includes('max-width') ? queries.mobile : queries.fine,
    requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout, setInterval, clearInterval,
    getComputedStyle: el => ({ columnGap: '24px', gap: '24px', ...el.style }), scrollTo(value) { this.scrollY = value.top || 0; } });
  const intersections = [];
  class IntersectionObserver { constructor(callback, options) { this.callback = callback; this.options = options; this.targets = new Set(); intersections.push(this); }
    observe(target) { this.targets.add(target); } unobserve(target) { this.targets.delete(target); } disconnect() { this.targets.clear(); } }
  class ResizeObserver { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} }
  if (observers) Object.assign(window, { IntersectionObserver, ResizeObserver });
  const copied = []; const navigator = { clipboard: { writeText: async value => copied.push(value) } };
  class FormData { constructor(form) { this.form = form; } get(name) { return this.form.elements.namedItem(name)?.value ?? null; } }
  class Event { constructor(type) { this.type = type; this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } }
  const sandbox = { window, document: doc, navigator, console, Date, URL, URLSearchParams, FormData, Event,
    requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout, setInterval, clearInterval,
    IntersectionObserver, ResizeObserver, getComputedStyle: window.getComputedStyle, performance: { now: () => 0 },
    fetch() { throw new Error('Forbidden network access in offline tests'); } };
  return { doc, window, queries, frames, timers, intersections, copied, navigator,
    run(code) { vm.runInNewContext(code, sandbox); },
    async frame(time = 16) { const current = [...frames.values()]; frames.clear(); for (const callback of current) await callback(time); },
    async tick() { const current = [...timers]; for (const [id, timer] of current) { if (!timer.repeat) timers.delete(id); await timer.callback(); } },
    intersect(target, isIntersecting) { for (const observer of intersections) if (observer.targets.has(target)) observer.callback([{ target, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }]); } };
}

module.exports = { setup };
