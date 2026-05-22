const year = document.querySelector("#year");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector("#global-nav");
const navLinks = document.querySelectorAll(".nav a");
const worksMarquee = document.querySelector(".works-marquee");
const revealSections = document.querySelectorAll(".reveal-section");
const mailModal = document.querySelector("#mail-modal");
const openMailButton = document.querySelector("[data-open-mail]");
const closeMailButtons = document.querySelectorAll("[data-close-mail]");
const mailForm = document.querySelector(".mail-form");

year.textContent = new Date().getFullYear();

menuToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

if (revealSections.length) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  revealSections.forEach((section) => {
    revealObserver.observe(section);
  });
}

if (mailModal && openMailButton && mailForm) {
  let closeMailTimer = null;

  const openMailModal = () => {
    window.clearTimeout(closeMailTimer);
    mailModal.classList.add("is-open");
    mailModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const subjectInput = mailForm.querySelector('input[name="subject"]');

    window.setTimeout(() => {
      subjectInput.focus();
      subjectInput.setSelectionRange(subjectInput.value.length, subjectInput.value.length);
    }, 120);
  };

  const closeMailModal = () => {
    mailModal.classList.remove("is-open");
    mailModal.setAttribute("aria-hidden", "true");
    closeMailTimer = window.setTimeout(() => {
      document.body.style.overflow = "";
      openMailButton.focus();
    }, 320);
  };

  openMailButton.addEventListener("click", openMailModal);

  closeMailButtons.forEach((button) => {
    button.addEventListener("click", closeMailModal);
  });

  mailModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMailModal();
    }
  });

  mailForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(mailForm);
    const to = formData.get("to");
    const subject = encodeURIComponent(formData.get("subject") || "");
    const body = encodeURIComponent(formData.get("body") || "");

    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}

