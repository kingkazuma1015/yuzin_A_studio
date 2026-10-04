const year = document.querySelector("#year");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#global-nav");
const mobileQuery = window.matchMedia("(max-width: 760px)");
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

if (year) year.textContent = new Date().getFullYear();

const closeMenu = () => {
  nav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "メニューを開く");
};
menuToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "メニューを閉じる" : "メニューを開く");
});
nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
mobileQuery.addEventListener("change", closeMenu);
nav.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mobileQuery.matches) {
    closeMenu();
    menuToggle.focus();
  }
});

const revealSections = document.querySelectorAll(".reveal-section");
if ("IntersectionObserver" in window && !motionQuery.matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  revealSections.forEach((section) => {
    section.classList.add("reveal-ready");
    observer.observe(section);
  });
  motionQuery.addEventListener("change", () => {
    if (motionQuery.matches) {
      revealSections.forEach((section) => section.classList.add("is-visible"));
      observer.disconnect();
    }
  });
}

const mailDialog = document.querySelector("#mail-modal");
const openMailButton = document.querySelector("[data-open-mail]");
const mailForm = document.querySelector(".mail-form");
if (mailDialog && openMailButton && mailForm) {
  const status = mailForm.querySelector(".mail-status");
  let previousOverflow = "";
  openMailButton.addEventListener("click", () => {
    if (mailDialog.open) return;
    status.textContent = "";
    previousOverflow = document.body.style.overflow;
    // A modal native dialog keeps the rest of the document inert and restores focus.
    mailDialog.showModal();
    document.body.style.overflow = "hidden";
    const subject = mailForm.elements.namedItem("subject");
    subject.focus();
    subject.setSelectionRange(subject.value.length, subject.value.length);
  });
  mailDialog.querySelector("[data-close-mail]").addEventListener("click", () => mailDialog.close());
  mailDialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    openMailButton.focus();
  });
  mailDialog.addEventListener("click", (event) => {
    if (event.target !== mailDialog) return;
    const rect = mailDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      mailDialog.close();
    }
  });
  mailDialog.querySelectorAll("[data-copy-mail]").forEach((button) => {
    button.addEventListener("click", async () => {
      const field = mailForm.elements.namedItem(button.dataset.copyMail);
      const label = { to: "宛先", subject: "件名", body: "本文" }[button.dataset.copyMail];
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(field.value);
        status.textContent = `${label}をコピーしました。メールサービスに貼り付けてください。`;
      } catch {
        field.focus();
        field.select();
        status.textContent = `自動コピーが使えません。選択した${label}を長押し、またはコピー操作でコピーしてください。`;
      }
    });
  });
  mailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const to = mailForm.elements.namedItem("to").value;
    const subject = encodeURIComponent(mailForm.elements.namedItem("subject").value);
    const body = encodeURIComponent(mailForm.elements.namedItem("body").value.replace(/\r?\n/g, "\r\n"));
    status.textContent = "メールアプリで内容を確認して送信してください。開かない場合はコピー機能をご利用ください。";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}

