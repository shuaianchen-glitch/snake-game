/**
 * 角色动画基类 — 全屏视频版
 */
class CharacterBase {
  constructor(container) {
    this.container = container;
    this.root = null;
    this.phase = "idle";
  }

  static asset(path) {
    return chrome.runtime.getURL(path);
  }

  mount() {
    this.root = document.createElement("div");
    this.root.className = "ic-character ic-character-fullscreen";
    this.container.appendChild(this.root);
    this.render();
    this._setupVideoHandlers();
    return this.root;
  }

  render() {}

  _setupVideoHandlers() {
    const video = this._getVideo();
    if (!video) return;
    video.addEventListener("ended", () => {
      if (this.phase === "entering" || this.phase === "acting") {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    });
  }

  _sceneVideoHtml({ bgClass, videoPath, posterPath, extra = "" }) {
    const videoSrc = CharacterBase.asset(videoPath);
    const poster = posterPath ? CharacterBase.asset(posterPath) : "";
    return `
      <div class="ic-scene ${bgClass}">
        <div class="ic-scene-backdrop"></div>
        <div class="ic-scene-vignette"></div>
        <div class="ic-scene-glow"></div>
        <video
          class="ic-scene-video"
          src="${videoSrc}"
          ${poster ? `poster="${poster}"` : ""}
          playsinline
          muted
          preload="auto"
        ></video>
        ${extra}
      </div>
    `;
  }

  _getVideo() {
    return this.root?.querySelector(".ic-scene-video");
  }

  _waitForVideo() {
    const video = this._getVideo();
    if (!video) return Promise.resolve();
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      video.addEventListener("canplay", done, { once: true });
      video.addEventListener("error", done, { once: true });
      video.load();
    });
  }

  async _playVideo({ from = 0, loop = false } = {}) {
    const video = this._getVideo();
    if (!video) return;
    video.loop = loop;
    video.currentTime = from;
    try {
      await video.play();
    } catch (_) {}
  }

  _pauseVideo() {
    const video = this._getVideo();
    if (video) {
      video.pause();
      video.loop = false;
    }
  }

  async playEntrance() {
    this.phase = "entering";
    await this._waitForVideo();
    await this._playVideo({ from: 0, loop: false });
    this.root?.classList.add("ic-visible");
    return this._wait(2200);
  }

  async playAction() {
    this.phase = "acting";
    return this._wait(1800);
  }

  startIdle() {
    this.phase = "idle";
    this.root?.classList.add("ic-idle");
    this._playVideo({ loop: true });
  }

  async playExit() {
    this.phase = "exiting";
    this.root?.classList.remove("ic-idle");
    this.root?.classList.add("ic-exiting");
    this._pauseVideo();
    return this._wait(1400);
  }

  destroy() {
    this._pauseVideo();
    this.root?.remove();
    this.root = null;
  }

  _wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /* ── Cat Gatekeeper 风格：全高透明视频 + 入场切待机 ── */

  _renderGatekeeperScene({ entryPath, idlePath, sceneClass = "" }) {
    const entrySrc = CharacterBase.asset(entryPath);
    const idleSrc = CharacterBase.asset(idlePath || entryPath);
    return `
      <div class="ic-scene ic-gk-scene ${sceneClass}">
        <video
          class="ic-gk-video ic-gk-entry"
          src="${entrySrc}"
          playsinline
          muted
          preload="auto"
        ></video>
        <video
          class="ic-gk-video ic-gk-idle"
          src="${idleSrc}"
          playsinline
          muted
          preload="auto"
          loop
          hidden
        ></video>
      </div>
    `;
  }

  _bindGatekeeperVideos() {
    this.gkEntry = this.root?.querySelector(".ic-gk-entry");
    this.gkIdle = this.root?.querySelector(".ic-gk-idle");
  }

  _waitForGkVideo(video) {
    if (!video) return Promise.resolve();
    if (video.readyState >= 2) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      video.addEventListener("canplay", done, { once: true });
      video.addEventListener("error", done, { once: true });
      video.load();
    });
  }

  async _playGkVideo(video, { loop = false } = {}) {
    if (!video) return;
    video.loop = loop;
    video.currentTime = 0;
    try {
      await video.play();
    } catch (_) {}
  }

  _pauseGkVideos() {
    [this.gkEntry, this.gkIdle].forEach((video) => {
      if (!video) return;
      video.pause();
      video.loop = false;
    });
  }

  async playGatekeeperEntrance({ enterClass, maxMs = 6000 } = {}) {
    this.phase = "entering";
    this.root?.classList.add("ic-visible");
    if (enterClass) this.root?.classList.add(enterClass);

    await this._waitForGkVideo(this.gkEntry);
    await this._playGkVideo(this.gkEntry, { loop: false });

    await new Promise((resolve) => {
      const done = () => resolve();
      this.gkEntry?.addEventListener("ended", done, { once: true });
      setTimeout(done, maxMs);
    });

    if (enterClass) this.root?.classList.remove(enterClass);
  }

  startGatekeeperIdle() {
    this.phase = "idle";
    this.root?.classList.add("ic-idle");

    if (this.gkEntry) {
      this.gkEntry.style.display = "none";
      this.gkEntry.pause();
    }

    if (this.gkIdle) {
      this.gkIdle.hidden = false;
      this.gkIdle.classList.add("ic-gk-idle-active");
      this._playGkVideo(this.gkIdle, { loop: true });
    }
  }
}

window.CharacterBase = CharacterBase;
