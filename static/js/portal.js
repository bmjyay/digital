(function () {
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);

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
  const filterBtns = $$("[data-friend-filter]");

  let currentFilter = "all";

  let currentUser = null;
  let hostsDirectory = [];
  let friendsSet = new Set();
  let incomingSet = new Set();

  function initialsFromNameOrEmail(name, email) {
    if (name && name.trim()) {
      return name
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0].toUpperCase())
        .slice(0, 2)
        .join("");
    }
    if (email) return String(email)[0].toUpperCase();
    return "?";
  }

  function setUserUI(user) {
    if (!navUserChip || !navUserAvatar || !navUserLabel || !navLoginButton) return;

    if (user && user.email) {
      const initials = initialsFromNameOrEmail(user.name, user.email);
      const label = user.school || user.name || "IMC attendee";

      navUserAvatar.textContent = initials;
      navUserLabel.textContent = label;

      navUserChip.hidden = false;
      navLoginButton.hidden = true;

      if (navLoginEmailInput) navLoginEmailInput.value = user.email || "";
      if (navLoginCodeInput) navLoginCodeInput.value = "";
    } else {
      navUserChip.hidden = true;
      navLoginButton.hidden = false;
      if (navLoginEmailInput) navLoginEmailInput.value = "";
      if (navLoginCodeInput) navLoginCodeInput.value = "";
    }
  }

  const heroLoginCta = $("hero-login-cta");
  if (heroLoginCta && navLoginButton) {
    heroLoginCta.addEventListener("click", () => navLoginButton.click());
  }

  function showLoginPanel() {
    if (!navLoginPanel) return;
    navLoginPanel.hidden = false;
    navLoginEmailInput?.focus();
  }

  function hideLoginPanel() {
    if (!navLoginPanel) return;
    navLoginPanel.hidden = true;
  }

  async function safeJSON(resp) {
    const txt = await resp.text().catch(() => "");
    try {
      return txt ? JSON.parse(txt) : {};
    } catch {
      return { raw: txt };
    }
  }

  async function verifyLoginCode(email, code) {
    const resp = await fetch("/api/auth/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (!resp.ok) {
      console.error("verify-code failed:", await resp.text());
      alert("Invalid or expired code. Please try again.");
      return null;
    }

    return resp.json();
  }

  navLoginButton?.addEventListener("click", () => {
    if (navLoginPanel.hidden) showLoginPanel();
    else hideLoginPanel();
  });

  navUserChip?.addEventListener("click", () => {
    if (navLoginPanel.hidden) showLoginPanel();
    else hideLoginPanel();
  });

  navLoginCancel?.addEventListener("click", hideLoginPanel);

  navLogoutButton?.addEventListener("click", async () => {
    const resp = await fetch("/api/logout", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) console.error("Logout failed:", await resp.text());

    currentUser = null;
    setUserUI(null);

    clearResult();
    clearDirectoryState();
    renderFriends();

    hideLoginPanel();
  });

  navLoginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = (navLoginEmailInput?.value || "").trim().toLowerCase();
    const code = (navLoginCodeInput?.value || "").trim();

    if (!email) return navLoginEmailInput?.focus();
    if (!code) return navLoginCodeInput?.focus();

    const user = await verifyLoginCode(email, code);
    if (!user) return;

    currentUser = user;
    setUserUI(user);

    try {
      const data = Array.isArray(user.hostees) ? user : await fetchHostByEmail(user.email);
      renderHost(data);
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.log("Could not load hostees after login:", err);
    }

    try {
      await refreshDirectory();
      renderFriends();
    } catch (err) {
      console.warn("Could not load directory after login:", err);
    }

    hideLoginPanel();
  });

  document.addEventListener("click", (e) => {
    if (!navLoginPanel || navLoginPanel.hidden) return;
    const target = e.target;
    if (
      target instanceof HTMLElement &&
      !navLoginPanel.contains(target) &&
      target !== navLoginButton &&
      target !== navUserChip
    ) {
      hideLoginPanel();
    }
  });

  function clearResult() {
    if (resultSection) resultSection.hidden = true;
    if (resultEmpty) resultEmpty.hidden = false;
    if (hostNameEl) hostNameEl.textContent = "";
    if (hosteesListEl) hosteesListEl.innerHTML = "";
  }

  function renderHost(user) {
    if (!hostNameEl || !hosteesListEl || !resultSection) return;

    hostNameEl.textContent = user.name || "Host";
    hosteesListEl.innerHTML = "";

    const hostees = Array.isArray(user.hostees) ? user.hostees : [];

    if (hostees.length) {
      hostees.forEach((h, i) => {
        const card = document.createElement("div");
        card.className = "hostee-card";
        card.innerHTML = `
          <div class="hostee-row">
            <div class="hostee-primary">${h.name ?? "Unnamed"}</div>
            <div class="hostee-secondary">${h.email ?? ""}</div>
            <div class="hostee-secondary">${h.phone ?? ""}</div>
          </div>
        `;
        hosteesListEl.appendChild(card);
        if (i < hostees.length - 1) {
          const hr = document.createElement("hr");
          hr.className = "divider";
          hosteesListEl.appendChild(hr);
        }
      });
    } else {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No contacts available.";
      hosteesListEl.appendChild(empty);
    }

    if (resultEmpty) resultEmpty.hidden = true;
    resultSection.hidden = false;
  }

  async function fetchHostByEmail(email) {
    const resp = await fetch(`/api/hostees?email=${encodeURIComponent(email)}`, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(text || `Request failed with ${resp.status}`);
    }
    return resp.json();
  }

  function clearDirectoryState() {
    hostsDirectory = [];
    friendsSet = new Set();
    incomingSet = new Set();
    outgoingSet = new Set();
  }

  async function fetchCurrentUser() {
    try {
      const resp = await fetch("/api/me", { headers: { Accept: "application/json" } });
      if (!resp.ok) return;

      const data = await resp.json();
      currentUser = data && data.email ? data : null;
      setUserUI(currentUser);

      if (currentUser?.email) {
        await refreshDirectory();
        renderFriends();
      } else {
        clearDirectoryState();
        renderFriends();
      }

      if (currentUser?.email) {
        if (Array.isArray(data.hostees) && data.hostees.length) {
          renderHost(data);
        } else {
          try {
            const hostData = await fetchHostByEmail(currentUser.email);
            renderHost(hostData);
          } catch (err) {
            console.log("Unable to load hostees for current user:", err);
          }
        }
      }
    } catch (e) {
      console.warn("Unable to fetch current user:", e);
    }
  }

  async function tryFetchJSON(url) {
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    return resp.json();
  }

  async function refreshDirectory() {
    if (!currentUser?.email) {
      clearDirectoryState();
      return;
    }

    const hostsResp = await fetch("/api/hosts", { headers: { Accept: "application/json" } });
    if (!hostsResp.ok) {
      const err = await safeJSON(hostsResp);
      throw new Error(err?.error || `Failed /api/hosts (${hostsResp.status})`);
    }
    const hostsData = await hostsResp.json();
    hostsDirectory = Array.isArray(hostsData.hosts) ? hostsData.hosts : [];

    const friendsResp = await fetch("/api/friend/my_friends", { headers: { Accept: "application/json" } });
    if (!friendsResp.ok) {
      const err = await safeJSON(friendsResp);
      throw new Error(err?.error || `Failed /api/friend/my_friends (${friendsResp.status})`);
    }
    const friendsData = await friendsResp.json();
    const friendsArr = Array.isArray(friendsData.friends) ? friendsData.friends : [];
    friendsSet = new Set(friendsArr.map((x) => Number(x.u_id)));

    const reqResp = await fetch("/api/friend/incoming_requests", { headers: { Accept: "application/json" } });
    if (!reqResp.ok) {
      const err = await safeJSON(reqResp);
      throw new Error(err?.error || `Failed /api/friend/incoming_requests (${reqResp.status})`);
    }
    const reqData = await reqResp.json();
    const reqArr = Array.isArray(reqData.requests) ? reqData.requests : [];
    incomingSet = new Set(reqArr.map((x) => Number(x.u_id)));

    const outgoingData =
      (await tryFetchJSON("/api/friend/outgoing_requests")) ||
      (await tryFetchJSON("/api/friend/sent_requests")) ||
      null;

    if (outgoingData && Array.isArray(outgoingData.requests)) {
      outgoingSet = new Set(outgoingData.requests.map((x) => Number(x.u_id)));
    }
  }

  function statusForUser(u_id) {
    const id = Number(u_id);
    if (!Number.isFinite(id)) return "available";
    if (friendsSet.has(id)) return "friend";
    if (incomingSet.has(id)) return "requestedYou";
    if (outgoingSet.has(id)) return "requested";
    return "available";
  }

  const STATUS_LABEL = {
    available: "Available",
    requested: "Wave sent",
    requestedYou: "Waved at you",
    friend: "Match",
  };

  const STATUS_CLASS = {
    available: "friend-status--available",
    requested: "friend-status--requested",
    requestedYou: "friend-status--requestedYou",
    friend: "friend-status--friend",
  };

  const BUTTON_LABEL = {
    available: "Wave",
    requested: "Undo wave",
    requestedYou: "Accept",
    friend: "Remove",
  };

  function filteredDirectory() {
    const me = Number(currentUser?.u_id);

    const list = hostsDirectory
      .filter((h) => Number(h.u_id) !== me)
      .map((h) => ({ ...h, status: statusForUser(h.u_id) }));

    if (currentFilter === "all") return list;
    return list.filter((p) => p.status === currentFilter);
  }

  function renderFriends() {
    if (!friendsListEl) return;

    if (!currentUser?.email) {
      friendsListEl.innerHTML = `<p class="empty">Sign in to view and connect with the IMC community.</p>`;
      return;
    }

    const list = filteredDirectory();
    friendsListEl.innerHTML = "";

    if (!list.length) {
      const msg =
        currentFilter === "friend"
          ? "No matches yet. When two people wave at each other, they’ll show up here."
          : currentFilter === "requestedYou"
          ? "No incoming waves right now."
          : currentFilter === "requested"
          ? "No outgoing waves right now."
          : "No attendees found.";
      friendsListEl.innerHTML = `<p class="empty">${msg}</p>`;
      return;
    }

    list.forEach((person) => {
      const card = document.createElement("div");
      card.className = "friend-card";
      card.dataset.id = String(person.u_id);
      card.dataset.status = person.status;

      card.innerHTML = `
        <div class="friend-main">
          <div class="friend-name-row">
            <span class="friend-name">${person.name || "Unnamed"}</span>
            <span class="friend-meta">${person.email || ""}</span>
          </div>
        </div>
        <div class="friend-actions">
          <span class="friend-status ${STATUS_CLASS[person.status] || ""}">
            ${STATUS_LABEL[person.status] || ""}
          </span>
          <button class="friend-btn" type="button">
            ${BUTTON_LABEL[person.status] || "Action"}
          </button>
        </div>
      `;

      friendsListEl.appendChild(card);
    });
  }

  async function postFriendAction(endpoint, friend_u_id) {
    const idStr = String(friend_u_id);

    let resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ friend_u_id: idStr }),
    });

    if (!resp.ok) {
      resp = await fetch(`${endpoint}?friend_u_id=${encodeURIComponent(idStr)}`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
    }

    const data = await safeJSON(resp);
    if (!resp.ok || data?.error) {
      throw new Error(data?.error || `Request failed (${resp.status})`);
    }
    return data;
  }

  async function handleFriendButtonClick(friend_u_id, status) {
    const id = Number(friend_u_id);
    if (!Number.isFinite(id)) return;

    if (status === "available") {
      await postFriendAction("/api/friend/send_request", id);
      outgoingSet.add(id); 
    } else if (status === "requestedYou") {
      await postFriendAction("/api/friend/accept_request", id);
    } else if (status === "friend") {
      await postFriendAction("/api/friend/remove_friend", id);
    } else if (status === "requested") {
      await postFriendAction("/api/friend/decline_request", id);
      outgoingSet.delete(id);
    }

    await refreshDirectory().catch(() => {});
    renderFriends();
  }

  if (friendsListEl) {
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", async () => {
        currentFilter = btn.dataset.friendFilter || "all";
        filterBtns.forEach((b) => b.classList.remove("sp-filter--active"));
        btn.classList.add("sp-filter--active");

        if (currentUser?.email && !hostsDirectory.length) {
          try {
            await refreshDirectory();
          } catch (e) {
            console.warn(e);
          }
        }
        renderFriends();
      });
    });

    friendsListEl.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.(".friend-btn");
      if (!btn) return;

      const card = btn.closest(".friend-card");
      if (!card) return;

      const id = Number(card.dataset.id);
      const status = card.dataset.status || "available";

      btn.disabled = true;
      try {
        await handleFriendButtonClick(id, status);
      } catch (err) {
        console.error(err);
        alert(err?.message || "Something went wrong.");
      } finally {
        btn.disabled = false;
      }
    });
  }

  const feedbackOverlay = $("feedback-overlay");
  const feedbackOpenBtn = $("feedback-open");
  const feedbackCloseBtn = $("feedback-close");
  const feedbackCancelBtn = $("feedback-cancel");
  const feedbackForm = $("feedback-form");
  const feedbackMessageInput = $("feedback-message");
  const feedbackEmailInput = $("feedback-email");
  const feedbackTypeButtons = $$("[data-feedback-type]");

  let feedbackType = "idea";

  function openFeedback() {
    if (!feedbackOverlay) return;
    feedbackOverlay.hidden = false;
    feedbackMessageInput?.focus();
  }

  function closeFeedback() {
    if (!feedbackOverlay) return;
    feedbackOverlay.hidden = true;
  }

  feedbackOpenBtn?.addEventListener("click", openFeedback);
  feedbackCloseBtn?.addEventListener("click", closeFeedback);
  feedbackCancelBtn?.addEventListener("click", closeFeedback);

  feedbackOverlay?.addEventListener("click", (e) => {
    if (e.target === feedbackOverlay) closeFeedback();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFeedback();
  });

  feedbackTypeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-feedback-type") || "idea";
      feedbackType = value;
      feedbackTypeButtons.forEach((b) => b.classList.remove("pill--active"));
      btn.classList.add("pill--active");
    });
  });

  feedbackForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = feedbackMessageInput?.value.trim();
    const email = feedbackEmailInput?.value.trim();

    if (!message) return feedbackMessageInput?.focus();

    try {
      const resp = await fetch("/api/post_feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ content: message, category: feedbackType, email }),
      });
      const data = await safeJSON(resp);
      if (!resp.ok || data?.error) throw new Error(data?.error || "Feedback failed.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Could not submit feedback.");
      return;
    }

    if (feedbackMessageInput) feedbackMessageInput.value = "";
    if (feedbackEmailInput) feedbackEmailInput.value = "";

    closeFeedback();
  });

  clearResult();
  clearDirectoryState();
  fetchCurrentUser().then(() => {
    if (currentUser?.u_id) {
      initUserFeatures(currentUser);
    }
  });

  window._portalSetCurrentUser = (user) => {
    currentUser = user;
    if (user?.u_id) initUserFeatures(user);
  };

  console.log("portal.js loaded");
})();

