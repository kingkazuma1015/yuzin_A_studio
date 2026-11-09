/* Optional choreography. Native scrolling, content, links and dialogs remain independent. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!('IntersectionObserver' in window) || typeof root.animate !== 'function') return;
  const all = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const small = window.matchMedia('(max-width: 760px)');
  const hero = document.querySelector('.hero');
  const flow = document.querySelector('.flow-section');
  const steps = all('.flow-list li');
  const animations = new Set();
  const entries = new Map();
  const counters = new Map();
  const inView = new Set();
  let focused = document.hasFocus();
  let active = false;
  let scrollFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let button = null;

  const play = (element, frames, options) => {
    if (!active) return;
    const animation = element.animate(frames, {easing:'cubic-bezier(.2,.75,.2,1)', fill:'backwards', ...options});
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
  };
  const enter = element => {
    const entry = entries.get(element);
    if (!entry || entry.done || !active) return;
    entry.done = true;
    element.classList.add('motion-entered');
    const heading = element.matches('h2');
    play(element, [
      {opacity:0, transform:`translateY(${heading ? 28 : 16}px)`, clipPath:heading ? 'inset(0 0 100% 0)' : 'inset(0)'},
      {opacity:1, transform:'translateY(0)', clipPath:'inset(0)'}
    ], {duration:heading ? 1050 : 850, delay:entry.delay});
  };
  const finishCounter = counter => {
    window.cancelAnimationFrame(counter.frame);
    counter.value.textContent = counter.original;
    counter.frame = 0;
  };
  const count = element => {
    const counter = counters.get(element);
    if (!counter || counter.done || !active) return;
    counter.done = true;
    const start = performance.now();
    const tick = now => {
      if (!active || !inView.has(element)) { finishCounter(counter); return; }
      const progress = Math.min(1, Math.max(0, (now - start) / 1250));
      counter.value.textContent = Math.round(counter.target * (1 - Math.pow(1 - progress, 4))).toLocaleString('en-US');
      if (progress < 1) counter.frame = window.requestAnimationFrame(tick);
      else finishCounter(counter);
    };
    counter.frame = window.requestAnimationFrame(tick);
  };
  const paint = () => {
    scrollFrame = 0;
    if (!active) return;
    if (hero && inView.has(hero)) {
      const scroll = Math.max(0, -hero.getBoundingClientRect().top);
      hero.style.setProperty('--photo-x', `${pointerX}px`);
      hero.style.setProperty('--photo-y', `${Math.min(scroll * (small.matches ? .025 : .055), small.matches ? 12 : 36) + pointerY}px`);
    }
    if (flow && inView.has(flow)) {
      const line = window.innerHeight * .64;
      steps.forEach(step => {
        const box = step.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (line - box.top - 44) / Math.max(1, box.height - 44)));
        step.style.setProperty('--step-progress', progress.toFixed(3));
        step.classList.toggle('motion-step-active', box.top < line);
      });
    }
  };
  const requestPaint = () => {
    if (active && !scrollFrame) scrollFrame = window.requestAnimationFrame(paint);
  };
  const resetButton = () => {
    if (!button) return;
    button.style.removeProperty('--button-x');
    button.style.removeProperty('--button-y');
    button = null;
  };
  const sync = () => {
    active = !reduced.matches && !document.hidden && focused && !document.querySelector('dialog[open]');
    root.classList.toggle('studio-motion', !reduced.matches);
    root.classList.toggle('motion-paused', !active);
    animations.forEach(animation => {
      if (reduced.matches) animation.cancel();
      else if (active) animation.play();
      else animation.pause();
    });
    if (!active) {
      window.cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
      pointerX = pointerY = 0;
      hero?.style.removeProperty('--photo-x');
      hero?.style.removeProperty('--photo-y');
      resetButton();
      counters.forEach(counter => { if (counter.frame) finishCounter(counter); });
    }
    if (reduced.matches) {
      entries.forEach(entry => { entry.done = true; });
      counters.forEach(counter => { counter.done = true; finishCounter(counter); });
      steps.forEach(step => { step.style.removeProperty('--step-progress'); step.classList.remove('motion-step-active'); });
    } else if (active) {
      inView.forEach(element => { enter(element); count(element); });
      requestPaint();
    }
  };

  const observe = new IntersectionObserver(changes => {
    changes.forEach(({target, isIntersecting}) => {
      if (isIntersecting) inView.add(target); else inView.delete(target);
      target.classList.toggle('motion-in-view', isIntersecting);
      if (isIntersecting) { enter(target); count(target); }
      else if (counters.get(target)?.frame) finishCounter(counters.get(target));
    });
    requestPaint();
  }, {threshold:0, rootMargin:'0px 0px -32px 0px'});
  const prepare = (element, delay = 0) => {
    if (entries.has(element)) return;
    entries.set(element, {delay, done:reduced.matches});
    observe.observe(element);
  };
  all('main h2').forEach(element => prepare(element));
  ['.about-points', '.price-table', '.faq-list', '.contact-buttons', '.guide-grid'].forEach(selector => {
    const group = document.querySelector(selector);
    if (group) Array.from(group.children).forEach((element, index) => prepare(element, Math.min(index * 85, 340)));
  });
  all('.section-body>p, .contact>p, .service-row h3, .flow-list h3').forEach(element => prepare(element, 80));
  all('.service-row, .price-row:not(.price-head), .playlist-card').forEach(element => {
    element.classList.add('motion-rule');
    prepare(element);
  });
  all('.about-figures strong').forEach(element => {
    const node = element.firstChild;
    if (!node || node.nodeType !== 3 || !/^[\d,]+$/.test(node.textContent.trim())) return;
    const original = node.textContent.trim();
    const value = document.createElement('span');
    value.className = 'motion-figure';
    value.textContent = original;
    node.replaceWith(value);
    value.style.minWidth = `${value.getBoundingClientRect().width}px`;
    counters.set(element, {value, original, target:Number(original.replaceAll(',', '')), frame:0, done:reduced.matches});
    observe.observe(element);
  });
  [hero, flow, document.querySelector('.service-section')].filter(Boolean).forEach(element => observe.observe(element));
  sync();
  if (active) all('#hero-title>span').forEach((line, index) => play(line, [
    {opacity:0, transform:'translateY(26px)', clipPath:'inset(0 0 100% 0)'},
    {opacity:1, transform:'translateY(0)', clipPath:'inset(0)'}
  ], {duration:1200, delay:120 + index * 160}));

  hero?.addEventListener('pointermove', event => {
    if (!active || !fine.matches || small.matches || event.pointerType !== 'mouse') return;
    const box = hero.getBoundingClientRect();
    pointerX = ((event.clientX - box.left) / box.width - .5) * 14;
    pointerY = ((event.clientY - box.top) / box.height - .5) * 8;
    requestPaint();
  }, {passive:true});
  hero?.addEventListener('pointerleave', () => { pointerX = pointerY = 0; requestPaint(); });
  document.addEventListener('pointermove', event => {
    if (!active || !fine.matches || event.pointerType !== 'mouse') return;
    const target = event.target.closest('.button, .circle-control, .nav-contact');
    if (target !== button) { resetButton(); button = target; }
    if (!button) return;
    const box = button.getBoundingClientRect();
    const clamp = value => Math.max(-3, Math.min(3, value));
    button.style.setProperty('--button-x', `${clamp((event.clientX - box.left - box.width / 2) * .06)}px`);
    button.style.setProperty('--button-y', `${clamp((event.clientY - box.top - box.height / 2) * .1)}px`);
  }, {passive:true});
  document.addEventListener('pointerout', event => { if (button && !button.contains(event.relatedTarget)) resetButton(); });
  window.addEventListener('scroll', requestPaint, {passive:true});
  window.addEventListener('resize', requestPaint);
  window.addEventListener('focus', () => { focused = true; sync(); });
  window.addEventListener('blur', () => { focused = false; sync(); });
  window.addEventListener('pagehide', () => { focused = false; sync(); });
  window.addEventListener('pageshow', () => { focused = document.hasFocus(); sync(); });
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('studio:dialogchange', sync);
  reduced.addEventListener('change', sync);
  fine.addEventListener('change', () => { pointerX = pointerY = 0; resetButton(); requestPaint(); });
  small.addEventListener('change', () => { pointerX = pointerY = 0; requestPaint(); });
})();
