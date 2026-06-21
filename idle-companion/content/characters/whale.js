/**
 * 蓝鲸 — Cat Gatekeeper 同款方案：全高写实视频，入场后循环待机
 */
class WhaleCharacter extends CharacterBase {
  render() {
    this.root.classList.add("ic-character-gatekeeper");
    this.root.innerHTML = this._renderGatekeeperScene({
      entryPath: "assets/whale.mp4",
      idlePath: "assets/whale.mp4",
      sceneClass: "ic-whale-gk-scene",
    });
    this._bindGatekeeperVideos();
  }

  _getVideo() {
    return this.gkEntry;
  }

  _setupVideoHandlers() {}

  async playEntrance() {
    await this.playGatekeeperEntrance({
      enterClass: "ic-gk-slide-in",
      maxMs: 5500,
    });
    return Promise.resolve();
  }

  async playAction() {
    this.phase = "acting";
    await this._wait(2000);
    return Promise.resolve();
  }

  startIdle() {
    this.startGatekeeperIdle();
  }

  async playExit() {
    this.phase = "exiting";
    this.root?.classList.remove("ic-idle");
    this.root?.classList.add("ic-exiting");
    this._pauseGkVideos();
    return this._wait(1200);
  }

  destroy() {
    this._pauseGkVideos();
    this.root?.remove();
    this.root = null;
  }
}

window.WhaleCharacter = WhaleCharacter;
