(function () {
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const navUserChip = $("nav-user-chip");
  const navUserAvatar = $("nav-user-avatar");
  const navUserLabel = $("nav-user-label");

  const navLoginButton = $("nav-login-button");
  const navLoginPanel = $("nav-login-panel");
  const navLoginForm = $("nav-login-form");
  const navLoginEmailInput = $("nav-login-email");
  const navLoginCodeInput = $("nav-login-code");
  const navLoginCancel = $("nav-login-cancel");
  const navLogoutButton = $("nav-logout-button");

  const resultSection = $("result");
  const resultEmpty = $("result-empty");
  const hostNameEl = $("host-name");
  const hosteesListEl = $("hostees-list");

  const friendsListEl = $("friends-list");
  const isHome = Boolean(resultSection); // guests + hosts directory only live on the Housing page
  const filterBtns = $$("[data-friend-filter]");

  let currentFilter = "all";
  let currentUser = null;
  let hostsDirectory = [];
  let friendsSet = new Set();
  let incomingSet = new Set();
  let outgoingSet = new Set();

  async function safeJSON(resp) {
    const txt = await resp.text().catch(() => "");
    try {
      return txt ? JSON.parse(txt) : {};
    } catch {
      return { raw: txt };
    }
  }

  /* ---------- Account UI ---------- */

  function initials(name, email) {
    if (name && name.trim()) {
      return name.split(" ").filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 2).join("");
    }
    return email ? String(email)[0].toUpperCase() : "?";
  }

  function setUserUI(user) {
    const signedIn = Boolean(user && user.email);
    if (signedIn) {
      navUserAvatar.textContent = initials(user.name, user.email);
      navUserLabel.textContent = user.name || user.email;
      navLoginEmailInput.value = user.email || "";
    } else {
      navLoginEmailInput.value = "";
    }
    navLoginCodeInput.value = "";
    navUserChip.hidden = !signedIn;
    navLoginButton.hidden = signedIn;
    navLogoutButton.hidden = !signedIn;
    updateFeedbackGate();
  }

  function showLoginPanel() {
    navLoginPanel.hidden = false;
    (currentUser ? navLogoutButton : navLoginEmailInput)?.focus();
  }

  function hideLoginPanel() {
    navLoginPanel.hidden = true;
  }

  function toggleLoginPanel() {
    navLoginPanel.hidden ? showLoginPanel() : hideLoginPanel();
  }

  function openLoginFromAnywhere() {
    closeFeedback();
    if (currentUser) {
      if (isHome) $("results").scrollIntoView({ behavior: "smooth", block: "start" });
      else window.location.href = "/#results";
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    showLoginPanel();
  }

  navLoginButton.addEventListener("click", toggleLoginPanel);
  navUserChip.addEventListener("click", toggleLoginPanel);
  navLoginCancel.addEventListener("click", hideLoginPanel);
  $("hero-login-cta")?.addEventListener("click", openLoginFromAnywhere);
  $$("[data-open-login]").forEach((b) => b.addEventListener("click", openLoginFromAnywhere));

  document.addEventListener("click", (e) => {
    if (navLoginPanel.hidden) return;
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (navLoginPanel.contains(t) || navLoginButton.contains(t) || navUserChip.contains(t)) return;
    if (t.closest("[data-open-login], #hero-login-cta")) return;
    hideLoginPanel();
  });

  navLogoutButton.addEventListener("click", async () => {
    const resp = await fetch("/api/logout", { method: "POST", headers: { Accept: "application/json" } });
    if (!resp.ok) console.error("Logout failed:", await resp.text());

    currentUser = null;
    setUserUI(null);
    clearResult();
    clearDirectoryState();
    renderFriends();
    hideLoginPanel();
  });

  navLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = navLoginEmailInput.value.trim().toLowerCase();
    const code = navLoginCodeInput.value.trim();
    if (!email) return navLoginEmailInput.focus();
    if (!code) return navLoginCodeInput.focus();

    const resp = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (!resp.ok) {
      const err = await safeJSON(resp);
      alert(err?.error || "That code didn't work. Check it and try again.");
      return;
    }
    const user = await resp.json();

    currentUser = user;
    setUserUI(user);
    hideLoginPanel();

    try {
      renderHost(Array.isArray(user.hostees) ? user : await fetchHostByEmail(user.email));
      $("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.log("Could not load guests after login:", err);
    }

    try {
      await refreshDirectory();
    } catch (err) {
      console.warn("Could not load directory after login:", err);
    }
    renderFriends();
  });

  /* ---------- Guests ---------- */

  function clearResult() {
    if (!isHome) return;
    resultSection.hidden = true;
    resultEmpty.hidden = false;
    hostNameEl.textContent = "";
    hosteesListEl.innerHTML = "";
  }

  function renderHost(user) {
    if (!isHome) return;
    hostNameEl.textContent = user.name || "Your account";
    const hostees = Array.isArray(user.hostees) ? user.hostees : [];

    hosteesListEl.innerHTML = hostees.length
      ? hostees
          .map(
            (h) => `
        <div class="guest">
          <span class="guest__name">${esc(h.name || "Name not provided")}</span>
          ${h.email ? `<span class="guest__meta"><a href="mailto:${esc(h.email)}">${esc(h.email)}</a></span>` : ""}
          ${h.phone ? `<span class="guest__meta">${esc(h.phone)}</span>` : ""}
        </div>`
          )
          .join("")
      : `<p class="empty">No guests assigned yet. Once matching is done, they'll show up here.</p>`;

    resultEmpty.hidden = true;
    resultSection.hidden = false;
  }

  async function fetchHostByEmail(email) {
    const resp = await fetch(`/api/hostees?email=${encodeURIComponent(email)}`, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) throw new Error((await resp.text().catch(() => "")) || `Request failed with ${resp.status}`);
    return resp.json();
  }

  async function fetchCurrentUser() {
    try {
      const resp = await fetch("/api/me", { headers: { Accept: "application/json" } });
      if (!resp.ok) return;
      const data = await resp.json();
      currentUser = data && data.email ? data : null;
      setUserUI(currentUser);

      if (!currentUser) {
        clearDirectoryState();
        renderFriends();
        return;
      }

      await refreshDirectory().catch((e) => console.warn(e));
      renderFriends();

      if (Array.isArray(data.hostees) && data.hostees.length) {
        renderHost(data);
      } else {
        try {
          renderHost(await fetchHostByEmail(currentUser.email));
        } catch (err) {
          renderHost({ name: currentUser.name, hostees: [] });
        }
      }
    } catch (e) {
      console.warn("Unable to fetch current user:", e);
    }
  }

  /* ---------- Community (waves) ---------- */

  function clearDirectoryState() {
    hostsDirectory = [];
    friendsSet = new Set();
    incomingSet = new Set();
    outgoingSet = new Set();
  }

  async function getJSON(url, required = true) {
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) {
      if (!required) return null;
      const err = await safeJSON(resp);
      throw new Error(err?.error || `Failed ${url} (${resp.status})`);
    }
    return resp.json();
  }

  async function refreshDirectory() {
    if (!isHome || !currentUser?.email) return clearDirectoryState();

    const hosts = await getJSON("/api/hosts");
    hostsDirectory = Array.isArray(hosts.hosts) ? hosts.hosts : [];

    const friends = await getJSON("/api/friend/my_friends");
    friendsSet = new Set((friends.friends || []).map((x) => Number(x.u_id)));

    const incoming = await getJSON("/api/friend/incoming_requests");
    incomingSet = new Set((incoming.requests || []).map((x) => Number(x.u_id)));

    const outgoing = await getJSON("/api/friend/outgoing_requests", false);
    if (outgoing && Array.isArray(outgoing.requests)) {
      outgoingSet = new Set(outgoing.requests.map((x) => Number(x.u_id)));
    }
  }

  function statusFor(u_id) {
    const id = Number(u_id);
    if (friendsSet.has(id)) return "friend";
    if (incomingSet.has(id)) return "requestedYou";
    if (outgoingSet.has(id)) return "requested";
    return "available";
  }

  const STATUS_LABEL = { available: "", requested: "Wave sent", requestedYou: "Waved at you", friend: "Connected" };
  const BUTTON_LABEL = { available: "Wave", requested: "Undo", requestedYou: "Wave back", friend: "Remove" };

  function renderFriends() {
    if (!isHome) return;
    if (!currentUser?.email) {
      friendsListEl.innerHTML = `<p class="empty">Log in to see other hosts.</p>`;
      return;
    }

    const me = Number(currentUser.u_id);
    let list = hostsDirectory
      .filter((h) => Number(h.u_id) !== me)
      .map((h) => ({ ...h, status: statusFor(h.u_id) }));
    if (currentFilter !== "all") list = list.filter((p) => p.status === currentFilter);

    if (!list.length) {
      const msg = {
        friend: "No connections yet. When you and another host wave at each other, they'll show up here.",
        requestedYou: "Nobody has waved at you yet.",
      }[currentFilter] || "No other hosts yet.";
      friendsListEl.innerHTML = `<p class="empty">${msg}</p>`;
      return;
    }

    friendsListEl.innerHTML = list
      .map(
        (p) => `
      <div class="person" data-id="${esc(p.u_id)}" data-status="${p.status}">
        <div class="person__main">
          <div class="person__name">${esc(p.name || "Name not provided")}</div>
          <div class="person__meta">${esc(p.email || "")}</div>
        </div>
        ${STATUS_LABEL[p.status] ? `<span class="person__status person__status--${p.status}">${STATUS_LABEL[p.status]}</span>` : ""}
        <button class="person__btn" type="button">${BUTTON_LABEL[p.status]}</button>
      </div>`
      )
      .join("");
  }

  async function postFriendAction(endpoint, friend_u_id) {
    const resp = await fetch(`${endpoint}?friend_u_id=${encodeURIComponent(String(friend_u_id))}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    const data = await safeJSON(resp);
    if (!resp.ok || data?.error) throw new Error(data?.error || `Request failed (${resp.status})`);
    return data;
  }

  const ACTIONS = {
    available: "/api/friend/send_request",
    requestedYou: "/api/friend/accept_request",
    friend: "/api/friend/remove_friend",
    requested: "/api/friend/decline_request",
  };

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.friendFilter || "all";
      filterBtns.forEach((b) => b.classList.toggle("is-active", b === btn));
      renderFriends();
    });
  });

  friendsListEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest?.(".person__btn");
    if (!btn) return;
    const row = btn.closest(".person");
    const id = Number(row.dataset.id);
    const status = row.dataset.status || "available";
    if (!Number.isFinite(id)) return;

    btn.disabled = true;
    try {
      await postFriendAction(ACTIONS[status], id);
      if (status === "available") outgoingSet.add(id);
      if (status === "requested") outgoingSet.delete(id);
      await refreshDirectory().catch(() => {});
      renderFriends();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Something went wrong. Please try again.");
      btn.disabled = false;
    }
  });

  /* ---------- Feedback ---------- */

  const feedbackOverlay = $("feedback-overlay");
  const feedbackForm = $("feedback-form");
  const feedbackMessage = $("feedback-message");
  const feedbackSubmit = $("feedback-submit");
  const feedbackLoginNote = $("feedback-login-note");
  const feedbackStatus = $("feedback-status");
  const feedbackTypeButtons = $$("[data-feedback-type]");
  let feedbackType = "idea";
  let lastFocus = null;

  function updateFeedbackGate() {
    const signedIn = Boolean(currentUser?.email);
    feedbackLoginNote.hidden = signedIn;
    feedbackSubmit.disabled = !signedIn;
  }

  function openFeedback() {
    lastFocus = document.activeElement;
    feedbackStatus.hidden = true;
    updateFeedbackGate();
    feedbackOverlay.hidden = false;
    feedbackMessage.focus();
  }

  function closeFeedback() {
    if (feedbackOverlay.hidden) return;
    feedbackOverlay.hidden = true;
    lastFocus?.focus?.();
  }

  $("feedback-open").addEventListener("click", openFeedback);
  $$("[data-open-feedback]").forEach((b) => b.addEventListener("click", openFeedback));
  $("feedback-close").addEventListener("click", closeFeedback);
  $("feedback-cancel").addEventListener("click", closeFeedback);
  feedbackOverlay.addEventListener("click", (e) => {
    if (e.target === feedbackOverlay) closeFeedback();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeFeedback();
    hideLoginPanel();
  });

  feedbackTypeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      feedbackType = btn.dataset.feedbackType || "idea";
      feedbackTypeButtons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-checked", String(on));
      });
    });
  });

  feedbackForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = feedbackMessage.value.trim();
    if (!message) return feedbackMessage.focus();

    feedbackSubmit.disabled = true;
    try {
      const resp = await fetch("/api/post_feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ content: message, category: feedbackType }),
      });
      const data = await safeJSON(resp);
      if (resp.status === 401) {
        currentUser = null;
        setUserUI(null);
        return;
      }
      if (!resp.ok || data?.error) throw new Error(data?.error || "Feedback failed.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "We couldn't send that. Please try again.");
      return;
    } finally {
      updateFeedbackGate();
    }

    feedbackMessage.value = "";
    feedbackStatus.textContent = "Thanks, we got it.";
    feedbackStatus.hidden = false;
    setTimeout(closeFeedback, 1400);
  });

  /* ---------- Start ---------- */

  clearResult();
  setUserUI(null);
  renderFriends();
  fetchCurrentUser();
})();

/* Banner parallax (Housing page) */
(function () {
  const banner = document.querySelector(".banner");
  if (!banner || window.IMC?.reduceMotion) return;
  let ticking = false;
  function update() {
    ticking = false;
    const h = banner.offsetHeight || 1;
    const y = Math.min(window.scrollY, h);
    banner.style.setProperty("--parallax", `${y * 0.3}px`);
    banner.style.setProperty("--title-fade", String(Math.max(0, 1 - (y / h) * 1.4)));
  }
  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
})();

/* "The weekend at a glance": next few events, linking to the full itinerary */
(function () {
  const section = document.getElementById("weekend");
  const list = document.getElementById("weekend-list");
  if (!section || !list || !window.IMC) return;
  const { el, titleCase, getJSON, parseTime, timeFmt, shortDayFmt } = window.IMC;

  getJSON("/api/events")
    .then(({ events = [] }) => {
      if (!events.length) return;
      const now = new Date();
      const upcoming = events.filter((e) => (parseTime(e.end_time) || parseTime(e.start_time)) >= now);
      const pick = (upcoming.length ? upcoming : events).slice(0, 4);

      pick.forEach((event) => {
        const start = parseTime(event.start_time);
        const item = el("li", "agenda__item");
        const when = el("p", "agenda__when");
        when.appendChild(el("span", "agenda__day", shortDayFmt.format(start)));
        when.appendChild(el("span", "agenda__time", timeFmt.format(start)));
        item.appendChild(when);
        item.appendChild(el("h3", "agenda__title", event.title));
        if (event.location) item.appendChild(el("p", "agenda__place", event.location));
        item.appendChild(el("span", `tag tag--${event.category}`, titleCase(event.category)));
        list.appendChild(item);
      });
      section.hidden = false;
    })
    .catch((err) => console.warn("Could not load the schedule preview:", err));
})();
