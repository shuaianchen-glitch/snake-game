const DEFAULTS = {
  idleMinutes: 5,
  displayMinutes: 3,
  character: "whale",
  showCountdown: true,
  soundEnabled: true,
  enabled: true,
  whitelistEnabled: false,
  whitelist: [],
};

const $ = (id) => document.getElementById(id);

const fields = {
  enabled: $("enabled"),
  idleMinutes: $("idleMinutes"),
  displayMinutes: $("displayMinutes"),
  showCountdown: $("showCountdown"),
  soundEnabled: $("soundEnabled"),
  whitelistEnabled: $("whitelistEnabled"),
};

const whitelistInput = $("whitelistInput");
const whitelistList = $("whitelistList");
const statusEl = $("status");
let saveTimer = null;
let whitelist = [];

function load() {
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    const s = { ...DEFAULTS, ...stored };
    fields.enabled.checked = s.enabled;
    fields.idleMinutes.value = s.idleMinutes;
    fields.displayMinutes.value = s.displayMinutes;
    fields.showCountdown.checked = s.showCountdown;
    fields.soundEnabled.checked = s.soundEnabled;
    fields.whitelistEnabled.checked = s.whitelistEnabled;
    whitelist = Array.isArray(s.whitelist) ? [...s.whitelist] : [];

    document.querySelectorAll(".character-card[data-character]").forEach((card) => {
      const input = card.querySelector("input");
      const isSelected = input.value === s.character;
      input.checked = isSelected;
      card.classList.toggle("selected", isSelected);
    });

    renderWhitelist();
  });
}

function save() {
  const characterInput = document.querySelector('input[name="character"]:checked');
  const data = {
    enabled: fields.enabled.checked,
    idleMinutes: clamp(parseInt(fields.idleMinutes.value, 10) || 5, 1, 120),
    displayMinutes: clamp(parseInt(fields.displayMinutes.value, 10) || 3, 1, 60),
    character: characterInput?.value || "whale",
    showCountdown: fields.showCountdown.checked,
    soundEnabled: fields.soundEnabled.checked,
    whitelistEnabled: fields.whitelistEnabled.checked,
    whitelist: whitelist,
  };

  fields.idleMinutes.value = data.idleMinutes;
  fields.displayMinutes.value = data.displayMinutes;

  chrome.storage.sync.set(data, () => {
    showStatus("已保存");
  });
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function normalizeHost(input) {
  let val = input.trim().toLowerCase();
  if (!val) return "";
  val = val.replace(/^https?:\/\//, "");
  val = val.replace(/\/.*$/, "");
  val = val.replace(/:\d+$/, "");
  return val;
}

function addToWhitelist(host) {
  const normalized = normalizeHost(host);
  if (!normalized) {
    showStatus("请输入有效域名");
    return false;
  }
  if (whitelist.includes(normalized)) {
    showStatus("该网站已在列表中");
    return false;
  }
  whitelist.push(normalized);
  renderWhitelist();
  debouncedSave();
  return true;
}

function removeFromWhitelist(host) {
  whitelist = whitelist.filter((h) => h !== host);
  renderWhitelist();
  debouncedSave();
}

function renderWhitelist() {
  whitelistList.innerHTML = "";
  if (whitelist.length === 0) {
    const empty = document.createElement("li");
    empty.className = "whitelist-empty";
    empty.textContent = fields.whitelistEnabled.checked
      ? "暂无网站，请添加"
      : "未启用白名单，所有网站均生效";
    whitelistList.appendChild(empty);
    return;
  }
  whitelist.forEach((host) => {
    const li = document.createElement("li");
    li.className = "whitelist-item";
    li.innerHTML = `
      <span class="whitelist-host">${host}</span>
      <button type="button" class="btn-remove" data-host="${host}" title="移除">×</button>
    `;
    li.querySelector(".btn-remove").addEventListener("click", () => {
      removeFromWhitelist(host);
    });
    whitelistList.appendChild(li);
  });
}

function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.remove("fade");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => statusEl.classList.add("fade"), 2000);
}

function debouncedSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 300);
}

Object.values(fields).forEach((el) => {
  el.addEventListener("change", () => {
    if (el === fields.whitelistEnabled) renderWhitelist();
    debouncedSave();
  });
  if (el.type === "number") {
    el.addEventListener("input", debouncedSave);
  }
});

document.querySelectorAll(".character-card[data-character]").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".character-card[data-character]").forEach((c) => {
      c.classList.remove("selected");
    });
    card.classList.add("selected");
    card.querySelector("input").checked = true;
    debouncedSave();
  });
});

$("addSiteBtn").addEventListener("click", () => {
  if (addToWhitelist(whitelistInput.value)) {
    whitelistInput.value = "";
  }
});

whitelistInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (addToWhitelist(whitelistInput.value)) {
      whitelistInput.value = "";
    }
  }
});

$("addCurrentBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) {
      showStatus("无法获取当前页面");
      return;
    }
    try {
      const url = new URL(tab.url);
      if (!["http:", "https:"].includes(url.protocol)) {
        showStatus("仅支持 http/https 网站");
        return;
      }
      if (addToWhitelist(url.hostname)) {
        showStatus(`已添加 ${url.hostname}`);
      }
    } catch (_) {
      showStatus("无法解析当前页面地址");
    }
  });
});

load();
