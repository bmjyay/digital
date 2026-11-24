(function () {
  const { el, titleCase, renderFilters, getJSON, reveal } = window.IMC;
  const CATEGORY_ORDER = ["cafe", "restaurant", "activity", "other"];
  const LABELS = { cafe: "Cafes", restaurant: "Restaurants", activity: "Things to do", other: "Other" };

  const grid = document.getElementById("explore-grid");
  const filters = document.getElementById("explore-filters");
  const empty = document.getElementById("explore-empty");

  function link(className, text, href, icon) {
    const a = el("a", className);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = `<svg width="16" height="16" aria-hidden="true"><use href="#${icon}"/></svg>`;
    a.appendChild(document.createTextNode(text));
    return a;
  }

  function placeCard(place) {
    const card = el("article", "place");
    card.dataset.category = place.category;
    card.dataset.reveal = "";

    card.appendChild(el("span", `tag tag--${place.category}`, titleCase(place.category)));
    card.appendChild(el("h2", "place__name", place.name));
    if (place.description) card.appendChild(el("p", "place__desc", place.description));

    const links = el("div", "place__links");
    if (place.address) {
      links.appendChild(
        link("place__link", place.address, "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place.address), "i-pin")
      );
    }
    if (place.url) links.appendChild(link("place__link", "Website", place.url, "i-external"));
    if (links.childElementCount) card.appendChild(links);
    return card;
  }

  function applyFilter(category) {
    grid.querySelectorAll(".place").forEach((card) => {
      card.hidden = category !== "all" && card.dataset.category !== category;
    });
  }

  async function load() {
    try {
      const { recommendations = [] } = await getJSON("/api/recommendations");
      empty.hidden = recommendations.length > 0;
      const rank = (p) => {
        const i = CATEGORY_ORDER.indexOf(p.category);
        return i === -1 ? CATEGORY_ORDER.length : i;
      };
      recommendations
        .slice()
        .sort((a, b) => rank(a) - rank(b))
        .forEach((place) => grid.appendChild(placeCard(place)));
      reveal(grid);

      const present = CATEGORY_ORDER.filter((c) => recommendations.some((r) => r.category === c));
      renderFilters(filters, present, applyFilter, LABELS);
    } catch (err) {
      console.error(err);
      empty.textContent = "Recommendations couldn't be loaded. Please try again in a moment.";
      empty.hidden = false;
    }
  }

  load();
})();
