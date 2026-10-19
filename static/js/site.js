// Shared helpers for the Explore and Itinerary pages.
window.IMC = (function () {
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
  function renderFilters(container, categories, onChange) {
    if (!container) return;
    container.innerHTML = "";
    if (categories.length < 2) return;

    ["all", ...categories].forEach((category, i) => {
      const btn = el("button", "filter-pill" + (i === 0 ? " is-active" : ""), category === "all" ? "All" : titleCase(category));
      btn.type = "button";
      btn.addEventListener("click", () => {
        container.querySelectorAll(".filter-pill").forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
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

  function revealOnScroll() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.05 }
    );
    items.forEach((item) => observer.observe(item));
  }

  return { el, titleCase, renderFilters, getJSON, revealOnScroll };
})();
