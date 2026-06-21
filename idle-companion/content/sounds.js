/**
 * Web Audio API 合成音效 — 无需外部音频文件
 */
class SoundManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  setEnabled(val) {
    this.enabled = val;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playEntrance(character) {
    if (!this.enabled) return;
    const fn = {
      whale: () => this._whaleSplash(),
      fox: () => this._foxHop(),
      cat: () => this._catMeow(),
    }[character];
    fn?.();
  }

  playAction(character) {
    if (!this.enabled) return;
    const fn = {
      whale: () => this._waterSpray(),
      fox: () => this._foxYip(),
      cat: () => this._catPurr(),
    }[character];
    fn?.();
  }

  _tone(freq, start, dur, type = "sine", vol = 0.15, ramp = true) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    if (ramp) {
      osc.frequency.exponentialRampToValueAtTime(
        freq * 1.2,
        ctx.currentTime + start + dur * 0.6
      );
    }
    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur + 0.05);
  }

  _noise(start, dur, vol = 0.08, filterFreq = 800) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime + start);
    filter.frequency.exponentialRampToValueAtTime(
      filterFreq * 0.3,
      ctx.currentTime + start + dur
    );
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime + start);
    src.stop(ctx.currentTime + start + dur + 0.05);
  }

  _whaleSplash() {
    this._noise(0, 0.6, 0.12, 200);
    this._tone(80, 0.1, 0.8, "sine", 0.18);
    this._tone(120, 0.3, 0.5, "triangle", 0.08);
    this._noise(0.4, 0.4, 0.06, 600);
  }

  _waterSpray() {
    this._noise(0, 1.2, 0.05, 1200);
    this._noise(0.3, 0.8, 0.04, 900);
    this._tone(200, 0, 0.3, "sine", 0.06);
  }

  _foxHop() {
    this._tone(400, 0, 0.12, "triangle", 0.1);
    this._tone(600, 0.1, 0.15, "triangle", 0.12);
    this._tone(500, 0.25, 0.1, "sine", 0.08);
  }

  _foxYip() {
    this._tone(700, 0, 0.08, "square", 0.06);
    this._tone(900, 0.08, 0.1, "square", 0.07);
    this._tone(750, 0.2, 0.12, "triangle", 0.05);
  }

  _catMeow() {
    this._tone(600, 0, 0.15, "sine", 0.1, false);
    this._tone(900, 0.12, 0.2, "sine", 0.12);
    this._tone(500, 0.3, 0.25, "sine", 0.08);
  }

  _catPurr() {
    this._tone(50, 0, 1.5, "sine", 0.06, false);
    this._noise(0, 1.2, 0.02, 100);
    this._tone(55, 0.2, 1.0, "sine", 0.04, false);
  }
}

window.SoundManager = SoundManager;
