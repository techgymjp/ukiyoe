'use strict';
/* 汎用ユーティリティ・効果音 */
const U = (() => {
  const U = {};
  const NS = 'http://www.w3.org/2000/svg';
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  U.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  U.rng = (seed) => {
    let a = (seed >>> 0) || 1;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  };
  U.hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  /* SVGパス文字列を一定間隔の点列にする */
  let svg = null;
  U.samplePath = (d, step = 3) => {
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
      svg.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
      document.body.appendChild(svg);
    }
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d); svg.appendChild(p);
    const L = p.getTotalLength();
    const n = Math.max(2, Math.ceil(L / step));
    const pts = [];
    for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n); pts.push({ x: q.x, y: q.y }); }
    svg.removeChild(p);
    return pts;
  };

  /* 絶対座標の M/L/C/Q/Z パスを平行移動・回転・拡大 */
  U.tf = (d, ox, oy, deg = 0, s = 1) => {
    const c = Math.cos(deg * Math.PI / 180), sn = Math.sin(deg * Math.PI / 180);
    const toks = d.match(/[MLCQZ]|-?\d*\.?\d+/g);
    const out = []; let pend = null;
    for (const t of toks) {
      if (/[A-Z]/.test(t)) { out.push(t); continue; }
      const v = parseFloat(t);
      if (pend === null) { pend = v; continue; }
      const x = pend * s, y = v * s;
      out.push((ox + x * c - y * sn).toFixed(1), (oy + x * sn + y * c).toFixed(1));
      pend = null;
    }
    return out.join(' ');
  };
  U.tp = (x, y, ox, oy, deg = 0, s = 1) => {
    const c = Math.cos(deg * Math.PI / 180), sn = Math.sin(deg * Math.PI / 180);
    return { x: ox + (x * c - y * sn) * s, y: oy + (x * sn + y * c) * s };
  };
  U.circle = (cx, cy, r) => `M${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} Z`;
  U.poly = (pts, close = true) => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + (close ? ' Z' : '');
  return U;
})();

