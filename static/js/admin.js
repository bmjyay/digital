(function () {
  const hostsCsv = document.getElementById("hostsCsv");
  const hosteesCsv = document.getElementById("hosteesCsv");
  const prematchesCsv = document.getElementById("prematchesCsv");

  const btnUpload = document.getElementById("btnUpload");
  const btnMatch = document.getElementById("btnMatch");
  const btnClear = document.getElementById("btnClear");
  const btnDownloadFinal = document.getElementById("btnDownloadFinal");
  const btnDownloadMatches = document.getElementById("btnDownloadMatches");

  const uploadStatus = document.getElementById("uploadStatus");
  const matchStatus = document.getElementById("matchStatus");

  const btnRefreshFeedback = document.getElementById("btnRefreshFeedback");
  const feedbackStatus = document.getElementById("feedbackStatus");
  const feedbackTbody = document.getElementById("feedbackTbody");

  function setStatus(el, message, type = "info") {
    if (!el) return;
    el.textContent = message || "";
    el.className = `status ${type}`;
  }

  async function safeJSON(resp) {
    const txt = await resp.text().catch(() => "");
    try {
      return txt ? JSON.parse(txt) : {};
    } catch {
      return { raw: txt };
    }
  }

  btnUpload?.addEventListener("click", async () => {
    setStatus(uploadStatus, "");
    if (!hostsCsv?.files?.[0] || !hosteesCsv?.files?.[0]) {
      setStatus(uploadStatus, "Please select both hosts.csv and hostees.csv", "warn");
      return;
    }

    const fd = new FormData();
    fd.append("hosts", hostsCsv.files[0]);
    fd.append("hostees", hosteesCsv.files[0]);

    try {
      btnUpload.disabled = true;
      setStatus(uploadStatus, "Uploading and reloading database…", "info");

      const resp = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await safeJSON(resp);
      if (!resp.ok) throw new Error(data.error || data.message || resp.statusText);

      setStatus(uploadStatus, data.message || "Upload complete. Database refreshed.", "info");
    } catch (e) {
      console.error(e);
      setStatus(uploadStatus, e.message || "Upload failed", "error");
    } finally {
      btnUpload.disabled = false;
    }
  });

  btnMatch?.addEventListener("click", async () => {
    setStatus(matchStatus, "");
    if (!prematchesCsv?.files?.[0]) {
      setStatus(matchStatus, "Please select prematches.csv", "warn");
      return;
    }

    const fd = new FormData();
    fd.append("prematches", prematchesCsv.files[0]);

    try {
      btnMatch.disabled = true;
      setStatus(matchStatus, "Running matcher…", "info");

      const resp = await fetch("/api/admin/match", { method: "POST", body: fd });
      const data = await safeJSON(resp);
      if (!resp.ok) throw new Error(data.error || data.message || resp.statusText);

      btnDownloadFinal.hidden = false;
      btnDownloadMatches.hidden = false;
      //btnClear.hidden = false;
      setStatus(matchStatus, data.message || "Matching complete. Downloads ready below.", "info");
    } catch (e) {
      console.error(e);
      setStatus(matchStatus, e.message || "Matching failed", "error");
    } finally {
      btnMatch.disabled = false;
    }
  });

  btnClear?.addEventListener("click", async () => {
    try {
      btnClear.disabled = true;
      setStatus(matchStatus, "Clearing matches and updating database…", "info");

      const resp = await fetch("/api/admin/clear-matches", { method: "POST" });
      const data = await safeJSON(resp);
      if (!resp.ok) throw new Error(data.error || data.message || resp.statusText);

      setStatus(matchStatus, data.message || "Matches cleared.", "info");
      btnDownloadFinal.hidden = true;
      btnDownloadMatches.hidden = true;
      //btnClear.hidden = true;
    } catch (e) {
      console.error(e);
      setStatus(matchStatus, e.message || "Failed to clear matches", "error");
    } finally {
      btnClear.disabled = false;
    }
  });

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleString();
  }

  function normalizeFeedbackItems(data) {
    if (Array.isArray(data?.feedback)) return data.feedback;
    if (Array.isArray(data?.feedbacks)) return data.feedbacks;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data)) return data;
    return [];
  }

  function renderFeedbackRows(items) {
    if (!feedbackTbody) return;
    feedbackTbody.innerHTML = "";

    if (!items || !items.length) {
      feedbackTbody.innerHTML = `
        <tr>
          <td class="muted" colspan="5">No feedback found.</td>
        </tr>
      `;
      return;
    }

    for (const f of items) {
      const when =
        f.published_at || f.created_at || f.created || f.timestamp || "";
      const category = f.category || f.type || "";
      const msg = f.content || f.message || "";
      const name = f.name || "";
      const email = f.email || "";

      feedbackTbody.insertAdjacentHTML(
        "beforeend",
        `<tr>
          <td>${escapeHtml(formatDate(when))}</td>
          <td>${escapeHtml(category)}</td>
          <td>${escapeHtml(msg)}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(email)}</td>
        </tr>`
      );
    }
  }

  async function fetchFeedback() {
    const candidates = [
      "/admin/get-feedback",
      "/api/admin/feedback",
      "/api/admin/feedbacks",
      "/api/feedback",
      "/api/feedbacks",
    ];

    let lastErr = null;

    for (const url of candidates) {
      try {
        const resp = await fetch(url, { headers: { Accept: "application/json" } });
        if (!resp.ok) continue;

        const data = await safeJSON(resp);
        const items = normalizeFeedbackItems(data);

        if (items.length || (data && typeof data === "object" && Object.keys(data).length)) {
          return { url, items };
        }
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) throw lastErr;
    throw new Error(
      "No working feedback endpoint found. Add a GET route like /admin/get-feedback returning {feedback:[...]}."
    );
  }

  async function refreshFeedbackUI() {
    if (!btnRefreshFeedback || !feedbackTbody) return;

    setStatus(feedbackStatus, "Loading feedback…", "info");
    btnRefreshFeedback.disabled = true;

    try {
      const { url, items } = await fetchFeedback();
      renderFeedbackRows(items);
      setStatus(feedbackStatus, `Loaded ${items.length} item(s) from ${url}`, "info");
    } catch (e) {
      console.error(e);
      renderFeedbackRows([]);
      setStatus(feedbackStatus, e.message || "Failed to load feedback", "error");
    } finally {
      btnRefreshFeedback.disabled = false;
    }
  }

  btnRefreshFeedback?.addEventListener("click", refreshFeedbackUI);

  refreshFeedbackUI();
  // Explore recommendations and itinerary events
  const recForm = document.getElementById("recForm");
  const recStatus = document.getElementById("recStatus");
  const recList = document.getElementById("recList");
  const eventForm = document.getElementById("eventForm");
  const eventStatus = document.getElementById("eventStatus");
  const eventList = document.getElementById("eventList");

  const value = (id) => (document.getElementById(id)?.value || "").trim();

  function listRow(title, meta, onDelete) {
    const li = document.createElement("li");
    li.className = "admin-list__item";

    const text = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = title;
    const small = document.createElement("span");
    small.className = "admin-list__meta";
    small.textContent = meta;
    text.append(strong, small);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-danger";
    del.textContent = "Delete";
    del.addEventListener("click", onDelete);

    li.append(text, del);
    return li;
  }

  async function sendJSON(url, method, body) {
    const resp = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await safeJSON(resp);
    if (!resp.ok) throw new Error(data.error || data.message || resp.statusText);
    return data;
  }

  async function loadRecommendations() {
    if (!recList) return;
    try {
      const resp = await fetch("/api/recommendations");
      const data = await safeJSON(resp);
      const recs = data.recommendations || [];
      recList.innerHTML = "";
      if (!recs.length) setStatus(recStatus, "No recommendations yet.", "info");
      recs.forEach((r) => {
        recList.appendChild(
          listRow(r.name, [r.category, r.address].filter(Boolean).join(" · "), async () => {
            if (!confirm(`Delete “${r.name}”?`)) return;
            try {
              await sendJSON(`/api/admin/recommendations/${r.r_id}`, "DELETE");
              setStatus(recStatus, "Recommendation deleted.", "info");
              loadRecommendations();
            } catch (e) {
              setStatus(recStatus, e.message || "Delete failed", "error");
            }
          })
        );
      });
    } catch (e) {
      console.error(e);
      setStatus(recStatus, "Could not load recommendations.", "error");
    }
  }

  async function loadEvents() {
    if (!eventList) return;
    try {
      const resp = await fetch("/api/events");
      const data = await safeJSON(resp);
      const events = data.events || [];
      eventList.innerHTML = "";
      if (!events.length) setStatus(eventStatus, "No events yet.", "info");
      events.forEach((ev) => {
        const when = ev.start_time.slice(0, 16) + (ev.end_time ? ` – ${ev.end_time.slice(11, 16)}` : "");
        eventList.appendChild(
          listRow(ev.title, [ev.category, when, ev.location].filter(Boolean).join(" · "), async () => {
            if (!confirm(`Delete “${ev.title}”?`)) return;
            try {
              await sendJSON(`/api/admin/events/${ev.e_id}`, "DELETE");
              setStatus(eventStatus, "Event deleted.", "info");
              loadEvents();
            } catch (e) {
              setStatus(eventStatus, e.message || "Delete failed", "error");
            }
          })
        );
      });
    } catch (e) {
      console.error(e);
      setStatus(eventStatus, "Could not load events.", "error");
    }
  }

  recForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await sendJSON("/api/admin/recommendations", "POST", {
        name: value("recName"),
        category: value("recCategory"),
        address: value("recAddress"),
        url: value("recUrl"),
        description: value("recDescription"),
      });
      recForm.reset();
      setStatus(recStatus, data.message || "Recommendation added.", "info");
      loadRecommendations();
    } catch (err) {
      setStatus(recStatus, err.message || "Could not add recommendation", "error");
    }
  });

  eventForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = await sendJSON("/api/admin/events", "POST", {
        title: value("eventTitle"),
        category: value("eventCategory"),
        start_time: value("eventStart"),
        end_time: value("eventEnd"),
        location: value("eventLocation"),
        description: value("eventDescription"),
      });
      eventForm.reset();
      setStatus(eventStatus, data.message || "Event added.", "info");
      loadEvents();
    } catch (err) {
      setStatus(eventStatus, err.message || "Could not add event", "error");
    }
  });

  loadRecommendations();
  loadEvents();
})();
