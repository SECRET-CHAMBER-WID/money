const STORAGE_KEY = "secret-chamber-credits-state";
const SESSION_KEY = "secret-chamber-credits-session";
const UI_KEY = "secret-chamber-credits-ui";
const GITHUB_SYNC_KEY = "secret-chamber-credits-github-sync";
const ADMIN_NAME = "\uc704\ub4dc";
const ADMIN_PIN = "4001";
const ADMIN_ID = "operator-with-4001";
const VERSION = 5;

const COINS = [
  { key: "gold", label: "\uae08\ud654", short: "G", value: 10000, emoji: "\uD83D\uDFE1" },
  { key: "silver", label: "\uc740\ud654", short: "S", value: 1000, emoji: "\u26AA" },
  { key: "copper", label: "coin", short: "C", value: 1, emoji: "\uD83E\uDE99" },
];

const COLORS = ["#607d9c", "#56b7a9", "#d8b85f", "#c96f7d", "#59616d", "#4f8fbd", "#6b9a72", "#be7b56"];
const sourceId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
const channel = "BroadcastChannel" in window ? new BroadcastChannel("secret-chamber-credits") : null;

const remoteSync = {
  enabled: false,
  applying: false,
  push: null,
};

const githubSync = {
  config: loadGithubConfig(),
  applying: false,
  sha: "",
  timer: null,
};

let state = null;
let currentUserId = localStorage.getItem(SESSION_KEY);
let ui = loadUi();
let selectedManageUserId = null;
let adjustMode = "add";

const $ = (selector) => document.querySelector(selector);

const els = {
  authView: $("#authView"),
  appView: $("#appView"),
  authForm: $("#authForm"),
  authName: $("#authName"),
  authPin: $("#authPin"),
  authError: $("#authError"),
  welcomeText: $("#welcomeText"),
  heroName: $("#heroName"),
  profileShortcut: $("#profileShortcut"),
  searchInput: $("#searchInput"),
  krwMode: $("#krwMode"),
  coinMode: $("#coinMode"),
  walletBalance: $("#walletBalance"),
  walletSendButton: $("#walletSendButton"),
  roleBadge: $("#roleBadge"),
  adminPanel: $("#adminPanel"),
  seedAmountFields: $("#seedAmountFields"),
  seedButton: $("#seedButton"),
  resetButton: $("#resetButton"),
  githubOwner: $("#githubOwner"),
  githubRepo: $("#githubRepo"),
  githubBranch: $("#githubBranch"),
  githubPath: $("#githubPath"),
  githubToken: $("#githubToken"),
  githubAutoSync: $("#githubAutoSync"),
  githubSaveConfig: $("#githubSaveConfig"),
  githubPullButton: $("#githubPullButton"),
  githubPushButton: $("#githubPushButton"),
  githubSyncStatus: $("#githubSyncStatus"),
  peopleFilter: $("#peopleFilter"),
  peopleList: $("#peopleList"),
  ledgerList: $("#ledgerList"),
  chatList: $("#chatList"),
  chatForm: $("#chatForm"),
  chatInput: $("#chatInput"),
  alertList: $("#alertList"),
  markReadButton: $("#markReadButton"),
  unreadDot: $("#unreadDot"),
  profilePhotoButton: $("#profilePhotoButton"),
  photoInput: $("#photoInput"),
  profileForm: $("#profileForm"),
  profileName: $("#profileName"),
  profileAlias: $("#profileAlias"),
  profileError: $("#profileError"),
  logoutButton: $("#logoutButton"),
  fabButton: $("#fabButton"),
  transferDialog: $("#transferDialog"),
  transferForm: $("#transferForm"),
  transferTitle: $("#transferTitle"),
  recipientSelect: $("#recipientSelect"),
  transferAmountFields: $("#transferAmountFields"),
  transferMemo: $("#transferMemo"),
  transferError: $("#transferError"),
  manageDialog: $("#manageDialog"),
  manageForm: $("#manageForm"),
  manageTitle: $("#manageTitle"),
  manageAmountFields: $("#manageAmountFields"),
  manageMemo: $("#manageMemo"),
  manageError: $("#manageError"),
  toastRegion: $("#toastRegion"),
  emptyTemplate: $("#emptyTemplate"),
};

function loadUi() {
  try {
    return {
      tab: "home",
      currency: "krw",
      search: "",
      filter: "recent",
      ...JSON.parse(localStorage.getItem(UI_KEY) || "{}"),
    };
  } catch {
    return { tab: "home", currency: "krw", search: "", filter: "recent" };
  }
}

function saveUi() {
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}

function loadGithubConfig() {
  const defaults = {
    owner: "SECRET-CHAMBER-WID",
    repo: "money",
    branch: "main",
    path: "data/credits-state.json",
    token: "",
    auto: false,
  };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(GITHUB_SYNC_KEY) || "{}") };
  } catch {
    return defaults;
  }
}

function saveGithubConfig() {
  localStorage.setItem(GITHUB_SYNC_KEY, JSON.stringify(githubSync.config));
}

function createDefaultState() {
  return {
    version: VERSION,
    users: [],
    ledger: [],
    notifications: [],
    chats: [],
    settings: { seedAmount: 100000 },
    updatedAt: Date.now(),
  };
}

function loadState() {
  try {
    const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return normalizeState(loaded || createDefaultState());
  } catch {
    return createDefaultState();
  }
}

function normalizeState(nextState) {
  const base = createDefaultState();
  const merged = { ...base, ...(nextState || {}) };
  merged.version = VERSION;
  merged.users = Array.isArray(merged.users) ? merged.users : [];
  merged.ledger = Array.isArray(merged.ledger) ? merged.ledger : [];
  merged.notifications = Array.isArray(merged.notifications) ? merged.notifications : [];
  merged.chats = Array.isArray(merged.chats) ? merged.chats : [];
  merged.settings = { ...base.settings, ...(merged.settings || {}) };
  merged.users.forEach((user) => {
    user.name = normalizeName(user.name);
    user.alias = normalizeName(user.alias || "");
    user.photo = user.photo || "";
    user.balance = Math.max(0, Math.round(Number(user.balance) || 0));
    user.createdAt = Number(user.createdAt) || Date.now();
    user.lastActive = Number(user.lastActive) || user.createdAt;
  });
  return merged;
}

