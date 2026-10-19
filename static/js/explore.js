(function () {
  const { el, titleCase, renderFilters, getJSON, revealOnScroll } = window.IMC;
  const CATEGORY_ORDER = ["cafe", "restaurant", "activity", "other"];

  const grid = document.getElementById("explore-grid");
  const filters = document.getElementById("explore-filters");
  const empty = document.getElementById("explore-empty");

  function placeCard(place) {
    const card = el("article", "place-card");
    card.dataset.category = place.category;

    card.appendChild(el("p", "place-card__category", titleCase(place.category)));
    card.appendChild(el("h2", "place-card__name", place.name));
    if (place.description) card.appendChild(el("p", "place-card__desc", place.description));

    const links = el("div", "place-card__links");
    if (place.address) {
      const map = el("a", "place-card__link", place.address);
      map.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place.address);
      map.target = "_blank";
      map.rel = "noopener";
      links.appendChild(map);
    }
    if (place.url) {
      const site = el("a", "place-card__link", "Website ↗");
      site.href = place.url;
      site.target = "_blank";
      site.rel = "noopener";
      links.appendChild(site);
    }
    if (links.childElementCount) card.appendChild(links);
    return card;
  }

  function applyFilter(category) {
    grid.querySelectorAll(".place-card").forEach((card) => {
      card.hidden = category !== "all" && card.dataset.category !== category;
    });
  }

  async function load() {
    try {
      const { recommendations = [] } = await getJSON("/api/recommendations");
      empty.hidden = recommendations.length > 0;
      const rank = (place) => {
        const i = CATEGORY_ORDER.indexOf(place.category);
        return i === -1 ? CATEGORY_ORDER.length : i;
      };
      recommendations
        .slice()
        .sort((a, b) => rank(a) - rank(b))
        .forEach((place) => grid.appendChild(placeCard(place)));

      const present = CATEGORY_ORDER.filter((c) => recommendations.some((r) => r.category === c));
      renderFilters(filters, present, applyFilter);
    } catch (err) {
      console.error(err);
      empty.textContent = "Recommendations couldn’t be loaded. Please try again later.";
      empty.hidden = false;
    }
  }

  load();
  revealOnScroll();
})();