/* 効果音とBGM（WebAudioで合成。音源ファイル不要） */
const Sfx = {
  on: true, bgmOn: true, ctx: null, noise: null, last: {}, master: null, sfxBus: null, bgmBus: null, koto: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = c.sampleRate * 0.6, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      this.master = c.createGain(); this.master.connect(c.destination);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.bgmBus = c.createGain(); this.bgmBus.gain.value = 0;
      // 簡易リバーブ（BGM用）
      const rv = c.createConvolver(), il = c.sampleRate * 2.2, ib = c.createBuffer(2, il, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const x = ib.getChannelData(ch); for (let i = 0; i < il; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / il, 3); }
      rv.buffer = ib;
      const wet = c.createGain(); wet.gain.value = 0.35;
      this.bgmBus.connect(this.master); this.bgmBus.connect(rv); rv.connect(wet); wet.connect(this.master);
      this.revIn = rv;
      if (this.bgmOn) this.bgmStart();
    } catch (e) { this.ctx = null; }
  },
  /* 箏の音（Karplus-Strong 法で弦をはじく音を合成） */
  kotoBuf(freq) {
    const k = Math.round(freq);
    if (this.koto[k]) return this.koto[k];
    const c = this.ctx, sr = c.sampleRate, len = Math.floor(sr * 2.6), buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (i < N / 3 ? 1 : 0.5);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const nx = (idx + 1) % N, v = (ring[idx] + ring[nx]) * 0.4985;
      d[i] = ring[idx]; ring[idx] = v; idx = nx;
    }
    for (let i = 0; i < 200; i++) d[i] *= i / 200;
    return (this.koto[k] = buf);
  },
  pluck(freq, vol, when, bus) {
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    src.buffer = this.kotoBuf(freq); f.type = 'lowpass'; f.frequency.value = 3200;
    g.gain.value = vol;
    src.connect(f).connect(g).connect(bus || this.sfxBus); src.start(when);
  },
  bell(freq, vol, when, dur = 2.5, bus) {
    const c = this.ctx;
    [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.9, 0.1]].forEach(([m, a]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol * a, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur / m ** 0.3);
      o.connect(g).connect(bus || this.sfxBus); o.start(when); o.stop(when + dur + 0.1);
    });
  },
  play(type, throttle = 0) {
    if (!this.on) return;
    this.init();
    const c = this.ctx; if (!c) return;
    const now = performance.now();
    if (throttle && this.last[type] && now - this.last[type] < throttle) return;
    this.last[type] = now;
    const t = c.currentTime, bus = this.sfxBus;
    const noiseHit = (ftype, freq, vol, dur, q = 1, attack = 0.002) => {
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(bus);
      src.start(t, Math.random() * 0.4, dur + 0.05);
    };
    const tone = (freq, vol, dur, type = 'sine', delay = 0, slide = 0) => {
      const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t + delay);
      if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + delay + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t + delay); g.gain.linearRampToValueAtTime(vol, t + delay + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
      o.connect(g).connect(bus); o.start(t + delay); o.stop(t + delay + dur + 0.05);
    };
    const wood = (freq, vol, delay = 0) => { tone(freq, vol, 0.09, 'sine', delay, 0.7); };
    const P = [293.7, 311.1, 392, 440, 466.2]; // 都節音階（レ ミ♭ ソ ラ シ♭）
    switch (type) {
      case 'brush': noiseHit('bandpass', 2200, 0.07, 0.12, 0.6, 0.03); break;           // 筆のさらさら
      case 'carve': noiseHit('highpass', 3800, 0.08, 0.04); tone(900 + Math.random() * 300, 0.02, 0.03, 'square'); break; // 小刀
      case 'rub': noiseHit('lowpass', 520, 0.16, 0.14, 0.8, 0.04); break;              // ばれん
      case 'chip': wood(380, 0.35); noiseHit('highpass', 2500, 0.18, 0.06); break;      // 欠け
      case 'tap': wood(1250, 0.25); break;                                              // 拍子木風
      case 'paint': noiseHit('bandpass', 700, 0.22, 0.4, 0.5, 0.05); noiseHit('bandpass', 1600, 0.08, 0.3, 0.8, 0.02); break; // 刷毛
      case 'paper': noiseHit('bandpass', 3000, 0.1, 0.32, 0.3, 0.06); break;            // 紙
      case 'seal': tone(95, 0.45, 0.22, 'sine', 0, 0.6); noiseHit('lowpass', 260, 0.35, 0.12); break; // 印
      case 'good': this.pluck(P[2] * 2, 0.5, t); this.pluck(P[4] * 2, 0.4, t + 0.09); break;
      case 'bad': this.pluck(P[1], 0.6, t); this.pluck(P[0] * 0.75, 0.5, t + 0.12); break;
      case 'done': this.bell(880, 0.12, t, 2.2); break;                                 // りん
      case 'fanfare': [0, 1, 2, 3, 4, 5, 6, 7].forEach((k, i) => this.pluck(P[k % 5] * (k >= 5 ? 2 : 1), 0.45, t + i * 0.07)); this.bell(587.3, 0.1, t + 0.6, 3); break; // 箏のグリッサンド
    }
  },
  /* ───── BGM：箏と尺八風の音による都節音階の即興 ───── */
  bgmStart() {
    if (!this.ctx || this.bgmTimer) return;
    const c = this.ctx;
    this.bgmBus.gain.cancelScheduledValues(c.currentTime);
    this.bgmBus.gain.setTargetAtTime(0.55, c.currentTime, 1.2);
    const scale = [146.8, 155.6, 196, 220, 233.1, 293.7, 311.1, 392, 440, 466.2, 587.3];
    let step = 0, pos = 5, next = c.currentTime + 0.2;
    const beat = 0.62;
    const tick = () => {
      while (next < c.currentTime + 1.2) {
        const bar = Math.floor(step / 8), inBar = step % 8;
        if (inBar === 0) this.pluck(scale[[0, 2, 3, 0][bar % 4]] / 2, 0.38, next, this.bgmBus);         // 低音
        if (inBar === 4 && bar % 2) this.pluck(scale[[2, 3][bar % 2]] / 2 * 1.5, 0.22, next, this.bgmBus);
        if (Math.random() < (inBar % 2 ? 0.35 : 0.7)) {                                                  // 旋律
          pos = Math.max(3, Math.min(scale.length - 1, pos + [-2, -1, -1, 1, 1, 2, 0][Math.random() * 7 | 0]));
          this.pluck(scale[pos] * (Math.random() < 0.15 ? 2 : 1), 0.28, next + (Math.random() < 0.2 ? beat / 2 : 0), this.bgmBus);
          if (Math.random() < 0.15) this.pluck(scale[Math.min(scale.length - 1, pos + 2)], 0.18, next + 0.04, this.bgmBus);
        }
        if (inBar === 0 && bar % 4 === 2) this.shaku(scale[[7, 8, 9, 8][(bar / 4 | 0) % 4]], next, beat * 6); // 尺八風の長音
        if (inBar === 0 && bar % 8 === 7) this.bell(1174.7, 0.025, next, 3, this.bgmBus);
        next += beat; step++;
      }
    };
    tick(); this.bgmTimer = setInterval(tick, 300);
  },
  shaku(freq, when, dur) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter();
    o.type = 'triangle'; o.frequency.setValueAtTime(freq * 0.97, when); o.frequency.linearRampToValueAtTime(freq, when + 0.35);
    lfo.frequency.value = 5; lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(freq * 0.012, when + dur * 0.6);
    lfo.connect(lg).connect(o.frequency);
    f.type = 'lowpass'; f.frequency.value = 1500;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.07, when + 0.4); g.gain.setValueAtTime(0.07, when + dur - 0.8); g.gain.linearRampToValueAtTime(0.0001, when + dur);
    o.connect(f).connect(g).connect(this.bgmBus);
    const br = c.createBufferSource(), bf = c.createBiquadFilter(), bg = c.createGain();      // 息の音
    br.buffer = this.noise; br.loop = true; bf.type = 'bandpass'; bf.frequency.value = freq * 2; bf.Q.value = 2;
    bg.gain.setValueAtTime(0.0001, when); bg.gain.linearRampToValueAtTime(0.02, when + 0.2); bg.gain.linearRampToValueAtTime(0.004, when + dur);
    br.connect(bf).connect(bg).connect(this.bgmBus);
    [o, lfo, br].forEach(n => { n.start(when); n.stop(when + dur + 0.1); });
  },
  bgmStop() {
    clearInterval(this.bgmTimer); this.bgmTimer = null;
    if (this.ctx) this.bgmBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  },
  /* ばれんで摺る音：こすっている間鳴り続け、速さで音量と音色が変わる */
  rubLoop: null,
  rubStart() {
    if (!this.on) return;
    this.init();
    const c = this.ctx; if (!c || this.rubLoop) return;
    const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
    const lo = c.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 5000;
    const g = c.createGain(); g.gain.value = 0;
    // 紙の繊維がこすれる「ざらつき」：音量を細かく揺らす
    const trem = c.createOscillator(), tg = c.createGain(); trem.type = 'sawtooth'; trem.frequency.value = 22; tg.gain.value = 0;
    trem.connect(tg).connect(g.gain);
    src.connect(bp).connect(lo).connect(g).connect(this.sfxBus);
    src.start(); trem.start();
    this.rubLoop = { src, bp, g, trem, tg };
  },
  rubSpeed(v) {
    const r = this.rubLoop; if (!r) return;
    const t = this.ctx.currentTime, k = Math.min(1, v / 1.3);
    const level = 0.08 + 0.42 * k;
    r.g.gain.cancelScheduledValues(t);
    r.g.gain.setTargetAtTime(level, t, 0.02);
    r.g.gain.setTargetAtTime(0, t + 0.09, 0.06);          // 手を止めると消える
    r.tg.gain.setTargetAtTime(level * 0.35, t, 0.03);
    r.trem.frequency.setTargetAtTime(14 + 30 * k, t, 0.05);
    r.bp.frequency.setTargetAtTime(1000 + 1800 * k, t, 0.05);
  },
  rubStop() {
    const r = this.rubLoop; if (!r) return;
    const t = this.ctx.currentTime;
    r.g.gain.cancelScheduledValues(t); r.g.gain.setTargetAtTime(0, t, 0.05);
    r.tg.gain.setTargetAtTime(0, t, 0.05);
    r.src.stop(t + 0.4); r.trem.stop(t + 0.4);
    this.rubLoop = null;
  },
  setBgm(on) { this.bgmOn = on; if (on) { this.init(); this.bgmStart(); } else this.bgmStop(); },
};