async function ensureAdmin() {
  const adminHash = await hashPin(ADMIN_PIN);
  let admin = state.users.find((user) => user.id === ADMIN_ID || user.isAdmin);
  if (!admin) {
    admin = {
      id: ADMIN_ID,
      name: ADMIN_NAME,
      alias: "",
      pinHash: adminHash,
      photo: "",
      balance: 0,
      isAdmin: true,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    state.users.unshift(admin);
  }

  admin.id = ADMIN_ID;
  admin.name = ADMIN_NAME;
  admin.pinHash = adminHash;
  admin.isAdmin = true;
  admin.balance = Math.max(0, Math.round(Number(admin.balance) || 0));
}

async function hashPin(pin) {
  const normalized = String(pin).trim();
  if (crypto.subtle) {
    const bytes = new TextEncoder().encode(`secret-chamber:${normalized}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `fallback:${btoa(normalized)}`;
}

function uid(prefix = "id") {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function normalizeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function comparableName(name) {
  return normalizeName(name).toLocaleLowerCase("ko-KR");
}

function getUser(userId) {
  return state.users.find((user) => user.id === userId) || null;
}

function currentUser() {
  return getUser(currentUserId);
}

function displayName(user) {
  if (!user) return "\uc0ad\uc81c\ub41c \uc0ac\uc6a9\uc790";
  return user.alias?.trim() || user.name || "\uc54c \uc218 \uc5c6\uc74c";
}

function snapshotName(userId) {
  return displayName(getUser(userId));
}

function persist({ broadcast = true, remote = true } = {}) {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (broadcast && channel) channel.postMessage({ type: "state", sourceId, state });
  if (remote && remoteSync.enabled && remoteSync.push && !remoteSync.applying) remoteSync.push(state);
  if (remote && githubSync.config.auto && githubConfigReady() && !githubSync.applying) queueGithubPush();
}

function showAuthenticatedApp() {
  els.authView.classList.add("is-hidden");
  els.appView.classList.remove("is-hidden");
}

function showAuth() {
  els.appView.classList.add("is-hidden");
  els.authView.classList.remove("is-hidden");
}

function formatAmount(amount, mode = ui.currency) {
  const value = Math.max(0, Math.round(Number(amount) || 0));
  if (mode === "coin") {
    return coinParts(value).map((part) => `${part.emoji} ${part.count.toLocaleString("ko-KR")} ${part.label}`).join("  ");
  }
  return `${value.toLocaleString("ko-KR")}\uc6d0`;
}

function coinParts(amount) {
  let rest = Math.max(0, Math.round(Number(amount) || 0));
  const parts = [];
  COINS.forEach((coin) => {
    const count = Math.floor(rest / coin.value);
    rest %= coin.value;
    if (count > 0) parts.push({ ...coin, count });
  });
  return parts.length ? parts : [{ ...COINS[COINS.length - 1], count: 0 }];
}

function renderAmountInto(element, amount) {
  element.textContent = "";
  element.classList.toggle("coin-amount", ui.currency === "coin");
  if (ui.currency !== "coin") {
    element.textContent = formatAmount(amount);
    return;
  }

  coinParts(amount).forEach((part) => {
    const item = document.createElement("span");
    item.className = "coin-part";

    const emoji = document.createElement("span");
    emoji.className = "coin-emoji";
    emoji.textContent = part.emoji;

    const count = document.createElement("span");
    count.textContent = part.count.toLocaleString("ko-KR");

    const unit = document.createElement("small");
    unit.className = `coin-unit${part.key === "copper" ? " is-coin" : ""}`;
    unit.textContent = part.label;

    item.append(emoji, count, unit);
    element.append(item);
  });
}

function parseAmount(container) {
  if (ui.currency === "krw") {
    const input = container.querySelector("[data-amount='krw']");
    return Math.round(Number(input?.value || 0));
  }

  return COINS.reduce((sum, coin) => {
    const input = container.querySelector(`[data-coin='${coin.key}']`);
    return sum + Math.round(Number(input?.value || 0)) * coin.value;
  }, 0);
}

function splitCoins(amount) {
  let rest = Math.max(0, Math.round(Number(amount) || 0));
  return COINS.map((coin) => {
    const count = Math.floor(rest / coin.value);
    rest %= coin.value;
    return { ...coin, count };
  });
}

function renderAmountFields(container, amount = 0, options = {}) {
  container.textContent = "";
  const maxAmount = Number.isFinite(options.maxAmount) ? Math.max(0, Math.round(options.maxAmount)) : null;
  if (ui.currency === "krw") {
    const label = document.createElement("label");
    label.textContent = "\uae08\uc561";
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "1";
    input.step = "1";
    input.placeholder = maxAmount === null ? "0" : `0 ~ ${formatAmount(maxAmount, "krw")}`;
    if (maxAmount !== null) input.max = String(maxAmount);
    input.value = amount > 0 ? String(Math.round(amount)) : "";
    input.dataset.amount = "krw";
    label.append(input);
    container.append(label);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "coin-grid";
  const maxCoins = maxAmount === null ? [] : splitCoins(maxAmount);
  splitCoins(amount).forEach((coin, index) => {
    const label = document.createElement("label");
    label.textContent = `${coin.emoji} ${coin.key === "copper" ? "coin" : `${coin.label} (${coin.short})`}`;
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.step = "1";
    input.placeholder = maxAmount === null ? "0" : `0 ~ ${maxCoins[index]?.count || 0}`;
    if (maxAmount !== null) input.max = String(maxCoins[index]?.count || 0);
    input.value = coin.count ? String(coin.count) : "";
    input.dataset.coin = coin.key;
    label.append(input);
    grid.append(label);
  });
  container.append(grid);
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function colorForUser(user) {
  const seed = Array.from(user?.id || user?.name || "scc").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return COLORS[seed % COLORS.length];
}

function initialForUser(user) {
  const name = displayName(user);
  return Array.from(name)[0]?.toUpperCase() || "S";
}

function setAvatarElement(element, user) {
  element.textContent = user?.photo ? "" : initialForUser(user);
  element.style.backgroundColor = colorForUser(user);
  element.style.backgroundImage = user?.photo ? `url("${user.photo}")` : "";
}

function makeIconUse(iconId) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${iconId}`);
  svg.append(use);
  return svg;
}

function emptyState(message) {
  const node = els.emptyTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector("p").textContent = message;
  return node;
}

function renderAll() {
  const user = currentUser();
  if (!user) {
    if (currentUserId) localStorage.removeItem(SESSION_KEY);
    currentUserId = null;
    showAuth();
    return;
  }

  showAuthenticatedApp();
  renderHeader(user);
  renderHome(user);
  renderChat(user);
  renderAlerts(user);
  renderProfile(user);
  renderActiveTab();
}

function renderHeader(user) {
  els.welcomeText.textContent = remoteSync.enabled ? "Secret Chamber Credits - Live" : "Secret Chamber Credits";
  els.heroName.textContent = displayName(user);
  setAvatarElement(els.profileShortcut, user);
  els.searchInput.value = ui.search;
  els.krwMode.classList.toggle("is-active", ui.currency === "krw");
  els.coinMode.classList.toggle("is-active", ui.currency === "coin");
}

function renderHome(user) {
  renderAmountInto(els.walletBalance, user.balance);
  els.roleBadge.textContent = user.isAdmin ? "Operator" : "Member";
  els.roleBadge.classList.toggle("operator", user.isAdmin);
  els.adminPanel.classList.toggle("is-hidden", !user.isAdmin);
  renderGithubSyncPanel();
  els.peopleFilter.value = ui.filter;
  renderAmountFields(els.seedAmountFields, state.settings.seedAmount);
  renderPeople(user);
  renderLedger(user);
}

function renderGithubSyncPanel() {
  if (!els.githubOwner) return;
  const config = githubSync.config;
  els.githubOwner.value = config.owner;
  els.githubRepo.value = config.repo;
  els.githubBranch.value = config.branch;
  els.githubPath.value = config.path;
  els.githubToken.value = config.token;
  els.githubAutoSync.checked = Boolean(config.auto);
  const ready = githubConfigReady();
  els.githubSyncStatus.textContent = ready && config.auto ? "Auto" : ready ? "Ready" : "Off";
  els.githubSyncStatus.classList.toggle("is-on", ready && config.auto);
}

function visibleUsers() {
  const term = comparableName(ui.search);
  let users = state.users.filter((person) => !person.isAdmin);
  if (term) users = users.filter((user) => comparableName(`${user.name} ${user.alias || ""}`).includes(term));

  users.sort((a, b) => {
    if (ui.filter === "name") return comparableName(a.name).localeCompare(comparableName(b.name), "ko-KR");
    if (ui.filter === "rank") return (b.balance || 0) - (a.balance || 0);
    return (b.lastActive || b.createdAt || 0) - (a.lastActive || a.createdAt || 0);
  });

  const myIndex = users.findIndex((user) => user.id === currentUserId);
  if (myIndex > 0) {
    const [me] = users.splice(myIndex, 1);
    users.unshift(me);
  }

  return users;
}

function renderPeople(user) {
  els.peopleList.textContent = "";
  const users = visibleUsers();
  if (!users.length) {
    els.peopleList.append(emptyState("\uac80\uc0c9\ub41c \uc0ac\uc6a9\uc790\uac00 \uc5c6\uc2b5\ub2c8\ub2e4"));
    return;
  }

  users.forEach((person, index) => {
    const card = document.createElement("article");
    card.className = `person-card${person.id === user.id ? " is-me" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    setAvatarElement(avatar, person);

    const main = document.createElement("div");
    main.className = "person-main";

    const title = document.createElement("div");
    title.className = "person-title";
    const strong = document.createElement("strong");
    strong.textContent = person.id === user.id ? `${person.name} - \ub098` : person.name;
    title.append(strong);
    if (person.isAdmin) title.append(makeIconUse("icon-crown"));

    const sub = document.createElement("p");
    sub.className = "person-sub";
    sub.textContent = person.alias?.trim() || (person.isAdmin ? "Secret Chamber Operator" : `#${String(index + 1).padStart(2, "0")}`);
    main.append(title, sub);

    const balance = document.createElement("span");
    balance.className = "person-balance";
    renderAmountInto(balance, person.balance);
    main.append(balance);

    const actions = document.createElement("div");
    actions.className = "person-actions";
    if (user.isAdmin) {
      const manage = document.createElement("button");
      manage.className = "mini-button";
      manage.type = "button";
      manage.setAttribute("aria-label", `${person.name} adjust`);
      manage.textContent = "+/-";
      manage.addEventListener("click", () => openManageDialog(person.id));
      actions.append(manage);

      if (!person.isAdmin) {
        const remove = document.createElement("button");
        remove.className = "mini-button danger";
        remove.type = "button";
        remove.setAttribute("aria-label", `${person.name} delete`);
        remove.append(makeIconUse("icon-trash"));
        remove.addEventListener("click", () => deleteUser(person.id));
        actions.append(remove);
      }
    } else if (person.id !== user.id) {
      const send = document.createElement("button");
      send.className = "mini-button";
      send.type = "button";
      send.setAttribute("aria-label", `${person.name} transfer`);
      send.append(makeIconUse("icon-send"));
      send.addEventListener("click", () => openTransferDialog(person.id));
      actions.append(send);
    } else {
      const own = document.createElement("button");
      own.className = "mini-button";
      own.type = "button";
      own.disabled = true;
      own.setAttribute("aria-label", "current user");
      own.append(makeIconUse("icon-check"));
      actions.append(own);
    }

    card.append(avatar, main, actions);
    els.peopleList.append(card);
  });
}

function renderLedger(user) {
  els.ledgerList.textContent = "";
  const entries = state.ledger.filter((entry) => user.isAdmin || entryTouchesUser(entry, user.id)).slice(0, 40);
  if (!entries.length) {
    els.ledgerList.append(emptyState("\uc774\ub3d9 \ub0b4\uc5ed\uc774 \uc5c6\uc2b5\ub2c8\ub2e4"));
    return;
  }
  entries.forEach((entry) => els.ledgerList.append(ledgerCard(entry)));
}

function ledgerCard(entry) {
  const card = document.createElement("article");
  card.className = "timeline-card";
  const header = document.createElement("header");
  const title = document.createElement("strong");
  title.textContent = ledgerTitle(entry);
  const time = document.createElement("time");
  time.dateTime = new Date(entry.createdAt).toISOString();
  time.textContent = formatTime(entry.createdAt);
  header.append(title, time);
  const body = document.createElement("p");
  body.textContent = ledgerBody(entry);
  card.append(header, body);
  return card;
}

function entryName(entry, field, idField) {
  return entry[field] || snapshotName(entry[idField]);
}

function ledgerTitle(entry) {
  if (entry.type === "transfer") return `${entryName(entry, "fromName", "fromId")} -> ${entryName(entry, "toName", "toId")}`;
  if (entry.type === "adjustment") {
    const sign = entry.direction === "subtract" ? "-" : "+";
    return `${entryName(entry, "targetName", "targetId")} ${sign}${formatAmount(entry.amount)}`;
  }
  if (entry.type === "seed") return `${entryName(entry, "targetName", "targetId")} \ucd08\uae30 \uc790\ubcf8`;
  if (entry.type === "delete") return `${entry.targetName || "\uc0ac\uc6a9\uc790"} \uc0ad\uc81c`;
  if (entry.type === "reset") return "\ud06c\ub808\ub527 \ub9ac\uc14b";
  return "Update";
}

function ledgerBody(entry) {
  if (entry.type === "transfer") return `${formatAmount(entry.amount)} - ${entry.memo || "\uc1a1\uae08"}`;
  if (entry.type === "adjustment") return `${entryName(entry, "operatorName", "operatorId")} - ${entry.memo || "\uad00\ub9ac\uc790 \uc870\uc815"}`;
  if (entry.type === "seed") return `${formatAmount(entry.amount)} - ${entryName(entry, "operatorName", "operatorId")}`;
  if (entry.type === "delete") return `${entryName(entry, "operatorName", "operatorId")} - ${entry.memo || "\uc0ac\uc6a9\uc790 \uc0ad\uc81c"}`;
  if (entry.type === "reset") return `${entryName(entry, "operatorName", "operatorId")} - all wallets 0`;
  return entry.memo || "";
}

function entryTouchesUser(entry, userId) {
  return entry.fromId === userId || entry.toId === userId || entry.targetId === userId || entry.operatorId === userId;
}

function renderChat(user) {
  els.chatList.textContent = "";
  const chats = state.chats.slice(-80);
  if (!chats.length) {
    els.chatList.append(emptyState("\ucc44\ud305\uc774 \uc5c6\uc2b5\ub2c8\ub2e4"));
    return;
  }

  chats.forEach((chat) => {
    const bubble = document.createElement("article");
    bubble.className = `chat-bubble${chat.userId === user.id ? " own" : ""}`;
    const header = document.createElement("header");
    const strong = document.createElement("strong");
    strong.textContent = chat.userName || snapshotName(chat.userId);
    const time = document.createElement("time");
    time.dateTime = new Date(chat.createdAt).toISOString();
    time.textContent = formatTime(chat.createdAt);
    header.append(strong, time);
    const p = document.createElement("p");
    p.textContent = chat.message;
    bubble.append(header, p);
    els.chatList.append(bubble);
  });
}

function notificationsFor(user) {
  return state.notifications.filter((notice) => notice.userId === user.id || (user.isAdmin && notice.userId === "admin"));
}

function renderAlerts(user) {
  els.alertList.textContent = "";
  const alerts = notificationsFor(user);
  els.unreadDot.classList.toggle("is-hidden", alerts.length === 0);

  if (!alerts.length) {
    els.alertList.append(emptyState("\uc54c\ub9bc\uc774 \uc5c6\uc2b5\ub2c8\ub2e4"));
    return;
  }

  alerts.slice(0, 80).forEach((alert) => {
    const card = document.createElement("article");
    card.className = "timeline-card";
    const header = document.createElement("header");
    const strong = document.createElement("strong");
    strong.textContent = alert.title;
    const time = document.createElement("time");
    time.dateTime = new Date(alert.createdAt).toISOString();
    time.textContent = formatTime(alert.createdAt);
    header.append(strong, time);
    const body = document.createElement("p");
    body.textContent = alert.body;
    card.append(header, body);
    els.alertList.append(card);
  });
}

function renderProfile(user) {
  setAvatarElement(els.profilePhotoButton, user);
  els.profileName.value = user.name;
  els.profileAlias.value = user.alias || "";
  els.profileName.disabled = user.isAdmin;
}

function renderActiveTab() {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("is-active"));
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.remove("is-active"));
  $(`#${ui.tab}Tab`)?.classList.add("is-active");
  document.querySelector(`[data-tab='${ui.tab}']`)?.classList.add("is-active");
}

