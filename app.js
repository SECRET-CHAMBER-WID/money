const STORAGE_KEY = "secret-chamber-credits-state";
const SESSION_KEY = "secret-chamber-credits-session";
const UI_KEY = "secret-chamber-credits-ui";
const ADMIN_NAME = "위드";
const ADMIN_PIN = "4001";
const ADMIN_ID = "operator-with-4001";
const VERSION = 1;

const COINS = [
  { key: "gold", label: "금화", short: "G", value: 10000 },
  { key: "silver", label: "은화", short: "S", value: 1000 },
  { key: "copper", label: "동화", short: "C", value: 100 },
  { key: "tin", label: "주석", short: "T", value: 1 },
];

const ICONS = [
  { key: "onyx", symbol: "◆", color: "#607d9c" },
  { key: "mint", symbol: "✦", color: "#56b7a9" },
  { key: "gold", symbol: "●", color: "#d8b85f" },
  { key: "rose", symbol: "✚", color: "#c96f7d" },
  { key: "steel", symbol: "■", color: "#59616d" },
  { key: "wave", symbol: "◒", color: "#4f8fbd" },
  { key: "leaf", symbol: "✶", color: "#6b9a72" },
  { key: "ember", symbol: "▲", color: "#be7b56" },
  { key: "night", symbol: "✷", color: "#2f333a" },
  { key: "clear", symbol: "◇", color: "#8a97a8" },
];

const sourceId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
const channel = "BroadcastChannel" in window ? new BroadcastChannel("secret-chamber-credits") : null;
const remoteSync = {
  enabled: false,
  applying: false,
  push: null,
};

let state = null;
let currentUserId = localStorage.getItem(SESSION_KEY);
let ui = loadUi();
let selectedManageUserId = null;
let adjustMode = "add";
let selectedIconKey = ICONS[0].key;

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
  iconPicker: $("#iconPicker"),
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

