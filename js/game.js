'use strict';
(() => {
  const VW = 460, VH = 660, OX = 30, OY = 30;
  const { GW, GH, CELL, M } = R;
  const $ = s => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d'), panel = $('#panel');
  const hitCtx = document.createElement('canvas').getContext('2d');
  let scale = 1, dpr = 1, texPaper = null, texWood = null;
  const G = { design: null, st: null, stageName: null, stage: null, finalCv: null };
  window.UKIYOE = G;
  const STEPS = ['shitae', 'irosashi', 'hori', 'suri', 'rakkan'];

  /* ───────── 共通 ───────── */
  function resize() {
    const wrap = cv.parentElement, r = wrap.getBoundingClientRect();
    const s = Math.max(0.2, Math.min(r.width / VW, r.height / VH));
    scale = s; dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = VW * s + 'px'; cv.style.height = VH * s + 'px';
    cv.width = Math.round(VW * s * dpr); cv.height = Math.round(VH * s * dpr);
  }
  window.addEventListener('resize', resize);
  function show(id) {
    document.querySelectorAll('.screen').forEach(e => e.classList.toggle('active', e.id === id));
    document.body.dataset.screen = id;
    if (id === 'screen-work') requestAnimationFrame(resize);
  }
  function setStep(name) {
    const idx = STEPS.indexOf(name);
    document.querySelectorAll('#steps li').forEach((li, i) => {
      li.classList.toggle('active', i === idx);
      li.classList.toggle('done', idx >= 0 && i < idx);
    });
  }
  let toastTimer = 0;
  function toast(msg, kind = '') {
    const t = $('#toast'); t.textContent = msg; t.className = 'show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 1600);
  }
  function go(name) {
    G.stageName = name; G.stage = stages[name];
    setStep(name); show('screen-work');
    G.stage.enter();
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function head(role, num, title, yomi) {
    return `<div class="role"><span class="role-seal">${role[0]}</span>${role}の仕事</div>
      <h2><small>${num}</small>${title}<span class="yomi">${yomi}</span></h2>`;
  }
  const bgPaper = g => g.drawImage(texPaper, -OX, -OY, VW, VH);
  const bgWood = g => g.drawImage(texWood, -OX, -OY, VW, VH);
  const mirror = g => { g.translate(400, 0); g.scale(-1, 1); };

  function prepDesign(d) {
    if (d._prep) return;
    d.lines.forEach(l => { l.path = new Path2D(l.d); l.samples = U.samplePath(l.d, 3); });
    d.regions.forEach(r => r.path = new Path2D(r.d));
    d.autoPaths = d.auto.map(a => new Path2D(a));
    d.keyFillPaths = (d.keyFills || []).map(a => new Path2D(a));
    d._prep = true;
  }
  function buildBlocks(d) {
    return [{ kind: 'key', name: '主版（墨線）', yomi: 'おもはん' }]
      .concat(d.regions.slice().sort((a, b) => a.z - b.z).map(r => ({ kind: 'color', region: r, name: r.name })));
  }
  function newState(d) {
    return {
      strokes: [], cov: d.lines.map(l => new Uint8Array(l.samples.length)), errSum: 0, errN: 0,
      colors: Object.fromEntries(d.regions.map(r => [r.id, r.color])),
      carve: d.lines.map(() => ({ k: 0, done: false, chips: [], slips: 0, q: 1 })),
      blocks: buildBlocks(d), results: [], scores: {}, name: '', blockScores: [],
    };
  }
  function idealState(d) {
    const st = newState(d);
    st.strokes = d.lines.map((l, i) => ({ line: i, pts: l.samples.map(p => ({ x: p.x, y: p.y, w: 2.4 })) }));
    st.carve.forEach(c => { c.done = true; c.q = 1; });
    st.results = st.blocks.map(() => ({ amount: 0.5, dx: 0, dy: 0, cov: new Float32Array(GW * GH).fill(1.2) }));
    return st;
  }
  function drawStroke(g, s, color, wk = 1) { R.drawStroke(g, s, color, wk); }

  /* ───────── 壱：版下絵（絵師） ───────── */
  const TCOV = 8;
  function markCov(x, y) {
    const d = G.design, st = G.st; let minD = 1e9;
    d.lines.forEach((l, i) => {
      const s = l.samples, c = st.cov[i];
      for (let j = 0; j < s.length; j++) {
        const dx = s[j].x - x, dy = s[j].y - y, dd = dx * dx + dy * dy;
        if (dd < minD) minD = dd;
        if (dd < TCOV * TCOV) c[j] = 1;
      }
    });
    st.errSum += Math.min(Math.sqrt(minD), 25); st.errN++;
  }
  const lineRatio = i => { const c = G.st.cov[i]; let n = 0; for (const v of c) n += v; return n / c.length; };
  const LINE_OK = 0.86;
  function recomputeCov() {
    const st = G.st; st.cov.forEach(c => c.fill(0)); st.errSum = 0; st.errN = 0;
    st.strokes.forEach(s => s.pts.forEach(p => markCov(p.x, p.y)));
  }
  function assignLine(stroke) {
    const d = G.design, votes = new Array(d.lines.length).fill(0);
    stroke.pts.forEach(p => {
      let best = -1, bd = 15 * 15;
      d.lines.forEach((l, i) => l.samples.forEach(s => { const dd = (s.x - p.x) ** 2 + (s.y - p.y) ** 2; if (dd < bd) { bd = dd; best = i; } }));
      if (best >= 0) votes[best]++;
    });
    const m = Math.max(...votes); return m > 0 ? votes.indexOf(m) : -1;
  }
  function shitaeScore() {
    const d = G.design, st = G.st;
    const avg = d.lines.reduce((a, _, i) => a + lineRatio(i), 0) / d.lines.length;
    const me = st.errN ? st.errSum / st.errN : 10;
    const acc = U.clamp(1 - (me - 2.5) / 12, 0.4, 1);
    return Math.round(100 * Math.min(1, avg / 0.95) * acc);
  }
  let cur = null;
  const stages = {};
  stages.shitae = {
    enter() { cur = null; this.panel(); },
    panel() {
      const d = G.design, n = d.lines.length, done = d.lines.filter((_, i) => lineRatio(i) >= LINE_OK).length;
      panel.innerHTML = head('絵師', '壱', '版下絵', 'はんしたえ') + `
        <p>浮世絵はまず<b>絵師</b>が墨一色で線画を描きます。薄い美濃紙に描かれた「版下絵」はそのまま版木に貼られて彫られるため、<b>絵師の筆跡がそのまま版画の線</b>になります。</p>
        <p class="howto">青い点線を筆でなぞりましょう。なぞり終えた線は朱に変わります。丁寧にゆっくり描くと線に抑揚が生まれます。</p>
        <div class="meter"><div class="meter-fill" style="width:${done / n * 100}%"></div><span>線 ${done} / ${n}</span></div>
        <div class="controls">
          <button class="btn" id="b-undo" ${G.st.strokes.length ? '' : 'disabled'}>一筆戻す</button>
          <button class="btn" id="b-clear" ${G.st.strokes.length ? '' : 'disabled'}>描き直す</button>
          <button class="btn primary" id="b-next" ${done === n ? '' : 'disabled'}>色さしへ進む</button>
        </div>
        <div class="tip"><b>豆知識</b>版下絵は彫る時に版木ごと削られて失われます。そのため、浮世絵の肉筆の下絵はほとんど現存していません。</div>`;
      $('#b-undo').onclick = () => { G.st.strokes.pop(); recomputeCov(); this.panel(); };
      $('#b-clear').onclick = () => { G.st.strokes = []; recomputeCov(); this.panel(); };
      $('#b-next').onclick = () => { G.st.scores.shitae = shitaeScore(); Sfx.play('done'); go('irosashi'); };
    },
    draw(g) {
      const d = G.design;
      bgPaper(g);
      g.save(); g.globalAlpha = 0.12;
      d.regions.slice().sort((a, b) => a.z - b.z).forEach(r => R.fillRegion(g, r, PIG[r.color].hex));
      g.restore();
      g.strokeStyle = 'rgba(60,90,140,0.3)'; g.lineWidth = 1; g.strokeRect(1.5, 1.5, 397, 597);
      g.lineWidth = 1; g.setLineDash([]);
      g.strokeStyle = 'rgba(60,90,140,0.22)'; d.autoPaths.forEach(p => g.stroke(p));
      d.lines.forEach((l, i) => {
        const ok = lineRatio(i) >= LINE_OK;
        g.strokeStyle = ok ? 'rgba(200,68,47,0.4)' : 'rgba(40,80,150,0.75)';
        g.lineWidth = ok ? 3 : 1.4; g.setLineDash(ok ? [] : [5, 4]); g.stroke(l.path);
      });
      g.setLineDash([]);
      G.st.strokes.forEach(s => drawStroke(g, s, '#1d1a17'));
      if (cur) drawStroke(g, cur, '#1d1a17');
    },
    down(p) { cur = { pts: [{ x: p.x, y: p.y, w: 1.2, t: p.t }], line: -1 }; markCov(p.x, p.y); },
    move(p, down) {
      if (!cur || !down) return;
      const last = cur.pts[cur.pts.length - 1];
      const sx = last.x + (p.x - last.x) * 0.6, sy = last.y + (p.y - last.y) * 0.6;
      const dd = Math.hypot(sx - last.x, sy - last.y);
      if (dd < 1.2) return;
      const v = dd / Math.max(1, p.t - last.t);
      const wt = U.clamp(3.6 - v * 2.4, 1.2, 3.6);
      cur.pts.push({ x: sx, y: sy, w: last.w + (wt - last.w) * 0.3, t: p.t });
      markCov(sx, sy);
      Sfx.play('brush', 90);
    },
    up() {
      if (!cur) return;
      const n = cur.pts.length;
      for (let i = 0; i < Math.min(5, n); i++) cur.pts[n - 1 - i].w *= 0.45 + i * 0.11;
      if (n > 2) { cur.line = assignLine(cur); G.st.strokes.push(cur); }
      const before = G.design.lines.filter((_, i) => lineRatio(i) >= LINE_OK).length;
      cur = null;
      if (before === G.design.lines.length) toast('版下絵が描き上がった！', 'good');
      this.panel();
    },
  };

  /* ───────── 弐：色さし（絵師） ───────── */
  let selRegion = null;
  stages.irosashi = {
    enter() { selRegion = G.design.regions[0]; this.panel(); },
    panel() {
      const d = G.design, st = G.st;
      const rows = d.regions.map(r => `<button class="region-row ${r === selRegion ? 'sel' : ''}" data-r="${r.id}">
        <i style="background:${PIG[st.colors[r.id]].hex}"></i>${r.name}${r.bokashi ? '<em>ぼかし</em>' : ''}<span>${PIG[st.colors[r.id]].name}</span></button>`).join('');
      const sw = Object.entries(PIG).filter(([k]) => k !== 'sumi').map(([k, p]) => `<button class="swatch ${selRegion && st.colors[selRegion.id] === k ? 'sel' : ''}" data-p="${k}" title="${p.name}">
        <i style="background:${p.hex}"></i>${p.name}</button>`).join('');
      panel.innerHTML = head('絵師', '弐', '色さし', 'いろさし') + `
        <p>彫師が墨線だけの版木（主版）を彫ると、それを摺った「校合摺り」が絵師に戻されます。絵師はそこに<b>朱で色を指定</b>し、彫師は色の数だけ「色版」を彫ります。</p>
        <p class="howto">絵の部分をタップ（または下の一覧から選択）し、顔料を選びましょう。</p>
        <div class="regions">${rows}</div>
        <div class="palette">${sw}</div>
        <div class="controls">
          <button class="btn" id="b-reset">お手本の色に戻す</button>
          <button class="btn primary" id="b-next">彫りへ進む</button>
        </div>
        <div class="tip"><b>豆知識</b>1829年頃から舶来の合成顔料「ベロ藍（プルシアンブルー）」が流行し、鮮やかな藍の風景画が次々と生まれました。</div>`;
      panel.querySelectorAll('.region-row').forEach(b => b.onclick = () => { selRegion = d.regions.find(r => r.id === b.dataset.r); Sfx.play('tap'); this.panel(); });
      panel.querySelectorAll('.swatch').forEach(b => b.onclick = () => { if (!selRegion) return; st.colors[selRegion.id] = b.dataset.p; Sfx.play('paint'); this.panel(); });
      $('#b-reset').onclick = () => { d.regions.forEach(r => st.colors[r.id] = r.color); this.panel(); };
      $('#b-next').onclick = () => { Sfx.play('done'); go('hori'); };
    },
    draw(g, t) {
      const d = G.design, st = G.st;
      bgPaper(g);
      d.regions.slice().sort((a, b) => a.z - b.z).forEach(r => { g.globalAlpha = 0.92; R.fillRegion(g, r, PIG[st.colors[r.id]].hex); });
      g.globalAlpha = 1;
      g.strokeStyle = PIG.sumi.hex; g.lineWidth = 2.2; g.strokeRect(1.5, 1.5, 397, 597);
      st.strokes.forEach(s => drawStroke(g, s, PIG.sumi.hex, 0.9));
      g.lineWidth = 1.2; d.autoPaths.forEach(p => g.stroke(p));
      if (selRegion) {
        g.save(); g.setLineDash([6, 5]); g.lineDashOffset = -t / 40;
        g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.stroke(selRegion.path);
        g.strokeStyle = '#c8442f'; g.lineWidth = 2; g.stroke(selRegion.path);
        g.restore();
      }
    },
    down(p) {
      const hit = G.design.regions.slice().sort((a, b) => b.z - a.z).find(r => hitCtx.isPointInPath(r.path, p.x, p.y));
      if (hit) { selRegion = hit; Sfx.play('tap'); this.panel(); }
    },
  };

  /* ───────── 参：彫り（彫師） ───────── */
  const H = { carving: false, sp: 0, last: null, lastChip: 0, parts: [], msgT: 0 };
  const curLine = () => G.st.carve.findIndex(c => !c.done);
  stages.hori = {
    enter() { H.carving = false; H.parts = []; this.panel(); },
    panel() {
      const d = G.design, st = G.st, n = d.lines.length, done = st.carve.filter(c => c.done).length;
      const chips = st.carve.reduce((a, c) => a + c.chips.length, 0);
      const li = curLine();
      panel.innerHTML = head('彫師', '参', '彫り', 'ほり') + `
        <p><b>彫師</b>は版下絵を裏返しにして山桜の版木に貼り、小刀で線の両側を彫り込んで<b>線だけを浮き上がらせ</b>ます。だから版木の絵は左右反転しています。</p>
        <p class="howto">朱い印から線に沿って小刀を引きましょう。<b>速すぎると線が欠け</b>、線から外れると印から彫り直しです。</p>
        <div class="now">${li >= 0 ? `いま彫る線：<b>${d.lines[li].name}</b>` : '主版を彫り上げた！'}</div>
        <div class="speed"><span>刃の速さ</span><div class="speed-bar"><div class="speed-zone"></div><div class="speed-fill" id="speed-fill"></div></div></div>
        <div class="meter"><div class="meter-fill" style="width:${done / n * 100}%"></div><span>線 ${done} / ${n}　欠け ${chips}</span></div>
        <div class="controls"><button class="btn primary" id="b-next" ${done === n ? '' : 'disabled'}>摺りへ進む</button></div>
        <div class="tip"><b>豆知識</b>美人画の生え際を彫る「毛割（けわり）」では、1ミリに3本もの髪の毛を彫り分けました。頭彫りは熟練の親方の仕事です。</div>`;
      $('#b-next').onclick = () => {
        const st = G.st; st.scores.hori = Math.round(100 * st.carve.reduce((a, c) => a + c.q, 0) / st.carve.length);
        Sfx.play('done'); go('suri');
      };
    },
    draw(g, t, dt) {
      const d = G.design, st = G.st;
      bgWood(g);
      g.save(); mirror(g);
      g.fillStyle = 'rgba(245,236,215,0.3)'; g.fillRect(0, 0, 400, 600);
      st.strokes.forEach(s => drawStroke(g, s, 'rgba(40,28,20,0.5)'));
      g.lineCap = g.lineJoin = 'round';
      const carved = (path) => {
        g.strokeStyle = 'rgba(110,70,40,0.75)'; g.lineWidth = 8; g.stroke(path);
        g.strokeStyle = '#ecd2a8'; g.lineWidth = 2.4; g.stroke(path);
      };
      g.strokeRect(1.5, 1.5, 397, 597);
      d.autoPaths.forEach(p => { g.strokeStyle = 'rgba(110,70,40,0.5)'; g.lineWidth = 5; g.stroke(p); g.strokeStyle = '#e6c99c'; g.lineWidth = 1.3; g.stroke(p); });
      d.lines.forEach((l, i) => {
        const c = st.carve[i], k = c.done ? l.samples.length - 1 : c.k;
        if (k >= 1) {
          const p = new Path2D(); l.samples.slice(0, k + 1).forEach((s, j) => j ? p.lineTo(s.x, s.y) : p.moveTo(s.x, s.y));
          carved(p);
        }
        c.chips.forEach(ch => { g.fillStyle = '#4a2e1a'; g.beginPath(); g.arc(ch.x, ch.y, 2.6, 0, 7); g.fill(); });
      });
      const li = curLine();
      if (li >= 0) {
        const l = d.lines[li], c = st.carve[li], s = l.samples;
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(200,50,30,0.85)'; g.lineWidth = 1.4;
        g.beginPath(); s.slice(c.k).forEach((q, j) => j ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke(); g.setLineDash([]);
        const a = s[c.k], b = s[Math.min(s.length - 1, c.k + 4)];
        const pulse = 9 + Math.sin(t / 160) * 2.5;
        g.fillStyle = H.carving ? 'rgba(200,50,30,0.35)' : 'rgba(200,50,30,0.7)';
        g.beginPath(); g.arc(a.x, a.y, pulse, 0, 7); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        g.save(); g.translate(a.x, a.y); g.rotate(ang); g.fillStyle = '#fff';
        g.beginPath(); g.moveTo(16, 0); g.lineTo(9, -4); g.lineTo(9, 4); g.closePath(); g.fill(); g.restore();
      }
      H.parts = H.parts.filter(p => (p.life -= dt) > 0);
      H.parts.forEach(p => {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.0006 * dt;
        g.fillStyle = `rgba(225,190,140,${p.life / 600})`; g.fillRect(p.x, p.y, p.s, p.s * 0.6);
      });
      g.restore();
      const f = $('#speed-fill');
      if (f) { H.sp *= 0.94; const v = U.clamp(H.sp / 0.7 * 75, 0, 100); f.style.width = v + '%'; f.classList.toggle('over', v > 75); }
    },
    down(p) {
      const li = curLine(); if (li < 0) return;
      const q = { x: 400 - p.x, y: p.y }, c = G.st.carve[li], s = G.design.lines[li].samples;
      if (U.dist(q, s[c.k]) < 18) { H.carving = true; H.last = { ...q, t: p.t }; H.sp = 0; }
      else toast('朱い印から彫り始めよう');
    },
    move(p, down) {
      if (!H.carving || !down) return;
      const li = curLine(); if (li < 0) return;
      const q = { x: 400 - p.x, y: p.y }, c = G.st.carve[li], l = G.design.lines[li], s = l.samples;
      const dt = Math.max(1, p.t - H.last.t), v = U.dist(q, H.last) / dt;
      H.sp = H.sp * 0.7 + v * 0.3; H.last = { ...q, t: p.t };
      if (H.sp > 0.7 && p.t - H.lastChip > 400) {
        H.lastChip = p.t; c.chips.push({ ...s[c.k] }); Sfx.play('chip'); toast('速すぎて線が欠けた！', 'bad');
      }
      let best = -1, bd = 11;
      for (let j = c.k; j < Math.min(s.length, c.k + 14); j++) { const dd = U.dist(q, s[j]); if (dd < bd) { bd = dd; best = j; } }
      if (best > c.k) {
        for (let j = c.k; j < best; j++) if (Math.random() < 0.5) H.parts.push({ x: s[j].x, y: s[j].y, vx: (Math.random() - 0.5) * 0.15, vy: -Math.random() * 0.15, life: 600, s: 1.5 + Math.random() * 2 });
        c.k = best; Sfx.play('carve', 45);
      } else if (best < 0 && U.dist(q, s[c.k]) > 24) {
        H.carving = false; c.slips++; Sfx.play('chip'); toast('刃が線から外れた…印から彫り直し', 'bad');
      }
      if (c.k >= s.length - 2) {
        c.done = true; c.k = s.length - 1; H.carving = false;
        c.q = U.clamp(1 - 0.12 * c.chips.length - 0.06 * c.slips, 0.35, 1);
        Sfx.play('done');
        toast(curLine() < 0 ? '主版を彫り上げた！ 色版は弟子たちが彫った' : `「${l.name}」を彫り上げた`, 'good');
        this.panel();
      }
    },
    up() { H.carving = false; },
  };

  /* ───────── 四：摺り（摺師） ───────── */
  const S = { i: 0, phase: 'paint', ph: 0, ox: 0, oy: 0, drag: null, hover: null, last: null, mask: null, content: null, tmp: null, covCv: null, covDirty: true, print: null, t0: 0, inkT: 0, prog: 0 };
  const RUB_R = 30, RUB_K = 0.0145;
  const PAPER = { x: -M, y: -M, w: 400 + 2 * M, h: 600 + 2 * M };
  const blk = () => G.st.blocks[S.i];
  const resNow = () => G.st.results[S.i];
  function amountScore(a) { return U.clamp(1 - Math.max(0, Math.abs(a - 0.5) - 0.08) / 0.3, 0, 1); }
  function kentoScore(e) { return U.clamp(1 - (e - 0.7) / 7, 0, 1); }
  function rubMean() {
    const res = resNow(), m = S.mask; let s = 0;
    for (let i = 0; i < m.mask.length; i++) if (m.mask[i]) s += Math.min(1, res.cov[i]);
    return m.n ? s / m.n : 1;
  }
  const rubScore = mean => U.clamp((mean - 0.4) / 0.55, 0, 1);
  function drawKento(g) {
    g.fillStyle = '#5e3c22';
    g.fillRect(392 + M - 18, 618, 30, 4); g.fillRect(418, 592, 4, 30);
    g.fillRect(30, 618, 50, 4);
    g.fillStyle = '#e8cfa5';
    g.fillRect(392 + M - 18, 618, 30, 1.2); g.fillRect(418, 592, 1.2, 30); g.fillRect(30, 618, 50, 1.2);
  }
  function drawBlock(g, ink) {
    const b = blk(), d = G.design, st = G.st;
    bgWood(g);
    g.save(); mirror(g);
    g.fillStyle = 'rgba(80,48,25,0.3)'; g.fillRect(0, 0, 400, 600);
    if (b.kind === 'key') {
      const raised = (color, dx) => {
        g.save(); g.translate(dx, dx);
        st.strokes.forEach(s => drawStroke(g, s, color, 1.1));
        g.strokeStyle = color; g.lineWidth = 1.6; d.autoPaths.forEach(p => g.stroke(p)); g.lineWidth = 2.6; g.strokeRect(1.5, 1.5, 397, 597);
        g.fillStyle = color; d.keyFillPaths.forEach(p => g.fill(p));
        g.restore();
      };
      raised('#5a381f', 1.2); raised('#e3c49a', 0);
      if (ink > 0) { g.globalAlpha = ink; raised(PIG.sumi.hex, 0); g.globalAlpha = 1; }
    } else {
      const r = b.region;
      g.save(); g.translate(1.4, 1.6); g.fillStyle = '#5a381f'; g.fill(r.path); g.restore();
      g.fillStyle = '#dcb88c'; g.fill(r.path);
      if (ink > 0) { g.globalAlpha = ink * 0.9; R.fillRegion(g, r, PIG[st.colors[r.id]].hex); g.globalAlpha = 1; }
    }
    g.restore();
    drawKento(g);
  }
  function drawPaper(g, alpha) {
    g.save(); g.translate(S.ox, S.oy);
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.globalAlpha = alpha; g.drawImage(texPaper, PAPER.x, PAPER.y, PAPER.w, PAPER.h);
    g.shadowColor = 'transparent';
    if (S.print) { g.save(); mirror(g); g.globalAlpha = 0.14; g.drawImage(S.print, PAPER.x, PAPER.y, PAPER.w, PAPER.h); g.restore(); }
    g.restore();
  }
  function updateTmp() {
    const res = resNow();
    if (S.covDirty) {
      const cg = S.covCv.getContext('2d'), im = cg.createImageData(GW, GH);
      for (let i = 0; i < GW * GH; i++) im.data[i * 4 + 3] = Math.min(1, res.cov[i]) * 255;
      cg.putImageData(im, 0, 0); S.covDirty = false;
      const tg = S.tmp.getContext('2d');
      tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, S.tmp.width, S.tmp.height);
      tg.drawImage(S.content, 0, 0);
      tg.globalCompositeOperation = 'destination-in'; tg.imageSmoothingEnabled = true;
      tg.drawImage(S.covCv, 0, 0, S.tmp.width, S.tmp.height);
    }
  }
  function startBlock(i) {
    const d = G.design, st = G.st;
    S.i = i; S.phase = 'paint'; S.ph = Math.random() * 6; S.drag = null;
    st.results[i] = { amount: null, dx: 0, dy: 0, cov: new Float32Array(GW * GH) };
    S.mask = R.blockMask(d, st, st.blocks[i]);
    S.content = R.blockContent(d, st, st.blocks[i], 0.6);
    S.tmp = U.canvas(S.content.width, S.content.height);
    S.covCv = U.canvas(GW, GH); S.covDirty = true;
    stages.suri.panel();
  }
  function finishBlockScore(i, a, err, mean) {
    G.st.blockScores[i] = { amount: amountScore(a), kento: kentoScore(err), rub: rubScore(mean) };
  }
  function blockScore(b) { return 0.3 * b.amount + 0.35 * b.kento + 0.35 * b.rub; }
  function apprentice() {
    const d = G.design, st = G.st;
    for (let i = S.i; i < st.blocks.length; i++) {
      const m = R.blockMask(d, st, st.blocks[i]);
      const a = 0.5 + (Math.random() - 0.5) * 0.16, ox = (Math.random() - 0.5) * 3, oy = (Math.random() - 0.5) * 3;
      const cov = new Float32Array(GW * GH);
      for (let k = 0; k < cov.length; k++) cov[k] = m.mask[k] ? 0.72 + Math.random() * 0.5 : 0;
      st.results[i] = { amount: a, dx: ox, dy: -oy, cov };
      let s = 0; for (let k = 0; k < cov.length; k++) if (m.mask[k]) s += Math.min(1, cov[k]);
      finishBlockScore(i, a, Math.hypot(ox, oy), m.n ? s / m.n : 1);
    }
    go('rakkan');
  }
  stages.suri = {
    enter() { G.st.results = []; G.st.blockScores = []; S.print = null; startBlock(0); },
    panel() {
      const st = G.st, b = blk(), n = st.blocks.length;
      const isBokashi = b.kind === 'color' && b.region.bokashi;
      const pig = b.kind === 'key' ? PIG.sumi : PIG[st.colors[b.region.id]];
      const chips = ['絵の具', '見当', 'ばれん', 'めくる'].map((s, k) => `<li class="${['paint', 'kento', 'baren', 'reveal'].indexOf(S.phase) === k ? 'on' : ''}">${s}</li>`).join('');
      let body = '';
      if (S.phase === 'paint') body = `
        <p class="howto">${isBokashi ? '<b>ぼかし摺り</b>：湿らせた版木に刷毛で絵の具を拭き込み、濃淡をつけます。' : '版木に刷毛で絵の具と糊を置きます。'}針が<b>朱の枠</b>に入った瞬間に「刷毛を置く」！</p>
        <div class="gauge"><div class="gauge-zone"></div><div class="gauge-needle" id="needle"></div><span class="gl">薄い</span><span class="gr">濃い</span></div>
        <div class="controls"><button class="btn primary big" id="b-brush">刷毛を置く（Space）</button></div>
        ${S.i >= 1 ? '<div class="controls"><button class="btn ghost" id="b-deshi">残りの版を弟子に任せる</button></div>' : ''}`;
      if (S.phase === 'kento') body = `
        <p class="howto">紙をドラッグして、紙の右下の角を<b>「鉤（かぎ）」</b>に、下の辺を<b>「引付（ひきつけ）」</b>にぴたりと合わせます（矢印キーで微調整）。</p>
        <canvas id="lens" class="lens" width="320" height="200"></canvas>
        <div class="controls"><button class="btn primary big" id="b-place">紙を置く</button></div>`;
      if (S.phase === 'baren') body = `
        <p class="howto">ばれんで紙の背をこすって色を移します。円を描くように、版の形が透けて見えるまでまんべんなく。</p>
        <div class="meter"><div class="meter-fill" id="rub-fill"></div><span id="rub-txt">0%</span></div>
        <div class="controls"><button class="btn primary big" id="b-peel" disabled>紙をめくる</button></div>`;
      if (S.phase === 'reveal') {
        const bs = st.blockScores[S.i];
        const word = (v, a, b, c) => v > 0.85 ? a : v > 0.55 ? b : c;
        body = `<ul class="result">
          <li><span>絵の具</span>${word(bs.amount, 'ちょうど良い', 'やや' + (resNow().amount < 0.5 ? '薄い' : '濃い'), resNow().amount < 0.5 ? '掠れた' : '滲んだ')}</li>
          <li><span>見当</span>${word(bs.kento, 'ぴたり', 'わずかにずれた', '大きくずれた')}</li>
          <li><span>摺りムラ</span>${word(bs.rub, 'ムラなし', 'ややムラ', 'ムラが目立つ')}</li></ul>
          <div class="controls"><button class="btn primary big" id="b-nextblock">${S.i < n - 1 ? '次の版へ' : '摺り上がり！ 落款へ'}</button></div>`;
      }
      panel.innerHTML = head('摺師', '四', '摺り', 'すり') + `
        <div class="blockinfo">第${S.i + 1}版 / 全${n}版　<b>${b.name}</b><span class="pig"><i style="background:${pig.hex}"></i>${pig.name}${isBokashi ? '・ぼかし' : ''}</span></div>
        <ol class="phase">${chips}</ol>${body}
        <div class="tip"><b>豆知識</b>${['摺師は薄い色から濃い色へ、一色ごとに版木を替えて摺り重ねます。一枚の錦絵に十数版を使うことも。',
          '「見当」は版木に彫られた目印。色版がずれる「見当違い」という言葉はここから生まれました。',
          'ばれんは竹の皮で包んだ摺り道具。芯の「当て皮」の縄目が力を均一に伝えます。',
          '初版は200枚ほど。売れれば版木を使って「増し摺り」が重ねられました。'][S.i % 4]}</div>`;
      const on = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };
      on('#b-brush', () => this.brush());
      on('#b-deshi', () => { Sfx.play('done'); apprentice(); });
      on('#b-place', () => this.place());
      on('#b-peel', () => this.peel());
      on('#b-nextblock', () => { if (S.i < n - 1) startBlock(S.i + 1); else { Sfx.play('fanfare'); go('rakkan'); } });
    },
    brush() {
      if (S.phase !== 'paint' || resNow().amount != null) return;
      const v = 0.5 + 0.5 * Math.sin(S.ph);
      resNow().amount = v; S.inkT = performance.now();
      Sfx.play('paint');
      const sc = amountScore(v);
      toast(sc > 0.85 ? '程よい絵の具の量！' : v < 0.5 ? '絵の具が少なめ…掠れるかも' : '絵の具が多すぎ…滲むかも', sc > 0.85 ? 'good' : 'bad');
      setTimeout(() => {
        S.phase = 'kento';
        S.ox = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 20); S.oy = -(25 + Math.random() * 25);
        Sfx.play('paper'); this.panel();
      }, 900);
    },
    place() {
      if (S.phase !== 'kento') return;
      const res = resNow(); res.dx = S.ox; res.dy = -S.oy;
      S.kentoErr = Math.hypot(S.ox, S.oy);
      Sfx.play('paper');
      toast(S.kentoErr < 1.5 ? '見当ぴたり！' : S.kentoErr < 4 ? '少しずれた…' : '見当違い！', S.kentoErr < 1.5 ? 'good' : 'bad');
      S.phase = 'baren'; S.covDirty = true; this.panel();
    },
    peel() {
      if (S.phase !== 'baren') return;
      const res = resNow();
      finishBlockScore(S.i, res.amount, S.kentoErr, rubMean());
      S.print = R.render(G.design, G.st, { S: 1.6, upto: S.i });
      S.phase = 'reveal'; S.t0 = performance.now();
      Sfx.play('paper'); this.panel();
    },
    draw(g, t, dt) {
      if (S.phase === 'paint') {
        const res = resNow();
        const ink = res.amount == null ? 0 : U.clamp((performance.now() - S.inkT) / 500, 0, 1) * (0.55 + res.amount * 0.6);
        drawBlock(g, Math.min(1, ink));
        if (res.amount == null) {
          S.ph += dt / 1000 * (2.6 + S.i * 0.22);
          const nd = $('#needle'); if (nd) nd.style.left = (50 + 50 * Math.sin(S.ph)) + '%';
        }
      } else if (S.phase === 'kento') {
        drawBlock(g, 1); drawPaper(g, 0.88);
        const lens = $('#lens');
        if (lens) {
          const lg = lens.getContext('2d'), k = lens.width / 34;
          lg.setTransform(1, 0, 0, 1, 0, 0); lg.fillStyle = '#3a2a1c'; lg.fillRect(0, 0, lens.width, lens.height);
          lg.setTransform(k, 0, 0, k, lens.width / 2 - 412 * k, lens.height / 2 - 612 * k);
          drawBlock(lg, 1); drawPaper(lg, 0.88);
          lg.setTransform(1, 0, 0, 1, 0, 0);
          lg.fillStyle = '#fff'; lg.font = `14px ${R.FONT}`; lg.fillText('鉤（かぎ）拡大', 10, 20);
        }
      } else if (S.phase === 'baren') {
        drawBlock(g, 1); drawPaper(g, 0.96);
        updateTmp();
        g.save(); mirror(g); g.globalAlpha = 0.5; g.drawImage(S.tmp, 0, 0, 400, 600); g.restore();
        if (S.hover) {
          const h = S.hover;
          const gr = g.createRadialGradient(h.x - 8, h.y - 8, 4, h.x, h.y, RUB_R);
          gr.addColorStop(0, 'rgba(150,110,65,0.9)'); gr.addColorStop(1, 'rgba(70,45,25,0.9)');
          g.fillStyle = gr; g.beginPath(); g.arc(h.x, h.y, RUB_R, 0, 7); g.fill();
          g.strokeStyle = 'rgba(40,25,10,0.6)'; g.lineWidth = 1.2;
          for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(h.x, h.y, RUB_R * (0.25 + k * 0.2), k, k + 4); g.stroke(); }
          g.beginPath(); g.moveTo(h.x - RUB_R, h.y); g.quadraticCurveTo(h.x, h.y - RUB_R * 1.25, h.x + RUB_R, h.y); g.strokeStyle = 'rgba(30,18,8,0.8)'; g.lineWidth = 2.5; g.stroke();
        }
        const mean = rubMean(); S.prog = mean;
        const f = $('#rub-fill'), tx = $('#rub-txt'), b = $('#b-peel');
        if (f) { f.style.width = Math.min(100, mean * 100) + '%'; tx.textContent = `摺れ具合 ${Math.round(mean * 100)}%`; b.disabled = mean < 0.7; }
      } else if (S.phase === 'reveal') {
        drawBlock(g, 0.6);
        const p = U.clamp((performance.now() - S.t0) / 900, 0, 1), e = 1 - Math.pow(1 - p, 3);
        g.save(); g.translate(0, -10 * e);
        g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 18 * e; g.shadowOffsetY = 8 * e;
        g.globalAlpha = e; g.drawImage(S.print, PAPER.x, PAPER.y, PAPER.w, PAPER.h);
        g.restore();
      }
    },
    down(p) {
      if (S.phase === 'paint') { this.brush(); return; }
      if (S.phase === 'kento') S.drag = { sx: p.x, sy: p.y, ox: S.ox, oy: S.oy };
      if (S.phase === 'baren') { S.last = p; S.hover = p; }
    },
    move(p, down) {
      S.hover = p;
      if (S.phase === 'kento' && S.drag && down) {
        S.ox = U.clamp(S.drag.ox + p.x - S.drag.sx, -60, 60); S.oy = U.clamp(S.drag.oy + p.y - S.drag.sy, -60, 30);
      }
      if (S.phase === 'baren' && down && S.last) {
        const res = resNow(), L = U.dist(p, S.last), n = Math.max(1, Math.ceil(L / 4)), step = L / n;
        for (let k = 1; k <= n; k++) {
          const x = 400 - U.lerp(S.last.x, p.x, k / n), y = U.lerp(S.last.y, p.y, k / n);
          const gx0 = Math.max(0, Math.floor((x - RUB_R) / CELL)), gx1 = Math.min(GW - 1, Math.floor((x + RUB_R) / CELL));
          const gy0 = Math.max(0, Math.floor((y - RUB_R) / CELL)), gy1 = Math.min(GH - 1, Math.floor((y + RUB_R) / CELL));
          for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
            const dd = Math.hypot(gx * CELL + 4 - x, gy * CELL + 4 - y) / RUB_R;
            if (dd < 1) { const i = gy * GW + gx; res.cov[i] = Math.min(1.3, res.cov[i] + RUB_K * step * (1 - dd * dd)); }
          }
        }
        S.covDirty = true; S.last = p;
        if (L > 2) Sfx.play('rub', 110);
      }
    },
    up() { S.drag = null; S.last = null; },
    key(e) {
      if (S.phase === 'paint' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); this.brush(); }
      if (S.phase === 'kento') {
        const m = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.code];
        if (m) { e.preventDefault(); S.ox += m[0]; S.oy += m[1]; }
        if (e.code === 'Enter') this.place();
      }
    },
  };

  /* ───────── 伍：落款・完成 ───────── */
  const NAMES = ['春水', '雪月', '清風', '花信', '松濤', '秋香', '藍川', '鶴汀', '桜雲', '一筆斎'];
  const RANKS = [
    [92, '名人', '見事！ これは江戸中の評判になる。初摺り二百枚、すぐに増し摺りだ！'],
    [80, '上手', '良い出来だ。絵双紙屋の店先に並べても恥ずかしくない。'],
    [65, '一人前', 'まずまずだな。ところどころ荒いが、売り物にはなる。'],
    [45, '職人見習い', 'まだまだ修業が足りん。だが筋は悪くない。'],
    [0, '弟子入り志願', 'これでは売り物にならん…。もう一度、最初からやり直しだ。'],
  ];
  function totals() {
    const st = G.st;
    const suri = Math.round(100 * st.blockScores.reduce((a, b) => a + blockScore(b), 0) / st.blockScores.length);
    st.scores.suri = suri;
    const total = Math.round(0.3 * (st.scores.shitae ?? 0) + 0.3 * (st.scores.hori ?? 0) + 0.4 * suri);
    const rank = RANKS.find(r => total >= r[0]);
    return { total, rank, price: Math.round(12 + total * 0.12) };
  }
  stages.rakkan = {
    enter() {
      G.signed = false; G.sealT = 0;
      G.finalCv = R.render(G.design, G.st, { S: 2 });
      this.panel();
    },
    panel() {
      const st = G.st;
      if (!G.signed) {
        panel.innerHTML = head('絵師', '伍', '落款', 'らっかん') + `
          <p>全ての版を摺り終えました。最後に絵師の<b>雅号（ペンネーム）</b>を入れ、印を押して仕上げます。</p>
          <label class="field">雅号<input id="i-name" maxlength="4" value="${esc(st.name || NAMES[Math.random() * NAMES.length | 0])}"></label>
          <div class="controls"><button class="btn" id="b-rand">別の号</button><button class="btn primary big" id="b-sign">落款を押す</button></div>
          <div class="tip"><b>豆知識</b>題名の入った枠を「題箋（だいせん）」、丸い「極（きわめ）」の印は幕府の検閲を通った証の改印です。</div>`;
        $('#b-rand').onclick = () => { $('#i-name').value = NAMES[Math.random() * NAMES.length | 0]; };
        $('#b-sign').onclick = () => this.sign();
        return;
      }
      const { total, rank, price } = totals();
      panel.innerHTML = head('版元', '完', '摺り上がり', 'できあがり') + `
        <div class="score">
          <div class="rank"><span>${rank[1]}</span><b>${total}</b>点</div>
          <ul class="result">
            <li><span>版下絵（絵師）</span>${st.scores.shitae}点</li>
            <li><span>彫り（彫師）</span>${st.scores.hori}点</li>
            <li><span>摺り（摺師）</span>${st.scores.suri}点</li>
          </ul>
          <p class="hanmoto">版元「${rank[2]}」<br>この錦絵、一枚 <b>${price}文</b> で売れそうだ。</p>
        </div>
        <div class="controls">
          <button class="btn primary" id="b-save">画像を保存</button>
          <button class="btn" id="b-gal">画廊に飾る</button>
        </div>
        <div class="controls">
          <button class="btn" id="b-again">増し摺り（同じ版木でもう一枚）</button>
          <button class="btn" id="b-home">別の画題を選ぶ</button>
        </div>`;
      $('#b-save').onclick = () => {
        G.finalCv.toBlob(b => {
          const a = document.createElement('a'); a.href = URL.createObjectURL(b);
          a.download = `${G.design.title}_${st.name}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
      };
      $('#b-gal').onclick = (e) => { if (saveGallery({ total, rank })) { e.target.disabled = true; e.target.textContent = '画廊に飾った'; toast('画廊に飾りました', 'good'); } };
      $('#b-again').onclick = () => go('suri');
      $('#b-home').onclick = () => toTitle();
    },
    sign() {
      const st = G.st;
      st.name = ($('#i-name').value || '').trim() || '無名';
      G.signed = true; G.sealT = performance.now();
      G.finalCv = R.render(G.design, st, { S: 2, sign: st.name });
      Sfx.play('seal'); setTimeout(() => Sfx.play('fanfare'), 300);
      this.panel();
    },
    draw(g) {
      g.fillStyle = '#2b2622'; g.fillRect(-OX, -OY, VW, VH);
      const p = G.signed ? U.clamp((performance.now() - G.sealT) / 500, 0, 1) : 1;
      const sc = 1 + (1 - p) * 0.04;
      g.save(); g.translate(200, 300); g.scale(sc, sc); g.translate(-200, -300);
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
      g.drawImage(G.finalCv, PAPER.x, PAPER.y, PAPER.w, PAPER.h);
      g.restore();
    },
  };

  /* ───────── 画廊 ───────── */
  const GKEY = 'ukiyoe-shokunin-gallery';
  function loadGallery() { try { return JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch (e) { return []; } }
  function saveGallery({ total, rank }) {
    const c = U.canvas(436, 636); c.getContext('2d').drawImage(G.finalCv, 0, 0, 436, 636);
    const item = { id: Date.now(), title: G.design.title, name: G.st.name, score: total, rank: rank[1], date: new Date().toLocaleDateString('ja-JP'), img: c.toDataURL('image/jpeg', 0.85) };
    const list = loadGallery(); list.unshift(item);
    while (list.length) {
      try { localStorage.setItem(GKEY, JSON.stringify(list.slice(0, 24))); return true; }
      catch (e) { if (list.length <= 1) { toast('保存できませんでした', 'bad'); return false; } list.pop(); }
    }
    return false;
  }
  function showGallery() {
    const list = loadGallery(), box = $('#gallery-list');
    box.innerHTML = list.length ? list.map(it => `<figure data-id="${it.id}"><img src="${it.img}" alt="${esc(it.title)}">
      <figcaption><b>${esc(it.title)}</b>${esc(it.name)}画<br><small>${esc(it.rank)} ${it.score}点・${esc(it.date)}</small>
      <button class="del" data-del="${it.id}" aria-label="削除">✕</button></figcaption></figure>`).join('')
      : '<p class="empty">まだ作品がありません。錦絵を摺り上げて飾りましょう。</p>';
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      if (!confirm('この作品を画廊から外しますか？')) return;
      localStorage.setItem(GKEY, JSON.stringify(loadGallery().filter(x => String(x.id) !== b.dataset.del))); showGallery();
    });
    box.querySelectorAll('figure').forEach(f => f.onclick = () => {
      const it = list.find(x => String(x.id) === f.dataset.id);
      $('#viewer img').src = it.img; $('#viewer').classList.add('open');
    });
    setStep(null); G.stage = null; show('screen-gallery');
  }
  $('#viewer').onclick = () => $('#viewer').classList.remove('open');

  /* ───────── 表題 ───────── */
  function toTitle() {
    if (G.stage && G.stageName !== 'rakkan' && !confirm('作業中の錦絵は失われます。表題に戻りますか？')) return;
    G.stage = null; setStep(null); show('screen-title');
  }
  function buildTitle() {
    const box = $('#design-list');
    box.innerHTML = DESIGNS.map((d, i) => `<article class="card">
      <div class="thumb"><img alt="${d.title}の完成見本" data-i="${i}"></div>
      <div class="card-body"><h3>${d.title}<small>${d.yomi}</small></h3><p>${d.desc}</p>
      <div class="lv">難しさ ${'★'.repeat(d.level)}${'☆'.repeat(3 - d.level)}　${d.lines.length}本の線・${d.regions.length + 1}版</div>
      <button class="btn primary" data-start="${i}">この画題で始める</button></div></article>`).join('');
    box.querySelectorAll('[data-start]').forEach(b => b.onclick = () => start(+b.dataset.start));
    DESIGNS.forEach((d, i) => {
      setTimeout(() => {
        prepDesign(d);
        const c = R.render(d, idealState(d), { S: 0.7 });
        box.querySelector(`img[data-i="${i}"]`).src = c.toDataURL('image/jpeg', 0.85);
      }, 30 + i * 60);
    });
  }
  function start(i) {
    Sfx.init();
    G.design = DESIGNS[i]; prepDesign(G.design);
    G.st = newState(G.design);
    go('shitae');
  }

  /* ───────── 入力・ループ ───────── */
  function pt(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * VW - OX, y: (e.clientY - r.top) / r.height * VH - OY, t: e.timeStamp };
  }
  let pDown = false;
  cv.addEventListener('pointerdown', e => {
    Sfx.init(); e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    pDown = true; G.stage?.down?.(pt(e));
  });
  cv.addEventListener('pointermove', e => {
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of evs) G.stage?.move?.(pt(ev), pDown);
  });
  const endP = e => { if (!pDown) return; pDown = false; G.stage?.up?.(pt(e)); };
  cv.addEventListener('pointerup', endP);
  cv.addEventListener('pointercancel', endP);
  cv.addEventListener('pointerleave', () => { if (G.stageName === 'suri') S.hover = null; });
  document.addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT') G.stage?.key?.(e); });

  let lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(50, t - lastT || 16); lastT = t;
    if (!G.stage || document.body.dataset.screen !== 'screen-work') return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.translate(OX, OY);
    G.stage.draw(ctx, t, dt);
  }

  $('#btn-home').onclick = toTitle;
  $('#btn-gallery').onclick = () => { if (G.stage && G.stageName !== 'rakkan' && !confirm('作業中の錦絵は失われます。画廊へ移動しますか？')) return; showGallery(); };
  $('#btn-gallery-back').onclick = () => { show('screen-title'); };
  $('#btn-sound').onclick = (e) => { Sfx.on = !Sfx.on; e.currentTarget.setAttribute('aria-pressed', Sfx.on); e.currentTarget.textContent = Sfx.on ? '音 有' : '音 無'; };

  texPaper = R.paper(920, 1320);
  texWood = R.wood(920, 1320);
  show('screen-title');
  const fontReady = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load(`700 20px "Shippori Mincho"`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
  fontReady.catch(() => {}).then(buildTitle);
  requestAnimationFrame(loop);

  /* 自動テスト用 */
  G._debug = { go, start, idealState, stages, S, apprentice };
})();
