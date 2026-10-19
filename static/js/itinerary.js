(function () {
  const { el, titleCase, renderFilters, getJSON, revealOnScroll } = window.IMC;
  const CATEGORY_ORDER = ["session", "meal", "prayer", "social", "general"];

  const daysEl = document.getElementById("itinerary-days");
  const filters = document.getElementById("itinerary-filters");
  const empty = document.getElementById("itinerary-empty");

  const parse = (value) => (value ? new Date(value.replace(" ", "T")) : null);
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

  function eventItem(event, now) {
    const start = parse(event.start_time);
    const end = parse(event.end_time);

    const item = el("li", "timeline__item");
    item.dataset.category = event.category;
    if (end && end < now) item.classList.add("is-past");
    if (start <= now && end && now <= end) item.classList.add("is-now");

    const time = el("div", "timeline__time", timeFmt.format(start));
    if (end) time.appendChild(el("span", "timeline__end", timeFmt.format(end)));
    item.appendChild(time);

    const body = el("div", "timeline__body");
    const head = el("div", "timeline__head");
    head.appendChild(el("h3", "timeline__title", event.title));
    head.appendChild(el("span", `timeline__tag timeline__tag--${event.category}`, titleCase(event.category)));
    if (item.classList.contains("is-now")) head.appendChild(el("span", "timeline__now", "Happening now"));
    body.appendChild(head);
    if (event.location) body.appendChild(el("p", "timeline__location", event.location));
    if (event.description) body.appendChild(el("p", "timeline__desc", event.description));
    item.appendChild(body);
    return item;
  }

  function render(events) {
    const now = new Date();
    const byDay = new Map();
    events.forEach((event) => {
      const key = event.start_time.slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(event);
    });

    byDay.forEach((dayEvents, key) => {
      const day = el("section", "itinerary__day");
      day.appendChild(el("h2", "itinerary__date", dayFmt.format(parse(`${key} 00:00`))));
      const list = el("ol", "timeline");
      dayEvents.forEach((event) => list.appendChild(eventItem(event, now)));
      day.appendChild(list);
      daysEl.appendChild(day);
    });
  }

  function applyFilter(category) {
    daysEl.querySelectorAll(".itinerary__day").forEach((day) => {
      let visible = 0;
      day.querySelectorAll(".timeline__item").forEach((item) => {
        item.hidden = category !== "all" && item.dataset.category !== category;
        if (!item.hidden) visible += 1;
      });
      day.hidden = visible === 0;
    });
  }

  async function load() {
    try {
      const { events = [] } = await getJSON("/api/events");
      empty.hidden = events.length > 0;
      render(events);

      const present = CATEGORY_ORDER.filter((c) => events.some((e) => e.category === c));
      renderFilters(filters, present, applyFilter);
    } catch (err) {
      console.error(err);
      empty.textContent = "The schedule couldn’t be loaded. Please try again later.";
      empty.hidden = false;
    }
  }

  load();
  revealOnScroll();
})();
