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
  const STEPS = ['shitae', 'irosashi', 'hori', 'kento', 'suri', 'rakkan'];
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

  /* ───────── 共通：判定演出（正確なら PERFECT! で満点）と自動進行 ───────── */
  const FX = { t0: -1e9, text: '', sub: '', perfect: false };
  let finishing = false;
  function grade(q, perfect, tip = '') {
    Object.assign(FX, { t0: performance.now(), perfect, text: perfect ? 'PERFECT!' : q >= 0.6 ? 'GREAT!' : 'GOOD', sub: perfect ? '見事！ 満点' : (q >= 0.6 ? '上出来！ ' : 'まずまず。') + tip });
    Sfx.play(perfect ? 'fanfare' : 'done');
    return perfect ? 100 : Math.round(55 + 40 * U.clamp(q, 0, 1));
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
    g.font = `700 ${size * 0.3}px ${R.FONT}`; g.lineWidth = size * 0.07; g.strokeText(FX.sub, 0, size * 0.75);
    g.fillStyle = '#fff'; g.fillText(FX.sub, 0, size * 0.75);
    g.restore();
  }
  function finishStage(next, msg) {
    if (finishing) return;
    finishing = true; toast(msg, 'good');
    setTimeout(() => { finishing = false; if (G.stage && G.stageName !== next) go(next); }, 1700);
  }
  function simplePanel(role, num, title, yomi, howto, extra = '', desc = '') {
    panel.innerHTML = head(role, num, title, yomi) + `<p class="howto">${howto}</p>${extra}${desc ? `<p class="desc">${desc}</p>` : ''}`;
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
  function ideaStrokes() {
    G.st.strokes = G.design.lines.map((l, i) => ({ line: i, pts: l.samples.map((q, j) => {
      const n = l.samples.length; return { x: q.x, y: q.y, w: 2.6 * Math.min(1, 0.45 + Math.min(j, n - 1 - j) * 0.18) };
    }) }));
  }

  /* ───────── なぞり（下絵・彫り共通） ─────────
     点線のお手本を指でなぞる。線の近くならどこから始めてもよく、6割なぞれば残りは自動で仕上がる */
  const TR = { lines: [], cov: [], dev: 0, devN: 0, active: -1, mirror: false, onDone: null, last: null, ink: [] };
  const TR_R = 22;
  const lineLen = sm => { let L = 0; for (let j = 1; j < sm.length; j++) L += U.dist(sm[j], sm[j - 1]); return L; };
  function traceSetup(mirror) {
    const ls = G.design.lines.slice().sort((a, b) => b.samples.length - a.samples.length).slice(0, 6);
    Object.assign(TR, { lines: ls.map(l => l.samples), cov: ls.map(l => new Uint8Array(l.samples.length)), dev: 0, devN: 0, active: -1, mirror, last: null, natural: 0, total: 0 });
    TR.total = TR.cov.reduce((a, c) => a + c.length, 0);
  }
  const trRatio = i => { const c = TR.cov[i]; let n = 0; for (const v of c) n += v; return n / c.length; };
  const trAllDone = () => TR.cov.every((_, i) => trRatio(i) >= 0.999);
  const trMeanDev = () => TR.devN ? TR.dev / TR.devN : 99;
  const trQ = () => U.clamp(TR.natural / TR.total / 0.92, 0, 1) * U.clamp(1 - (trMeanDev() - 6) / 22, 0, 1);
  const trPerfect = () => TR.natural / TR.total >= 0.88 && trMeanDev() <= 9;
  const toLocal = p => TR.mirror ? { x: W - p.x, y: p.y, t: p.t } : p;
  function trDown(p0) {
    const p = toLocal(p0); let best = -1, bd = 38 * 38;
    TR.lines.forEach((s, i) => { if (trRatio(i) >= 0.999) return; s.forEach(q => { const dd = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (dd < bd) { bd = dd; best = i; } }); });
    if (best < 0) { toast('赤い点線の近くからなぞろう'); return false; }
    TR.active = best; TR.last = p; TR.slen = 0; trMark(p); return true;
  }
  function trMark(p) {
    const s = TR.lines[TR.active], c = TR.cov[TR.active]; let md = 1e9;
    s.forEach((q, j) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < md) md = d; if (d < TR_R && !c[j]) { c[j] = 1; TR.natural++; } });
    TR.dev += Math.min(md, 40); TR.devN++;
    return md;
  }
  function trMove(p0, down) {
    if (TR.active < 0 || !down) return null;
    const p = toLocal(p0); if (U.dist(p, TR.last) < 1) return null;
    TR.slen += U.dist(p, TR.last); TR.last = p; return trMark(p);
  }
  function trUp() {
    const i = TR.active; TR.active = -1; if (i < 0) return;
    if (trRatio(i) >= 0.6 || TR.slen >= lineLen(TR.lines[i]) * 0.5) { TR.cov[i].fill(1); Sfx.play('tap'); }
    else toast('点線に沿って最後までなぞろう');
  }
  function drawTrace(g, t, inkColor, inkW, groove) {
    TR.lines.forEach((s, i) => {
      const c = TR.cov[i], done = trRatio(i) >= 0.999;
      if (!done) {
        g.save(); g.lineCap = 'round';
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 7;
        g.beginPath(); s.forEach((q, j) => j ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.stroke();
        g.strokeStyle = TR.active === i ? 'rgba(232,150,30,0.95)' : 'rgba(200,68,47,0.9)'; g.lineWidth = 3.2;
        g.setLineDash([7, 6]); g.lineDashOffset = -t / 30; g.stroke(); g.restore();
      }
      g.lineCap = 'round';
      for (let j = 1; j < s.length; j++) if (c[j] && c[j - 1]) {
        if (groove) { g.strokeStyle = 'rgba(110,70,40,0.75)'; g.lineWidth = 8; g.beginPath(); g.moveTo(s[j - 1].x, s[j - 1].y); g.lineTo(s[j].x, s[j].y); g.stroke(); }
        g.strokeStyle = inkColor; g.lineWidth = inkW; g.beginPath(); g.moveTo(s[j - 1].x, s[j - 1].y); g.lineTo(s[j].x, s[j].y); g.stroke();
      }
    });
  }
  function traceMeter() {
    const n = TR.lines.length, done = TR.cov.filter((_, i) => trRatio(i) >= 0.999).length;
    const f = $('#tr-fill'), t = $('#tr-txt');
    if (f) f.style.width = done / n * 100 + '%';
    if (t) t.textContent = `線 ${done} / ${n}`;
  }
  const meter = (id) => `<div class="meter"><div class="meter-fill" id="${id}-fill"></div><span id="${id}-txt"></span></div>`;

  const stages = {};
  /* ───────── 壱：版下絵＝輪郭をなぞる ───────── */
  stages.shitae = {
    enter() { traceSetup(false); simplePanel('絵師', '壱', '版下絵', 'はんしたえ', '赤い点線の<b>輪郭をなぞろう</b>。ぴったり沿えば PERFECT!', meter('tr'), '絵師が墨一色で描く版下絵は、そのまま版木に貼られて彫られます。'); },
    down(p) { trDown(p); },
    move(p, down) { if (trMove(p, down) != null) Sfx.play('brush', 90); },
    up() {
      trUp();
      if (trAllDone() && !finishing) {
        ideaStrokes();
        G.st.scores.shitae = grade(trQ(), trPerfect(), '点線にぴったり沿えば満点');
        finishStage('irosashi', '版下絵が描き上がった！');
      }
    },
    draw(g, t) {
      const d = G.design;
      bgPaper(g);
      g.save(); g.globalAlpha = d.raster ? 0.22 : 0.12;
      if (d.raster) g.drawImage(d._ras.canvas, 0, 0, W, H);
      else d.regions.slice().sort((a, b) => a.z - b.z).forEach(r => R.fillRegion(g, r, R.regionHex(r)));
      g.restore();
      drawTrace(g, t, '#1d1a17', 2.8, false);
      traceMeter();
    },
  };

  /* ───────── 弐：色さし＝配色を覚えて合わせる ───────── */
  const MEM = { phase: 'memo', t0: 0, order: [], i: 0, ok: 0, filled: new Set(), choices: [] };
  const MEMO_SEC = 6;
  const colorDist = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
  function makeChoices(r) {
    const right = R.regionHex(r), pool = [];
    G.design.regions.forEach(o => { const h = R.regionHex(o); if (o !== r && pool.every(p => colorDist(p, h) > 28) && colorDist(h, right) > 28) pool.push(h); });
    Object.values(PIG).forEach(p => { if (pool.length < 8 && pool.every(q => colorDist(q, p.hex) > 40) && colorDist(p.hex, right) > 60) pool.push(p.hex); });
    return [right, ...pool.sort(() => Math.random() - 0.5).slice(0, 3)].sort(() => Math.random() - 0.5);
  }
  function highlight(g, r, t) {
    const d = G.design, a = 0.45 + 0.3 * Math.sin(t / 180);
    g.save(); g.globalAlpha = a;
    if (d.raster) g.drawImage(R.silhouette(d, r.label, '#e0412a'), 0, 0, W, H);
    else { g.fillStyle = '#e0412a'; g.fill(r.path); }
    g.restore();
  }
  stages.irosashi = {
    enter() {
      Object.assign(MEM, { phase: 'memo', t0: performance.now(), i: 0, ok: 0, filled: new Set() });
      MEM.order = G.design.regions.slice().sort((a, b) => a.z - b.z);
      this.panel();
    },
    panel() {
      const n = MEM.order.length;
      let body;
      if (MEM.phase === 'memo') body = `<p class="howto">完成の<b>配色を覚えよう！</b> <b id="memo-t">${MEMO_SEC}</b>秒で色が消えます。</p>
        <div class="controls"><button class="btn primary big" id="b-ready">覚えた！</button></div>`;
      else if (MEM.phase === 'quiz') {
        const r = MEM.order[MEM.i];
        body = `<p class="howto">光っている所は<b>何色</b>だった？</p>
          <div class="now">${MEM.i + 1} / ${n}：<b>${r.name}</b></div>
          <div class="choices">${MEM.choices.map(h => `<button class="choice" data-c="${h}" style="background:${h}" aria-label="色"></button>`).join('')}</div>`;
      } else body = `<div class="score-line">正解 <b>${MEM.ok}</b> / ${n}</div>`;
      panel.innerHTML = head('絵師', '弐', '色さし', 'いろさし') + body + `<p class="desc">絵師の色指定をもとに、彫師は色の数だけ「色版」を彫ります。</p>`;
      const b = $('#b-ready'); if (b) b.onclick = () => this.startQuiz();
      panel.querySelectorAll('.choice').forEach(c => c.onclick = () => this.answer(c.dataset.c));
    },
    startQuiz() { if (MEM.phase !== 'memo') return; MEM.phase = 'quiz'; MEM.choices = makeChoices(MEM.order[0]); Sfx.play('paper'); this.panel(); },
    answer(h) {
      if (MEM.phase !== 'quiz') return;
      const r = MEM.order[MEM.i], right = R.regionHex(r) === h;
      if (right) { MEM.ok++; Sfx.play('good'); toast('正解！', 'good'); }
      else { Sfx.play('bad'); toast(`ちがう…「${r.name}」はこの色`, 'bad'); }
      MEM.filled.add(r.id); MEM.i++;
      if (MEM.i >= MEM.order.length) {
        MEM.phase = 'done';
        const n = MEM.order.length;
        G.st.scores.iro = grade(MEM.ok / n, MEM.ok === n, `${MEM.ok}/${n} 正解`);
        finishStage('hori', '色さし完了！');
      } else MEM.choices = makeChoices(MEM.order[MEM.i]);
      this.panel();
    },
    draw(g, t) {
      const d = G.design;
      bgPaper(g);
      if (MEM.phase === 'memo') {
        MEM.order.forEach(r => R.drawRegion(g, d, r));
        drawKeyArt(g);
        const left = MEMO_SEC - (performance.now() - MEM.t0) / 1000, e = $('#memo-t');
        if (e) e.textContent = Math.max(0, Math.ceil(left));
        if (left <= 0) this.startQuiz();
        return;
      }
      MEM.order.forEach(r => { if (MEM.filled.has(r.id)) R.drawRegion(g, d, r); });
      if (MEM.phase === 'quiz') highlight(g, MEM.order[MEM.i], t);
      drawKeyArt(g, d.raster ? 0.9 : 1);
    },
  };

  /* ───────── 参：彫り＝版木の線をなぞって彫る ───────── */
  const HR = { parts: [], lastChip: 0, chips: 0 };
  stages.hori = {
    enter() {
      traceSetup(true); HR.parts = []; HR.chips = 0;
      G.st.carve.forEach(c => { c.chips = []; c.q = 1; c.done = false; });
      simplePanel('彫師', '参', '彫り', 'ほり', '版木の赤い点線を<b>なぞって彫ろう</b>。線から外れると欠けます。', meter('tr'), '版下絵を裏返しに版木へ貼るので、版木の絵は左右反転しています。');
    },
    down(p) { trDown(p); },
    move(p, down) {
      const md = trMove(p, down);
      if (md == null) return;
      Sfx.play('carve', 50);
      const q = TR.last;
      if (Math.random() < 0.5) HR.parts.push({ x: q.x, y: q.y, vx: (Math.random() - 0.5) * 0.15, vy: -Math.random() * 0.15, life: 500, s: 1.5 + Math.random() * 2 });
      if (md > 15 && p.t - HR.lastChip > 300) {
        HR.lastChip = p.t; HR.chips++;
        const li = Math.max(0, G.design.lines.findIndex(l => l.samples === TR.lines[TR.active]));
        const s = TR.lines[TR.active]; let bj = 0, bd = 1e9;
        s.forEach((x, j) => { const dd = Math.hypot(x.x - q.x, x.y - q.y); if (dd < bd) { bd = dd; bj = j; } });
        G.st.carve[li].chips.push({ ...s[bj] });
        Sfx.play('chip'); toast('線から外れて欠けた！', 'bad');
      }
    },
    up() {
      trUp();
      if (trAllDone() && !finishing) {
        const st = G.st;
        st.carve.forEach(c => { c.done = true; c.q = U.clamp(1 - 0.15 * c.chips.length, 0.3, 1); });
        st.scores.hori = grade(Math.min(trQ(), 1 - HR.chips * 0.1), trPerfect() && HR.chips === 0, '線から外れないように');
        finishStage('kento', '版木が彫り上がった！');
      }
    },
    draw(g, t, dt) {
      const d = G.design, st = G.st;
      bgWood(g);
      g.save(); mirror(g);
      g.fillStyle = 'rgba(245,236,215,0.3)'; g.fillRect(0, 0, W, H);
      if (d.raster) { g.globalAlpha = 0.55; g.drawImage(R.silhouette(d, d.raster.keyLabel, '#2b1d14'), 0, 0, W, H); g.globalAlpha = 1; }
      else st.strokes.forEach(s => drawStroke(g, s, 'rgba(40,28,20,0.5)'));
      drawTrace(g, t, '#ecd2a8', 2.4, true);
      st.carve.forEach(c => c.chips.forEach(ch => { g.fillStyle = '#4a2e1a'; g.beginPath(); g.arc(ch.x, ch.y, 3, 0, 7); g.fill(); }));
      HR.parts = HR.parts.filter(p => (p.life -= dt) > 0);
      HR.parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.0006 * dt; g.fillStyle = `rgba(225,190,140,${p.life / 500})`; g.fillRect(p.x, p.y, p.s, p.s * 0.6); });
      g.restore();
      traceMeter();
    },
  };

  /* ───────── 四：見当＝紙を合わせる ───────── */
  const KT = { ox: 0, oy: 0, drag: null, placed: false };
  const MAGNET = 1.6;
  function drawKento(g) {
    const X = W + M, Y = H + M;
    g.fillStyle = '#5e3c22';
    g.fillRect(X - 30, Y, 34, 5); g.fillRect(X, Y - 30, 5, 35); g.fillRect(40, Y, 60, 5);
    g.fillStyle = '#e8cfa5';
    g.fillRect(X - 30, Y, 34, 1.4); g.fillRect(X, Y - 30, 1.4, 35); g.fillRect(40, Y, 60, 1.4);
  }
  function drawKentoScene(g) {
    const d = G.design;
    bgWood(g);
    g.save(); mirror(g); g.fillStyle = 'rgba(80,48,25,0.3)'; g.fillRect(0, 0, W, H);
    if (d.raster) { g.drawImage(R.silhouette(d, d.raster.keyLabel, '#5a381f'), 1.2, 1.4, W, H); g.drawImage(R.plate(d, d.raster.keyLabel), 0, 0, W, H); }
    else G.st.strokes.forEach(s => drawStroke(g, s, PIG.sumi.hex, 1.1));
    g.restore();
    drawKento(g);
    g.save(); g.translate(KT.ox, KT.oy);
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.globalAlpha = 0.86; g.drawImage(texPaper, PAPER.x, PAPER.y, PAPER.w, PAPER.h);
    g.restore();
    g.strokeStyle = 'rgba(200,68,47,0.9)'; g.lineWidth = 2; g.setLineDash([5, 4]);
    g.strokeRect(PAPER.x, PAPER.y, PAPER.w, PAPER.h); g.setLineDash([]);
  }
  stages.kento = {
    enter() {
      Object.assign(KT, { ox: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 25), oy: -(35 + Math.random() * 25), drag: null, placed: false });
      simplePanel('摺師', '四', '見当', 'けんとう', '紙をドラッグして、<b>赤い枠と版木の目印（鉤）にぴったり合わせよう</b>。', '<canvas id="lens" class="lens" width="320" height="170"></canvas>', '「見当」は紙の位置を合わせる版木の目印。「見当違い」の語源です。');
    },
    down(p) { if (!KT.placed) KT.drag = { sx: p.x, sy: p.y, ox: KT.ox, oy: KT.oy }; },
    move(p, down) {
      if (!KT.drag || !down) return;
      KT.ox = U.clamp(KT.drag.ox + p.x - KT.drag.sx, -90, 90); KT.oy = U.clamp(KT.drag.oy + p.y - KT.drag.sy, -90, 40);
      if (Math.hypot(KT.ox, KT.oy) < MAGNET) { if (KT.ox || KT.oy) Sfx.play('tap', 300); KT.ox = 0; KT.oy = 0; }
    },
    up() {
      if (!KT.drag) return; KT.drag = null;
      const err = Math.hypot(KT.ox, KT.oy);
      Sfx.play('paper');
      if (err > 10) { toast('赤い枠に近づけよう'); return; }
      KT.placed = true; G.st.kento = { ox: KT.ox, oy: KT.oy, err };
      G.st.scores.kento = grade(U.clamp(1 - err / 10, 0, 1), err === 0, 'ぴたりと吸い付く所が満点');
      finishStage('suri', '紙を置いた！ 摺ろう');
    },
    key(e) {
      if (e.type !== 'keydown' || KT.placed) return;
      const m = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.code];
      if (m) { e.preventDefault(); KT.ox += m[0]; KT.oy += m[1]; if (Math.hypot(KT.ox, KT.oy) < MAGNET) { KT.ox = 0; KT.oy = 0; } }
      if (e.code === 'Enter') { KT.drag = {}; this.up(); }
    },
    draw(g) {
      drawKentoScene(g);
      const lens = $('#lens');
      if (lens) {
        const lg = lens.getContext('2d'), k = lens.width / 40;
        lg.setTransform(1, 0, 0, 1, 0, 0); lg.fillStyle = '#3a2a1c'; lg.fillRect(0, 0, lens.width, lens.height);
        lg.setTransform(k, 0, 0, k, lens.width / 2 - (W + M - 6) * k, lens.height / 2 - (H + M - 6) * k);
        drawKentoScene(lg);
        lg.setTransform(1, 0, 0, 1, 0, 0); lg.fillStyle = '#fff'; lg.font = `14px ${R.FONT}`; lg.fillText('鉤（かぎ）拡大', 10, 20);
      }
    },
  };

  /* ───────── 伍：摺り＝まんべんなく摺る ───────── */
  const SR = { cov: null, full: null, tmp: null, covCv: null, dirty: true, last: null, hover: null, started: false };
  const RUB_R = 34, RUB_K = 0.016;
  const srMean = () => { let s = 0; for (const v of SR.cov) s += Math.min(1, v); return s / SR.cov.length; };
  function srResults(cov) {
    const st = G.st, k = st.kento || { ox: 0, oy: 0, err: 0 }, r = U.rng((st.round || 1) * 31);
    st.results = st.blocks.map((b, i) => {
      const j = k.err === 0 ? 0 : 0.6;
      return { amount: 0.5, dx: k.ox * (i ? 1 : 0) + (r() - 0.5) * j, dy: -k.oy * (i ? 1 : 0) + (r() - 0.5) * j, cov };
    });
  }
  stages.suri = {
    enter() {
      const st = G.st; st.round = (st.round || 0) + 1;
      SR.cov = new Float32Array(GW * GH); SR.last = null; SR.hover = null; SR.started = false; SR.dirty = true;
      srResults(new Float32Array(GW * GH).fill(1.2));
      SR.full = R.render(G.design, st, { S: 1 });
      SR.tmp = U.canvas(SR.full.width, SR.full.height); SR.covCv = U.canvas(GW, GH);
      simplePanel('摺師', '伍', '摺り', 'すり', 'ばれんで紙を<b>まんべんなくこすろう</b>。こすった所に絵が現れます。', meter('sr') + '<div class="controls"><button class="btn ghost" id="b-fin">ここで仕上げる</button></div>', '摺師は薄い色から濃い色へ、版を替えて一色ずつ摺り重ねます。');
      $('#b-fin').onclick = () => this.finish();
    },
    finish() {
      if (finishing) return;
      const mean = srMean();
      srResults(SR.cov);
      G.st.scores.suri = grade(U.clamp((mean - 0.5) / 0.47, 0, 1), mean >= 0.97, 'ムラなく全体をこすると満点');
      finishStage('rakkan', '摺り上がり！');
    },
    down(p) { SR.last = p; SR.started = true; },
    move(p, down) {
      SR.hover = p;
      if (!down || !SR.last || finishing) return;
      const L = U.dist(p, SR.last), n = Math.max(1, Math.ceil(L / 4)), step = L / n;
      for (let k = 1; k <= n; k++) {
        const x = U.lerp(SR.last.x, p.x, k / n), y = U.lerp(SR.last.y, p.y, k / n);
        const gx0 = Math.max(0, Math.floor((x - RUB_R) / CELL)), gx1 = Math.min(GW - 1, Math.floor((x + RUB_R) / CELL));
        const gy0 = Math.max(0, Math.floor((y - RUB_R) / CELL)), gy1 = Math.min(GH - 1, Math.floor((y + RUB_R) / CELL));
        for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
          const dd = Math.hypot(gx * CELL + 4 - x, gy * CELL + 4 - y) / RUB_R;
          if (dd < 1) { const i = gy * GW + gx; SR.cov[i] = Math.min(1.3, SR.cov[i] + RUB_K * step * (1 - dd * dd)); }
        }
      }
      SR.last = p; SR.dirty = true;
      if (L > 2) Sfx.play('rub', 110);
      if (srMean() >= 0.985) this.finish();
    },
    up() { SR.last = null; if (SR.started && srMean() >= 0.93) this.finish(); },
    draw(g) {
      bgWood(g);
      g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
      g.drawImage(texPaper, PAPER.x, PAPER.y, PAPER.w, PAPER.h); g.restore();
      if (SR.dirty) {
        const cg = SR.covCv.getContext('2d'), im = cg.createImageData(GW, GH);
        for (let i = 0; i < GW * GH; i++) im.data[i * 4 + 3] = U.smooth(0.15, 0.95, SR.cov[i]) * 255;
        cg.putImageData(im, 0, 0);
        const tg = SR.tmp.getContext('2d'), s = SR.tmp.width / PAPER.w;
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, SR.tmp.width, SR.tmp.height);
        tg.drawImage(SR.full, 0, 0);
        tg.globalCompositeOperation = 'destination-in'; tg.imageSmoothingEnabled = true;
        tg.drawImage(SR.covCv, M * s, M * s, W * s, H * s);
        SR.dirty = false;
      }
      g.drawImage(SR.tmp, PAPER.x, PAPER.y, PAPER.w, PAPER.h);
      const h = SR.hover;
      if (h && !finishing) {
        const gr = g.createRadialGradient(h.x - 8, h.y - 8, 4, h.x, h.y, RUB_R);
        gr.addColorStop(0, 'rgba(150,110,65,0.85)'); gr.addColorStop(1, 'rgba(70,45,25,0.85)');
        g.fillStyle = gr; g.beginPath(); g.arc(h.x, h.y, RUB_R, 0, 7); g.fill();
        g.strokeStyle = 'rgba(40,25,10,0.6)'; g.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(h.x, h.y, RUB_R * (0.25 + k * 0.2), k, k + 4); g.stroke(); }
      }
      const m = srMean(), f = $('#sr-fill'), t = $('#sr-txt');
      if (f) { f.style.width = Math.min(100, m * 100) + '%'; t.textContent = `摺れ具合 ${Math.round(m * 100)}%`; }
    },
  };

  /* ───────── 六：落款・完成 ───────── */
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
    const total = Math.round(0.15 * (sc.shitae ?? 0) + 0.15 * (sc.iro ?? 0) + 0.2 * (sc.hori ?? 0) + 0.15 * (sc.kento ?? 0) + 0.35 * (sc.suri ?? 0));
    return { total, rank: RANKS.find(r => total >= r[0]), price: Math.round(12 + total * 0.12) };
  }
  stages.rakkan = {
    enter() {
      G.signed = false; G.sealT = 0; G.compare = false;
      const d = G.design;
      if (d.original && !d._orig) { d._orig = new Image(); d._orig.src = d.original; }
      if (!G.st.name) G.st.name = NAMES[Math.random() * NAMES.length | 0];
      G.finalCv = R.render(d, G.st, { S: 2 });
      this.panel();
    },
    panel() {
      const st = G.st;
      if (!G.signed) {
        panel.innerHTML = head('絵師', '六', '落款', 'らっかん') + `
          <p class="howto">画面を<b>タップ</b>して印を押そう。</p>
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
            <li><span>彫り</span>${st.scores.hori}点</li><li><span>見当</span>${st.scores.kento}点</li><li><span>摺り</span>${st.scores.suri}点</li>
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
      $('#b-again').onclick = () => go('kento');
      const cmp = $('#b-cmp'); if (cmp) cmp.onclick = () => { G.compare = !G.compare; Sfx.play('paper'); this.panel(); };
      $('#b-home').onclick = () => toTitle();
    },
    down() {
      if (G.signed) return;
      G.signed = true; G.sealT = performance.now();
      G.finalCv = R.render(G.design, G.st, { S: 2, sign: G.st.name });
      Sfx.play('seal'); setTimeout(() => Sfx.play('fanfare'), 300);
      this.panel();
    },
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
      if (!G.signed) {
        const a = 0.6 + 0.4 * Math.sin(t / 200);
        g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(36,32,29,0.85)'; g.fillRect(W / 2 - 90, H / 2 - 18, 180, 36);
        g.fillStyle = '#fff'; g.font = `700 16px ${R.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('タップして印を押す', W / 2, H / 2); g.restore();
      }
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
  G._debug = { go, start, idealState, stages, TR, KT, SR, MEM };
})();
