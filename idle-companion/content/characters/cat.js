/**
 * 猫咪 — Cat Gatekeeper 同款：全高视频滑入，播完切循环待机
 */
class CatCharacter extends CharacterBase {
  render() {
    this.root.classList.add("ic-character-gatekeeper");
    this.root.innerHTML = this._renderGatekeeperScene({
      entryPath: "assets/cat.mp4",
      idlePath: "assets/cat.mp4",
      sceneClass: "ic-cat-gk-scene",
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
      maxMs: 5000,
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

window.CatCharacter = CatCharacter;
