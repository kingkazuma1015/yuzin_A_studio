/* YuzinA Studio — progressive enhancement. No analytics, feeds or form submission. */
(() => {
'use strict';
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobile = window.matchMedia('(max-width: 760px)');
const year = $('#year');
if (year) year.textContent = new Date().getFullYear();
document.documentElement.classList.add('js-ready');

// Navigation works as ordinary anchors before enhancement and with JavaScript disabled.
const menuToggle = $('.menu-toggle');
const nav = $('#global-nav');
const header = $('.site-header');
const closeMenu = (restoreFocus = false) => {
  nav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'メニューを開く');
  if (restoreFocus) menuToggle.focus({ preventScroll: true });
};
menuToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
});
$$('a', nav).forEach(link => link.addEventListener('click', () => closeMenu()));
header.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu(true);
});
document.addEventListener('pointerdown', event => {
  if (!header.contains(event.target)) closeMenu();
});
header.addEventListener('focusout', event => {
  if (event.relatedTarget && !header.contains(event.relatedTarget)) closeMenu();
});
mobile.addEventListener('change', () => closeMenu());
nav.classList.add('is-collapsible');
header.classList.add('has-menu');
menuToggle.hidden = false;

// Reveal once. Content is never initially hidden without an observer or in reduced motion.
const reveals = $$('.reveal-section');
if ('IntersectionObserver' in window && !motion.matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -24px 0px' });
  reveals.forEach((section, index) => {
    section.classList.add('reveal-ready');
    section.style.transitionDelay = `${index % 3 * 35}ms`;
    observer.observe(section);
  });
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    reveals.forEach(section => section.classList.add('is-visible'));
    observer.disconnect();
  });
}

// Scroll-bound motion uses one requested frame per scroll, never a continuous render loop.
const hero = $('.hero');
const pageProgress = $('.page-progress');
const navTargets = $$('.nav a').map(link => ({ link, target: $(link.getAttribute('href')) })).filter(item => item.target);
let scrollFrame = 0;
const paintScroll = () => {
  scrollFrame = 0;
  const y = window.scrollY || 0;
  header.classList.toggle('is-pinned', y > 100);
  const max = document.documentElement.scrollHeight - window.innerHeight;
  pageProgress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
  hero.style.setProperty('--hero-shift', `${motion.matches || mobile.matches ? 0 : Math.min(y * .1, 65)}px`);
  hero.style.setProperty('--signal-turn', `${motion.matches || mobile.matches ? 0 : Math.min(y * .035, 24)}deg`);
  let active = null;
  let nearestTop = -Infinity;
  navTargets.forEach(item => {
    const top = item.target.getBoundingClientRect().top;
    if (top <= 150 && top > nearestTop) { active = item; nearestTop = top; }
  });
  navTargets.forEach(item => {
    if (item === active) item.link.setAttribute('aria-current', 'location');
    else item.link.removeAttribute('aria-current');
  });
};
const requestScrollPaint = () => { if (!scrollFrame) scrollFrame = window.requestAnimationFrame(paintScroll); };
window.addEventListener('scroll', requestScrollPaint, { passive: true });
window.addEventListener('resize', requestScrollPaint);
motion.addEventListener('change', requestScrollPaint);
paintScroll();

