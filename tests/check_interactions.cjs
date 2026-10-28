// Offline deterministic logic tests. Real browser/device/visual QA is separate.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { setup } = require('./dom_environment.cjs');
const tree = JSON.parse(fs.readFileSync(0, 'utf8'));
const code = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const q = (env, selector) => env.doc.querySelector(selector);
const qa = (env, selector) => env.doc.querySelectorAll(selector);
const boot = options => { const env = setup(tree, options); env.run(code); return env; };
const settle = async env => { await env.frame(100); await env.frame(164); };

(async () => {
  // Desktop loops retain exactly nine accessible originals; clones never enter tab order.
  const env = boot();
  const gallery = q(env, '.works-marquee');
  const original = qa(env, '.work-card').filter(card => !card.hasAttribute('data-loop-clone'));
  assert.equal(original.length, 9);
  assert.equal(qa(env, '.work-card').length, 27);
  for (const clone of qa(env, '[data-loop-clone]')) {
    assert.equal(clone.getAttribute('aria-hidden'), 'true'); assert.equal(clone.tabIndex, -1);
    assert.equal(clone.querySelector('img').alt, '');
  }
  assert.equal(env.frames.size, 1, 'Only one carousel animation frame pending');
  const initial = gallery.scrollLeft; await settle(env); assert.ok(gallery.scrollLeft > initial);
  assert.equal(env.frames.size, 1);
  await gallery.emit('pointerenter', { pointerType: 'mouse' }); assert.equal(env.frames.size, 0);
  await gallery.emit('pointerleave', { pointerType: 'mouse' }); assert.equal(env.frames.size, 1);
  original[0].focus(); await gallery.emit('focusin'); assert.equal(env.frames.size, 0);
  env.doc.activeElement = env.doc.body; await gallery.emit('focusout'); await env.frame(); assert.equal(env.frames.size, 1);
  env.intersect(gallery, false); assert.equal(env.frames.size, 0);
  env.intersect(gallery, true); assert.equal(env.frames.size, 1);
  env.doc.hidden = true; await env.doc.emit('visibilitychange'); assert.equal(env.frames.size, 0);
  env.doc.hidden = false; await env.doc.emit('visibilitychange'); assert.equal(env.frames.size, 1);
  await env.window.emit('blur'); assert.equal(env.frames.size, 0);
  await env.window.emit('focus'); assert.equal(env.frames.size, 1);
  for (let cycle = 0; cycle < 3; cycle++) {
    await env.queries.motion.set(true); await settle(env); assert.equal(env.frames.size, 0);
    assert.ok(qa(env, '.reveal-section').every(section => section.classList.contains('is-visible')));
    await env.queries.motion.set(false); await settle(env); assert.equal(env.frames.size, 1);
    await env.queries.mobile.set(true); await settle(env); assert.equal(env.frames.size, 0);
    await env.queries.mobile.set(false); await settle(env); assert.equal(env.frames.size, 1);
    await env.queries.fine.set(false); await settle(env); assert.equal(env.frames.size, 0, 'Coarse pointers must not auto-scroll');
    await env.queries.fine.set(true); await settle(env); assert.equal(env.frames.size, 1);
    assert.equal(qa(env, '.work-card').length, 27, 'No clones accumulate across media changes');
  }
  const beforeNext = gallery.scrollLeft;
  await q(env, '[data-works-next]').emit('click'); assert.ok(gallery.scrollLeft > beforeNext);
  await q(env, '[data-works-prev]').emit('click'); assert.ok(Math.abs(gallery.scrollLeft - beforeNext) < 1);
  const touch = await gallery.emit('pointerdown', { pointerType: 'touch', isPrimary: true, pointerId: 7, clientX: 300, clientY: 20 });
  assert.equal(touch.defaultPrevented, false, 'Touch must retain native panning');
  assert.equal(gallery.pointerCapture, undefined);
  await gallery.emit('pointerdown', { pointerType: 'mouse', isPrimary: true, pointerId: 8, clientX: 300, clientY: 20, target: original[0] });
  const drag = await env.window.emit('pointermove', { pointerId: 8, buttons: 1, clientX: -10000, clientY: 20 });
  assert.equal(drag.defaultPrevented, true); assert.equal(gallery.pointerCapture, 8);
  assert.ok(gallery.scrollLeft > 0 && gallery.scrollLeft < gallery.scrollWidth - gallery.clientWidth, 'Large drag wraps rather than clamps');
  await env.window.emit('pointerup', { pointerId: 8, clientX: -10000, clientY: 20 });
  assert.equal(gallery.classList.contains('is-dragging'), false);
  const suppressed = await gallery.emit('click', { target: original[0], detail: 1 });
  assert.equal(suppressed.defaultPrevented, true); assert.equal(q(env, '#video-modal').open, false);
  console.log('PASS: nine accessible works / hidden clones; continuous bidirectional movement; hover, focus, offscreen, hidden, blur, reduced-motion, mobile and coarse-pointer guards; native touch; large-drag wrapping and click suppression');

  // Real anchor fallbacks and opt-in privacy-enhanced video, never autoplay.
  const videoModal = q(env, '#video-modal');
  const videoClose = q(env, '[data-close-video]');
  const videoFrame = q(env, '.video-frame');
  const modified = await gallery.emit('click', { target: original[7], ctrlKey: true });
  assert.equal(modified.defaultPrevented, false); assert.equal(videoModal.open, false);
  for (const card of [original[0], original[7], original[8]]) {
    const opened = await gallery.emit('click', { target: card, detail: 0 });
    assert.equal(opened.defaultPrevented, true); assert.equal(videoModal.open, true);
    assert.equal(env.doc.activeElement, videoClose); assert.equal(env.doc.body.style.overflow, 'hidden');
    assert.equal(videoFrame.children.length, 1);
    const iframe = videoFrame.children[0];
    assert.match(iframe.src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?autoplay=0&rel=0$/);
    assert.ok(iframe.title); assert.ok(!iframe.allow.includes('autoplay'));
    assert.equal(q(env, '.video-external').href, card.href);
    await videoModal.emit('cancel');
    assert.equal(videoModal.open, false); assert.equal(videoFrame.children.length, 0);
    assert.equal(env.doc.body.style.overflow, ''); assert.equal(env.doc.activeElement, card);
  }
  await gallery.emit('click', { target: original[1] }); await videoClose.emit('click');
  assert.equal(videoFrame.children.length, 0);
  await gallery.emit('click', { target: original[2] }); await videoModal.emit('click', { clientX: -10, clientY: -10 });
  assert.equal(videoModal.open, false); assert.equal(videoFrame.children.length, 0);
  console.log('PASS: modified native link behavior; repeated video opens including KING / 東京駅; click-to-load no-autoplay embed; Escape, button and backdrop teardown / focus restoration');

  // Menu reset, Escape/outside/focus dismissal and section-order-aware current nav.
  const menu = q(env, '.menu-toggle'); const nav = q(env, '#global-nav'); const header = q(env, '.site-header');
  assert.equal(menu.hidden, false);
  for (let cycle = 0; cycle < 3; cycle++) {
    await menu.emit('click'); assert.equal(menu.getAttribute('aria-expanded'), 'true');
    await header.emit('keydown', { key: 'Escape' }); assert.equal(menu.getAttribute('aria-expanded'), 'false'); assert.equal(env.doc.activeElement, menu);
    await menu.emit('click'); await env.doc.emit('pointerdown', { target: env.doc.body }); assert.equal(nav.classList.contains('is-open'), false);
    await menu.emit('click'); await header.emit('focusout', { relatedTarget: env.doc.body }); assert.equal(menu.getAttribute('aria-expanded'), 'false');
    await menu.emit('click'); await env.queries.mobile.set(!env.queries.mobile.matches); assert.equal(menu.getAttribute('aria-expanded'), 'false');
  }
  await menu.emit('click'); await nav.querySelector('a').emit('click'); assert.equal(menu.getAttribute('aria-expanded'), 'false');
  for (const node of qa(env, '.nav a')) q(env, node.href)._top = 2000;
  q(env, '#works')._top = -1800; q(env, '#about')._top = 100;
  env.window.scrollY = 900; await env.window.emit('scroll'); await env.frame();
  assert.equal(q(env, '.nav a[href="#about"]').getAttribute('aria-current'), 'location', 'Active section follows page order, not nav order');
  assert.equal(q(env, '.nav a[href="#works"]').getAttribute('aria-current'), null);
  assert.equal(header.classList.contains('is-pinned'), true);
  await env.queries.motion.set(true); await env.frame(); assert.equal(q(env, '.hero').style['--hero-shift'], '0px');
  console.log('PASS: repeated mobile menu flows / focus / Escape / outside dismissal; pinned header; active-section order; reduced-motion parallax');

  // Mail only prepares a local mailto; no message is sent by this website.
  const opener = q(env, '[data-open-mail]'); const modal = q(env, '#mail-modal');
  const close = q(env, '[data-close-mail]'); const form = q(env, '.mail-form'); const status = q(env, '.mail-status');
  const field = name => form.elements.namedItem(name);
  assert.equal(opener.hidden, false);
  for (let cycle = 0; cycle < 3; cycle++) {
    await opener.emit('click'); assert.equal(modal.open, true); assert.equal(env.doc.activeElement, field('subject'));
    assert.equal(env.doc.body.style.overflow, 'hidden'); await close.emit('click');
    assert.equal(modal.open, false); assert.equal(env.doc.body.style.overflow, ''); assert.equal(env.doc.activeElement, opener);
  }
  await opener.emit('click'); field('body').value = '日本語 & ?\n現在の本文';
  const copies = qa(env, '[data-copy-mail]');
  for (const button of copies) await button.emit('click');
  assert.deepEqual(env.copied, ['yuzinamix@gmail.com', 'MIX依頼の相談', field('body').value]);
  env.navigator.clipboard.writeText = async () => { throw new Error('Permission denied'); };
  await copies[2].emit('click'); assert.equal(field('body').selected, true); assert.equal(env.doc.activeElement, field('body'));
  assert.match(status.textContent, /自動コピーが使えません/);
  env.navigator.clipboard = undefined; await copies[0].emit('click'); assert.equal(field('to').selected, true);
  copies[2].focus(); const forwardTab = await modal.emit('keydown', { key: 'Tab' });
  assert.equal(forwardTab.defaultPrevented, true); assert.equal(env.doc.activeElement, close);
  const backTab = await modal.emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(backTab.defaultPrevented, true); assert.equal(env.doc.activeElement, copies[2]);
  field('subject').value = '日本語 & ?'; field('to').value = 'not-authorized@example.invalid';
  const submitted = await form.emit('submit'); assert.equal(submitted.defaultPrevented, true);
  assert.match(env.window.location.href, /^mailto:yuzinamix@gmail.com\?subject=/);
  const params = new URLSearchParams(env.window.location.href.split('?')[1]);
  assert.equal(params.get('subject'), '日本語 & ?'); assert.equal(params.get('body'), '日本語 & ?\r\n現在の本文');
  await modal.emit('cancel'); assert.equal(modal.open, false); assert.equal(env.doc.activeElement, opener); assert.equal(env.doc.body.style.overflow, '');
  await opener.emit('click'); await modal.emit('click', { clientX: -1, clientY: -1 }); assert.equal(modal.open, false);
  console.log('PASS: repeated mail open/close; focus trapping / Escape / backdrop / overflow; clipboard success, denied and absent fallbacks; fixed recipient and safely encoded mailto');

  // Optional APIs absent: no hidden content or broken original destinations.
  const fallback = boot({ observers: false, dialogs: false, reduced: true, mobile: true });
  assert.ok(qa(fallback, '.reveal-section').every(section => !section.classList.contains('reveal-ready')));
  assert.equal(q(fallback, '[data-open-mail]').hidden, true);
  const fallbackLink = qa(fallback, '.work-card').find(card => !card.hasAttribute('data-loop-clone'));
  const nativeClick = await q(fallback, '.works-marquee').emit('click', { target: fallbackLink });
  assert.equal(nativeClick.defaultPrevented, false); assert.equal(q(fallback, '#video-modal').open, false);
  assert.equal(qa(fallback, 'iframe').length, 0); assert.equal(fallback.frames.size, 0);
  assert.ok(q(fallback, 'a[href="mailto:yuzinamix@gmail.com"]'));
  console.log('PASS: optional observer/dialog APIs absent; reduced-motion mobile startup; static content/contact/video-link fallbacks; no automatic iframe loading');
})().catch(error => { console.error(error); process.exit(1); });
