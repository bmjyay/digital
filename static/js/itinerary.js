(function () {
  const { el, titleCase, renderFilters, getJSON, parseTime, timeFmt, dayFmt, reveal } = window.IMC;
  const CATEGORY_ORDER = ["session", "meal", "prayer", "social", "general"];
  const LABELS = { session: "Sessions", meal: "Meals", prayer: "Prayer", social: "Social", general: "General" };

  const daysEl = document.getElementById("itinerary-days");
  const filters = document.getElementById("itinerary-filters");
  const empty = document.getElementById("itinerary-empty");

  function eventRow(event, now) {
    const start = parseTime(event.start_time);
    const end = parseTime(event.end_time);

    const row = el("li", "event");
    row.dataset.category = event.category;
    if ((end || start) < now) row.classList.add("is-past");
    if (start <= now && end && now <= end) row.classList.add("is-now");

    const time = el("div", "event__time");
    time.appendChild(el("span", "event__start", timeFmt.format(start)));
    if (end) time.appendChild(el("span", "event__end", `to ${timeFmt.format(end)}`));
    row.appendChild(time);

    const body = el("div", "event__body");
    const head = el("div", "event__head");
    head.appendChild(el("h3", "event__title", event.title));
    head.appendChild(el("span", `tag tag--${event.category}`, titleCase(event.category)));
    if (row.classList.contains("is-now")) head.appendChild(el("span", "tag tag--now", "Happening now"));
    body.appendChild(head);

    if (event.location) {
      const loc = el("p", "event__location");
      loc.innerHTML = '<svg width="16" height="16" aria-hidden="true"><use href="#i-pin"/></svg>';
      loc.appendChild(document.createTextNode(event.location));
      body.appendChild(loc);
    }
    if (event.description) body.appendChild(el("p", "event__desc", event.description));
    row.appendChild(body);
    return row;
  }

  function render(events) {
    const now = new Date();
    const byDay = new Map();
    events.forEach((event) => {
      const key = String(event.start_time).slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(event);
    });

    byDay.forEach((dayEvents, key) => {
      const day = el("section", "day");
      day.dataset.reveal = "";
      const head = el("div", "day__head");
      head.appendChild(el("h2", "day__date", dayFmt.format(parseTime(`${key} 00:00`))));
      head.appendChild(el("span", "day__count", `${dayEvents.length} ${dayEvents.length === 1 ? "event" : "events"}`));
      day.appendChild(head);

      const list = el("ol", "events");
      dayEvents.forEach((event) => list.appendChild(eventRow(event, now)));
      day.appendChild(list);
      daysEl.appendChild(day);
    });
    reveal(daysEl);
  }

  function applyFilter(category) {
    daysEl.querySelectorAll(".day").forEach((day) => {
      let visible = 0;
      day.querySelectorAll(".event").forEach((row) => {
        row.hidden = category !== "all" && row.dataset.category !== category;
        if (!row.hidden) visible += 1;
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
      renderFilters(filters, present, applyFilter, LABELS);
    } catch (err) {
      console.error(err);
      empty.textContent = "The schedule couldn't be loaded. Please try again in a moment.";
      empty.hidden = false;
    }
  }

  load();
})();
