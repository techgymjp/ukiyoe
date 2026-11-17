'use strict';
/* 錦絵の描画エンジン：和紙・木目・摺りムラ・見当ずれを再現 */
const R = (() => {
  const M = 18, GW = 50, GH = 75, CELL = 8, MW = 100, MH = 150;
  const FONT = '"Shippori Mincho","Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif';
  const mk = U.canvas;
  const cache = new Map();
  const cached = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

  function fibers(w, h, seed = 11, density = 1) {
    return cached(`f${w}x${h}:${seed}:${density}`, () => {
      const c = mk(w, h), g = c.getContext('2d'), r = U.rng(seed), k = w / 900;
      const n = Math.round(w * h / 650 * density);
      for (let i = 0; i < n; i++) {
        const x = r() * w, y = r() * h, l = (4 + r() * 20) * k, a = r() * Math.PI * 2;
        g.strokeStyle = `rgba(${120 + r() * 40 | 0},${95 + r() * 30 | 0},${60 + r() * 20 | 0},${0.04 + r() * 0.09})`;
        g.lineWidth = (0.4 + r() * 0.9) * k;
        g.beginPath(); g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
      for (let i = 0; i < n / 4; i++) {
        g.fillStyle = `rgba(110,85,50,${0.05 + r() * 0.1})`;
        g.fillRect(r() * w, r() * h, k * (0.6 + r()), k * (0.6 + r()));
      }
      return c;
    });
  }
  function paper(w, h) {
    w = Math.round(w); h = Math.round(h);
    return cached(`p${w}x${h}`, () => {
      const c = mk(w, h), g = c.getContext('2d');
      g.fillStyle = '#f1e6cf'; g.fillRect(0, 0, w, h);
      const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, 'rgba(255,250,235,0.35)'); gr.addColorStop(1, 'rgba(160,125,80,0.16)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.drawImage(fibers(w, h, 3), 0, 0);
      return c;
    });
  }
  function grainLines(g, w, h, r, n, colorFn) {
    const k = w / 900;
    for (let i = 0; i < n; i++) {
      const x0 = r() * w, amp = (2 + r() * 12) * k, f = (0.002 + r() * 0.007) / k, ph = r() * 6;
      g.strokeStyle = colorFn(r); g.lineWidth = (0.5 + r() * 2.2) * k;
      g.beginPath();
      for (let y = 0; y <= h + 8 * k; y += 8 * k) {
        const x = x0 + Math.sin(y * f + ph) * amp + Math.sin(y * f * 2.7 + ph * 1.3) * amp * 0.3;
        y === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  function wood(w, h) {
    w = Math.round(w); h = Math.round(h);
    return cached(`w${w}x${h}`, () => {
      const c = mk(w, h), g = c.getContext('2d'), r = U.rng(5);
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#caa274'); gr.addColorStop(1, '#b68b5d');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      grainLines(g, w, h, r, Math.round(w / 3), r => `rgba(${100 + r() * 30 | 0},${62 + r() * 20 | 0},${32 + r() * 15 | 0},${0.06 + r() * 0.18})`);
      grainLines(g, w, h, r, Math.round(w / 12), r => `rgba(235,205,160,${0.05 + r() * 0.12})`);
      return c;
    });
  }
  function grain(w, h) {
    return cached(`g${w}x${h}`, () => {
      const c = mk(w, h), g = c.getContext('2d'), r = U.rng(21);
      grainLines(g, w, h, r, Math.round(w / 2.5), r => `rgba(0,0,0,${0.15 + r() * 0.5})`);
      for (let i = 0; i < w * h / 250; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.6})`; g.fillRect(r() * w, r() * h, w / 900 * 1.5, w / 900 * 1.5); }
      return c;
    });
  }
  let noiseArr = null;
  function noise() {
    if (noiseArr) return noiseArr;
    const r = U.rng(99);
    const lattice = (n) => {
      const gw = Math.ceil(MW / n) + 2, gh = Math.ceil(MH / n) + 2;
      const L = new Float32Array(gw * gh).map(() => r());
      return (x, y) => {
        const fx = x / n, fy = y / n, ix = fx | 0, iy = fy | 0;
        let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const a = L[iy * gw + ix], b = L[iy * gw + ix + 1], c = L[(iy + 1) * gw + ix], d = L[(iy + 1) * gw + ix + 1];
        return U.lerp(U.lerp(a, b, tx), U.lerp(c, d, tx), ty);
      };
    };
    const o1 = lattice(12), o2 = lattice(5), o3 = lattice(2);
    noiseArr = new Float32Array(MW * MH);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) noiseArr[y * MW + x] = o1(x, y) * 0.5 + o2(x, y) * 0.3 + o3(x, y) * 0.2;
    return noiseArr;
  }
  /* ばれんの当たり具合（50x75グリッド）から摺りムラのマスクを作る */
  function coverMask(cov) {
    const c = mk(MW, MH), g = c.getContext('2d'), im = g.createImageData(MW, MH), N = noise();
    const at = (x, y) => Math.min(1, cov[U.clamp(y, 0, GH - 1) * GW + U.clamp(x, 0, GW - 1)]);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const gx = (x + 0.5) * GW / MW - 0.5, gy = (y + 0.5) * GH / MH - 0.5;
      const ix = Math.floor(gx), iy = Math.floor(gy), tx = gx - ix, ty = gy - iy;
      const v = U.lerp(U.lerp(at(ix, iy), at(ix + 1, iy), tx), U.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
      const i = y * MW + x;
      im.data[i * 4 + 3] = U.smooth(0.3, 0.8, v + (N[i] - 0.5) * 0.5) * 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  function fillRegion(g, region, hex) {
    if (region.bokashi) {
      const b = region.bokashi, gr = g.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
      gr.addColorStop(0, U.hexA(hex, b.a0)); gr.addColorStop(1, U.hexA(hex, b.a1));
      g.fillStyle = gr;
    } else g.fillStyle = hex;
    g.fill(region.path);
  }
  function colorLayer(region, hex, S) {
    const c = mk(400 * S, 600 * S), g = c.getContext('2d');
    g.setTransform(S, 0, 0, S, 0, 0);
    fillRegion(g, region, hex);
    return c;
  }
  function drawStroke(g, s, color, wk = 1, gapQ = 1, seed = 1) {
    const p = s.pts; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
    const r = U.rng(seed); let skip = 0;
    for (let i = 1; i < p.length; i++) {
      if (gapQ < 1 && skip <= 0 && r() < (1 - gapQ) * 0.12) skip = 1 + (r() * 3 | 0);
      if (skip-- > 0) continue;
      g.lineWidth = (p[i - 1].w + p[i].w) / 2 * wk;
      g.beginPath(); g.moveTo(p[i - 1].x, p[i - 1].y); g.lineTo(p[i].x, p[i].y); g.stroke();
    }
  }
  function vtext(g, text, x, y, size, step) {
    g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    [...text].forEach((ch, i) => g.fillText(ch, x, y + i * step));
  }
  function cartoucheBox(d) {
    const n = [...d.title].length;
    return { x: d.cartouche.x, y: d.cartouche.y, w: 30, h: n * 22 + 16 };
  }
  /* 主版（墨線）：絵師の筆跡 + 彫りの出来 */
  function keyLayer(d, st, S, opt = {}) {
    const c = mk(400 * S, 600 * S), g = c.getContext('2d');
    g.setTransform(S, 0, 0, S, 0, 0);
    g.strokeStyle = g.fillStyle = PIG.sumi.hex; g.lineCap = g.lineJoin = 'round';
    g.lineWidth = 2.4; g.strokeRect(1.5, 1.5, 397, 597);
    st.strokes.forEach((s, si) => {
      const q = s.line >= 0 && st.carve[s.line] ? st.carve[s.line].q : 0.85;
      drawStroke(g, s, PIG.sumi.hex, 0.9, q, si * 977 + 13);
    });
    g.lineWidth = 1.3; d.autoPaths.forEach(p => g.stroke(p));
    (d.keyFillPaths || []).forEach(p => g.fill(p));
    if (opt.cartouche !== false) {
      const b = cartoucheBox(d);
      g.lineWidth = 1.6; g.strokeRect(b.x, b.y, b.w, b.h);
      g.lineWidth = 0.7; g.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
      vtext(g, d.title, b.x + b.w / 2, b.y + 9, 19, 22);
    }
    if (opt.sign) vtext(g, opt.sign + '画', d.sign.x, d.sign.y, 15, 17);
    return c;
  }
  function strength(res) { return res.amount < 0.42 ? 0.5 + 0.5 * (res.amount / 0.42) : 1; }
  function finish(c, res) {
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    const ex =Math.max(0, res.amount - 0.58) / 0.42;
    if (ex > 0.02) {
      const copy = mk(c.width, c.height); copy.getContext('2d').drawImage(c, 0, 0);
      const k = c.width / 400 * 2.2 * ex;
      g.globalAlpha = 0.3 * ex;
      [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]].forEach(([x, y]) => g.drawImage(copy, x * k, y * k));
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.drawImage(coverMask(res.cov), 0, 0, c.width, c.height);
    const lack = Math.max(0, 0.42 - res.amount) / 0.42;
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.1 + 0.5 * lack;
    g.drawImage(grain(c.width, c.height), 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    return c;
  }
  function seal(g, x, y, s, ch) {
    const r = U.rng(ch.charCodeAt(0) || 7);
    g.fillStyle = 'rgba(184,46,36,0.93)';
    g.beginPath();
    const j = () => (r() - 0.5) * 1.2;
    g.moveTo(x + j(), y + j()); g.lineTo(x + s + j(), y + j()); g.lineTo(x + s + j(), y + s + j()); g.lineTo(x + j(), y + s + j()); g.closePath(); g.fill();
    g.fillStyle = '#f3e9d3';
    g.font = `700 ${s * 0.72}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, x + s / 2, y + s / 2 + 0.5);
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(243,233,211,${r() * 0.6})`; g.fillRect(x + r() * s, y + r() * s, 0.8, 0.8); }
  }
  function kiwame(g, x, y) {
    g.strokeStyle = 'rgba(140,58,44,0.85)'; g.fillStyle = 'rgba(140,58,44,0.85)';
    g.lineWidth = 1; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.stroke();
    g.font = `700 10px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('極', x, y + 0.5);
  }

  /* 一枚の錦絵を摺り上げる */
  function render(d, st, opt) {
    const S = opt.S, W = Math.round((400 + 2 * M) * S), H = Math.round((600 + 2 * M) * S);
    const out = mk(W, H), o = out.getContext('2d');
    o.drawImage(paper(W, H), 0, 0);
    const upto = opt.upto ?? st.blocks.length - 1;
    let keyIdx = -1;
    st.blocks.forEach((b, i) => {
      const res = st.results[i];
      if (i > upto || !res || res.amount == null) return;
      if (b.kind === 'key') { keyIdx = i; return; }
      const c = finish(colorLayer(b.region, PIG[st.colors[b.region.id]].hex, S), res);
      o.globalAlpha = strength(res);
      o.drawImage(c, (M + res.dx) * S, (M + res.dy) * S);
      o.globalAlpha = 1;
    });
    if (keyIdx >= 0) {
      const res = st.results[keyIdx], bx = cartoucheBox(d);
      o.save(); o.translate((M + res.dx) * S, (M + res.dy) * S); o.scale(S, S);
      o.fillStyle = 'rgba(238,214,128,0.9)'; o.fillRect(bx.x, bx.y, bx.w, bx.h);
      o.restore();
      const k = finish(keyLayer(d, st, S, { sign: opt.sign }), res);
      o.globalCompositeOperation = 'multiply'; o.globalAlpha = strength(res) * 0.96;
      o.drawImage(k, (M + res.dx) * S, (M + res.dy) * S);
      o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1;
    }
    o.globalAlpha = 0.45; o.drawImage(fibers(W, H, 17, 0.6), 0, 0); o.globalAlpha = 1;
    if (opt.sign) {
      o.save(); o.translate(M * S, M * S); o.scale(S, S);
      const n = [...(opt.sign + '画')].length;
      seal(o, d.sign.x - 8, d.sign.y + n * 17 + 4, 16, [...opt.sign][0] || '印');
      const bx = cartoucheBox(d);
      kiwame(o, bx.x - 12, bx.y + bx.h - 8);
      o.restore();
    }
    return out;
  }

  /* 版木ごとの摺り範囲（ばれん判定用） */
  function blockMask(d, st, block) {
    const c = mk(GW, GH), g = c.getContext('2d');
    g.scale(1 / CELL, 1 / CELL);
    g.fillStyle = g.strokeStyle = '#000';
    if (block.kind === 'key') {
      g.lineWidth = 10; g.lineCap = 'round';
      st.strokes.forEach(s => { g.beginPath(); s.pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); });
      d.autoPaths.forEach(p => g.stroke(p));
      g.strokeRect(4, 4, 392, 592);
    } else g.fill(block.region.path);
    const data = g.getImageData(0, 0, GW, GH).data, mask = new Uint8Array(GW * GH);
    let n = 0;
    for (let i = 0; i < GW * GH; i++) if (data[i * 4 + 3] > 20) { mask[i] = 1; n++; }
    return { mask, n };
  }
  function blockContent(d, st, block, S) {
    if (block.kind === 'key') return keyLayer(d, st, S, { cartouche: true });
    return colorLayer(block.region, PIG[st.colors[block.region.id]].hex, S);
  }

  return { M, GW, GH, CELL, FONT, paper, wood, fibers, render, blockMask, blockContent, drawStroke, fillRegion };
})();