const gallery = document.querySelector(".works-marquee");
if (gallery) {
  const track = gallery.querySelector(".works-track");
  const cards = Array.from(track.querySelectorAll(".work-card"));
  const prevButton = document.querySelector("[data-works-prev]");
  const nextButton = document.querySelector("[data-works-next]");
  const pauseButton = document.querySelector("[data-works-pause]");
  let loopEnabled = false;
  let loopStart = 0;
  let loopWidth = 0;
  let userPaused = false;
  let hovered = false;
  let focused = false;
  let inView = true;
  let frame = 0;
  let lastTime = 0;
  let drag = null;
  let suppressClickUntil = 0;

  const updateButtons = () => {
    prevButton.disabled = !loopEnabled && gallery.scrollLeft <= 1;
    nextButton.disabled = !loopEnabled && gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 1;
    pauseButton.hidden = !loopEnabled;
    pauseButton.setAttribute("aria-pressed", String(userPaused));
    pauseButton.textContent = userPaused ? "自動スクロールを再開" : "自動スクロールを停止";
  };
  const normalize = () => {
    if (!loopEnabled || !loopWidth || focused) return;
    if (gallery.scrollLeft >= loopStart + loopWidth) gallery.scrollLeft -= loopWidth;
    else if (gallery.scrollLeft < loopStart) gallery.scrollLeft += loopWidth;
  };
  const canAnimate = () => loopEnabled && !userPaused && !hovered && !focused && !drag && inView && !document.hidden;
  const animate = (time) => {
    frame = 0;
    if (!canAnimate()) { lastTime = 0; return; }
    if (lastTime) gallery.scrollLeft += 34 * Math.min(time - lastTime, 64) / 1000;
    lastTime = time;
    normalize();
    frame = window.requestAnimationFrame(animate);
  };
  const syncAnimation = () => {
    if (canAnimate() && !frame) frame = window.requestAnimationFrame(animate);
    else if (!canAnimate()) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    }
  };
  const pauseForInteraction = () => {
    userPaused = true;
    syncAnimation();
    updateButtons();
  };
  const shouldLoop = () => {
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth;
    return !mobileQuery.matches && !motionQuery.matches && pointerQuery.matches && gallery.clientWidth < step * cards.length;
  };
  const measure = () => {
    loopStart = loopEnabled ? cards[0].offsetLeft : 0;
    const nextClone = track.querySelector("[data-loop-next]");
    loopWidth = nextClone ? nextClone.offsetLeft - loopStart : 0;
    updateButtons();
  };
  const configureGallery = () => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    drag = null;
    gallery.classList.remove("is-dragging");
    // CSS controls the mobile layout; mode changes rebuild only desktop loop copies.
    track.querySelectorAll("[data-loop-clone]").forEach((card) => card.remove());
    loopEnabled = shouldLoop();
    if (loopEnabled) {
      const cloneGroup = (next) => {
        const fragment = document.createDocumentFragment();
        cards.forEach((card, index) => {
          const clone = card.cloneNode(true);
          clone.dataset.loopClone = "";
          if (next && index === 0) clone.dataset.loopNext = "";
          clone.setAttribute("aria-hidden", "true");
          clone.setAttribute("tabindex", "-1");
          clone.querySelector("img").alt = "";
          fragment.appendChild(clone);
        });
        return fragment;
      };
      track.prepend(cloneGroup(false));
      track.append(cloneGroup(true));
    }
    measure();
    const focusedCard = cards.find((card) => card === document.activeElement);
    gallery.scrollLeft = focusedCard ? focusedCard.offsetLeft : loopStart;
    updateButtons();
    syncAnimation();
  };
  [mobileQuery, motionQuery, pointerQuery].forEach((query) => query.addEventListener("change", configureGallery));
  window.addEventListener("resize", () => {
    if (loopEnabled !== shouldLoop()) configureGallery();
    else { measure(); normalize(); }
  });
  window.addEventListener("load", measure);
  document.addEventListener("visibilitychange", syncAnimation);
  gallery.addEventListener("mouseenter", () => { hovered = true; syncAnimation(); });
  gallery.addEventListener("mouseleave", () => { hovered = false; syncAnimation(); });
  gallery.addEventListener("focusin", () => { focused = true; syncAnimation(); });
  gallery.addEventListener("focusout", (event) => {
    if (!gallery.contains(event.relatedTarget)) { focused = false; syncAnimation(); }
  });
  gallery.addEventListener("wheel", pauseForInteraction, { passive: true });
  gallery.addEventListener("scroll", updateButtons, { passive: true });
  const moveGallery = (direction) => {
    pauseForInteraction();
    normalize();
    const step = cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : cards[0].offsetWidth;
    gallery.scrollBy({ left: direction * step, behavior: motionQuery.matches || loopEnabled ? "auto" : "smooth" });
  };
  prevButton.addEventListener("click", () => moveGallery(-1));
  nextButton.addEventListener("click", () => moveGallery(1));
  pauseButton.addEventListener("click", () => {
    userPaused = !userPaused;
    updateButtons();
    syncAnimation();
  });
  // Keep touch scrolling native. Mouse dragging never hijacks normal link clicks.
  gallery.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    pauseForInteraction();
    drag = { id: event.pointerId, startX: event.clientX, scrollLeft: gallery.scrollLeft, moved: false };
  });
  gallery.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 6 && !drag.moved) {
      drag.moved = true;
      gallery.setPointerCapture(event.pointerId);
      gallery.classList.add("is-dragging");
    }
    if (drag.moved) gallery.scrollLeft = drag.scrollLeft - distance;
  });
  const stopDrag = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) suppressClickUntil = Date.now() + 250;
    if (gallery.hasPointerCapture(event.pointerId)) gallery.releasePointerCapture(event.pointerId);
    drag = null;
    gallery.classList.remove("is-dragging");
    normalize();
    syncAnimation();
  };
  gallery.addEventListener("pointerup", stopDrag);
  gallery.addEventListener("pointercancel", stopDrag);
  window.addEventListener("pointerup", stopDrag);
  gallery.addEventListener("click", (event) => {
    if (event.detail !== 0 && Date.now() < suppressClickUntil) event.preventDefault();
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; syncAnimation(); });
    observer.observe(gallery);
  }
  configureGallery();
}