function setTab(tab) {
  ui.tab = tab;
  saveUi();
  renderActiveTab();
  if (tab === "chat") requestAnimationFrame(scrollActiveScreenToBottom);
}

function scrollActiveScreenToBottom() {
  const screen = document.querySelector(".screen.is-active");
  if (screen) screen.scrollTo({ top: screen.scrollHeight, behavior: "smooth" });
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function openTransferDialog(preselectedUserId = "") {
  const user = currentUser();
  if (!user) return;
  els.transferError.textContent = "";
  els.transferMemo.value = "";
  renderRecipientOptions(preselectedUserId);
  renderAmountFields(els.transferAmountFields, 0, { maxAmount: user.balance || 0 });
  els.transferTitle.textContent = "\ud06c\ub808\ub527 \ubcf4\ub0b4\uae30";
  openDialog(els.transferDialog);
}

function renderRecipientOptions(preselectedUserId = "") {
  const user = currentUser();
  els.recipientSelect.textContent = "";
  state.users
    .filter((person) => person.id !== user.id && !person.isAdmin)
    .sort((a, b) => comparableName(a.name).localeCompare(comparableName(b.name), "ko-KR"))
    .forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.isAdmin ? `${person.name} - Operator` : person.name;
      if (person.id === preselectedUserId) option.selected = true;
      els.recipientSelect.append(option);
    });
}