if (worksMarquee) {
  const track = worksMarquee.querySelector(".works-track");
  track.querySelectorAll(".work-card[aria-hidden='true']").forEach((card) => card.remove());
  const originalCards = Array.from(track.querySelectorAll(".work-card"));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobileWorks = window.matchMedia("(max-width: 760px)").matches;

  if (isMobileWorks) {
    worksMarquee.classList.add("is-vertical-works");

    let ticking = false;

    const updateVerticalDepth = () => {
      const marqueeRect = worksMarquee.getBoundingClientRect();
      const centerY = marqueeRect.top + marqueeRect.height / 2;

      originalCards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const cardCenterY = cardRect.top + cardRect.height / 2;
        const distance = (cardCenterY - centerY) / marqueeRect.height;
        const absDistance = Math.min(Math.abs(distance), 1);
        const scale = 1.02 - absDistance * 0.22;
        const translateZ = 110 - absDistance * 160;
        const rotateX = distance * -16;
        const opacity = 1 - absDistance * 0.38;
        const shadow = 0.22 - absDistance * 0.12;

        card.style.setProperty("--work-scale", scale.toFixed(3));
        card.style.setProperty("--work-z", `${translateZ.toFixed(1)}px`);
        card.style.setProperty("--work-rotate", `${rotateX.toFixed(1)}deg`);
        card.style.setProperty("--work-opacity", opacity.toFixed(3));
        card.style.setProperty("--work-shadow", shadow.toFixed(3));
        card.style.zIndex = String(Math.round((1 - absDistance) * 100));
      });

      ticking = false;
    };

    const requestDepthUpdate = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateVerticalDepth);
        ticking = true;
      }
    };

    worksMarquee.addEventListener("scroll", requestDepthUpdate, { passive: true });
    window.addEventListener("resize", requestDepthUpdate);
    window.addEventListener("load", requestDepthUpdate);
    requestDepthUpdate();
  } else {
  const previousCards = originalCards.map((card) => card.cloneNode(true));
  const nextCards = originalCards.map((card) => card.cloneNode(true));
  let isDragging = false;
  let isHovering = false;
  let dragStarted = false;
  let startX = 0;
  let startScrollLeft = 0;
  let lastTimestamp = 0;
  let lastPointerX = 0;
  let lastPointerTime = 0;
  let inertiaVelocity = 0;
  let pressedCard = null;
  let loopStart = 0;
  let loopWidth = 0;
  let loopBuffer = 0;
  const autoSpeed = prefersReducedMotion ? 0 : 34;
  const friction = 0.0045;

  const prepareClone = (card) => {
    card.setAttribute("aria-hidden", "true");
    card.setAttribute("tabindex", "-1");
    card.querySelectorAll("img").forEach((image) => {
      image.alt = "";
    });
  };

  previousCards.forEach(prepareClone);
  nextCards.forEach(prepareClone);

  const previousFragment = document.createDocumentFragment();
  const nextFragment = document.createDocumentFragment();

  previousCards.forEach((card) => previousFragment.appendChild(card));
  nextCards.forEach((card) => nextFragment.appendChild(card));
  track.insertBefore(previousFragment, track.firstChild);
  track.appendChild(nextFragment);

  const updateLoopWidth = () => {
    const firstOriginalCard = originalCards[0];
    const firstNextCard = nextCards[0];

    if (!firstOriginalCard || !firstNextCard) {
      loopStart = 0;
      loopWidth = track.scrollWidth / 3;
      return;
    }

    loopStart = firstOriginalCard.offsetLeft;
    loopWidth = firstNextCard.offsetLeft - loopStart;
    loopBuffer = Math.min(worksMarquee.clientWidth * 0.55, loopWidth * 0.24);

    if (worksMarquee.scrollLeft < loopStart || worksMarquee.scrollLeft >= loopStart + loopWidth) {
      worksMarquee.scrollLeft = loopStart;
    }
  };

  const normalizeScroll = () => {
    if (!loopWidth) {
      return;
    }

    if (worksMarquee.scrollLeft >= loopStart + loopWidth + loopBuffer) {
      worksMarquee.scrollLeft -= loopWidth;
    } else if (worksMarquee.scrollLeft < loopStart - loopBuffer) {
      worksMarquee.scrollLeft += loopWidth;
    }
  };

  const normalizeDragScroll = () => {
    if (!loopWidth) {
      return;
    }

    if (worksMarquee.scrollLeft >= loopStart + loopWidth + loopBuffer) {
      worksMarquee.scrollLeft -= loopWidth;
      startScrollLeft -= loopWidth;
    } else if (worksMarquee.scrollLeft < loopStart - loopBuffer) {
      worksMarquee.scrollLeft += loopWidth;
      startScrollLeft += loopWidth;
    }
  };

  const animateWorks = (timestamp) => {
    if (!lastTimestamp) {
      lastTimestamp = timestamp;
    }

    const elapsed = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    if (!isDragging && Math.abs(inertiaVelocity) > 0.02) {
      worksMarquee.scrollLeft += inertiaVelocity * elapsed;
      inertiaVelocity *= Math.exp(-friction * elapsed);
      normalizeScroll();
    } else if (!isDragging && !isHovering) {
      inertiaVelocity = 0;
      worksMarquee.scrollLeft += (autoSpeed * elapsed) / 1000;
      normalizeScroll();
    }

    window.requestAnimationFrame(animateWorks);
  };

  updateLoopWidth();
  window.addEventListener("resize", updateLoopWidth);
  window.addEventListener("load", updateLoopWidth);
  window.requestAnimationFrame(animateWorks);

  worksMarquee.addEventListener("pointerdown", (event) => {
    normalizeScroll();

    isDragging = true;
    dragStarted = false;
    pressedCard = event.target.closest(".work-card");
    inertiaVelocity = 0;
    startX = event.clientX;
    startScrollLeft = worksMarquee.scrollLeft;
    lastPointerX = event.clientX;
    lastPointerTime = event.timeStamp;
    worksMarquee.classList.add("is-dragging");
    worksMarquee.setPointerCapture(event.pointerId);
  });

  worksMarquee.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    const moveX = event.clientX - startX;
    const elapsed = event.timeStamp - lastPointerTime;

    if (Math.abs(moveX) > 6) {
      dragStarted = true;
    }

    worksMarquee.scrollLeft = startScrollLeft - moveX;

    if (elapsed > 0) {
      inertiaVelocity = -(event.clientX - lastPointerX) / elapsed;
      lastPointerX = event.clientX;
      lastPointerTime = event.timeStamp;
    }

    normalizeDragScroll();
  });

  const stopDragging = (event) => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    worksMarquee.classList.remove("is-dragging");

    if (worksMarquee.hasPointerCapture(event.pointerId)) {
      worksMarquee.releasePointerCapture(event.pointerId);
    }
  };

  worksMarquee.addEventListener("pointerup", stopDragging);
  worksMarquee.addEventListener("pointercancel", stopDragging);
  worksMarquee.addEventListener("mouseenter", () => {
    isHovering = true;
  });
  worksMarquee.addEventListener("mouseleave", () => {
    isHovering = false;
  });
  worksMarquee.addEventListener("click", (event) => {
    if (dragStarted) {
      event.preventDefault();
      dragStarted = false;
      pressedCard = null;
      return;
    }

    const clickedCard = event.target.closest(".work-card") || pressedCard;

    if (clickedCard) {
      event.preventDefault();
      const youtubeWindow = window.open(clickedCard.href, "_blank");

      if (youtubeWindow) {
        youtubeWindow.opener = null;
      }
    }

    pressedCard = null;
  });
  }
}
