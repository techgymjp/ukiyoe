'use strict';
(() => {
  const OX = 30, OY = 30;
  const { CELL, M } = R;
  let W = 400, H = 600, VW = 460, VH = 660, GW = 50, GH = 75;
  function setDims(d) { ({ W, H, GW, GH } = R.dims(d)); VW = W + 2 * OX; VH = H + 2 * OY; PAPER.w = W + 2 * M; PAPER.h = H + 2 * M; cv.parentElement.style.setProperty('--ar', VW / VH); resize(); }
  const $ = s => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d'), panel = $('#panel');
  const hitCtx = document.createElement('canvas').getContext('2d');
  let scale = 1, dpr = 1, texPaper = null, texWood = null;
  const G = { design: null, st: null, stageName: null, stage: null, finalCv: null };
  window.UKIYOE = G;
  const STEPS = ['shitae', 'irosashi', 'hori', 'suri', 'rakkan'];
  const PAPER = { x: -M, y: -M, w: 400 + 2 * M, h: 600 + 2 * M };

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
  const mirror = g => { g.translate(W, 0); g.scale(-1, 1); };

  function prepDesign(d) {
    if (d._prep) return;
    d.lines.forEach(l => { l.path = new Path2D(l.d); l.samples = U.samplePath(l.d, 3); });
    d.regions.forEach(r => { if (r.d) r.path = new Path2D(r.d); });
    d.autoPaths = (d.auto || []).map(a => new Path2D(a));
    d.keyFillPaths = (d.keyFills || []).map(a => new Path2D(a));
    d._prep = true;
  }
  function buildBlocks(d) {
    return [{ kind: 'key', name: '主版（墨線）', yomi: 'おもはん' }]
      .concat(d.regions.slice().sort((a, b) => a.z - b.z).map(r => ({ kind: 'color', region: r, name: r.name })));
  }
  function newState(d) {
    return {
      strokes: [], hist: [], devSum: 0, devN: 0,
      ink: d.lines.map(l => { const n = l.samples.length; return { cov: new Uint8Array(n), w: new Float32Array(n), ox: new Float32Array(n), oy: new Float32Array(n) }; }),
      carve: d.lines.map(() => ({ k: 0, pos: 0, done: false, chips: [], q: 1, knot: null })),
      blocks: buildBlocks(d), results: [], scores: {}, name: '', blockScores: [],
    };
  }
  function idealState(d) {
    const st = newState(d);
    st.strokes = d.lines.map((l, i) => ({ line: i, pts: l.samples.map(p => ({ x: p.x, y: p.y, w: 2.4 })) }));
    st.carve.forEach(c => { c.done = true; c.q = 1; });
    const dm = R.dims(d);
    st.results = st.blocks.map(() => ({ amount: 0.5, dx: 0, dy: 0, cov: new Float32Array(dm.GW * dm.GH).fill(1.2) }));
    return st;
  }
  function drawStroke(g, s, color, wk = 1) { R.drawStroke(g, s, color, wk); }

  /* ───────── ひとなで：全工程共通の操作 ─────────
     画面をひとなですると作業が進み、指を離しても自動で最後まで仕上がって次の工程へ進む */
  const SW = { prog: 0, last: null, good: 0, n: 0, auto: false, done: false, started: false, hand: 0, finger: null };
  const NEED = 520, AUTO_RATE = 0.9;            // 必要ななで距離（画面単位）・離した後の自動進行（/秒）
  const V_LO = 0.2, V_HI = 1.9;                 // 丁寧ななでの速さ（画面単位/ms）
  function swipeReset() { Object.assign(SW, { prog: 0, last: null, good: 0, n: 0, auto: false, done: false, started: false, hand: 0, finger: null }); }
  const swipeQ = () => SW.n ? SW.good / SW.n : 0.8;
  const qScore = q => Math.round(60 + 40 * U.clamp(q, 0, 1));
  /* 戻り値：この移動での速さ（u/ms）。進捗は SW.prog に加算 */
  function swipeMove(p, down) {
    SW.finger = p;
    if (!down || SW.done) return 0;
    if (!SW.last) { SW.last = p; SW.started = true; return 0; }
    const dd = U.dist(p, SW.last), dt = Math.max(1, p.t - SW.last.t);
    if (dd < 0.5) return 0;
    const v = dd / dt;
    SW.n++; if (v >= V_LO && v <= V_HI) SW.good++;
    SW.prog = Math.min(1, SW.prog + dd / NEED);
    SW.last = p;
    return v;
  }
  function swipeUp() { SW.last = null; if (SW.started && !SW.done) SW.auto = true; }
  function swipeTick(dt) { if (SW.auto && !SW.done) SW.prog = Math.min(1, SW.prog + AUTO_RATE * dt / 1000); }
  function swipePanel(role, num, title, yomi, howto, desc = '') {
    panel.innerHTML = head(role, num, title, yomi) + `
      <p class="howto">${howto}</p>
      <div class="meter"><div class="meter-fill" id="sw-fill"></div><span id="sw-txt">画面をひとなで！</span></div>
      ${desc ? `<p class="desc">${desc}</p>` : ''}`;
  }
  function swipeUI() {
    const f = $('#sw-fill'), t = $('#sw-txt');
    if (f) f.style.width = SW.prog * 100 + '%';
    if (t && SW.started) t.textContent = SW.done ? '仕上がり！' : SW.auto ? 'そのまま仕上げ中…' : `${Math.round(SW.prog * 100)}%`;
  }
  /* なで方の見本（指のアイコンが左右に動く） */
  function drawHint(g, t) {
    if (SW.started) return;
    const k = (Math.sin(t / 450) + 1) / 2, x = U.lerp(W * 0.2, W * 0.8, k), y = H * 0.55 + Math.sin(t / 300) * 6;
    g.save();
    g.strokeStyle = 'rgba(200,68,47,0.5)'; g.lineWidth = 6; g.lineCap = 'round'; g.setLineDash([2, 12]);
    g.beginPath(); g.moveTo(W * 0.2, H * 0.55); g.lineTo(W * 0.8, H * 0.55); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(200,68,47,0.85)'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(36,32,29,0.82)'; g.fillRect(W / 2 - 92, H * 0.55 + 30, 184, 30);
    g.fillStyle = '#fff'; g.font = `700 16px ${R.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ひとなでして始める', W / 2, H * 0.55 + 45);
    g.restore();
  }
  /* 判定演出：正確なら PERFECT! で満点 */
  const FX = { t0: -1e9, text: '', sub: '', perfect: false };
  const PERFECT_Q = 0.85;
  function grade(q, extraOk = true) {
    const perfect = q >= PERFECT_Q && extraOk;
    Object.assign(FX, { t0: performance.now(), perfect, text: perfect ? 'PERFECT!' : q >= 0.6 ? 'GREAT!' : 'GOOD', sub: perfect ? '見事！ 満点' : q >= 0.6 ? '上出来' : 'まずまず。丁寧になでると高得点' });
    Sfx.play(perfect ? 'fanfare' : 'done');
    return perfect ? 100 : qScore(q);
  }
  function drawFx(g) {
    const e = performance.now() - FX.t0;
    if (e > 1500) return;
    const a = e < 1100 ? 1 : 1 - (e - 1100) / 400, pop = e < 220 ? 0.4 + 0.6 * U.smooth(0, 220, e) * 1.15 : 1 + 0.04 * Math.sin(e / 90);
    g.save(); g.globalAlpha = a; g.translate(W / 2, H / 2);
    if (FX.perfect) {
      g.save(); g.rotate(e / 1500);
      for (let k = 0; k < 16; k++) {
        g.rotate(Math.PI / 8); g.fillStyle = k % 2 ? 'rgba(255,215,90,0.35)' : 'rgba(255,240,180,0.25)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -Math.max(W, H)); g.lineTo(22, -Math.max(W, H)); g.closePath(); g.fill();
      }
      g.restore();
      for (let k = 0; k < 24; k++) {
        const ang = k / 24 * Math.PI * 2, r = e * 0.35;
        g.fillStyle = ['#ffd75a', '#e0412a', '#fff4cc'][k % 3];
        g.beginPath(); g.arc(Math.cos(ang) * r, Math.sin(ang) * r * 0.8, 5 * (1 - e / 1500) + 1, 0, 7); g.fill();
      }
    }
    g.scale(pop, pop);
    const size = Math.min(W, H) * (FX.perfect ? 0.17 : 0.13);
    g.font = `800 ${size}px ${R.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = 'rgba(36,32,29,0.9)'; g.strokeText(FX.text, 0, 0);
    g.fillStyle = FX.perfect ? '#ffd75a' : '#fff4dc'; g.fillText(FX.text, 0, 0);
    g.font = `700 ${size * 0.32}px ${R.FONT}`; g.lineWidth = size * 0.07; g.strokeText(FX.sub, 0, size * 0.75);
    g.fillStyle = '#fff'; g.fillText(FX.sub, 0, size * 0.75);
    g.restore();
  }
  function finishStage(next, msg) {
    if (SW.done) return;
    SW.done = true; SW.prog = 1; swipeUI();
    toast(msg, 'good');
    setTimeout(() => { if (G.stage && G.stageName !== next) go(next); }, 1700);
  }
  function drawKeyArt(g, alpha = 1) {
    const d = G.design;
    g.save(); g.globalAlpha = alpha;
    if (d.raster) g.drawImage(R.plate(d, d.raster.keyLabel), 0, 0, W, H);
    else {
      g.strokeStyle = PIG.sumi.hex; g.lineWidth = 2.2; g.strokeRect(1.5, 1.5, W - 3, H - 3);
      G.st.strokes.forEach(s => drawStroke(g, s, PIG.sumi.hex, 0.9));
      g.lineWidth = 1.2; d.autoPaths.forEach(p => g.stroke(p));
    }
    g.restore();
  }
  const partial = (g, s, f, color, w) => {
    const k = Math.max(1, Math.floor((s.length - 1) * f));
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = g.lineJoin = 'round';
    g.beginPath(); for (let j = 0; j <= k; j++) j ? g.lineTo(s[j].x, s[j].y) : g.moveTo(s[j].x, s[j].y); g.stroke();
    return s[k];
  };

  /* ───────── 壱：版下絵（絵師） ───────── */
  const stages = {};
  stages.shitae = {
    enter() { swipeReset(); this.wv = []; swipePanel('絵師', '壱', '版下絵', 'はんしたえ', '画面を<b>ひとなで</b>すると筆が輪郭を描きます。ゆっくり丁寧に。', '絵師が墨一色で描く版下絵は、そのまま版木に貼られて彫られます。'); },
    move(p, down) {
      const v = swipeMove(p, down);
      if (v) { this.wv.push(U.clamp(3.6 - v * 1.4, 1.6, 3.6)); Sfx.play('brush', 90); }
    },
    up() { swipeUp(); },
    finish() {
      const ws = this.wv.length ? this.wv : [2.6];
      G.st.strokes = G.design.lines.map((l, i) => ({ line: i, pts: l.samples.map((q, j) => {
        const w = ws[Math.floor(j / l.samples.length * ws.length)] || 2.6, n = l.samples.length;
        return { x: q.x, y: q.y, w: w * Math.min(1, 0.45 + Math.min(j, n - 1 - j) * 0.18) };
      }) }));
      G.st.scores.shitae = grade(swipeQ());
      finishStage('irosashi', '版下絵が描き上がった！');
    },
    draw(g, t, dt) {
      swipeTick(dt); swipeUI();
      const d = G.design;
      bgPaper(g);
      g.save(); g.globalAlpha = d.raster ? 0.22 : 0.12;
      if (d.raster) g.drawImage(d._ras.canvas, 0, 0, W, H);
      else d.regions.slice().sort((a, b) => a.z - b.z).forEach(r => R.fillRegion(g, r, R.regionHex(r)));
      g.restore();
      g.setLineDash([5, 4]); d.lines.forEach(l => { g.strokeStyle = 'rgba(40,80,150,0.55)'; g.lineWidth = 1.3; g.stroke(l.path); }); g.setLineDash([]);
      if (SW.prog > 0) d.lines.forEach(l => {
        const tip = partial(g, l.samples, SW.prog, '#1d1a17', 2.8);
        if (!SW.done) { g.fillStyle = 'rgba(29,26,23,0.8)'; g.beginPath(); g.arc(tip.x, tip.y, 3.5, 0, 7); g.fill(); }
      });
      if (SW.prog >= 1 && !SW.done) this.finish();
      drawHint(g, t);
    },
  };

  /* ───────── 弐：色さし（絵師） ───────── */
  stages.irosashi = {
    enter() { swipeReset(); this.order = G.design.regions.slice().sort((a, b) => a.z - b.z); this.shown = 0; swipePanel('絵師', '弐', '色さし', 'いろさし', '画面を<b>ひとなで</b>して、版ごとの色を指定しよう。', '絵師の色指定をもとに、彫師は色の数だけ「色版」を彫ります。'); },
    move(p, down) { if (swipeMove(p, down)) Sfx.play('brush', 120); },
    up() { swipeUp(); },
    draw(g, t, dt) {
      swipeTick(dt); swipeUI();
      const d = G.design, n = this.order.length;
      bgPaper(g);
      this.order.forEach((r, k) => {
        const a = U.clamp((SW.prog * n - k) * 1.5, 0, 1);
        if (a > 0) R.drawRegion(g, d, r, a);
        if (a > 0 && k >= this.shown) { this.shown = k + 1; Sfx.play('paint'); toast(`${r.name}`, ''); }
      });
      drawKeyArt(g, d.raster ? 0.9 : 1);
      if (SW.prog >= 1 && !SW.done) { G.st.scores.iro = grade(swipeQ()); finishStage('hori', '色さし完了！ 色版を彫ろう'); }
      drawHint(g, t);
    },
  };

  /* ───────── 参：彫り（彫師） ───────── */
  const HR = { parts: [], lastChip: 0 };
  stages.hori = {
    enter() {
      swipeReset(); HR.parts = [];
      G.st.carve.forEach(c => { c.chips = []; c.q = 1; c.done = false; });
      swipePanel('彫師', '参', '彫り', 'ほり', '画面を<b>ひとなで</b>して小刀で彫ろう。<b>速すぎると線が欠けます</b>。', '版下絵を裏返しに版木へ貼り、線の両側を彫って線を浮き上がらせます。');
    },
    move(p, down) {
      const v = swipeMove(p, down);
      if (!v) return;
      Sfx.play('carve', 50);
      if (v > V_HI * 1.2 && p.t - HR.lastChip > 280) {
        HR.lastChip = p.t;
        const i = Math.random() * G.design.lines.length | 0, s = G.design.lines[i].samples;
        G.st.carve[i].chips.push({ ...s[Math.floor((s.length - 1) * SW.prog)] });
        Sfx.play('chip'); toast('速すぎて線が欠けた！', 'bad');
      }
    },
    up() { swipeUp(); },
    draw(g, t, dt) {
      swipeTick(dt); swipeUI();
      const d = G.design, st = G.st;
      bgWood(g);
      g.save(); mirror(g);
      g.fillStyle = 'rgba(245,236,215,0.3)'; g.fillRect(0, 0, W, H);
      if (d.raster) { g.globalAlpha = 0.55; g.drawImage(R.silhouette(d, d.raster.keyLabel, '#2b1d14'), 0, 0, W, H); g.globalAlpha = 1; }
      else st.strokes.forEach(s => drawStroke(g, s, 'rgba(40,28,20,0.5)'));
      d.lines.forEach((l, i) => {
        if (SW.prog > 0) {
          partial(g, l.samples, SW.prog, 'rgba(110,70,40,0.75)', 8);
          const tip = partial(g, l.samples, SW.prog, '#ecd2a8', 2.4);
          if (!SW.done && Math.random() < 0.4 && (SW.auto || SW.last)) HR.parts.push({ x: tip.x, y: tip.y, vx: (Math.random() - 0.5) * 0.15, vy: -Math.random() * 0.15, life: 500, s: 1.5 + Math.random() * 2 });
        }
        st.carve[i].chips.forEach(ch => { g.fillStyle = '#4a2e1a'; g.beginPath(); g.arc(ch.x, ch.y, 3, 0, 7); g.fill(); });
      });
      HR.parts = HR.parts.filter(p => (p.life -= dt) > 0);
      HR.parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.0006 * dt; g.fillStyle = `rgba(225,190,140,${p.life / 500})`; g.fillRect(p.x, p.y, p.s, p.s * 0.6); });
      g.restore();
      if (SW.prog >= 1 && !SW.done) {
        st.carve.forEach(c => { c.done = true; c.q = U.clamp(1 - 0.15 * c.chips.length, 0.3, 1); });
        const chips = st.carve.reduce((a, c) => a + c.chips.length, 0);
        const sc = grade(Math.min(swipeQ(), 1 - chips * 0.1), chips === 0);
        st.scores.hori = sc === 100 ? 100 : Math.round(Math.min(sc, 100 * st.carve.reduce((a, c) => a + c.q, 0) / st.carve.length));
        finishStage('suri', '版木が彫り上がった！');
      }
      drawHint(g, t);
    },
  };

  /* ───────── 四：摺り（摺師） ─────────
     ひとなでで、薄い色から順に全ての版を摺り重ねる。なでる速さが見当・ムラに表れる */
  const S = { printed: 0, print: null, vs: [], flash: 0 };
  function blockScore(b) { return 0.3 * b.amount + 0.35 * b.kento + 0.35 * b.rub; }
  function printBlock(i) {
    const d = G.design, st = G.st;
    const vs = S.vs.length ? S.vs : [1];
    const good = vs.filter(v => v >= V_LO && v <= V_HI).length / vs.length;        // 丁寧さ
    const r = U.rng(i * 71 + st.blocks.length * 13 + (st.round || 0) * 997);
    const pf = swipeQ() >= PERFECT_Q && good >= 0.8, err = pf ? 0 : (1 - good) * 6 * r(), ang = r() * Math.PI * 2;
    const amount = pf ? 0.5 : 0.5 + (r() - 0.5) * 0.12 * (1 + (1 - good) * 2);
    const cov = new Float32Array(GW * GH);
    for (let k = 0; k < cov.length; k++) cov[k] = pf ? 1.2 : 0.75 + good * 0.4 + r() * 0.25;
    st.results[i] = { amount, dx: Math.cos(ang) * err, dy: Math.sin(ang) * err, cov };
    st.blockScores[i] = { amount: U.clamp(1 - Math.max(0, Math.abs(amount - 0.5) - 0.08) / 0.3, 0, 1), kento: U.clamp(1 - (err - 0.7) / 7, 0, 1), rub: U.clamp(0.6 + good * 0.4, 0, 1) };
    S.vs = [];
    S.print = R.render(d, st, { S: 1, upto: i });
    S.flash = performance.now();
    Sfx.play('paper');
  }
  stages.suri = {
    enter() {
      swipeReset(); G.st.results = []; G.st.blockScores = []; G.st.round = (G.st.round || 0) + 1;
      S.printed = 0; S.print = null; S.vs = [];
      swipePanel('摺師', '四', '摺り', 'すり', '画面を<b>ひとなで</b>して、ばれんで全ての版を摺り重ねよう。', '摺師は薄い色から濃い色へ、版木を替えて一色ずつ摺り重ねます。');
    },
    move(p, down) { const v = swipeMove(p, down); if (v) { S.vs.push(v); Sfx.play('rub', 110); } },
    up() { swipeUp(); },
    draw(g, t, dt) {
      swipeTick(dt); swipeUI();
      const st = G.st, n = st.blocks.length;
      while (S.printed < Math.min(n, Math.floor(SW.prog * n + 1e-6))) { printBlock(S.printed); S.printed++; }
      bgWood(g);
      g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
      g.drawImage(S.print || texPaper, PAPER.x, PAPER.y, PAPER.w, PAPER.h); g.restore();
      const fl = U.clamp(1 - (performance.now() - S.flash) / 500, 0, 1);
      if (fl > 0) { g.fillStyle = `rgba(255,250,235,${fl * 0.35})`; g.fillRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h); }
      g.save(); g.fillStyle = 'rgba(36,32,29,0.8)'; g.fillRect(PAPER.x, PAPER.y + PAPER.h - 26, 210, 26);
      g.fillStyle = '#f1e6cf'; g.font = `700 14px ${R.FONT}`; g.textBaseline = 'middle';
      const b = st.blocks[Math.min(n - 1, S.printed)];
      g.fillText(S.printed >= n ? `全${n}版 摺り上がり` : `第${S.printed + 1}版 / 全${n}版：${b.name}`, PAPER.x + 10, PAPER.y + PAPER.h - 13); g.restore();
      const f = SW.finger;
      if (f && !SW.done && (SW.last || SW.auto)) {
        const gr = g.createRadialGradient(f.x - 8, f.y - 8, 4, f.x, f.y, 30);
        gr.addColorStop(0, 'rgba(150,110,65,0.9)'); gr.addColorStop(1, 'rgba(70,45,25,0.9)');
        g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, 30, 0, 7); g.fill();
      }
      if (S.printed >= n && !SW.done) {
        const sc = grade(swipeQ());
        st.scores.suri = sc === 100 ? 100 : Math.round(Math.min(sc, 100 * st.blockScores.reduce((a, x) => a + blockScore(x), 0) / n));
        finishStage('rakkan', '摺り上がり！ 紙をめくろう');
      }
      drawHint(g, t);
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
    const sc = G.st.scores;
    const total = Math.round(0.15 * (sc.shitae ?? 0) + 0.15 * (sc.iro ?? 0) + 0.25 * (sc.hori ?? 0) + 0.45 * (sc.suri ?? 0));
    const rank = RANKS.find(r => total >= r[0]);
    return { total, rank, price: Math.round(12 + total * 0.12) };
  }
  stages.rakkan = {
    enter() {
      swipeReset(); G.signed = false; G.sealT = 0; G.compare = false;
      const d = G.design;
      if (d.original && !d._orig) { d._orig = new Image(); d._orig.src = d.original; }
      if (!G.st.name) G.st.name = NAMES[Math.random() * NAMES.length | 0];
      G.finalCv = R.render(d, G.st, { S: 2 });
      this.panel();
    },
    panel() {
      const st = G.st;
      if (!G.signed) {
        panel.innerHTML = head('絵師', '伍', '落款', 'らっかん') + `
          <p class="howto">画面を<b>ひとなで</b>して印を押そう。</p>
          <label class="field">号<input id="i-name" maxlength="4" value="${esc(st.name)}"></label>`;
        $('#i-name').oninput = e => { st.name = e.target.value.trim() || st.name; };
        return;
      }
      const { total, rank, price } = totals();
      panel.innerHTML = head('版元', '完', '摺り上がり', 'できあがり') + `
        <div class="score">
          <div class="rank"><span>${rank[1]}</span><b>${total}</b>点</div>
          <p class="hanmoto">版元「${rank[2]}」<br>一枚 <b>${price}文</b> で売れそうだ。</p>
          <ul class="result desc">
            <li><span>版下絵</span>${st.scores.shitae}点</li><li><span>色さし</span>${st.scores.iro}点</li>
            <li><span>彫り</span>${st.scores.hori}点</li><li><span>摺り</span>${st.scores.suri}点</li>
          </ul>
        </div>
        <div class="controls">
          <button class="btn primary" id="b-save">保存</button>
          <button class="btn" id="b-gal">画廊に飾る</button>
          ${G.design.original ? `<button class="btn compare" id="b-cmp">${G.compare ? '自分の作品' : '原画と比べる'}</button>` : ''}
        </div>
        <div class="controls">
          <button class="btn" id="b-again">もう一枚摺る</button>
          <button class="btn" id="b-home">別の絵を選ぶ</button>
        </div>
        ${G.design.credit ? `<p class="note desc">${G.design.credit}</p>` : ''}`;
      $('#b-save').onclick = () => {
        G.finalCv.toBlob(b => {
          const a = document.createElement('a'); a.href = URL.createObjectURL(b);
          a.download = `${G.design.title}_${st.name}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
      };
      $('#b-gal').onclick = (e) => { if (saveGallery({ total, rank })) { e.target.disabled = true; e.target.textContent = '飾った'; toast('画廊に飾りました', 'good'); } };
      $('#b-again').onclick = () => go('suri');
      const cmp = $('#b-cmp'); if (cmp) cmp.onclick = () => { G.compare = !G.compare; Sfx.play('paper'); this.panel(); };
      $('#b-home').onclick = () => toTitle();
    },
    sign() {
      if (G.signed) return;
      const st = G.st;
      G.signed = true; G.sealT = performance.now(); SW.done = true;
      G.finalCv = R.render(G.design, st, { S: 2, sign: st.name });
      Sfx.play('seal'); setTimeout(() => Sfx.play('fanfare'), 300);
      this.panel();
    },
    down(p) { if (!G.signed) SW.started = true; },
    move(p, down) { if (!G.signed) { swipeMove(p, down); if (SW.prog > 0.25) this.sign(); } },
    up() { if (!G.signed && SW.started) this.sign(); },
    draw(g, t) {
      g.fillStyle = '#2b2622'; g.fillRect(-OX, -OY, VW, VH);
      const p = G.signed ? U.clamp((performance.now() - G.sealT) / 500, 0, 1) : 1;
      const sc = 1 + (1 - p) * 0.04;
      g.save(); g.translate(W / 2, H / 2); g.scale(sc, sc); g.translate(-W / 2, -H / 2);
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
      const o = G.design._orig;
      if (G.compare && o && o.complete && o.naturalWidth) {
        g.fillStyle = '#efe4cc'; g.fillRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h);
        g.shadowColor = 'transparent'; g.drawImage(o, 0, 0, W, H);
        const cap = '原画：' + G.design.artist + '（メトロポリタン美術館蔵）';
        g.font = `11px ${R.FONT}`; const tw = g.measureText(cap).width + 12;
        g.fillStyle = 'rgba(36,32,29,0.85)'; g.fillRect(W - tw, H + 1, tw, 16);
        g.fillStyle = '#f1e6cf'; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(cap, W - 6, H + 9);
      } else g.drawImage(G.finalCv, PAPER.x, PAPER.y, PAPER.w, PAPER.h);
      g.restore();
      if (!G.signed) drawHint(g, t);
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
    const card = (d, i) => `<article class="card ${d.w > (d.h || 600) ? 'wide' : ''}">
      <div class="thumb"><img alt="${d.title}の完成見本" data-i="${i}"></div>
      <div class="card-body">${d.artist ? `<div class="badge">${d.artist}『${d.series}』</div>` : ''}<h3>${d.title}<small>${d.yomi}</small></h3><p>${d.desc}</p>
      <div class="lv">難しさ ${'★'.repeat(d.level)}${'☆'.repeat(3 - d.level)}　${d.regions.length + 1}版${d.raster ? '・原画を色分解' : ''}</div>
      <button class="btn primary" data-start="${i}">この画題で始める</button></div></article>`;
    const box = $('#design-list'), box2 = $('#design-list-orig');
    box2.innerHTML = DESIGNS.map((d, i) => d.artist ? card(d, i) : '').join('');
    box.innerHTML = DESIGNS.map((d, i) => d.artist ? '' : card(d, i)).join('');
    document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => start(+b.dataset.start));
    DESIGNS.forEach((d, i) => {
      setTimeout(() => {
        prepDesign(d);
        const img = document.querySelector(`img[data-i="${i}"]`);
        if (d.raster) { img.src = d.original; return; }
        img.src = R.render(d, idealState(d), { S: 0.7 }).toDataURL('image/jpeg', 0.85);
      }, 30 + i * 60);
    });
  }
  async function start(i) {
    Sfx.init();
    const d = DESIGNS[i];
    prepDesign(d);
    if (d.raster && !d._ras) {
      document.body.classList.add('loading');
      try { await R.loadRaster(d); }
      catch (e) {
        d._rs = null;
        alert('版木の読み込みに失敗しました。GitHub Pages などのWebサーバー経由で開いてください（ファイルを直接開くと画像を解析できません）。');
        return;
      } finally { document.body.classList.remove('loading'); }
    }
    G.design = d; setDims(d);
    G.st = newState(d);
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
  cv.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => { if (e.target.tagName !== 'INPUT' && !e.repeat) G.stage?.key?.(e); });
  document.addEventListener('keyup', e => { if (e.target.tagName !== 'INPUT') G.stage?.key?.(e); });

  let lastT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(50, t - lastT || 16); lastT = t;
    if (!G.stage || document.body.dataset.screen !== 'screen-work') return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.translate(OX, OY);
    G.stage.draw(ctx, t, dt);
    drawFx(ctx);
  }

  $('#btn-home').onclick = toTitle;
  $('#btn-gallery').onclick = () => { if (G.stage && G.stageName !== 'rakkan' && !confirm('作業中の錦絵は失われます。画廊へ移動しますか？')) return; showGallery(); };
  $('#btn-gallery-back').onclick = () => { show('screen-title'); };
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  Sfx.on = pref('ukiyoe-sfx') !== '0'; Sfx.bgmOn = pref('ukiyoe-bgm') !== '0';
  const syncAudioBtns = () => { $('#btn-sound').setAttribute('aria-pressed', Sfx.on); $('#btn-bgm').setAttribute('aria-pressed', Sfx.bgmOn); };
  syncAudioBtns();
  $('#btn-sound').onclick = () => { Sfx.on = !Sfx.on; pref('ukiyoe-sfx', Sfx.on ? '1' : '0'); syncAudioBtns(); Sfx.play('tap'); };
  $('#btn-bgm').onclick = () => { Sfx.setBgm(!Sfx.bgmOn); pref('ukiyoe-bgm', Sfx.bgmOn ? '1' : '0'); syncAudioBtns(); };
  // ブラウザの自動再生制限のため、最初の操作で音を開始
  document.addEventListener('pointerdown', () => Sfx.init(), { once: true });
  document.addEventListener('keydown', () => Sfx.init(), { once: true });

  texPaper = R.paper(920, 1320);
  texWood = R.wood(920, 1320);
  show('screen-title');
  const fontReady = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load(`700 20px "Shippori Mincho"`), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
  fontReady.catch(() => {}).then(buildTitle);
  requestAnimationFrame(loop);

  /* 自動テスト用 */
  G._debug = { go, start, idealState, stages, S, SW };
})();