// ── Tags, Messaging, Friend Hosting, Map ─────────────────────────────────────
(function () {
  const $ = (id) => document.getElementById(id);

  let me = null;
  let mapInstance = null;
  let activeMsgThread = null;
  let msgPollTimer = null;

  async function getMe() {
    try {
      const r = await fetch('/api/me');
      if (!r.ok) return null;
      return r.json();
    } catch { return null; }
  }

  // ── Tags ──────────────────────────────────────────────────────────────────

  async function initTags(h_id) {
    const grid = $('tags-grid');
    if (!grid) return;
    const [allRes, myRes] = await Promise.all([
      fetch('/api/tags').then(r => r.json()).catch(() => ({ tags: [] })),
      fetch('/api/host/tags').then(r => r.json()).catch(() => ({ tags: [] })),
    ]);
    const all = allRes.tags || [];
    const mine = new Set((myRes.tags || []).map(t => t.tag_id));
    grid.innerHTML = all.length
      ? all.map(t => `<span class="tag-pill ${mine.has(t.tag_id) ? 'selected' : ''}" data-tag="${t.tag_id}">${esc(t.name)}</span>`).join('')
      : '<span class="hint" style="font-size:12px;">No tags yet — ask an admin to add some.</span>';
    grid.querySelectorAll('.tag-pill').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('selected'));
    });
  }

  async function saveTags() {
    const grid = $('tags-grid');
    const status = $('tags-status');
    if (!grid || !status) return;
    const ids = [...grid.querySelectorAll('.tag-pill.selected')].map(el => Number(el.dataset.tag));
    try {
      await fetch('/api/host/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: ids }),
      });
      status.textContent = 'Saved!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    } catch {
      status.textContent = 'Failed to save.';
    }
  }

  $('save-tags-btn')?.addEventListener('click', saveTags);

  // ── Friend hosting ─────────────────────────────────────────────────────────

  async function loadFriendHosting() {
    const section = $('friend-hosting-section');
    const list = $('friend-hosting-list');
    if (!section || !list) return;
    try {
      const data = await fetch('/api/friend/hosting').then(r => r.json());
      const hosting = data.hosting || [];
      if (!hosting.length) { section.hidden = true; return; }
      section.hidden = false;
      list.innerHTML = hosting.map(h => `
        <div class="friend-host-item">
          <div class="friend-host-name">${esc(h.friend.name)}</div>
          <div class="friend-host-hostees">
            ${h.hostees.length
              ? 'Hosting: ' + h.hostees.map(e => esc(e.name)).join(', ')
              : 'No hostees yet'}
          </div>
        </div>`).join('');
    } catch {
      section.hidden = true;
    }
  }

  // ── Messaging ─────────────────────────────────────────────────────────────

  async function loadConversations() {
    const sidebar = $('msg-sidebar');
    if (!sidebar || !me) return;
    try {
      const data = await fetch('/api/messages').then(r => r.json());
      const convos = data.conversations || [];
      if (!convos.length) {
        sidebar.innerHTML = '<div class="msg-sidebar-empty">No conversations yet.</div>';
        return;
      }
      sidebar.innerHTML = convos.map(c => `
        <div class="msg-convo ${activeMsgThread === c.u_id ? 'active' : ''}" data-uid="${c.u_id}">
          <div class="msg-convo-name">${esc(c.name)}${c.unread ? `<span class="msg-convo-unread">${c.unread}</span>` : ''}</div>
          <div class="msg-convo-time">${c.last_at}</div>
        </div>`).join('');
      sidebar.querySelectorAll('.msg-convo').forEach(el => {
        el.addEventListener('click', () => openThread(Number(el.dataset.uid), el));
      });
      updateUnreadBadge();
    } catch {}
  }

  async function updateUnreadBadge() {
    const badge = $('unread-badge');
    if (!badge) return;
    try {
      const data = await fetch('/api/messages/unread').then(r => r.json());
      const count = data.count || 0;
      badge.textContent = count;
      badge.hidden = count === 0;
    } catch {}
  }

  async function openThread(otherUid, convoEl) {
    activeMsgThread = otherUid;
    document.querySelectorAll('.msg-convo').forEach(el => el.classList.remove('active'));
    convoEl?.classList.add('active');

    const empty = $('msg-empty');
    const msgs = $('msg-messages');
    const composer = $('msg-composer');
    if (!msgs || !composer || !empty) return;

    empty.hidden = true;
    msgs.hidden = false;
    composer.hidden = false;

    await refreshThread(otherUid);

    clearInterval(msgPollTimer);
    msgPollTimer = setInterval(() => refreshThread(otherUid), 4000);
  }

  async function refreshThread(otherUid) {
    const msgs = $('msg-messages');
    if (!msgs || !me) return;
    try {
      const data = await fetch(`/api/messages/${otherUid}`).then(r => r.json());
      const messages = data.messages || [];
      const atBottom = msgs.scrollHeight - msgs.scrollTop <= msgs.clientHeight + 40;
      msgs.innerHTML = messages.length
        ? messages.map(m => {
            const mine = m.from_u_id === me.u_id;
            return `<div>
              <div class="msg-bubble msg-bubble--${mine ? 'me' : 'them'}">${esc(m.content)}</div>
              <div class="msg-bubble-time" style="text-align:${mine ? 'right' : 'left'};">${m.sent_at}</div>
            </div>`;
          }).join('')
        : '<div style="color:var(--muted);font-size:13px;padding:8px;">No messages yet. Say hello!</div>';
      if (atBottom) msgs.scrollTop = msgs.scrollHeight;
      await loadConversations();
    } catch {}
  }

  async function sendMessage() {
    const input = $('msg-input');
    if (!input || !activeMsgThread) return;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    try {
      await fetch(`/api/messages/${activeMsgThread}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      await refreshThread(activeMsgThread);
    } catch {}
  }

  $('msg-send')?.addEventListener('click', sendMessage);
  $('msg-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

  // ── Map ───────────────────────────────────────────────────────────────────

  async function initMap() {
    const mapEl = $('map');
    if (!mapEl || typeof L === 'undefined') return;
    mapInstance = L.map('map').setView([41.3083, -72.9279], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapInstance);
    try {
      const data = await fetch('/api/map/locations').then(r => r.json());
      const locs = data.locations || [];
      if (!locs.length) {
        mapEl.insertAdjacentHTML('afterend', '<p class="hint" style="margin-top:8px;">No host locations set yet — admins can add them via the Admin Panel.</p>');
        return;
      }
      locs.forEach(loc => {
        const popup = `<b>${esc(loc.name)}</b>${loc.address ? '<br>' + esc(loc.address) : ''}${loc.hostees.length ? '<br><small>Hosting: ' + loc.hostees.map(esc).join(', ') + '</small>' : ''}`;
        L.marker([loc.lat, loc.lng]).addTo(mapInstance).bindPopup(popup);
      });
    } catch {}
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  window.initUserFeatures = async function(user) {
    me = user;
    if (!me?.u_id) return;
    await initTags(me.h_id);
    await loadFriendHosting();
    await loadConversations();
  };

  // Map loads regardless of login
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
  } else {
    initMap();
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();

(function () {
  const text = "IMC Housing Portal";
  const typeEl = document.getElementById("typewriter");
  const dotEl = document.getElementById("type-dot");
  const logoEl = document.getElementById("cover-logo");
  const caretEl = document.querySelector(".typewriter__caret");

  if (!typeEl || !dotEl || !logoEl) return;

  const titleWrap = typeEl.closest(".cover__title");

  let i = 0;
  const speed = 55;

  function type() {
    if (i < text.length) {
      typeEl.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    } else {
      if (caretEl) caretEl.style.opacity = "0";

      setTimeout(() => dotEl.classList.add("is-visible"), 250);
      setTimeout(() => dotEl.classList.add("is-growing"), 550);

      setTimeout(() => {
        dotEl.style.opacity = "0";
        logoEl.classList.add("is-visible");
        titleWrap?.classList.add("is-typed");
      }, 1100);
    }
  }

  type();
})();


