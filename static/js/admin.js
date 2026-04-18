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
})();

// ── Tags ──────────────────────────────────────────────────────────────────────
(function () {
  const input = document.getElementById('newTagInput');
  const btn = document.getElementById('btnAddTag');
  const list = document.getElementById('tagsList');
  const status = document.getElementById('tagsStatus');

  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function loadTags() {
    if (!list) return;
    const data = await fetch('/api/tags').then(r => r.json()).catch(() => ({ tags: [] }));
    const tags = data.tags || [];
    list.innerHTML = tags.length
      ? tags.map(t => `
          <span style="display:inline-flex;align-items:center;gap:4px;background:#ede9fe;border:1px solid #c4b5fd;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;color:#5b21b6;">
            ${esc(t.name)}
            <button data-tag-id="${t.tag_id}" style="border:none;background:none;cursor:pointer;color:#7c3aed;font-size:14px;line-height:1;padding:0 2px;" title="Delete">×</button>
          </span>`).join('')
      : '<span style="font-size:12px;color:var(--muted);">No tags yet.</span>';
    list.querySelectorAll('[data-tag-id]').forEach(del => {
      del.addEventListener('click', () => deleteTag(Number(del.dataset.tagId)));
    });
  }

  async function deleteTag(id) {
    await fetch(`/api/admin/tags/${id}`, { method: 'DELETE' });
    loadTags();
  }

  btn?.addEventListener('click', async () => {
    const name = (input?.value || '').trim();
    if (!name) return;
    const data = await fetch('/api/admin/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(r => r.json()).catch(() => ({}));
    if (data.error) { if (status) status.textContent = data.error; return; }
    if (input) input.value = '';
    if (status) { status.textContent = 'Tag added!'; setTimeout(() => { status.textContent = ''; }, 2000); }
    loadTags();
  });

  loadTags();
})();

// ── Recommendations ───────────────────────────────────────────────────────────
(function () {
  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function val(id) { return (document.getElementById(id)?.value || '').trim(); }

  async function loadRecs() {
    const list = document.getElementById('recList');
    if (!list) return;
    const data = await fetch('/api/recommendations').then(r => r.json()).catch(() => ({ recommendations: [] }));
    const recs = data.recommendations || [];
    list.innerHTML = recs.length
      ? recs.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;">
            <div>
              <div style="font-size:13px;font-weight:700;">${esc(r.name)} <span style="font-size:11px;color:#8b5cf6;font-weight:700;">[${esc(r.category)}]</span></div>
              ${r.address ? `<div style="font-size:12px;color:var(--muted);">${esc(r.address)}</div>` : ''}
              ${r.description ? `<div style="font-size:12px;margin-top:2px;">${esc(r.description)}</div>` : ''}
            </div>
            <button data-rec-id="${r.r_id}" class="btn-danger" style="flex-shrink:0;margin-left:12px;font-size:12px;padding:5px 10px;">Delete</button>
          </div>`).join('')
      : '<p style="font-size:13px;color:var(--muted);">No recommendations yet.</p>';
    list.querySelectorAll('[data-rec-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/admin/recommendations/${btn.dataset.recId}`, { method: 'DELETE' });
        loadRecs();
      });
    });
  }

  document.getElementById('btnAddRec')?.addEventListener('click', async () => {
    const status = document.getElementById('recStatus');
    const name = val('recName');
    if (!name) { if (status) status.textContent = 'Name is required.'; return; }
    await fetch('/api/admin/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, category: val('recCategory'), address: val('recAddress'),
        description: val('recDesc'), url: val('recUrl'),
      }),
    });
    ['recName','recAddress','recDesc','recUrl'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (status) { status.textContent = 'Added!'; setTimeout(() => { status.textContent = ''; }, 2000); }
    loadRecs();
  });

  loadRecs();
})();

// ── Itinerary ─────────────────────────────────────────────────────────────────
(function () {
  function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function val(id) { return (document.getElementById(id)?.value || '').trim(); }

  async function loadItin() {
    const list = document.getElementById('itinList');
    if (!list) return;
    const data = await fetch('/api/itinerary').then(r => r.json()).catch(() => ({ itinerary: [] }));
    const items = data.itinerary || [];
    list.innerHTML = items.length
      ? items.map(i => `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;">
            <div>
              <div style="font-size:13px;font-weight:700;">${esc(i.title)} <span style="font-size:11px;color:#8b5cf6;">[${esc(i.category)}]</span></div>
              <div style="font-size:12px;color:var(--muted);">${esc(i.start_time)} ${i.end_time ? '→ ' + esc(i.end_time) : ''} ${i.location ? '· ' + esc(i.location) : ''}</div>
              ${i.description ? `<div style="font-size:12px;">${esc(i.description)}</div>` : ''}
            </div>
            <button data-itin-id="${i.i_id}" class="btn-danger" style="flex-shrink:0;margin-left:12px;font-size:12px;padding:5px 10px;">Delete</button>
          </div>`).join('')
      : '<p style="font-size:13px;color:var(--muted);">No events yet.</p>';
    list.querySelectorAll('[data-itin-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/admin/itinerary/${btn.dataset.itinId}`, { method: 'DELETE' });
        loadItin();
      });
    });
  }

  document.getElementById('btnAddItin')?.addEventListener('click', async () => {
    const status = document.getElementById('itinStatus');
    const title = val('itinTitle');
    if (!title) { if (status) status.textContent = 'Title is required.'; return; }
    await fetch('/api/admin/itinerary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, category: val('itinCategory'), description: val('itinDesc'),
        location: val('itinLocation'), start_time: val('itinStart'), end_time: val('itinEnd'),
      }),
    });
    ['itinTitle','itinDesc','itinLocation','itinStart','itinEnd'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    if (status) { status.textContent = 'Added!'; setTimeout(() => { status.textContent = ''; }, 2000); }
    loadItin();
  });

  loadItin();
})();

// ── Host Location ─────────────────────────────────────────────────────────────
(function () {
  document.getElementById('btnSetLocation')?.addEventListener('click', async () => {
    const status = document.getElementById('locStatus');
    const h_id = document.getElementById('locHostId')?.value;
    const address = document.getElementById('locAddress')?.value.trim();
    const lat = document.getElementById('locLat')?.value;
    const lng = document.getElementById('locLng')?.value;
    if (!h_id || !lat || !lng) {
      if (status) status.textContent = 'Host ID, latitude, and longitude are required.';
      return;
    }
    try {
      await fetch('/api/admin/host-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ h_id: Number(h_id), address, lat: Number(lat), lng: Number(lng) }),
      });
      if (status) { status.textContent = 'Location saved!'; setTimeout(() => { status.textContent = ''; }, 2000); }
    } catch {
      if (status) status.textContent = 'Failed to save location.';
    }
  });
})();
