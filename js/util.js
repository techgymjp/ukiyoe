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

/* 効果音（WebAudioで合成） */
const Sfx = {
  on: true, ctx: null, noise: null, last: {},
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = this.ctx.sampleRate * 0.6;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
    } catch (e) { this.ctx = null; }
  },
  play(type, throttle = 0) {
    if (!this.on) return;
    this.init();
    const c = this.ctx; if (!c) return;
    if (c.state === 'suspended') c.resume();
    const now = performance.now();
    if (throttle && this.last[type] && now - this.last[type] < throttle) return;
    this.last[type] = now;
    const t = c.currentTime;
    const noiseHit = (ftype, freq, vol, dur, q = 1) => {
      const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(c.destination);
      src.start(t, Math.random() * 0.4, dur + 0.02);
    };
    const tone = (freq, vol, dur, type = 'sine', delay = 0) => {
      const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.linearRampToValueAtTime(vol, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
      o.connect(g).connect(c.destination); o.start(t + delay); o.stop(t + delay + dur + 0.05);
    };
    switch (type) {
      case 'brush': noiseHit('bandpass', 1800, 0.10, 0.08, 0.7); break;
      case 'carve': noiseHit('highpass', 3200, 0.10, 0.05); break;
      case 'rub': noiseHit('lowpass', 650, 0.12, 0.10); break;
      case 'chip': tone(180, 0.18, 0.12, 'square'); noiseHit('highpass', 2000, 0.2, 0.08); break;
      case 'tap': tone(880, 0.10, 0.12, 'triangle'); break;
      case 'paint': noiseHit('bandpass', 900, 0.25, 0.35, 0.5); break;
      case 'paper': noiseHit('bandpass', 2400, 0.12, 0.25, 0.4); break;
      case 'seal': tone(110, 0.35, 0.25); noiseHit('lowpass', 300, 0.3, 0.15); break;
      case 'done': tone(587.3, 0.12, 0.5, 'triangle'); tone(880, 0.12, 0.7, 'triangle', 0.12); break;
      case 'fanfare': [523.3, 587.3, 659.3, 784, 880].forEach((f, i) => tone(f, 0.1, 0.6, 'triangle', i * 0.11)); break;
    }
  }
};
