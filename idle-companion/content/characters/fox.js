/**
 * 狐狸角色：全屏写实视频 — 跃入 → 好奇张望 → 呼吸
 */
class FoxCharacter extends CharacterBase {
  render() {
    this.root.innerHTML = this._sceneVideoHtml({
      bgClass: "ic-fox-scene",
      videoPath: "assets/fox.mp4",
      posterPath: "assets/fox-realistic.png",
      extra: `
        <div class="ic-forest-particles"></div>
        <div class="ic-light-rays"></div>
      `,
    });
  }

  async playEntrance() {
    this.phase = "entering";
    await this._waitForVideo();
    this.root.classList.add("ic-fox-enter");
    await this._playVideo({ from: 0, loop: false });
    await this._wait(2800);
    this.root.classList.remove("ic-fox-enter");
    this.root.classList.add("ic-visible");
    return Promise.resolve();
  }

  async playAction() {
    this.phase = "acting";
    this.root.classList.add("ic-fox-curious");
    await this._wait(2800);
    this.root.classList.remove("ic-fox-curious");
    return Promise.resolve();
  }

  startIdle() {
    super.startIdle();
    this.root.classList.add("ic-fox-idle");
  }
}

window.FoxCharacter = FoxCharacter;
