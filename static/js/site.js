// Shared helpers for every page (Housing, Itinerary, Explore).
window.IMC = (function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function titleCase(word) {
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
  }

  // Pill buttons that filter a list by category; calls onChange("all" | category).
  function renderFilters(container, categories, onChange, labels = {}) {
    if (!container) return;
    container.innerHTML = "";
    if (categories.length < 2) return;

    ["all", ...categories].forEach((category, i) => {
      const label = category === "all" ? "All" : labels[category] || titleCase(category);
      const btn = el("button", "filter" + (i === 0 ? " is-active" : ""), label);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(i === 0));
      btn.addEventListener("click", () => {
        container.querySelectorAll(".filter").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", String(b === btn));
        });
        onChange(category);
      });
      container.appendChild(btn);
    });
  }

  async function getJSON(url) {
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`${url} failed: ${resp.status}`);
    return resp.json();
  }

  // Event times come back as "YYYY-MM-DD HH:MM[:SS]" in conference local time.
  const parseTime = (value) => (value ? new Date(String(value).replace(" ", "T")) : null);
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
  const shortDayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });

  /* Scroll reveal: elements with [data-reveal] fade up when they enter the viewport.
     Call IMC.reveal(node) for anything added after page load. */
  let observer = null;
  if (!reduceMotion && "IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-visible");
          observer.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
    );
  }

  function reveal(root) {
    const scope = root || document;
    const nodes = [...(scope.matches?.("[data-reveal]") ? [scope] : []), ...scope.querySelectorAll("[data-reveal]")];
    const siblings = new Map();
    nodes.forEach((node) => {
      if (node.dataset.revealBound) return;
      node.dataset.revealBound = "1";
      const n = siblings.get(node.parentElement) || 0;
      siblings.set(node.parentElement, n + 1);
      if (n) node.style.setProperty("--reveal-delay", `${Math.min(n, 5) * 0.1}s`);
      if (observer) observer.observe(node);
      else node.classList.add("is-visible");
    });
  }

  document.addEventListener("DOMContentLoaded", () => reveal());
  if (document.readyState !== "loading") reveal();

  return { el, titleCase, renderFilters, getJSON, parseTime, timeFmt, dayFmt, shortDayFmt, reveal, reduceMotion };
})();