function openManageDialog(userId) {
  const user = currentUser();
  if (!user?.isAdmin) return;
  selectedManageUserId = userId;
  adjustMode = "add";
  els.manageError.textContent = "";
  els.manageMemo.value = "";
  const target = getUser(userId);
  els.manageTitle.textContent = `${target?.name || "\uc0ac\uc6a9\uc790"} \uae08\uc561 \uc870\uc815`;
  document.querySelectorAll("[data-adjust]").forEach((button) => button.classList.toggle("is-active", button.dataset.adjust === adjustMode));
  renderAmountFields(els.manageAmountFields);
  openDialog(els.manageDialog);
}

function addNotification(userId, title, body, createdAt = Date.now()) {
  state.notifications.unshift({ id: uid("notice"), userId, title, body, createdAt });
  state.notifications = state.notifications.slice(0, 300);
}

function enrichLedger(entry) {
  const fullEntry = { id: uid("ledger"), createdAt: Date.now(), memo: "", ...entry };
  if (fullEntry.fromId) fullEntry.fromName = fullEntry.fromName || snapshotName(fullEntry.fromId);
  if (fullEntry.toId) fullEntry.toName = fullEntry.toName || snapshotName(fullEntry.toId);
  if (fullEntry.targetId) fullEntry.targetName = fullEntry.targetName || snapshotName(fullEntry.targetId);
  if (fullEntry.operatorId) fullEntry.operatorName = fullEntry.operatorName || snapshotName(fullEntry.operatorId);
  return fullEntry;
}

