const year = document.querySelector('#year');
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#global-nav');
const navLinks = document.querySelectorAll('.nav a');
const worksMarquee = document.querySelector('.works-marquee');
const revealSections = document.querySelectorAll('.reveal-section');
const mailModal = document.querySelector('#mail-modal');
const openMailButton = document.querySelector('[data-open-mail]');
const closeMailButtons = document.querySelectorAll('[data-close-mail]');
const mailForm = document.querySelector('.mail-form');

if (year) year.textContent = new Date().getFullYear();

const closeMenu = () => {
  nav.classList.remove('is-open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'メニューを開く');
};
menuToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  menuToggle.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
});
navLinks.forEach((link) => link.addEventListener('click', closeMenu));
const handleMenuEscape = (event) => {
  if (event.key === 'Escape') { closeMenu(); menuToggle.focus(); }
};
nav.addEventListener('keydown', handleMenuEscape);
menuToggle.addEventListener('keydown', handleMenuEscape);
window.matchMedia('(max-width: 760px)').addEventListener('change', closeMenu);
nav.classList.add('is-collapsible');
menuToggle.closest('.site-header').classList.add('has-menu');
menuToggle.hidden = false;

// Content is visible without JavaScript. Only opt into reveal animations after
// the observer is available, and reveal everything when motion is reduced.
const revealMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (revealSections.length && 'IntersectionObserver' in window && !revealMotion.matches) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });
  revealSections.forEach((section) => {
    section.classList.add('reveal-ready');
    revealObserver.observe(section);
  });
  revealMotion.addEventListener('change', () => {
    if (revealMotion.matches) {
      revealSections.forEach((section) => section.classList.add('is-visible'));
      revealObserver.disconnect();
    }
  });
}

if (mailModal && openMailButton && mailForm && typeof mailModal.showModal === 'function') {
  let previousOverflow = '';
  let scrollLocked = false;
  const restoreMailState = () => {
    if (!scrollLocked) return;
    document.body.style.overflow = previousOverflow;
    scrollLocked = false;
    openMailButton.focus({ preventScroll: true });
  };
  const closeMailModal = () => {
    if (!mailModal.open) return;
    mailModal.close();
    restoreMailState();
  };
  openMailButton.addEventListener('click', () => {
    if (mailModal.open) return;
    restoreMailState();
    previousOverflow = document.body.style.overflow;
    mailModal.showModal();
    document.body.style.overflow = 'hidden';
    scrollLocked = true;
    const subjectInput = mailForm.querySelector('input[name="subject"]');
    subjectInput.focus({ preventScroll: true });
    subjectInput.setSelectionRange(subjectInput.value.length, subjectInput.value.length);
    mailModal.scrollTop = 0;
  });
  closeMailButtons.forEach((button) => button.addEventListener('click', closeMailModal));
  mailModal.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const fields = Array.from(mailModal.querySelectorAll('a[href], button, input, textarea, select, [tabindex]'))
      .filter((field) => !field.disabled && field.tabIndex >= 0 && field.getClientRects().length);
    if (!fields.length) { event.preventDefault(); return; }
    const first = fields[0];
    const last = fields[fields.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !fields.includes(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !fields.includes(active))) {
      event.preventDefault();
      first.focus();
    }
  });
  mailModal.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMailModal();
  });
  mailModal.addEventListener('close', () => {
    if (!mailModal.open) restoreMailState();
  });
  // Native modal behavior makes the background inert; explicit Tab wrapping
  // above keeps focus in the dialog. Native Escape and closed-state handling remain.
  mailModal.addEventListener('click', (event) => {
    const rect = mailModal.getBoundingClientRect();
    if (event.target === mailModal && (event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom)) closeMailModal();
  });
  mailForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(mailForm);
    const subject = encodeURIComponent(formData.get('subject') || '');
    const body = encodeURIComponent(String(formData.get('body') || '').replace(/\r?\n/g, '\r\n'));
    window.location.href = `mailto:${formData.get('to')}?subject=${subject}&body=${body}`;
  });
  openMailButton.hidden = false;
}

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

  worksMarquee.setAttribute('role', 'region');
  worksMarquee.setAttribute('aria-live', 'off');
  const modulo = (value, width) => ((value % width) + width) % width;
  const keyboardFocused = () => worksMarquee.contains(document.activeElement)
    && document.activeElement.matches(':focus-visible');
  const canAnimate = () => loopWidth > 0 && !mobileQuery.matches && !motionQuery.matches
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
  worksMarquee.addEventListener('scroll', normalize, { passive: true });
  document.addEventListener('visibilitychange', syncAnimation);
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
}