function createDefaultState() {
  return {
    version: VERSION,
    users: [],
    ledger: [],
    notifications: [],
    chats: [],
    settings: {
      seedAmount: 100000,
    },
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
  merged.users = Array.isArray(merged.users) ? merged.users : [];
  merged.ledger = Array.isArray(merged.ledger) ? merged.ledger : [];
  merged.notifications = Array.isArray(merged.notifications) ? merged.notifications : [];
  merged.chats = Array.isArray(merged.chats) ? merged.chats : [];
  merged.settings = { ...base.settings, ...(merged.settings || {}) };
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
      iconKey: "night",
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
  admin.iconKey = admin.iconKey || "night";
  admin.balance = Number.isFinite(admin.balance) ? Math.max(0, Math.round(admin.balance)) : 0;
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

function getIcon(user) {
  return ICONS.find((icon) => icon.key === user?.iconKey) || ICONS[0];
}

function displayName(user) {
  if (!user) return "알 수 없음";
  return user.alias?.trim() || user.name;
}

function persist({ broadcast = true, remote = true } = {}) {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (broadcast && channel) {
    channel.postMessage({ type: "state", sourceId, state });
  }
  if (remote && remoteSync.enabled && remoteSync.push && !remoteSync.applying) {
    remoteSync.push(state);
  }
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
    let rest = value;
    const parts = [];
    COINS.forEach((coin) => {
      const count = Math.floor(rest / coin.value);
      rest %= coin.value;
      if (count > 0) parts.push(`${count.toLocaleString("ko-KR")} ${coin.label}`);
    });
    return parts.length ? parts.join(" ") : "0 주석";
  }
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value);
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

function renderAmountFields(container, amount = 0) {
  container.textContent = "";
  if (ui.currency === "krw") {
    const label = document.createElement("label");
    label.textContent = "금액";
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "1";
    input.step = "1";
    input.placeholder = "0";
    input.value = amount > 0 ? String(Math.round(amount)) : "";
    input.dataset.amount = "krw";
    label.append(input);
    container.append(label);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "coin-grid";
  splitCoins(amount).forEach((coin) => {
    const label = document.createElement("label");
    label.textContent = `${coin.label} (${coin.short})`;
    const input = document.createElement("input");
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.step = "1";
    input.placeholder = "0";
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

function setAvatarElement(element, user) {
  const icon = getIcon(user);
  element.textContent = user?.photo ? "" : icon.symbol;
  element.style.backgroundColor = icon.color;
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
  els.welcomeText.textContent = "Secret Chamber Credits";
  els.heroName.textContent = displayName(user);
  setAvatarElement(els.profileShortcut, user);
  els.searchInput.value = ui.search;
  els.krwMode.classList.toggle("is-active", ui.currency === "krw");
  els.coinMode.classList.toggle("is-active", ui.currency === "coin");
}

function renderHome(user) {
  els.walletBalance.textContent = formatAmount(user.balance);
  els.roleBadge.textContent = user.isAdmin ? "Operator" : "Member";
  els.roleBadge.classList.toggle("operator", user.isAdmin);
  els.adminPanel.classList.toggle("is-hidden", !user.isAdmin);
  els.peopleFilter.value = ui.filter;
  renderAmountFields(els.seedAmountFields, state.settings.seedAmount);
  renderPeople(user);
  renderLedger(user);
}

function visibleUsers() {
  const term = comparableName(ui.search);
  let users = [...state.users];
  if (term) {
    users = users.filter((user) => comparableName(`${user.name} ${user.alias || ""}`).includes(term));
  }

  users.sort((a, b) => {
    if (ui.filter === "name") return comparableName(a.name).localeCompare(comparableName(b.name), "ko-KR");
    if (ui.filter === "rank") return (b.balance || 0) - (a.balance || 0);
    return (b.lastActive || b.createdAt || 0) - (a.lastActive || a.createdAt || 0);
  });

  return users;
}

function renderPeople(user) {
  els.peopleList.textContent = "";
  const users = visibleUsers();
  if (!users.length) {
    els.peopleList.append(emptyState("검색된 사용자가 없습니다"));
    return;
  }

  users.forEach((person, index) => {
    const card = document.createElement("article");
    card.className = "person-card";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    setAvatarElement(avatar, person);

    const main = document.createElement("div");
    main.className = "person-main";

    const title = document.createElement("div");
    title.className = "person-title";
    const strong = document.createElement("strong");
    strong.textContent = person.id === user.id ? `${person.name} · 나` : person.name;
    title.append(strong);
    if (person.isAdmin) title.append(makeIconUse("icon-crown"));

    const sub = document.createElement("p");
    sub.className = "person-sub";
    sub.textContent = person.alias?.trim() || (person.isAdmin ? "Secret Chamber Operator" : `#${String(index + 1).padStart(2, "0")}`);

    main.append(title, sub);

    const balance = document.createElement("span");
    balance.className = "person-balance";
    balance.textContent = user.isAdmin ? formatAmount(person.balance) : person.id === user.id ? formatAmount(person.balance) : "송금 가능";
    main.append(balance);

    const actions = document.createElement("div");
    actions.className = "person-actions";
    if (user.isAdmin) {
      const manage = document.createElement("button");
      manage.className = "mini-button";
      manage.type = "button";
      manage.setAttribute("aria-label", `${person.name} 금액 조정`);
      manage.textContent = "±";
      manage.addEventListener("click", () => openManageDialog(person.id));
      actions.append(manage);
    } else if (person.id !== user.id) {
      const send = document.createElement("button");
      send.className = "mini-button";
      send.type = "button";
      send.setAttribute("aria-label", `${person.name}에게 송금`);
      send.append(makeIconUse("icon-send"));
      send.addEventListener("click", () => openTransferDialog(person.id));
      actions.append(send);
    } else {
      const own = document.createElement("button");
      own.className = "mini-button";
      own.type = "button";
      own.disabled = true;
      own.setAttribute("aria-label", "현재 사용자");
      own.append(makeIconUse("icon-check"));
      actions.append(own);
    }

    card.append(avatar, main, actions);
    els.peopleList.append(card);
  });
}

function renderLedger(user) {
  els.ledgerList.textContent = "";
  const entries = state.ledger
    .filter((entry) => user.isAdmin || entryTouchesUser(entry, user.id))
    .slice(0, 26);

  if (!entries.length) {
    els.ledgerList.append(emptyState("이동 내역이 없습니다"));
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

function ledgerTitle(entry) {
  if (entry.type === "transfer") {
    return `${nameOf(entry.fromId)} → ${nameOf(entry.toId)}`;
  }
  if (entry.type === "adjustment") {
    const sign = entry.direction === "subtract" ? "-" : "+";
    return `${nameOf(entry.targetId)} ${sign}${formatAmount(entry.amount)}`;
  }
  if (entry.type === "seed") {
    return `${nameOf(entry.targetId)} 초기 자본`;
  }
  if (entry.type === "reset") {
    return "크레딧 리셋";
  }
  return "업데이트";
}

function ledgerBody(entry) {
  if (entry.type === "transfer") {
    return `${formatAmount(entry.amount)} · ${entry.memo || "송금"}`;
  }
  if (entry.type === "adjustment") {
    return `${nameOf(entry.operatorId)} · ${entry.memo || "관리자 조정"}`;
  }
  if (entry.type === "seed") {
    return `${formatAmount(entry.amount)} · ${nameOf(entry.operatorId)}`;
  }
  if (entry.type === "reset") {
    return `${nameOf(entry.operatorId)} · 모든 지갑 0`;
  }
  return entry.memo || "";
}

function entryTouchesUser(entry, userId) {
  return entry.fromId === userId || entry.toId === userId || entry.targetId === userId || entry.operatorId === userId;
}

function nameOf(userId) {
  return displayName(getUser(userId));
}

function renderChat(user) {
  els.chatList.textContent = "";
  const chats = state.chats.slice(-80);
  if (!chats.length) {
    els.chatList.append(emptyState("채팅이 없습니다"));
    return;
  }

  chats.forEach((chat) => {
    const bubble = document.createElement("article");
    bubble.className = `chat-bubble${chat.userId === user.id ? " own" : ""}`;

    const header = document.createElement("header");
    const strong = document.createElement("strong");
    strong.textContent = nameOf(chat.userId);
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

function renderAlerts(user) {
  els.alertList.textContent = "";
  const alerts = state.notifications.filter((notification) => notification.userId === user.id || (user.isAdmin && notification.userId === "admin"));
  const unreadCount = alerts.filter((notification) => !notification.read).length;
  els.unreadDot.classList.toggle("is-hidden", unreadCount === 0);

  if (!alerts.length) {
    els.alertList.append(emptyState("알림이 없습니다"));
    return;
  }

  alerts.slice(0, 60).forEach((alert) => {
    const card = document.createElement("article");
    card.className = "timeline-card";
    const header = document.createElement("header");
    const strong = document.createElement("strong");
    strong.textContent = `${alert.read ? "" : "• "}${alert.title}`;
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
  selectedIconKey = user.iconKey || ICONS[0].key;
  renderIconPicker();
}

function renderIconPicker() {
  els.iconPicker.textContent = "";
  ICONS.forEach((icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-choice${icon.key === selectedIconKey ? " is-active" : ""}`;
    button.style.backgroundColor = icon.color;
    button.textContent = icon.symbol;
    button.setAttribute("aria-label", `${icon.key} 아이콘`);
    button.addEventListener("click", () => {
      selectedIconKey = icon.key;
      renderIconPicker();
    });
    els.iconPicker.append(button);
  });
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
  if (tab === "chat") {
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  }
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
  renderAmountFields(els.transferAmountFields);
  els.transferTitle.textContent = "크레딧 보내기";
  openDialog(els.transferDialog);
}

function renderRecipientOptions(preselectedUserId = "") {
  const user = currentUser();
  els.recipientSelect.textContent = "";
  state.users
    .filter((person) => person.id !== user.id)
    .sort((a, b) => comparableName(a.name).localeCompare(comparableName(b.name), "ko-KR"))
    .forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.isAdmin ? `${person.name} · Operator` : person.name;
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
  els.manageTitle.textContent = `${target?.name || "사용자"} 조정`;
  document.querySelectorAll("[data-adjust]").forEach((button) => button.classList.toggle("is-active", button.dataset.adjust === adjustMode));
  renderAmountFields(els.manageAmountFields);
  openDialog(els.manageDialog);
}

function addNotification(userId, title, body, createdAt = Date.now()) {
  state.notifications.unshift({
    id: uid("notice"),
    userId,
    title,
    body,
    read: false,
    createdAt,
  });
  state.notifications = state.notifications.slice(0, 250);
}

function addLedger(entry) {
  const fullEntry = {
    id: uid("ledger"),
    createdAt: Date.now(),
    memo: "",
    ...entry,
  };
  state.ledger.unshift(fullEntry);
  state.ledger = state.ledger.slice(0, 300);
  createLedgerNotifications(fullEntry);
  persist();
  renderAll();
  toastForLedger(fullEntry);
}

function createLedgerNotifications(entry) {
  if (entry.type === "transfer") {
    const from = nameOf(entry.fromId);
    const to = nameOf(entry.toId);
    const amount = formatAmount(entry.amount);
    addNotification(entry.toId, "크레딧 도착", `${from}님이 ${amount}를 보냈습니다`, entry.createdAt);
    addNotification(entry.fromId, "송금 완료", `${to}님에게 ${amount}를 보냈습니다`, entry.createdAt);
    addNotification("admin", "크레딧 이동", `${from} → ${to} · ${amount}`, entry.createdAt);
    return;
  }

  if (entry.type === "adjustment") {
    const sign = entry.direction === "subtract" ? "-" : "+";
    const amount = `${sign}${formatAmount(entry.amount)}`;
    addNotification(entry.targetId, "금액 조정", `${nameOf(entry.operatorId)}님이 ${amount} 조정했습니다`, entry.createdAt);
    addNotification("admin", "관리자 조정", `${nameOf(entry.targetId)} · ${amount}`, entry.createdAt);
    return;
  }

  if (entry.type === "seed") {
    const amount = formatAmount(entry.amount);
    addNotification(entry.targetId, "초기 자본", `${amount} 지급`, entry.createdAt);
    addNotification("admin", "초기 자본 지급", `${nameOf(entry.targetId)} · ${amount}`, entry.createdAt);
    return;
  }

  if (entry.type === "reset") {
    state.users.forEach((user) => addNotification(user.id, "크레딧 리셋", `${nameOf(entry.operatorId)}님이 지갑을 리셋했습니다`, entry.createdAt));
    addNotification("admin", "크레딧 리셋", "모든 지갑이 0으로 변경되었습니다", entry.createdAt);
  }
}

function toastForLedger(entry) {
  const user = currentUser();
  if (!user) return;
  if (!user.isAdmin && !entryTouchesUser(entry, user.id)) return;

  if (entry.type === "transfer") {
    if (entry.toId === user.id) {
      showToast("크레딧 도착", `${nameOf(entry.fromId)}님이 ${formatAmount(entry.amount)}를 보냈습니다`);
    } else if (entry.fromId === user.id) {
      showToast("송금 완료", `${nameOf(entry.toId)}님에게 ${formatAmount(entry.amount)}를 보냈습니다`);
    } else if (user.isAdmin) {
      showToast("크레딧 이동", `${nameOf(entry.fromId)} → ${nameOf(entry.toId)} · ${formatAmount(entry.amount)}`);
    }
    return;
  }

  if (entry.type === "adjustment") {
    const sign = entry.direction === "subtract" ? "-" : "+";
    showToast("금액 조정", `${nameOf(entry.targetId)} · ${sign}${formatAmount(entry.amount)}`);
    return;
  }

  if (entry.type === "seed") {
    showToast("초기 자본 지급", `${nameOf(entry.targetId)} · ${formatAmount(entry.amount)}`);
    return;
  }

  if (entry.type === "reset") {
    showToast("크레딧 리셋", "모든 지갑이 0으로 변경되었습니다");
  }
}

function showToast(title, body) {
  const toast = document.createElement("article");
  toast.className = "toast";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const p = document.createElement("p");
  p.textContent = body;
  toast.append(strong, p);
  els.toastRegion.append(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3600);
}

function transferCredits(toId, amount, memo) {
  const from = currentUser();
  const to = getUser(toId);
  if (!from || !to) return "받는 사람을 선택해주세요";
  if (from.id === to.id) return "자기 자신에게는 보낼 수 없습니다";
  if (!Number.isFinite(amount) || amount <= 0) return "금액을 입력해주세요";
  if ((from.balance || 0) < amount) return "잔액이 부족합니다";

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
  if (!operator?.isAdmin) return "관리자만 조정할 수 있습니다";
  if (!target) return "사용자를 찾을 수 없습니다";
  if (!Number.isFinite(amount) || amount <= 0) return "금액을 입력해주세요";
  if (direction === "subtract" && (target.balance || 0) < amount) return "잔액보다 큰 금액은 뺄 수 없습니다";

  target.balance = direction === "subtract" ? Math.round(target.balance - amount) : Math.round((target.balance || 0) + amount);
  target.lastActive = Date.now();
  operator.lastActive = Date.now();
  addLedger({ type: "adjustment", operatorId: operator.id, targetId: target.id, amount, direction, memo });
  return "";
}

function seedCapital(amount) {
  const operator = currentUser();
  if (!operator?.isAdmin) return "관리자만 지급할 수 있습니다";
  if (!Number.isFinite(amount) || amount <= 0) return "초기 자본을 입력해주세요";
  const targets = state.users.filter((user) => !user.isAdmin);
  if (!targets.length) return "지급할 사용자가 없습니다";

  state.settings.seedAmount = amount;
  const now = Date.now();
  const entries = targets.map((target) => {
    target.balance = Math.round((target.balance || 0) + amount);
    target.lastActive = now;
    return {
      id: uid("ledger"),
      type: "seed",
      operatorId: operator.id,
      targetId: target.id,
      amount,
      memo: "초기 자본",
      createdAt: now,
    };
  });

  entries.reverse().forEach((entry) => {
    state.ledger.unshift(entry);
    createLedgerNotifications(entry);
  });
  state.ledger = state.ledger.slice(0, 300);
  persist();
  renderAll();
  showToast("초기 자본 지급", `${targets.length}명에게 ${formatAmount(amount)} 지급`);
  return "";
}

function resetCredits() {
  const operator = currentUser();
  if (!operator?.isAdmin) return;
  const confirmed = window.confirm("모든 지갑 금액과 이동 내역을 리셋할까요?");
  if (!confirmed) return;

  state.users.forEach((user) => {
    user.balance = 0;
    user.lastActive = Date.now();
  });
  state.ledger = [];
  state.notifications = [];
  addLedger({ type: "reset", operatorId: operator.id, amount: 0, memo: "관리자 리셋" });
}

async function handleAuth(event) {
  event.preventDefault();
  els.authError.textContent = "";
  const name = normalizeName(els.authName.value);
  const pin = els.authPin.value.trim();

  if (!name) {
    els.authError.textContent = "이름을 입력해주세요";
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    els.authError.textContent = "인증번호는 숫자 4자리입니다";
    return;
  }

  const isAdminAttempt = comparableName(name) === comparableName(ADMIN_NAME);
  if (isAdminAttempt && pin !== ADMIN_PIN) {
    els.authError.textContent = "운영자 인증번호가 다릅니다";
    return;
  }

  const pinHash = await hashPin(pin);
  let user = state.users.find((person) => comparableName(person.name) === comparableName(name));

  if (user) {
    if (user.pinHash !== pinHash) {
      els.authError.textContent = "인증번호가 다릅니다";
      return;
    }
  } else {
    if (isAdminAttempt) user = getUser(ADMIN_ID);
    else {
      user = {
        id: uid("user"),
        name,
        alias: "",
        pinHash,
        iconKey: ICONS[Math.floor(Math.random() * ICONS.length)].key,
        photo: "",
        balance: 0,
        isAdmin: false,
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
      state.users.push(user);
    }
  }

  user.lastActive = Date.now();
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
    els.profileError.textContent = "이름을 입력해주세요";
    return;
  }
  if (!user.isAdmin && comparableName(nextName) === comparableName(ADMIN_NAME)) {
    els.profileError.textContent = "운영자 이름은 사용할 수 없습니다";
    return;
  }
  const duplicate = state.users.some((person) => person.id !== user.id && comparableName(person.name) === comparableName(nextName));
  if (duplicate) {
    els.profileError.textContent = "이미 사용 중인 이름입니다";
    return;
  }

  if (!user.isAdmin) user.name = nextName;
  user.alias = nextAlias;
  user.iconKey = selectedIconKey;
  user.lastActive = Date.now();
  persist();
  renderAll();
  showToast("프로필 저장", displayName(user));
}

async function handlePhoto(file) {
  const user = currentUser();
  if (!user || !file) return;
  try {
    user.photo = await resizeImage(file);
    user.lastActive = Date.now();
    persist();
    renderAll();
    showToast("프로필 사진 저장", displayName(user));
  } catch {
    showToast("사진 저장 실패", "다른 이미지를 선택해주세요");
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
  const knownLedgerIds = new Set(state.ledger.map((entry) => entry.id));
  state = normalizeState(nextState);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
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
    const database = getDatabase(app);
    const databasePath = configModule.databasePath || "secret-chamber-credits/state";
    const stateRef = ref(database, databasePath);

    remoteSync.enabled = true;
    remoteSync.push = async (nextState) => {
      try {
        await set(stateRef, JSON.parse(JSON.stringify(nextState)));
      } catch {
        showToast("원격 저장 실패", "네트워크 또는 Firebase 권한을 확인해주세요");
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
      if (els.transferDialog.open) renderAmountFields(els.transferAmountFields);
      if (els.manageDialog.open) renderAmountFields(els.manageAmountFields);
    });
  });

  els.peopleFilter.addEventListener("change", () => {
    ui.filter = els.peopleFilter.value;
    saveUi();
    renderPeople(currentUser());
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  els.fabButton.addEventListener("click", () => openTransferDialog());
  els.walletSendButton.addEventListener("click", () => openTransferDialog());

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });

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
    if (error) showToast("초기 자본", error);
  });

  els.resetButton.addEventListener("click", resetCredits);

  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const user = currentUser();
    const message = normalizeName(els.chatInput.value);
    if (!user || !message) return;
    state.chats.push({ id: uid("chat"), userId: user.id, message, createdAt: Date.now() });
    state.chats = state.chats.slice(-180);
    user.lastActive = Date.now();
    els.chatInput.value = "";
    persist();
    renderChat(user);
    requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  });

  els.markReadButton.addEventListener("click", () => {
    const user = currentUser();
    if (!user) return;
    state.notifications.forEach((notification) => {
      if (notification.userId === user.id || (user.isAdmin && notification.userId === "admin")) notification.read = true;
    });
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
      if (event.data?.type === "state" && event.data.sourceId !== sourceId) {
        handleIncomingState(event.data.state);
      }
    });
  }
}

async function init() {
  state = loadState();
  await ensureAdmin();
  persist({ broadcast: false });
  bindEvents();
  await initRemoteSync();

  if (!currentUser()) {
    currentUserId = null;
    localStorage.removeItem(SESSION_KEY);
  }

  renderAll();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