function addLedger(entry) {
  const fullEntry = enrichLedger(entry);
  state.ledger.unshift(fullEntry);
  state.ledger = state.ledger.slice(0, 400);
  createLedgerNotifications(fullEntry);
  persist();
  renderAll();
  toastForLedger(fullEntry);
}

function createLedgerNotifications(entry) {
  if (entry.type === "transfer") {
    const amount = formatAmount(entry.amount);
    addNotification(entry.toId, "\ud06c\ub808\ub527 \ub3c4\ucc29", `${entry.fromName}\ub2d8\uc774 ${amount}\ub97c \ubcf4\ub0c8\uc2b5\ub2c8\ub2e4.`, entry.createdAt);
    addNotification(entry.fromId, "\uc1a1\uae08 \uc644\ub8cc", `${entry.toName}\ub2d8\uc5d0\uac8c ${amount}\ub97c \ubcf4\ub0c8\uc2b5\ub2c8\ub2e4.`, entry.createdAt);
    addNotification("admin", "\ud06c\ub808\ub527 \uc774\ub3d9", `${entry.fromName} -> ${entry.toName} - ${amount}`, entry.createdAt);
    return;
  }

  if (entry.type === "adjustment") {
    const sign = entry.direction === "subtract" ? "-" : "+";
    const amount = `${sign}${formatAmount(entry.amount)}`;
    addNotification(entry.targetId, "\uae08\uc561 \uc870\uc815", `${entry.operatorName}\ub2d8\uc774 ${amount} \uc870\uc815\ud588\uc2b5\ub2c8\ub2e4.`, entry.createdAt);
    addNotification("admin", "\uad00\ub9ac\uc790 \uc870\uc815", `${entry.targetName} - ${amount}`, entry.createdAt);
    return;
  }

  if (entry.type === "seed") {
    const amount = formatAmount(entry.amount);
    addNotification(entry.targetId, "\ucd08\uae30 \uc790\ubcf8", `${amount} \uc9c0\uae09`, entry.createdAt);
    addNotification("admin", "\ucd08\uae30 \uc790\ubcf8 \uc9c0\uae09", `${entry.targetName} - ${amount}`, entry.createdAt);
    return;
  }

  if (entry.type === "delete") {
    addNotification("admin", "\uc0ac\uc6a9\uc790 \uc0ad\uc81c", `${entry.targetName} \uc0ad\uc81c`, entry.createdAt);
    return;
  }

  if (entry.type === "reset") {
    state.users.forEach((user) => addNotification(user.id, "\ud06c\ub808\ub527 \ub9ac\uc14b", `${entry.operatorName}\ub2d8\uc774 \uc9c0\uac11\uc744 \ub9ac\uc14b\ud588\uc2b5\ub2c8\ub2e4.`, entry.createdAt));
    addNotification("admin", "\ud06c\ub808\ub527 \ub9ac\uc14b", "\ubaa8\ub4e0 \uc9c0\uac11\uc774 0\uc6d0\uc73c\ub85c \ubcc0\uacbd\ub418\uc5c8\uc2b5\ub2c8\ub2e4.", entry.createdAt);
  }
}

function toastForLedger(entry) {
  const user = currentUser();
  if (!user) return;
  if (!user.isAdmin && !entryTouchesUser(entry, user.id)) return;

  if (entry.type === "transfer") {
    if (entry.toId === user.id) showToast("\ud06c\ub808\ub527 \ub3c4\ucc29", `${entry.fromName}\ub2d8\uc774 ${formatAmount(entry.amount)}\ub97c \ubcf4\ub0c8\uc2b5\ub2c8\ub2e4.`);
    else if (entry.fromId === user.id) showToast("\uc1a1\uae08 \uc644\ub8cc", `${entry.toName}\ub2d8\uc5d0\uac8c ${formatAmount(entry.amount)}\ub97c \ubcf4\ub0c8\uc2b5\ub2c8\ub2e4.`);
    else if (user.isAdmin) showToast("\ud06c\ub808\ub527 \uc774\ub3d9", `${entry.fromName} -> ${entry.toName} - ${formatAmount(entry.amount)}`);
    return;
  }

  if (entry.type === "adjustment") {
    const sign = entry.direction === "subtract" ? "-" : "+";
    showToast("\uae08\uc561 \uc870\uc815", `${entry.targetName} - ${sign}${formatAmount(entry.amount)}`);
    return;
  }

  if (entry.type === "seed") {
    showToast("\ucd08\uae30 \uc790\ubcf8 \uc9c0\uae09", `${entry.targetName} - ${formatAmount(entry.amount)}`);
    return;
  }

  if (entry.type === "delete") showToast("\uc0ac\uc6a9\uc790 \uc0ad\uc81c", entry.targetName);
  if (entry.type === "reset") showToast("\ud06c\ub808\ub527 \ub9ac\uc14b", "\ubaa8\ub4e0 \uc9c0\uac11\uc774 0\uc6d0\uc73c\ub85c \ubcc0\uacbd\ub418\uc5c8\uc2b5\ub2c8\ub2e4.");
}

function showToast(title, body) {
  els.toastRegion.textContent = "";
  const toast = document.createElement("article");
  toast.className = "toast";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("p");
  p.textContent = body;
  toast.append(strong, p);
  els.toastRegion.append(toast);
  window.setTimeout(() => {
    if (!toast.isConnected) return;
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
  }, 4800);
  window.setTimeout(() => {
    toast.remove();
  }, 5000);
}

