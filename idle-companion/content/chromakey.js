/**
 * WebGL 海洋蓝幕抠像 — 平滑透明边缘，避免马赛克
 */
class OceanChromaKey {
  constructor(options = {}) {
    this.sensitivity = options.sensitivity ?? 0.72;
    this.feather = options.feather ?? 0.18;
    this.video = null;
    this.canvas = null;
    this.animId = null;
    this.running = false;
    this.dpr = 1;
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.fallback2d = null;
  }

  attach(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });

    if (this.gl) {
      this._initGL();
    } else {
      this.fallback2d = new OceanChromaKey2D(this.sensitivity, this.feather);
      this.fallback2d.attach(video, canvas);
    }
    this._resize();
  }

  _initGL() {
    const gl = this.gl;
    const vs = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main() {
        v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

    const fs = `
      precision mediump float;
      uniform sampler2D u_tex;
      uniform float u_sens;
      uniform float u_feather;
      varying vec2 v_uv;

      void main() {
        vec4 c = texture2D(u_tex, v_uv);
        float r = c.r, g = c.g, b = c.b;
        float maxc = max(r, max(g, b));
        float minc = min(r, min(g, b));
        float delta = maxc - minc;
        float sat = delta / max(maxc, 0.001);

        float blueness = b - max(r, g);
        float grayness = 1.0 - sat;

        float isSubject = 0.0;
        if (grayness > 0.28 && maxc < 0.72) isSubject = 1.0;
        if (blueness < 0.04) isSubject = 1.0;
        if (maxc < 0.12) isSubject = 1.0;

        float waterScore = blueness * 2.2 + sat * 1.4 - grayness * 0.8;
        waterScore *= step(0.06, sat + blueness * 0.5);
        waterScore *= step(g, b * 0.98);

        float low = 0.08 * u_sens;
        float high = low + u_feather;
        float water = smoothstep(low, high, waterScore);
        water *= (1.0 - isSubject);

        float alpha = c.a * (1.0 - water);

        float spill = max(0.0, b - max(r, g));
        r -= spill * 0.55 * (1.0 - alpha);
        g -= spill * 0.15 * (1.0 - alpha);
        b -= spill * 0.75 * (1.0 - alpha);

        gl_FragColor = vec4(clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), alpha);
      }
    `;

    this.program = this._createProgram(gl, vs, fs);
    this.texture = gl.createTexture();

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _createProgram(gl, vsSrc, fsSrc) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return prog;
  }

  _resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    if (this.fallback2d) {
      this.fallback2d._resize();
      return;
    }

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._resize();
    this._loop();
    window.addEventListener("resize", this._onResize);
  }

  stop() {
    this.running = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    window.removeEventListener("resize", this._onResize);
    if (this.fallback2d) {
      this.fallback2d.stop();
    } else if (this.gl) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }
  }

  _onResize = () => this._resize();

  _loop() {
    if (!this.running) return;
    if (this.fallback2d) {
      this.fallback2d._renderFrame();
    } else {
      this._renderGL();
    }
    this.animId = requestAnimationFrame(() => this._loop());
  }

  _renderGL() {
    const { video, gl, canvas } = this;
    if (!video || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = Math.floor(vw * scale);
    const dh = Math.floor(vh * scale);
    const dx = Math.floor((cw - dw) / 2);
    const dy = Math.floor((ch - dh) / 2);

    if (!this._workCanvas) {
      this._workCanvas = document.createElement("canvas");
      this._workCtx = this._workCanvas.getContext("2d");
    }
    this._workCanvas.width = cw;
    this._workCanvas.height = ch;
    const wctx = this._workCtx;
    wctx.clearRect(0, 0, cw, ch);
    wctx.imageSmoothingEnabled = true;
    wctx.imageSmoothingQuality = "high";
    wctx.drawImage(video, dx, dy, dw, dh);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._workCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_tex"), 0);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_sens"), this.sensitivity);
    gl.uniform1f(gl.getUniformLocation(this.program, "u_feather"), this.feather);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

/**
 * Canvas 2D 降级方案 — 带 Alpha 羽化
 */
class OceanChromaKey2D {
  constructor(sensitivity, feather) {
    this.sensitivity = sensitivity;
    this.feather = feather;
    this.video = null;
    this.canvas = null;
    this.ctx = null;
    this.dpr = 1;
    this._workCanvas = document.createElement("canvas");
    this._workCtx = this._workCanvas.getContext("2d");
  }

  attach(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this._resize();
  }

  _resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  stop() {
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _renderFrame() {
    const { video, canvas, ctx } = this;
    if (!video || !ctx || video.readyState < 2) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    this._workCanvas.width = cw;
    this._workCanvas.height = ch;
    this._workCtx.imageSmoothingEnabled = true;
    this._workCtx.imageSmoothingQuality = "high";
    this._workCtx.clearRect(0, 0, cw, ch);
    this._workCtx.drawImage(video, dx, dy, dw, dh);

    const src = this._workCtx.getImageData(0, 0, cw, ch);
    const alpha = new Float32Array(cw * ch);

    for (let i = 0, p = 0; i < src.data.length; i += 4, p++) {
      alpha[p] = this._matte(
        src.data[i] / 255,
        src.data[i + 1] / 255,
        src.data[i + 2] / 255
      );
    }

    this._blurAlpha(alpha, cw, ch, 2);

    for (let i = 0, p = 0; i < src.data.length; i += 4, p++) {
      const a = alpha[p];
      src.data[i + 3] = Math.floor(a * 255);
      if (a < 0.98) {
        const spill = Math.max(0, src.data[i + 2] / 255 - Math.max(src.data[i], src.data[i + 1]) / 255);
        src.data[i] = Math.min(255, src.data[i] - spill * 55 * (1 - a));
        src.data[i + 2] = Math.min(255, src.data[i + 2] - spill * 90 * (1 - a));
      }
    }

    ctx.clearRect(0, 0, cw, ch);
    ctx.putImageData(src, 0, 0);
  }

  _matte(r, g, b) {
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const sat = (maxc - minc) / Math.max(maxc, 0.001);
    const blueness = b - Math.max(r, g);
    const grayness = 1 - sat;

    if (maxc < 0.12) return 1;
    if (grayness > 0.28 && maxc < 0.72) return 1;
    if (blueness < 0.04) return 1;

    const score = blueness * 2.2 + sat * 1.4 - grayness * 0.8;
    const low = 0.08 * this.sensitivity;
    const high = low + this.feather;
    const t = Math.max(0, Math.min(1, (score - low) / Math.max(0.001, high - low)));
    const water = t * t * (3 - 2 * t);
    return 1 - water;
  }

  _blurAlpha(alpha, w, h, radius) {
    const tmp = new Float32Array(alpha.length);
    const size = radius * 2 + 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          sum += alpha[y * w + Math.max(0, Math.min(w - 1, x + k))];
        }
        tmp[y * w + x] = sum / size;
      }
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          sum += tmp[Math.max(0, Math.min(h - 1, y + k)) * w + x];
        }
        alpha[y * w + x] = sum / size;
      }
    }
  }
}

window.OceanChromaKey = OceanChromaKey;
