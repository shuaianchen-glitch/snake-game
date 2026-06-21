/**
 * Idle Companion — Cat Gatekeeper 同款展示架构
 * Shadow DOM + 入场 WebM/MP4 + 播完切循环待机
 */
(function () {
  "use strict";

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

  const CHARACTER_ICONS = {
    whale: "🐋",
    fox: "🦊",
    cat: "🐱",
  };

  /* 优先 Hero 透明 PNG（Gatekeeper 挡屏）；自备 WebM 可覆盖 */
  const HERO_SETS = {
    whale: "assets/whale-hero.png",
    cat: "assets/cat-hero.png",
    fox: "assets/fox-hero.png",
  };

  /* 猫咪：Pexels 单条循环（Gatekeeper 同款 entry→loop，无跳切） */
  const VIDEO_SETS = {
    whale: {
      entry: "assets/whale-entry.webm",
      idle: "assets/whale-idle.webm",
      fallbackEntry: "assets/whale.mp4",
      fallbackIdle: "assets/whale.mp4",
      countdownClass: "",
    },
    cat: {
      entry: "assets/cat-loop.webm",
      idle: "assets/cat-loop.webm",
      fallbackEntry: "assets/cat.mp4",
      fallbackIdle: "assets/cat.mp4",
      countdownClass: "",
    },
    fox: {
      entry: "assets/fox-entry.webm",
      idle: "assets/fox-idle.webm",
      fallbackEntry: "assets/fox.mp4",
      fallbackIdle: "assets/fox.mp4",
      countdownClass: "",
    },
  };

  const ACTIVITY_EVENTS = [
    "mousemove", "mousedown", "keydown", "keyup",
    "scroll", "wheel", "touchstart", "touchmove",
    "click", "pointerdown",
  ];

  const SHADOW_HOST_ID = "ic-gk-host";
  const OVERLAY_ID = "ic-gk-overlay";

  let settings = { ...DEFAULTS };
  let soundManager = new SoundManager();

  let countdownHost = null;
  let countdownEl = null;

  let siteAllowed = true;
  let idleStart = Date.now();
  let idleTargetMs = DEFAULTS.idleMinutes * 60 * 1000;
  let displayTargetMs = DEFAULTS.displayMinutes * 60 * 1000;
  let displayStart = 0;

  let state = "watching";
  let tickInterval = null;
  let showRunId = 0;
  let gkVideos = null;

  /* ── Shadow DOM（与 Cat Gatekeeper 一致）── */

  function getShadowRoot({ create = true } = {}) {
    let host = document.getElementById(SHADOW_HOST_ID);
    if (!host && create) {
      host = document.createElement("div");
      host.id = SHADOW_HOST_ID;
      host.style.cssText =
        "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;";
      document.documentElement.appendChild(host);
    }
    if (!host) return null;
    if (!host.shadowRoot) host.attachShadow({ mode: "open" });
    return host.shadowRoot;
  }

  function removeShadowHost() {
    document.getElementById(SHADOW_HOST_ID)?.remove();
    gkVideos = null;
  }

  function ensureShadowStyles(shadow, callback) {
    const existing = shadow.querySelector("link[data-ic-gk-style]");
    if (existing) {
      callback();
      return;
    }
    const link = document.createElement("link");
    link.dataset.icGkStyle = "true";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content/gatekeeper.css");
    link.addEventListener("load", callback, { once: true });
    link.addEventListener("error", callback, { once: true });
    shadow.appendChild(link);
  }

  function prepareVideo(primarySrc, fallbackSrc) {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.src = chrome.runtime.getURL(primarySrc);
    video.addEventListener(
      "error",
      () => {
        if (fallbackSrc && !video.dataset.fallback) {
          video.dataset.fallback = "1";
          video.src = chrome.runtime.getURL(fallbackSrc);
          video.load();
        }
      },
      { once: true }
    );
    video.load();
    return video;
  }

  function getVideoSet() {
    return VIDEO_SETS[settings.character] || VIDEO_SETS.whale;
  }

  function preloadCharacterVideos() {
    const set = getVideoSet();
    prepareVideo(set.entry, set.fallbackEntry);
    prepareVideo(set.idle, set.fallbackIdle);
  }

  /* ── Whitelist ── */

  function matchHost(hostname, pattern) {
    const host = hostname.toLowerCase();
    const pat = pattern.trim().toLowerCase();
    if (!pat) return false;
    if (pat.startsWith("*.")) {
      const base = pat.slice(2);
      return host === base || host.endsWith("." + base);
    }
    return host === pat || host.endsWith("." + pat);
  }

  function isSiteAllowed() {
    if (!settings.whitelistEnabled) return true;
    const list = settings.whitelist || [];
    if (list.length === 0) return false;
    const hostname = location.hostname;
    if (!hostname || location.protocol === "chrome-extension:") return false;
    return list.some((entry) => matchHost(hostname, entry));
  }

  function updateSiteAllowed() {
    const allowed = isSiteAllowed();
    if (allowed === siteAllowed) return;
    siteAllowed = allowed;
    if (!siteAllowed) {
      dismissCompanion();
      hideCountdown();
      stopTick();
    } else if (settings.enabled) {
      buildCountdown();
      bindActivityListeners();
      resetIdle();
      startTick();
      updateCountdownUI();
      preloadCharacterVideos();
    }
  }

  /* ── Init ── */

  function init() {
    if (window.__idleCompanionLoaded) return;
    window.__idleCompanionLoaded = true;

    loadSettings().then(() => {
      siteAllowed = isSiteAllowed();
      soundManager.setEnabled(settings.soundEnabled);
      if (!settings.enabled || !siteAllowed) return;
      buildCountdown();
      bindActivityListeners();
      startTick();
      preloadCharacterVideos();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      applySettingChanges(changes);
    });
  }

  function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (stored) => {
        settings = { ...DEFAULTS, ...stored };
        if (!Array.isArray(settings.whitelist)) {
          settings.whitelist = [];
        }
        idleTargetMs = settings.idleMinutes * 60 * 1000;
        displayTargetMs = settings.displayMinutes * 60 * 1000;
        resolve();
      });
    });
  }

  function applySettingChanges(changes) {
    if (changes.enabled) {
      settings.enabled = changes.enabled.newValue;
      if (!settings.enabled) {
        dismissCompanion();
        hideCountdown();
        stopTick();
      } else if (siteAllowed) {
        buildCountdown();
        resetIdle();
        startTick();
        updateCountdownUI();
        preloadCharacterVideos();
      }
    }
    if (changes.idleMinutes) {
      settings.idleMinutes = changes.idleMinutes.newValue;
      idleTargetMs = settings.idleMinutes * 60 * 1000;
      resetIdle();
    }
    if (changes.displayMinutes) {
      settings.displayMinutes = changes.displayMinutes.newValue;
      displayTargetMs = settings.displayMinutes * 60 * 1000;
    }
    if (changes.showCountdown) {
      settings.showCountdown = changes.showCountdown.newValue;
      updateCountdownUI();
    }
    if (changes.soundEnabled) {
      settings.soundEnabled = changes.soundEnabled.newValue;
      soundManager.setEnabled(settings.soundEnabled);
    }
    if (changes.character) {
      settings.character = changes.character.newValue;
      updateCountdownIcon();
      preloadCharacterVideos();
    }
    if (changes.whitelistEnabled || changes.whitelist) {
      if (changes.whitelistEnabled) {
        settings.whitelistEnabled = changes.whitelistEnabled.newValue;
      }
      if (changes.whitelist) {
        settings.whitelist = changes.whitelist.newValue || [];
      }
      updateSiteAllowed();
    }
  }

  /* ── 空闲倒计时（轻量浮层，不进 Shadow）── */

  function buildCountdown() {
    if (countdownEl) return;

    countdownHost = document.createElement("div");
    countdownHost.id = "idle-companion-countdown-host";
    countdownHost.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";

    countdownEl = document.createElement("div");
    countdownEl.className = "ic-countdown";
    countdownEl.innerHTML = `
      <span class="ic-countdown-icon"></span>
      <span class="ic-countdown-label">空闲后出现</span>
      <span class="ic-countdown-time">--:--</span>
    `;

    countdownHost.appendChild(countdownEl);
    document.documentElement.appendChild(countdownHost);
    updateCountdownIcon();
    updateCountdownUI();
  }

  function updateCountdownIcon() {
    if (!countdownEl) return;
    const iconEl = countdownEl.querySelector(".ic-countdown-icon");
    if (iconEl) {
      iconEl.textContent = CHARACTER_ICONS[settings.character] || "🐾";
    }
  }

  function hideCountdown() {
    countdownEl?.classList.add("ic-hidden");
  }

  /* ── Activity ── */

  let listenersBound = false;

  function bindActivityListeners() {
    if (listenersBound) return;
    listenersBound = true;

    const onActivity = () => {
      if (state === "showing") {
        dismissCompanion();
        return;
      }
      resetIdle();
    };

    ACTIVITY_EVENTS.forEach((evt) => {
      document.addEventListener(evt, onActivity, { passive: true, capture: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (state === "watching") resetIdle();
    });
  }

  function resetIdle() {
    idleStart = Date.now();
    if (state === "watching") updateCountdownUI();
  }

  /* ── Tick ── */

  function startTick() {
    if (tickInterval) return;
    tickInterval = setInterval(tick, 1000);
  }

  function stopTick() {
    clearInterval(tickInterval);
    tickInterval = null;
  }

  function tick() {
    if (!settings.enabled || !siteAllowed) return;

    if (state === "watching") {
      const remaining = idleTargetMs - (Date.now() - idleStart);
      if (remaining <= 0) {
        showCompanion();
      } else {
        updateCountdownTime(remaining);
      }
    } else if (state === "showing") {
      const remaining = displayTargetMs - (Date.now() - displayStart);
      updateGkCountdown(remaining);
      if (remaining <= 0) dismissCompanion();
    }
  }

  function formatTime(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  }

  function updateCountdownUI() {
    if (!countdownEl) return;
    if (!settings.showCountdown || state !== "watching") {
      countdownEl.classList.add("ic-hidden");
      return;
    }
    countdownEl.classList.remove("ic-hidden");
    updateCountdownTime(idleTargetMs - (Date.now() - idleStart));
  }

  function updateCountdownTime(remainingMs) {
    if (!countdownEl) return;
    const timeEl = countdownEl.querySelector(".ic-countdown-time");
    if (timeEl) timeEl.textContent = formatTime(remainingMs);
  }

  function updateGkCountdown(remainingMs) {
    const shadow = getShadowRoot({ create: false });
    const countdown = shadow?.getElementById("ic-gk-countdown");
    if (countdown) {
      countdown.textContent = formatTime(remainingMs);
    }
  }

  /* ── Gatekeeper 展示：入场 → 循环（单条片无缝 loop）── */

  function showCompanion() {
    if (state !== "watching") return;

    const runId = ++showRunId;
    const shadow = getShadowRoot();
    const host = document.getElementById(SHADOW_HOST_ID);
    if (!shadow || !host) return;
    if (shadow.getElementById(OVERLAY_ID)) return;

    state = "showing";
    displayStart = Date.now();
    hideCountdown();

    host.style.width = "100vw";
    host.style.height = "100vh";
    host.style.pointerEvents = "none";

    const set = getVideoSet();
    const heroSrc = HERO_SETS[settings.character];

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText =
      "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;opacity:1;z-index:2147483647;";

    const countdown = document.createElement("div");
    countdown.id = "ic-gk-countdown";
    countdown.textContent = formatTime(displayTargetMs);
    overlay.appendChild(countdown);

    const mountOverlay = () => {
      const currentHost = document.getElementById(SHADOW_HOST_ID);
      if (runId !== showRunId || currentHost?.shadowRoot !== shadow) return;
      if (shadow.getElementById(OVERLAY_ID)) return;
      shadow.appendChild(overlay);
      soundManager.playEntrance(settings.character);
      soundManager.playAction(settings.character);
    };

    const showHero = (src) => {
      const img = document.createElement("img");
      img.className = "ic-gk-hero";
      img.alt = "";
      img.draggable = false;
      img.src = chrome.runtime.getURL(src);
      overlay.appendChild(img);
      gkVideos = null;
      ensureShadowStyles(shadow, mountOverlay);
    };

    const showVideo = () => {
      const stage = document.createElement("div");
      stage.className = "ic-gk-stage ic-gk-entering";
      overlay.appendChild(stage);

      const sameClip = set.entry === set.idle;

      if (sameClip) {
        const video = prepareVideo(set.entry, set.fallbackEntry);
        video.autoplay = true;
        video.style.cssText =
          "width:100vw;height:100vh;object-fit:cover;object-position:center bottom;display:block;";
        stage.appendChild(video);
        gkVideos = { entry: video, idle: video, stage };

        video.addEventListener("error", () => {
          if (heroSrc) showHero(heroSrc);
        }, { once: true });

        ensureShadowStyles(shadow, () => {
          mountOverlay();
          video.play().catch(() => {
            if (heroSrc) showHero(heroSrc);
          });
          setTimeout(() => {
            if (state !== "showing") return;
            stage.classList.remove("ic-gk-entering");
            video.loop = true;
          }, 3000);
        });
        return;
      }

      const videoEntry = prepareVideo(set.entry, set.fallbackEntry);
      videoEntry.autoplay = true;
      const videoIdle = prepareVideo(set.idle, set.fallbackIdle);
      videoIdle.loop = true;
      videoIdle.style.opacity = "0";
      stage.appendChild(videoEntry);
      stage.appendChild(videoIdle);
      gkVideos = { entry: videoEntry, idle: videoIdle, stage };

      videoEntry.addEventListener("ended", () => {
        stage.classList.remove("ic-gk-entering");
        videoIdle.style.opacity = "1";
        videoIdle.currentTime = 0;
        videoIdle.play().catch(() => {});
        videoEntry.style.opacity = "0";
      });

      videoEntry.addEventListener("error", () => {
        if (heroSrc) showHero(heroSrc);
      }, { once: true });

      ensureShadowStyles(shadow, () => {
        mountOverlay();
        videoEntry.play().catch(() => {
          if (heroSrc) showHero(heroSrc);
        });
      });
    };

    ensureShadowStyles(shadow, () => {
      if (runId !== showRunId) return;
      showVideo();
    });

    setTimeout(() => {
      if (runId !== showRunId) return;
      if (!shadow.getElementById(OVERLAY_ID)) {
        mountOverlay();
        if (heroSrc) showHero(heroSrc);
      }
    }, 4500);
  }

  function dismissCompanion() {
    if (state !== "showing") return;
    showRunId++;

    const shadow = getShadowRoot({ create: false });
    const overlay = shadow?.getElementById(OVERLAY_ID);

    gkVideos?.entry?.pause();
    gkVideos?.idle?.pause();
    gkVideos = null;

    const finish = () => {
      overlay?.remove();
      removeShadowHost();
      state = "watching";
      resetIdle();
      updateCountdownUI();
    };

    if (!overlay) {
      finish();
      return;
    }

    overlay.style.transition = "opacity 0.8s";
    overlay.style.opacity = "0";
    setTimeout(finish, 800);
  }

  window.addEventListener("pagehide", dismissCompanion);

  init();
})();