function updateGithubConfigFromFields() {
  githubSync.config = {
    owner: normalizeName(els.githubOwner.value),
    repo: normalizeName(els.githubRepo.value),
    branch: normalizeName(els.githubBranch.value) || "main",
    path: normalizeName(els.githubPath.value) || "data/credits-state.json",
    token: els.githubToken.value.trim(),
    auto: els.githubAutoSync.checked,
  };
  saveGithubConfig();
  renderGithubSyncPanel();
  restartGithubPolling();
}

function githubConfigReady() {
  const config = githubSync.config;
  return Boolean(config.owner && config.repo && config.branch && config.path && config.token);
}

function githubApiUrl() {
  const config = githubSync.config;
  const encodedPath = config.path.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}`;
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${githubSync.config.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodeBase64Unicode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Unicode(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function fetchGithubFile() {
  if (!githubConfigReady()) throw new Error("GitHub sync config missing.");
  const url = `${githubApiUrl()}?ref=${encodeURIComponent(githubSync.config.branch)}`;
  const response = await fetch(url, { headers: githubHeaders(), cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub pull failed: ${response.status}`);
  const payload = await response.json();
  githubSync.sha = payload.sha || "";
  return {
    sha: payload.sha || "",
    state: normalizeState(JSON.parse(decodeBase64Unicode(payload.content || ""))),
  };
}

async function pullFromGithub({ quiet = false } = {}) {
  if (!githubConfigReady()) {
    if (!quiet) showToast("GitHub Sync", "Owner, repo, path, token required.");
    return;
  }

  try {
    githubSync.applying = true;
    const remote = await fetchGithubFile();
    if (remote?.state) {
      state = remote.state;
      await ensureAdmin();
      persist({ remote: false });
      renderAll();
      if (!quiet) showToast("GitHub Pull", "Credits loaded from repository.");
    } else if (!quiet) {
      showToast("GitHub Pull", "No data file yet.");
    }
  } catch (error) {
    if (!quiet) showToast("GitHub Pull Failed", error.message);
  } finally {
    githubSync.applying = false;
  }
}

