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

  $$("[data-open-login]").forEach((btn) => {
    btn.addEventListener("click", () => showLoginPanel());
  });

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
      target !== navUserChip &&
      !target.closest("[data-open-login], #nav-login-button, #nav-user-chip")
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
  fetchCurrentUser();

  console.log("portal.js loaded");
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

(function () {
  const sections = document.querySelectorAll(".snap-section[id]");
  const dots = document.querySelectorAll("[data-section-dot]");
  const revealEls = document.querySelectorAll(".reveal");

  const progressBar = document.getElementById("scroll-progress-bar");
  if (progressBar) {
    let ticking = false;
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateProgress);
      }
    }, { passive: true });
    updateProgress();
  }

  if (!("IntersectionObserver" in window)) return;

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        dots.forEach((dot) => {
          dot.classList.toggle("is-active", dot.dataset.sectionDot === entry.target.id);
        });
      });
    },
    { threshold: 0.5 }
  );
  sections.forEach((section) => sectionObserver.observe(section));

  document.documentElement.classList.add("js-reveal");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
})();


