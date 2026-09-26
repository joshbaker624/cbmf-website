/* Charlotte Baker Memorial Fund — site interactions */
(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Header: solid background once the page scrolls */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Mobile menu */
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setMenu(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) setMenu(false);
    });
  }

  /* Hero entrance */
  var hero = document.querySelector(".hero");
  if (hero) requestAnimationFrame(function () { setTimeout(function () { hero.classList.add("is-ready"); }, 80); });

  /* Count-up numbers: <span data-count="25000" data-prefix="$" data-suffix="">0</span> */
  function formatNum(n) { return Math.round(n).toLocaleString("en-US"); }
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var plain = el.hasAttribute("data-plain");
    var render = function (v) { el.textContent = prefix + (plain ? Math.round(v) : formatNum(v)) + suffix; };
    if (reduceMotion) { render(target); return; }
    var start = null, duration = 1800;
    var from = plain ? Math.max(0, target - 12) : 0;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 4);
      render(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Scroll reveal */
  var revealables = document.querySelectorAll("[data-reveal], .mission-quote, .timeline li, [data-count]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute("data-delay") || "0", 10);
        setTimeout(function () {
          el.classList.add("is-visible");
          if (el.hasAttribute("data-count")) countUp(el);
        }, delay);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) {
      el.classList.add("is-visible");
      if (el.hasAttribute("data-count")) countUp(el);
    });
  }

  /* Gentle parallax on the hero medallion */
  var medallion = document.querySelector(".hero-medallion");
  if (medallion && !reduceMotion) {
    window.addEventListener("scroll", function () {
      var y = Math.min(window.scrollY, 800);
      medallion.style.transform = "translateY(" + y * 0.12 + "px)";
    }, { passive: true });
  }

  /* Stars in the sunset CTA */
  document.querySelectorAll(".cta .stars").forEach(function (box) {
    for (var i = 0; i < 26; i++) {
      var s = document.createElement("span");
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 38 + "%";
      s.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
      box.appendChild(s);
    }
  });

  /* ---------- Sponsor marquee ----------
     Data lives in sponsors.json, managed from admin.html. Each entry is
     { name, logo }, where logo is a path under assets/img/sponsors/.

     MARQUEE_SPEED is how fast the band slides, in pixels per second. It is a
     speed rather than a duration so the pace stays the same as sponsors are
     added — more sponsors make the loop longer, not faster. Lower is calmer. */
  var MARQUEE_SPEED = 38;
  function buildChip(sponsor) {
    var chip = document.createElement("div");
    chip.className = "sponsor-chip";
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = sponsor.name || "";
    if (sponsor.logo) {
      var img = document.createElement("img");
      img.src = sponsor.logo;
      img.alt = sponsor.name ? sponsor.name + " logo" : "Sponsor logo";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("error", function () {
        img.remove();
        chip.classList.add("is-textonly");
      });
      chip.appendChild(img);
    } else {
      chip.classList.add("is-textonly");
    }
    chip.appendChild(name);
    return chip;
  }

  function renderMarquee(marquee, list) {
    var track = marquee && marquee.querySelector("[data-marquee-track]");
    if (!track) return false;
    track.textContent = "";
    var clean = (list || []).filter(function (s) { return s && (s.name || s.logo); });
    if (!clean.length) return false;

    /* Build one half of the track, repeating the list until it is wider than
       the viewport — a short list would otherwise loop with a visible gap. */
    var reps = 0;
    do {
      clean.forEach(function (s) { track.appendChild(buildChip(s)); });
      reps++;
    } while (track.scrollWidth < marquee.offsetWidth && reps < 12);
    var halfWidth = track.scrollWidth;

    /* Second identical half, so the -50% keyframe lands exactly on its start */
    for (var i = 0; i < reps; i++) {
      clean.forEach(function (s) {
        var clone = buildChip(s);
        clone.classList.add("is-clone");
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
    }

    setDuration(marquee, track, 0);
    return true;
  }

  /* Derive the loop duration from the measured track. A display:none ancestor
     reports every width as 0, which would silently floor the duration to the
     minimum and run the band several times too fast — so retry for a few frames
     rather than trust a zero. */
  function setDuration(marquee, track, attempt) {
    var halfWidth = track.scrollWidth / 2;
    if (!halfWidth) {
      if (attempt < 10) requestAnimationFrame(function () { setDuration(marquee, track, attempt + 1); });
      return;
    }
    marquee.style.setProperty("--marquee-duration", Math.max(18, Math.round(halfWidth / MARQUEE_SPEED)) + "s");
  }

  var sponsorSection = document.querySelector("[data-sponsors]");
  if (sponsorSection && window.fetch) {
    fetch("sponsors.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) return;
        var marquee = sponsorSection.querySelector("[data-marquee]");
        /* Unhide first: rendering into a hidden section measures zero. */
        sponsorSection.hidden = false;
        if (!renderMarquee(marquee, list)) {
          sponsorSection.hidden = true;
          return;
        }
        /* Chip width and spacing are vw-based, so the track changes size with
           the window and the duration has to be recomputed. */
        var resizeTimer;
        window.addEventListener("resize", function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () { renderMarquee(marquee, list); }, 250);
        });
      })
      .catch(function () { /* no sponsors file yet: leave the section hidden */ });
  }

  /* Shared with admin.html for its live preview */
  window.CBMF = window.CBMF || {};
  window.CBMF.renderMarquee = renderMarquee;

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