async function pushToGithub({ quiet = false } = {}) {
  if (!githubConfigReady()) {
    if (!quiet) showToast("GitHub Sync", "Owner, repo, path, token required.");
    return;
  }

  try {
    githubSync.applying = true;
    const latest = await fetchGithubFile();
    const nextState = normalizeState(state);
    const body = {
      message: `Update Secret Chamber Credits ${new Date().toISOString()}`,
      content: encodeBase64Unicode(JSON.stringify(nextState, null, 2)),
      branch: githubSync.config.branch,
      committer: { name: "Secret Chamber Credits", email: "actions@users.noreply.github.com" },
    };
    if (latest?.sha) body.sha = latest.sha;

    const response = await fetch(githubApiUrl(), {
      method: "PUT",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`GitHub push failed: ${response.status}`);
    const payload = await response.json();
    githubSync.sha = payload.content?.sha || "";
    if (!quiet) showToast("GitHub Push", "Credits uploaded to repository.");
  } catch (error) {
    if (!quiet) showToast("GitHub Push Failed", error.message);
  } finally {
    githubSync.applying = false;
  }
}

let githubPushTimer = null;

function queueGithubPush() {
  window.clearTimeout(githubPushTimer);
  githubPushTimer = window.setTimeout(() => pushToGithub({ quiet: true }), 1400);
}

function restartGithubPolling() {
  window.clearInterval(githubSync.timer);
  if (!githubSync.config.auto || !githubConfigReady()) return;
  githubSync.timer = window.setInterval(() => pullFromGithub({ quiet: true }), 15000);
}

function transferCredits(toId, amount, memo) {
  const from = currentUser();
  const to = getUser(toId);
  if (!from || !to) return "\ubc1b\ub294 \uc0ac\ub78c\uc744 \uc120\ud0dd\ud574\uc8fc\uc138\uc694.";
  if (from.id === to.id) return "\uc790\uae30 \uc790\uc2e0\uc5d0\uac8c\ub294 \ubcf4\ub0bc \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.";
  if (!Number.isFinite(amount) || amount <= 0) return "\uae08\uc561\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694.";
  if ((from.balance || 0) < amount) return "\uc794\uc561\uc774 \ubd80\uc871\ud569\ub2c8\ub2e4.";

  from.balance = Math.max(0, Math.round(from.balance - amount));
  to.balance = Math.round((to.balance || 0) + amount);
  from.lastActive = Date.now();
  to.lastActive = Date.now();
  addLedger({ type: "transfer", fromId: from.id, toId: to.id, amount, memo });
  return "";
}

function adjustCredits(targetId, amount, direction, memo) {
  const operator = currentUser();
  const target = getUser(targetId);
  if (!operator?.isAdmin) return "Operator only.";
  if (!target) return "User not found.";
  if (!Number.isFinite(amount) || amount <= 0) return "\uae08\uc561\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694.";
  if (direction === "subtract" && (target.balance || 0) < amount) return "\uc794\uc561\ubcf4\ub2e4 \ud070 \uae08\uc561\uc740 \ube84 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.";

  target.balance = direction === "subtract" ? Math.round(target.balance - amount) : Math.round((target.balance || 0) + amount);
  target.lastActive = Date.now();
  operator.lastActive = Date.now();
  addLedger({ type: "adjustment", operatorId: operator.id, targetId: target.id, amount, direction, memo });
  return "";
}

function seedCapital(amount) {
  const operator = currentUser();
  if (!operator?.isAdmin) return "Operator only.";
  if (!Number.isFinite(amount) || amount <= 0) return "\ucd08\uae30 \uc790\ubcf8\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694.";
  const targets = state.users.filter((user) => !user.isAdmin);
  if (!targets.length) return "\uc9c0\uae09\ud560 \uc0ac\uc6a9\uc790\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.";

  state.settings.seedAmount = amount;
  const now = Date.now();
  targets.forEach((target) => {
    target.balance = Math.round((target.balance || 0) + amount);
    target.lastActive = now;
    const entry = enrichLedger({ type: "seed", operatorId: operator.id, targetId: target.id, amount, memo: "\ucd08\uae30 \uc790\ubcf8", createdAt: now });
    state.ledger.unshift(entry);
    createLedgerNotifications(entry);
  });
  state.ledger = state.ledger.slice(0, 400);
  persist();
  renderAll();
  showToast("\ucd08\uae30 \uc790\ubcf8 \uc9c0\uae09", `${targets.length}\uba85 - ${formatAmount(amount)}`);
  return "";
}

function resetCredits() {
  const operator = currentUser();
  if (!operator?.isAdmin) return;
  const confirmed = window.confirm("Reset every wallet to 0?");
  if (!confirmed) return;

  state.users.forEach((user) => {
    user.balance = 0;
    user.lastActive = Date.now();
  });
  state.ledger = [];
  state.notifications = [];
  addLedger({ type: "reset", operatorId: operator.id, amount: 0, memo: "reset" });
}

function deleteUser(targetId) {
  const operator = currentUser();
  const target = getUser(targetId);
  if (!operator?.isAdmin || !target || target.isAdmin) return;
  const confirmed = window.confirm(`Delete ${target.name}?`);
  if (!confirmed) return;

  const entry = enrichLedger({ type: "delete", operatorId: operator.id, targetId: target.id, targetName: displayName(target), memo: "delete user" });
  state.users = state.users.filter((user) => user.id !== target.id);
  state.notifications = state.notifications.filter((notice) => notice.userId !== target.id);
  state.ledger.unshift(entry);
  createLedgerNotifications(entry);
  persist();
  renderAll();
  toastForLedger(entry);
}

async function handleAuth(event) {
  event.preventDefault();
  els.authError.textContent = "";
  const name = normalizeName(els.authName.value);
  const pin = els.authPin.value.trim();

  if (!name) {
    els.authError.textContent = "\uc774\ub984\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694.";
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    els.authError.textContent = "\uc778\uc99d\ubc88\ud638\ub294 \uc22b\uc790 4\uc790\ub9ac\uc785\ub2c8\ub2e4.";
    return;
  }

  const isAdminAttempt = comparableName(name) === comparableName(ADMIN_NAME);
  if (isAdminAttempt && pin !== ADMIN_PIN) {
    els.authError.textContent = "\uc6b4\uc601\uc790 \uc778\uc99d\ubc88\ud638\uac00 \ub2e4\ub985\ub2c8\ub2e4.";
    return;
  }

  const pinHash = await hashPin(pin);
  let user = state.users.find((person) => comparableName(person.name) === comparableName(name));
  let created = false;

  if (user) {
    if (user.pinHash !== pinHash) {
      els.authError.textContent = "\uc778\uc99d\ubc88\ud638\uac00 \ub2e4\ub985\ub2c8\ub2e4.";
      return;
    }
  } else if (isAdminAttempt) {
    user = getUser(ADMIN_ID);
  } else {
    user = {
      id: uid("user"),
      name,
      alias: "",
      pinHash,
      photo: "",
      balance: 0,
      isAdmin: false,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    state.users.push(user);
    created = true;
  }

  user.lastActive = Date.now();
  if (created) {
    addNotification("admin", "\uc2e0\uaddc \uc0ac\uc6a9\uc790", `${user.name}\ub2d8\uc774 \uc0dd\uc131\ub418\uc5c8\uc2b5\ub2c8\ub2e4.`, Date.now());
  }
  currentUserId = user.id;
  localStorage.setItem(SESSION_KEY, currentUserId);
  persist();
  els.authForm.reset();
  ui.tab = "home";
  saveUi();
  renderAll();
}

function handleProfileSave(event) {
  event.preventDefault();
  const user = currentUser();
  if (!user) return;

  els.profileError.textContent = "";
  const nextName = normalizeName(els.profileName.value);
  const nextAlias = normalizeName(els.profileAlias.value);
  if (!nextName) {
    els.profileError.textContent = "\uc774\ub984\uc744 \uc785\ub825\ud574\uc8fc\uc138\uc694.";
    return;
  }
  if (!user.isAdmin && comparableName(nextName) === comparableName(ADMIN_NAME)) {
    els.profileError.textContent = "\uc6b4\uc601\uc790 \uc774\ub984\uc740 \uc0ac\uc6a9\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.";
    return;
  }
  const duplicate = state.users.some((person) => person.id !== user.id && comparableName(person.name) === comparableName(nextName));
  if (duplicate) {
    els.profileError.textContent = "\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \uc774\ub984\uc785\ub2c8\ub2e4.";
    return;
  }

  if (!user.isAdmin) user.name = nextName;
  user.alias = nextAlias;
  user.lastActive = Date.now();
  persist();
  renderAll();
  showToast("\ud504\ub85c\ud544 \uc800\uc7a5", displayName(user));
}

async function handlePhoto(file) {
  const user = currentUser();
  if (!user || !file) return;
  try {
    user.photo = await resizeImage(file);
    user.lastActive = Date.now();
    persist();
    renderAll();
    showToast("\ud504\ub85c\ud544 \uc0ac\uc9c4 \uc800\uc7a5", displayName(user));
  } catch {
    showToast("\uc0ac\uc9c4 \uc800\uc7a5 \uc2e4\ud328", "\ub2e4\ub978 \uc774\ubbf8\uc9c0\ub97c \uc120\ud0dd\ud574\uc8fc\uc138\uc694.");
  }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const size = 420;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const side = Math.min(image.width, image.height);
        const sx = (image.width - side) / 2;
        const sy = (image.height - side) / 2;
        ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function handleIncomingState(nextState) {
  const wasLoggedIn = Boolean(currentUserId);
  const knownLedgerIds = new Set((state?.ledger || []).map((entry) => entry.id));
  state = normalizeState(nextState);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  if (wasLoggedIn && !currentUser()) showToast("\uc0ac\uc6a9\uc790 \uc0ad\uc81c", "\uacc4\uc815\uc774 \uc0ad\uc81c\ub418\uc5c8\uc2b5\ub2c8\ub2e4.");
  state.ledger
    .filter((entry) => !knownLedgerIds.has(entry.id))
    .reverse()
    .forEach((entry) => toastForLedger(entry));
}

async function initRemoteSync() {
  try {
    const configModule = await import("./firebase-config.js");
    if (!configModule.firebaseConfig) return;
    const [{ initializeApp }, databaseModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js"),
    ]);
    const { getDatabase, ref, get, set, onValue } = databaseModule;
    const app = initializeApp(configModule.firebaseConfig);
    const projectId = configModule.firebaseConfig.projectId;
    const databaseURL =
      configModule.firebaseConfig.databaseURL ||
      configModule.databaseURL ||
      (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : "");
    const database = databaseURL ? getDatabase(app, databaseURL) : getDatabase(app);
    const databasePath = configModule.databasePath || "secret-chamber-credits/state";
    const stateRef = ref(database, databasePath);

    remoteSync.enabled = true;
    remoteSync.push = async (nextState) => {
      try {
        await set(stateRef, JSON.parse(JSON.stringify(nextState)));
      } catch {
        showToast("Sync failed", "Check Firebase rules.");
      }
    };

    const snapshot = await get(stateRef);
    if (snapshot.exists()) {
      remoteSync.applying = true;
      state = normalizeState(snapshot.val());
      await ensureAdmin();
      persist({ broadcast: false, remote: false });
      remoteSync.applying = false;
    } else {
      await remoteSync.push(state);
    }

    onValue(stateRef, async (nextSnapshot) => {
      if (!nextSnapshot.exists() || remoteSync.applying) return;
      remoteSync.applying = true;
      const previousState = state;
      const incoming = normalizeState(nextSnapshot.val());
      state = incoming;
      await ensureAdmin();
      const incomingWithAdmin = state;
      state = previousState;
      handleIncomingState(incomingWithAdmin);
      remoteSync.applying = false;
    });
  } catch {
    remoteSync.enabled = false;
  }
}

function bindEvents() {
  els.authForm.addEventListener("submit", handleAuth);
  els.profileShortcut.addEventListener("click", () => setTab("profile"));

  els.searchInput.addEventListener("input", () => {
    ui.search = els.searchInput.value;
    saveUi();
    renderPeople(currentUser());
  });

  [els.krwMode, els.coinMode].forEach((button) => {
    button.addEventListener("click", () => {
      ui.currency = button.dataset.currency;
      saveUi();
      renderAll();
      if (els.transferDialog.open) renderAmountFields(els.transferAmountFields, 0, { maxAmount: currentUser()?.balance || 0 });
      if (els.manageDialog.open) renderAmountFields(els.manageAmountFields);
    });
  });

  els.peopleFilter.addEventListener("change", () => {
    ui.filter = els.peopleFilter.value;
    saveUi();
    renderPeople(currentUser());
  });

  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  els.fabButton.addEventListener("click", () => openTransferDialog());
  els.walletSendButton.addEventListener("click", () => openTransferDialog());
  document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => closeDialog(button.closest("dialog"))));

  els.transferForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = parseAmount(els.transferAmountFields);
    const error = transferCredits(els.recipientSelect.value, amount, normalizeName(els.transferMemo.value));
    els.transferError.textContent = error;
    if (!error) closeDialog(els.transferDialog);
  });

  document.querySelectorAll("[data-adjust]").forEach((button) => {
    button.addEventListener("click", () => {
      adjustMode = button.dataset.adjust;
      document.querySelectorAll("[data-adjust]").forEach((item) => item.classList.toggle("is-active", item.dataset.adjust === adjustMode));
    });
  });

  els.manageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = parseAmount(els.manageAmountFields);
    const error = adjustCredits(selectedManageUserId, amount, adjustMode, normalizeName(els.manageMemo.value));
    els.manageError.textContent = error;
    if (!error) closeDialog(els.manageDialog);
  });

  els.seedButton.addEventListener("click", () => {
    const error = seedCapital(parseAmount(els.seedAmountFields));
    if (error) showToast("\ucd08\uae30 \uc790\ubcf8", error);
  });

  els.resetButton.addEventListener("click", resetCredits);

  if (els.githubSaveConfig) {
    els.githubSaveConfig.addEventListener("click", () => {
      updateGithubConfigFromFields();
      showToast("GitHub Sync", githubConfigReady() ? "Saved." : "Saved, but token/config is incomplete.");
    });

    els.githubAutoSync.addEventListener("change", () => {
      updateGithubConfigFromFields();
      if (githubSync.config.auto && githubConfigReady()) {
        pushToGithub({ quiet: true });
        showToast("GitHub Sync", "Auto upload is on.");
      } else {
        showToast("GitHub Sync", "Auto upload is off.");
      }
    });

    els.githubPullButton.addEventListener("click", () => {
      updateGithubConfigFromFields();
      pullFromGithub();
    });

    els.githubPushButton.addEventListener("click", () => {
      updateGithubConfigFromFields();
      pushToGithub();
    });
  }

  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const user = currentUser();
    const message = normalizeName(els.chatInput.value);
    if (!user || !message) return;
    state.chats.push({ id: uid("chat"), userId: user.id, userName: displayName(user), message, createdAt: Date.now() });
    state.chats = state.chats.slice(-180);
    user.lastActive = Date.now();
    els.chatInput.value = "";
    persist();
    renderChat(user);
    requestAnimationFrame(scrollActiveScreenToBottom);
  });

  els.markReadButton.addEventListener("click", () => {
    const user = currentUser();
    if (!user) return;
    state.notifications = state.notifications.filter((notice) => !(notice.userId === user.id || (user.isAdmin && notice.userId === "admin")));
    persist();
    renderAlerts(user);
  });

  els.profileForm.addEventListener("submit", handleProfileSave);
  els.photoInput.addEventListener("change", () => handlePhoto(els.photoInput.files[0]));
  els.profilePhotoButton.addEventListener("click", () => els.photoInput.click());
  els.logoutButton.addEventListener("click", () => {
    currentUserId = null;
    localStorage.removeItem(SESSION_KEY);
    showAuth();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        handleIncomingState(JSON.parse(event.newValue));
      } catch {
        // Ignore invalid external storage writes.
      }
    }
  });

  if (channel) {
    channel.addEventListener("message", (event) => {
      if (event.data?.type === "state" && event.data.sourceId !== sourceId) handleIncomingState(event.data.state);
    });
  }
}

async function init() {
  state = loadState();
  await ensureAdmin();
  bindEvents();
  await initRemoteSync();
  if (githubSync.config.auto && githubConfigReady()) await pullFromGithub({ quiet: true });
  restartGithubPolling();
  persist({ broadcast: false, remote: false });

  if (!currentUser()) {
    currentUserId = null;
    localStorage.removeItem(SESSION_KEY);
  }

  renderAll();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js?v=3").catch(() => {});
  }
}

init();