// Each native dialog owns its focus/overflow state and cleans up on every dismissal path.
const setupDialog = (dialog, closeSelector, onClose = () => {}) => {
  if (!dialog || typeof dialog.showModal !== 'function') return null;
  let opener = null;
  let overflow = '';
  let locked = false;
  const notify = () => document.dispatchEvent(new Event('studio:dialogchange'));
  const restore = () => {
    if (!locked) return;
    document.body.style.overflow = overflow;
    locked = false;
    onClose();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
    notify();
  };
  const close = () => {
    if (!dialog.open) return;
    dialog.close();
    restore();
  };
  $$(closeSelector, dialog).forEach(button => button.addEventListener('click', close));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (!dialog.open) restore(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const fields = $$('a[href], button, input, textarea, select, [tabindex]', dialog)
      .filter(field => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length);
    const first = fields[0], last = fields[fields.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !fields.includes(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !fields.includes(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  return {
    open(trigger, initialFocus) {
      if (dialog.open) return;
      opener = trigger;
      overflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
      locked = true;
      dialog.scrollTop = 0;
      initialFocus?.focus({ preventScroll: true });
      notify();
    }, close
  };
};
const mailModal = $('#mail-modal');
const openMailButton = $('[data-open-mail]');
const mailForm = $('.mail-form');
const mailStatus = $('.mail-status');
const mail = setupDialog(mailModal, '[data-close-mail]');
if (mail && openMailButton && mailForm) {
  const field = name => mailForm.elements.namedItem(name);
  openMailButton.addEventListener('click', () => {
    mailStatus.textContent = '';
    mail.open(openMailButton, field('subject'));
    field('subject').setSelectionRange(field('subject').value.length, field('subject').value.length);
  });
  $$('[data-copy-mail]', mailModal).forEach(button => button.addEventListener('click', async () => {
    const input = field(button.dataset.copyMail);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(input.value);
      mailStatus.textContent = `${button.textContent.replace('をコピー', '')}をコピーしました。`;
    } catch {
      input.focus(); input.select();
      mailStatus.textContent = '自動コピーが使えません。選択された内容を手動でコピーしてください。';
    }
  }));
  mailForm.addEventListener('submit', event => {
    event.preventDefault();
    const subject = encodeURIComponent(field('subject').value || '');
    const body = encodeURIComponent((field('body').value || '').replace(/\r?\n/g, '\r\n'));
    // The recipient is fixed; visitors only edit their subject/body, never submit to a server.
    window.location.href = `mailto:yuzinamix@gmail.com?subject=${subject}&body=${body}`;
  });
  openMailButton.hidden = false;
}

const worksMarquee = $('.works-marquee');
if (worksMarquee) {
  const track = worksMarquee.querySelector('.works-track');
  track.querySelectorAll('.work-card[aria-hidden="true"]').forEach((card) => card.remove());
  const cards = Array.from(track.querySelectorAll('.work-card'));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 760px)');
  const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const dragThreshold = 6;
  let loopStart = 0;
  let loopWidth = 0;
  let loopBuffer = 0;
  let drag = null;
  let suppressClick = false;
  let hovering = false;
  let inView = true;
  let windowActive = true;
  let frame = 0;
  let lastTime = null;
  let fractionalScroll = 0;
  let resizeFrame = 0;
  let measuredWidth = 0;
  let measuredCardWidth = 0;

  const controls = document.querySelector('.works-tools');
  if (controls) controls.hidden = false;
  const step = (direction) => {
    const gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
    const distance = (cards[0].getBoundingClientRect().width + gap) * direction;
    setPosition(worksMarquee.scrollLeft + distance);
    updateCounter();
  };
  document.querySelector('[data-works-prev]')?.addEventListener('click', () => step(-1));
  document.querySelector('[data-works-next]')?.addEventListener('click', () => step(1));
  const updateCounter = () => {
    if (!loopWidth) return;
    const index = Math.round(modulo(worksMarquee.scrollLeft - loopStart, loopWidth) / loopWidth * cards.length) % cards.length;
    const counter = document.querySelector('[data-work-index]');
    if (counter) counter.textContent = String(index + 1).padStart(2, '0');
  };
  worksMarquee.setAttribute('role', 'region');
  worksMarquee.setAttribute('aria-live', 'off');
  const modulo = (value, width) => ((value % width) + width) % width;
  const keyboardFocused = () => worksMarquee.contains(document.activeElement)
    && document.activeElement.matches(':focus-visible');
  const canAnimate = () => !document.querySelector('dialog[open]') && loopWidth > 0 && hoverQuery.matches && !mobileQuery.matches && !motionQuery.matches
    && !hovering && !keyboardFocused() && !drag && inView && windowActive && !document.hidden;

  // Keep a spare viewport on either side. Wrapping before writing avoids the
  // browser clamping a large drag delta at the physical ends of the track.
  const wrappedPosition = (position) => {
    if (!loopWidth) return position;
    if (position < loopStart - loopBuffer || position >= loopStart + loopWidth + loopBuffer) {
      return loopStart + modulo(position - loopStart, loopWidth);
    }
    return position;
  };
  const setPosition = (position) => { worksMarquee.scrollLeft = wrappedPosition(position); };
  const normalize = () => {
    const current = worksMarquee.scrollLeft;
    const next = wrappedPosition(current);
    if (Math.abs(next - current) > 0.5) worksMarquee.scrollLeft = next;
  };
  const advance = (distance) => {
    fractionalScroll += distance;
    const pixels = Math.trunc(fractionalScroll);
    if (pixels) {
      setPosition(worksMarquee.scrollLeft + pixels);
      fractionalScroll -= pixels;
    }
  };
  const animate = (time) => {
    frame = 0;
    if (!canAnimate()) { lastTime = null; return; }
    if (lastTime !== null) advance(34 * Math.min(time - lastTime, 64) / 1000);
    lastTime = time;
    frame = window.requestAnimationFrame(animate);
  };
  const syncAnimation = () => {
    if (canAnimate()) {
      if (!frame) frame = window.requestAnimationFrame(animate);
    } else {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    }
  };
  const pointerInside = (event) => {
    const rect = worksMarquee.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX < rect.right
      && event.clientY >= rect.top && event.clientY < rect.bottom;
  };
  const finishDrag = (event) => {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const ended = drag;
    drag = null;
    if (ended.moved) suppressClick = true;
    worksMarquee.classList.remove('is-dragging');
    if (worksMarquee.hasPointerCapture(ended.id)) worksMarquee.releasePointerCapture(ended.id);
    if (event.clientX !== undefined) hovering = hoverQuery.matches && pointerInside(event);
    fractionalScroll = 0;
    syncAnimation();
  };

  const makeClone = (card, index) => {
    const clone = card.cloneNode(true);
    clone.dataset.loopClone = String(index);
    clone.setAttribute('aria-hidden', 'true');
    clone.setAttribute('tabindex', '-1');
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    clone.querySelectorAll('img').forEach((image) => { image.alt = ''; });
    clone.querySelectorAll('a, button, input, textarea, select, [tabindex]').forEach((node) => {
      node.setAttribute('tabindex', '-1');
    });
    return clone;
  };
  const rebuild = () => {
    resizeFrame = 0;
    if (!cards.length) return;
    const width = worksMarquee.clientWidth;
    const cardWidth = cards[0].getBoundingClientRect().width;
    if (width === measuredWidth && Math.abs(cardWidth - measuredCardWidth) < 0.01) return;
    const phase = loopWidth ? modulo(worksMarquee.scrollLeft - loopStart, loopWidth) / loopWidth : 0;
    if (drag) finishDrag({ pointerId: drag.id });
    track.querySelectorAll('[data-loop-clone]').forEach((card) => card.remove());
    const gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
    const estimatedCycle = (cardWidth + gap) * cards.length;
    const reserve = Math.min(width * 0.5, estimatedCycle * 0.25);
    const copies = Math.max(1, Math.ceil((width + reserve) / estimatedCycle));
    const previous = document.createDocumentFragment();
    const next = document.createDocumentFragment();
    let firstNext = null;
    for (let group = 0; group < copies; group += 1) {
      cards.forEach((card, index) => previous.appendChild(makeClone(card, index)));
      cards.forEach((card, index) => {
        const clone = makeClone(card, index);
        if (!firstNext) firstNext = clone;
        next.appendChild(clone);
      });
    }
    track.insertBefore(previous, cards[0]);
    track.appendChild(next);
    const originalLeft = cards[0].getBoundingClientRect().left;
    loopStart = originalLeft - track.getBoundingClientRect().left;
    loopWidth = firstNext.getBoundingClientRect().left - originalLeft;
    loopBuffer = Math.min(width * 0.5, loopWidth * 0.25);
    worksMarquee.scrollLeft = loopStart + phase * loopWidth;
    measuredWidth = width;
    measuredCardWidth = cardWidth;
    fractionalScroll = 0;
    lastTime = null;
    syncAnimation();
  };
  const requestRebuild = () => {
    if (!resizeFrame) resizeFrame = window.requestAnimationFrame(rebuild);
  };

  worksMarquee.addEventListener('pointerdown', (event) => {
    suppressClick = false;
    // Touch uses native scrolling, preserving horizontal swipe and page pan.
    if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
    if (drag) finishDrag({ pointerId: drag.id });
    // Do not focus an aria-hidden duplicate, but keep its native link click.
    if (event.target.closest('[data-loop-clone]')) event.preventDefault();
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, moved: false };
    fractionalScroll = 0;
    syncAnimation();
  });
  window.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!(event.buttons & 1)) { finishDrag(event); return; }
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= dragThreshold) return;
      drag.moved = true;
      worksMarquee.classList.add('is-dragging');
      worksMarquee.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    // Incremental coordinates survive any number of left/right loop wraps.
    advance(drag.lastX - event.clientX);
    drag.lastX = event.clientX;
  }, { passive: false });
  window.addEventListener('pointerup', finishDrag, true);
  window.addEventListener('pointercancel', finishDrag, true);
  worksMarquee.addEventListener('lostpointercapture', finishDrag);
  worksMarquee.addEventListener('dragstart', (event) => event.preventDefault());
  worksMarquee.addEventListener('click', (event) => {
    if (event.detail !== 0 && suppressClick) {
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    // A click below the drag threshold follows the original anchor normally.
  }, true);
  worksMarquee.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') { hovering = true; syncAnimation(); }
  });
  worksMarquee.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') { hovering = false; syncAnimation(); }
  });
  worksMarquee.addEventListener('focusin', syncAnimation);
  worksMarquee.addEventListener('focusout', () => window.requestAnimationFrame(syncAnimation));
  worksMarquee.addEventListener('scroll', () => { normalize(); updateCounter(); }, { passive: true });
  document.addEventListener('visibilitychange', syncAnimation);
  document.addEventListener('studio:dialogchange', syncAnimation);
  window.addEventListener('blur', () => {
    windowActive = false;
    if (drag) finishDrag({ pointerId: drag.id });
    hovering = false;
    syncAnimation();
  });
  window.addEventListener('focus', () => {
    windowActive = true;
    hovering = hoverQuery.matches && worksMarquee.matches(':hover');
    syncAnimation();
  });
  window.addEventListener('resize', requestRebuild);
  mobileQuery.addEventListener('change', () => { requestRebuild(); syncAnimation(); });
  motionQuery.addEventListener('change', syncAnimation);
  hoverQuery.addEventListener('change', () => {
    hovering = hoverQuery.matches && worksMarquee.matches(':hover');
    syncAnimation();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncAnimation(); });
    observer.observe(worksMarquee);
  }
  if ('ResizeObserver' in window && cards.length) {
    const observer = new ResizeObserver(requestRebuild);
    observer.observe(worksMarquee);
    observer.observe(cards[0]);
  }
  rebuild();
  updateCounter();
}

// Delegate after carousel drag suppression. Ordinary/modified links retain native fallbacks.
const videoModal = $('#video-modal');
const videoFrame = $('.video-frame');
const video = setupDialog(videoModal, '[data-close-video]', () => videoFrame.replaceChildren());
if (video && worksMarquee) {
  worksMarquee.addEventListener('click', event => {
    const card = event.target.closest('.work-card');
    if (!card || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    const source = new URL(card.href);
    const id = source.searchParams.get('v');
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '')) return;
    event.preventDefault();
    const title = $('img', card)?.alt.replace(' のYouTubeサムネイル', '') || card.textContent.trim();
    $('#video-title').textContent = title;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`;
    iframe.title = title;
    iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allowfullscreen', '');
    videoFrame.replaceChildren(iframe);
    $('.video-external').href = card.href;
    const original = $$('.work-card', worksMarquee).find(item => !item.hasAttribute('data-loop-clone') && item.href === card.href);
    video.open(original || card, $('[data-close-video]'));
  });
}
})();
