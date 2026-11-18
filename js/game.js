'use strict';
/* 浮世絵職人：浮世絵の「版（レイヤー）」の順番を当てて摺るゲーム
   お手本を見て次に摺る版を選ぶ → 摺りモードでばれんを使って自分で摺る →
   摺り上がった時に順番が違っていたらゲームオーバー、全部正しければ次の浮世絵へ */
(() => {
  const OX = 30, OY = 30;
  const { CELL, M } = R;
  let W = 400, H = 600, VW = 460, VH = 660, GW = 50, GH = 75;
  const $ = s => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d'), panel = $('#panel');
  const PAPER = { x: -M, y: -M, w: 400 + 2 * M, h: 600 + 2 * M };
  let scale = 1, dpr = 1, texWood = null;
  const G = { idx: 0, design: null, st: null, total: 0, playing: false };
  window.UKIYOE = G;
  const STAGES = MEISAKU;

  /* ───────── 共通 ───────── */
  function setDims(d) {
    ({ W, H, GW, GH } = R.dims(d)); VW = W + 2 * OX; VH = H + 2 * OY;
    PAPER.w = W + 2 * M; PAPER.h = H + 2 * M;
    cv.parentElement.style.setProperty('--ar', VW / VH); resize();
  }
  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
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
  let toastTimer = 0;
  function toast(msg, kind = '') {
    const t = $('#toast'); t.textContent = msg; t.className = 'show ' + kind;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 1600);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bgWood = g => g.drawImage(texWood, -OX, -OY, VW, VH);
  function stageBar() {
    $('#stagebar').innerHTML = G.design ? `<b>第${G.idx + 1}図</b> / 全${STAGES.length}図<span>得点 ${G.total}</span>` : '';
  }
  const PREF = 'ukiyoe-shokunin-progress';
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };

  /* ───────── 判定演出 ───────── */
  const FX = { t0: -1e9, text: '', sub: '', perfect: false, color: '#ffd75a', stay: false };
  function fx(text, sub, perfect, color, stay = false) { Object.assign(FX, { t0: performance.now(), text, sub, perfect, stay, color: color || (perfect ? '#ffd75a' : '#fff4dc') }); }
  function drawFx(g) {
    const e = performance.now() - FX.t0, life = FX.stay ? 1e12 : 1900;
    if (e > life) return;
    const a = e < life - 400 ? 1 : 1 - (e - (life - 400)) / 400, pop = e < 220 ? 0.4 + 0.6 * U.smooth(0, 220, e) * 1.15 : 1 + 0.03 * Math.sin(e / 90);
    g.save(); g.globalAlpha = a; g.translate(W / 2, H / 2);
    if (FX.stay && !FX.perfect) { g.fillStyle = 'rgba(20,14,10,0.55)'; g.fillRect(-W / 2 - OX, -H / 2 - OY, VW, VH); }
    if (FX.perfect) {
      g.save(); g.rotate(e / 1500);
      for (let k = 0; k < 16; k++) {
        g.rotate(Math.PI / 8); g.fillStyle = k % 2 ? 'rgba(255,215,90,0.35)' : 'rgba(255,240,180,0.25)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -Math.max(W, H)); g.lineTo(22, -Math.max(W, H)); g.closePath(); g.fill();
      }
      g.restore();
      const ee = Math.min(e, 1500);
      for (let k = 0; k < 24; k++) {
        const ang = k / 24 * Math.PI * 2, r = ee * 0.35;
        g.fillStyle = ['#ffd75a', '#e0412a', '#fff4cc'][k % 3];
        g.beginPath(); g.arc(Math.cos(ang) * r, Math.sin(ang) * r * 0.8, 5 * (1 - ee / 1500) + 1, 0, 7); g.fill();
      }
    }
    g.scale(pop, pop);
    const size = Math.min(W, H) * (FX.text.length > 8 ? 0.11 : 0.15);
    g.font = `800 ${size}px ${R.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = 'rgba(36,32,29,0.92)'; g.strokeText(FX.text, 0, 0);
    g.fillStyle = FX.color; g.fillText(FX.text, 0, 0);
    if (FX.sub) {
      const s2 = Math.max(16, size * 0.3);
      g.font = `700 ${s2}px ${R.FONT}`; g.lineWidth = s2 * 0.3; g.strokeText(FX.sub, 0, size * 0.8);
      g.fillStyle = '#fff'; g.fillText(FX.sub, 0, size * 0.8);
    }
    g.restore();
  }

  /* ───────── 一図の流れ ───────── */
  const P = {
    phase: 'intro', expect: 0, picked: [], order: [], rubs: [], goal: null, base: null, current: -1,
    cov: null, full: null, tmp: null, covCv: null, dirty: true, last: null, hover: null, started: false, finalCv: null, timer: 0,
  };
  const RUB_R = 42, RUB_K = 0.021;
  const covMean = () => { let s = 0; for (const v of P.cov) s += Math.min(1, v); return s / P.cov.length; };
  function newState(d) {
    return { blocks: [{ kind: 'key', name: '主版（墨線）' }].concat(d.regions.map(r => ({ kind: 'color', region: r, name: r.name }))), results: [], carve: [], strokes: [] };
  }
  function idealState(d) {
    const st = newState(d), dm = R.dims(d);
    st.results = st.blocks.map(() => ({ amount: 0.5, dx: 0, dy: 0, cov: new Float32Array(dm.GW * dm.GH).fill(1.2) }));
    return st;
  }
  /* 摺った版だけを描いた紙 */
  function renderPicked(S, extra = -1) {
    const st = G.st, saved = st.results;
    st.results = saved.map((r, i) => (P.picked.includes(i) || i === extra) ? r : undefined);
    const c = R.render(G.design, st, { S });
    st.results = saved;
    return c;
  }
  /* 版木カード：彫り下げた所は暗く、浮き出た版の形は明るい木の縁と影で立体的に */
  function thumbs(d, st) {
    if (d._thumbs) return d._thumbs;
    d._thumbs = st.blocks.map(b => {
      const c = U.canvas(W * 0.8, H * 0.8), g = c.getContext('2d'), cw = c.width, ch = c.height;
      g.fillStyle = '#2e1d10'; g.fillRect(0, 0, cw, ch);
      g.globalAlpha = 0.25; g.drawImage(texWood, 0, 0, cw, ch); g.globalAlpha = 1;
      const label = b.kind === 'key' ? d.raster.keyLabel : b.region.label;
      g.drawImage(R.silhouette(d, label, '#0d0703'), 2.5, 3, cw, ch);                 // 影
      const rim = R.silhouette(d, label, '#f3dfb8');                                    // 明るい木の縁
      [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6], [-1.1, -1.1], [1.1, 1.1], [1.1, -1.1], [-1.1, 1.1]].forEach(([x, y]) => g.drawImage(rim, x, y, cw, ch));
      g.drawImage(R.plate(d, label), 0, 0, cw, ch);                                      // 版の色
      g.strokeStyle = '#5a381f'; g.lineWidth = 4; g.strokeRect(2, 2, cw - 4, ch - 4);
      return c.toDataURL('image/jpeg', 0.88);
    });
    return d._thumbs;
  }


  async function startStage(i) {
    setPicking(false);
    clearTimeout(P.timer); FX.t0 = -1e9; FX.stay = false;
    G.idx = i; pref(PREF, String(i));
    const d = STAGES[i];
    show('screen-work'); G.playing = false;
    panel.innerHTML = '<p class="howto">版木を用意しています…</p>';
    try { await R.loadRaster(d); }
    catch (e) {
      d._rs = null;
      panel.innerHTML = '<p class="howto">版木の読み込みに失敗しました。GitHub Pages などのWebサーバー経由で開いてください。</p><div class="controls"><button class="btn" id="b-title">タイトルへ</button></div>';
      $('#b-title').onclick = toTitle; return;
    }
    G.design = d; setDims(d);
    G.st = newState(d);
    Object.assign(P, { phase: 'intro', expect: 0, picked: [], rubs: [], hover: null, finalCv: null, current: -1, view: 0 });
    P.order = G.st.blocks.map((_, k) => k).sort(() => Math.random() - 0.5);
    if (P.order[0] === 0) P.order.push(P.order.shift());   // 主版がいつも左端にならないように
    P.goal = R.render(d, idealState(d), { S: 1.5 });
    P.base = renderPicked(1);
    stageBar(); G.playing = true;
    Sfx.play('paper');
    panel.innerHTML = `<div class="role"><span class="role-seal">${G.idx + 1}</span>第${G.idx + 1}図　${d.genre}</div>
      <h2>${d.title}<span class="yomi">${d.artist}${d.series ? '『' + d.series + '』' : ''}</span></h2>
      <p class="howto">お手本をよく見よう。この浮世絵は <b>${G.st.blocks.length}枚の版</b>を摺り重ねてできています。</p>
      <div class="controls"><button class="btn primary big" id="b-go">摺りはじめる</button></div>`;
    $('#b-go').onclick = toPick;
    P.timer = setTimeout(toPick, 4000);
  }
  function toPick() {
    clearTimeout(P.timer);
    if (P.phase !== 'intro') return;
    P.phase = 'pick'; panelPick();
  }
  function setPicking(on) { if (document.body.classList.contains('picking') !== on) { document.body.classList.toggle('picking', on); requestAnimationFrame(resize); } }
  function candidates() { return P.order.filter(k => !P.picked.includes(k)); }
  function panelPick() {
    const st = G.st, th = thumbs(G.design, st), n = st.blocks.length, cs = candidates();
    setPicking(true);
    P.view = U.clamp(P.view || 0, 0, cs.length - 1);
    const k = cs[P.view];
    panel.innerHTML = `<p class="howto">第<b>${P.picked.length + 1}</b>版 / 全${n}版：<b>次に摺る版</b>はどれ？<br><small>主版（墨の線）が最初。色は薄い色→濃い色の順。</small></p>
      <div class="cand">
        <button class="cand-nav" id="b-prev" aria-label="前の版" ${cs.length < 2 ? 'disabled' : ''}>◀</button>
        <div class="cand-card" id="cand"><img src="${th[k]}" alt="版木"><span>${P.view + 1} / ${cs.length}</span></div>
        <button class="cand-nav" id="b-next2" aria-label="次の版" ${cs.length < 2 ? 'disabled' : ''}>▶</button>
      </div>
      <div class="cand-dots">${cs.map((_, i) => `<i class="${i === P.view ? 'on' : ''}"></i>`).join('')}</div>
      <div class="controls"><button class="btn primary big" id="b-pick">この版を摺る</button></div>`;
    const flip = dir => { if (cs.length < 2) return; P.view = (P.view + dir + cs.length) % cs.length; Sfx.play('paper'); panelPick(); };
    $('#b-prev').onclick = () => flip(-1);
    $('#b-next2').onclick = () => flip(1);
    $('#b-pick').onclick = () => pickBlock(cs[P.view]);
    const card = $('#cand'); let sx = null;
    card.addEventListener('pointerdown', e => { sx = e.clientX; });
    card.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 30) flip(dx < 0 ? 1 : -1); });
    P.flip = flip;
  }
  function pickBlock(k) {
    if (P.phase !== 'pick' || P.picked.includes(k)) return;
    Sfx.play('tap'); setPicking(false);
    G.st.results[k] = { amount: 0.5, dx: 0, dy: 0, cov: new Float32Array(GW * GH).fill(1.2) };
    P.full = renderPicked(1, k);
    P.current = k;
    P.cov = new Float32Array(GW * GH); P.started = false; P.last = null; P.dirty = true;
    P.tmp = U.canvas(P.full.width, P.full.height); P.covCv = U.canvas(GW, GH);
    P.phase = 'rub';
    panel.innerHTML = `<div class="role"><span class="role-seal">摺</span>${G.design.title}</div>
      <p class="howto">ばれんで紙を<b>まんべんなくこすって</b>摺ろう。</p>
      <div class="meter"><div class="meter-fill" id="sr-fill"></div><span id="sr-txt"></span></div>
      <div class="controls"><button class="btn ghost" id="b-fin">摺り上げる</button></div>`;
    $('#b-fin').onclick = finishRub;
  }
  function finishRub() {
    if (P.phase !== 'rub') return;
    Sfx.rubStop();
    const st = G.st, k = P.current, mean = covMean();
    st.results[k].cov = P.cov;
    P.picked.push(k); P.rubs.push(mean);
    P.base = renderPicked(1);
    Sfx.play('paper');
    if (k !== P.expect) { gameOver(); return; }
    P.expect++;
    Sfx.play('good'); toast(mean >= 0.97 ? '正解！ ムラなく摺れた' : '正解！', 'good');
    if (P.picked.length >= st.blocks.length) { stageClear(); return; }
    P.phase = 'pick'; P.view = 0; panelPick();
  }
  function stageClear() {
    P.phase = 'clear';
    const even = P.rubs.reduce((a, v) => a + v, 0) / P.rubs.length, perfect = P.rubs.every(v => v >= 0.97);
    const score = perfect ? 100 : Math.round(60 + 40 * U.clamp((even - 0.5) / 0.47, 0, 1));
    G.total += score; stageBar();
    fx(perfect ? 'PERFECT!' : 'CLEAR!', perfect ? `見事！ ${score}点` : `${score}点　ムラなく摺れば満点`, perfect);
    Sfx.play('fanfare');
    P.finalCv = R.render(G.design, G.st, { S: 2 });
    saveGallery(score);
    const last = G.idx + 1 >= STAGES.length;
    panel.innerHTML = `<div class="role"><span class="role-seal">完</span>第${G.idx + 1}図 クリア</div>
      <h2>${G.design.title}<span class="yomi">${G.design.artist}</span></h2>
      <p class="howto">摺り上がり！ <b>${score}点</b>　${last ? '' : 'まもなく次の浮世絵へ…'}</p>
      <div class="controls"><button class="btn primary big" id="b-next">${last ? '結果を見る' : '次の浮世絵へ'}</button></div>
      <p class="note desc">${G.design.credit}</p>`;
    $('#b-next').onclick = nextStage;
    P.timer = setTimeout(nextStage, 4200);
  }
  function nextStage() {
    clearTimeout(P.timer);
    if (P.phase !== 'clear') return;
    if (G.idx + 1 >= STAGES.length) ending(); else startStage(G.idx + 1);
  }
  function gameOver() {
    P.phase = 'over'; clearTimeout(P.timer);
    fx('GAME OVER', '版の順番がちがう！', false, '#ff8a6a', true);
    Sfx.play('bad');
    const th = thumbs(G.design, G.st);
    panel.innerHTML = `<div class="role"><span class="role-seal">終</span>${G.design.title}</div>
      <p class="howto">版の順番がちがいました。正しい順番は：</p>
      <div class="blocks answer">${G.st.blocks.map((b, k) => `<div class="blockcard"><img src="${th[k]}" alt=""><span>${k + 1}番目</span></div>`).join('')}</div>
      <div class="controls"><button class="btn primary big" id="b-retry">この図からやり直す</button></div>
      <div class="controls"><button class="btn" id="b-title">タイトルへ</button></div>`;
    $('#b-retry').onclick = () => startStage(G.idx);
    $('#b-title').onclick = toTitle;
  }
  function ending() {
    P.phase = 'end'; pref(PREF, '0');
    fx('免許皆伝', `全${STAGES.length}図 摺り上がり　総得点 ${G.total}点`, true, '#ffd75a', true);
    panel.innerHTML = `<div class="role"><span class="role-seal">極</span>全図クリア</div>
      <h2>全${STAGES.length}図 摺り上がり</h2>
      <p class="howto">総得点 <b>${G.total}</b> 点。見事な摺師の腕前です。</p>
      <div class="controls"><button class="btn primary big" id="b-again">最初から遊ぶ</button></div>
      <div class="controls"><button class="btn" id="b-gal">画廊を見る</button><button class="btn" id="b-title">タイトルへ</button></div>`;
    $('#b-again').onclick = () => { G.total = 0; startStage(0); };
    $('#b-gal').onclick = showGallery;
    $('#b-title').onclick = toTitle;
  }

  /* ───────── 描画 ───────── */
  function drawGoal(g, big) {
    if (!P.goal) return;
    g.save(); g.textBaseline = 'middle'; g.textAlign = 'left';
    if (big) {
      g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 16; g.shadowOffsetY = 5;
      g.drawImage(P.goal, PAPER.x, PAPER.y, PAPER.w, PAPER.h); g.shadowColor = 'transparent';
      g.fillStyle = '#c8442f'; g.fillRect(PAPER.x, PAPER.y, 86, 26);
      g.fillStyle = '#fff'; g.font = `700 15px ${R.FONT}`; g.fillText('お手本', PAPER.x + 12, PAPER.y + 13);
    } else {
      const gw = W * 0.36, gh = gw * P.goal.height / P.goal.width, gx = W - gw - 4, gy = 4;
      g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 10; g.drawImage(P.goal, gx, gy, gw, gh); g.shadowColor = 'transparent';
      g.strokeStyle = '#c8442f'; g.lineWidth = 2.5; g.strokeRect(gx, gy, gw, gh);
      g.fillStyle = '#c8442f'; g.fillRect(gx, gy + gh, 60, 18);
      g.fillStyle = '#fff'; g.font = `700 12px ${R.FONT}`; g.fillText('お手本', gx + 8, gy + gh + 9);
    }
    g.restore();
  }
  function drawPlay(g) {
    bgWood(g);
    if (P.phase === 'intro') { drawGoal(g, true); return; }
    if (P.phase === 'pick') {
      drawGoal(g, true);
      if (P.picked.length) {
        const iw = W * 0.34, ih = iw * P.base.height / P.base.width, ix = W - iw - 2, iy = H - ih - 2;
        g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 10; g.drawImage(P.base, ix, iy, iw, ih); g.restore();
        g.strokeStyle = '#2b2622'; g.lineWidth = 2; g.strokeRect(ix, iy, iw, ih);
        g.fillStyle = 'rgba(36,32,29,0.85)'; g.fillRect(ix, iy - 18, 92, 18);
        g.fillStyle = '#fff'; g.font = `700 12px ${R.FONT}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(`いまの摺り（${P.picked.length}版）`, ix + 6, iy - 9);
      }
      return;
    }
    g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.drawImage(P.phase === 'clear' && P.finalCv ? P.finalCv : P.base, PAPER.x, PAPER.y, PAPER.w, PAPER.h); g.restore();
    if (P.phase === 'rub') {
      if (P.dirty) {
        const cg = P.covCv.getContext('2d'), im = cg.createImageData(GW, GH);
        for (let i = 0; i < GW * GH; i++) im.data[i * 4 + 3] = U.smooth(0.15, 0.95, P.cov[i]) * 255;
        cg.putImageData(im, 0, 0);
        const tg = P.tmp.getContext('2d'), s = P.tmp.width / PAPER.w;
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, P.tmp.width, P.tmp.height);
        tg.drawImage(P.full, 0, 0);
        tg.globalCompositeOperation = 'destination-in'; tg.imageSmoothingEnabled = true;
        tg.drawImage(P.covCv, M * s, M * s, W * s, H * s);
        P.dirty = false;
      }
      g.drawImage(P.tmp, PAPER.x, PAPER.y, PAPER.w, PAPER.h);
      const h = P.hover;
      if (h) {
        const gr = g.createRadialGradient(h.x - 8, h.y - 8, 4, h.x, h.y, RUB_R);
        gr.addColorStop(0, 'rgba(150,110,65,0.85)'); gr.addColorStop(1, 'rgba(70,45,25,0.85)');
        g.fillStyle = gr; g.beginPath(); g.arc(h.x, h.y, RUB_R, 0, 7); g.fill();
        g.strokeStyle = 'rgba(40,25,10,0.6)'; g.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(h.x, h.y, RUB_R * (0.25 + k * 0.2), k, k + 4); g.stroke(); }
      } else if (!P.started) {
        g.save(); g.fillStyle = 'rgba(36,32,29,0.8)'; g.fillRect(W / 2 - 120, H / 2 - 18, 240, 36);
        g.fillStyle = '#fff'; g.font = `700 15px ${R.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('紙をこすって摺ろう', W / 2, H / 2); g.restore();
      }
      const m = covMean(), f = $('#sr-fill'), t = $('#sr-txt');
      if (f) { f.style.width = Math.min(100, m * 100) + '%'; t.textContent = `摺れ具合 ${Math.round(m * 100)}%`; }
    }
  }

  /* ───────── 入力 ───────── */
  function pt(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * VW - OX, y: (e.clientY - r.top) / r.height * VH - OY, t: e.timeStamp };
  }
  let pDown = false;
  function rubTo(p) {
    const L = U.dist(p, P.last), n = Math.max(1, Math.ceil(L / 4)), step = L / n;
    if (L > 0.5) Sfx.rubSpeed(L / Math.max(1, p.t - P.last.t));
    for (let k = 1; k <= n; k++) {
      const x = U.lerp(P.last.x, p.x, k / n), y = U.lerp(P.last.y, p.y, k / n);
      const gx0 = Math.max(0, Math.floor((x - RUB_R) / CELL)), gx1 = Math.min(GW - 1, Math.floor((x + RUB_R) / CELL));
      const gy0 = Math.max(0, Math.floor((y - RUB_R) / CELL)), gy1 = Math.min(GH - 1, Math.floor((y + RUB_R) / CELL));
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const dd = Math.hypot(gx * CELL + 4 - x, gy * CELL + 4 - y) / RUB_R;
        if (dd < 1) { const i = gy * GW + gx; P.cov[i] = Math.min(1.3, P.cov[i] + RUB_K * step * (1 - dd * dd)); }
      }
    }
    P.last = p; P.dirty = true;
    if (covMean() >= 0.985) finishRub();
  }
  cv.addEventListener('pointerdown', e => {
    Sfx.init(); e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    pDown = true;
    const p = pt(e);
    if (P.phase === 'intro') toPick();
    else if (P.phase === 'rub') { P.last = p; P.started = true; P.hover = p; Sfx.rubStart(); }
  });
  cv.addEventListener('pointermove', e => {
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = pt(ev); P.hover = p;
      if (pDown && P.phase === 'rub' && P.last) rubTo(p);
    }
  });
  const endP = () => {
    if (!pDown) return; pDown = false; P.last = null; Sfx.rubStop();
    if (P.phase === 'rub' && P.started && covMean() >= 0.93) finishRub();
  };
  cv.addEventListener('pointerup', endP);
  cv.addEventListener('pointercancel', endP);
  cv.addEventListener('pointerleave', () => { P.hover = null; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (P.phase !== 'pick' || !G.playing) return;
    if (e.code === 'ArrowLeft') P.flip && P.flip(-1);
    if (e.code === 'ArrowRight') P.flip && P.flip(1);
    if (e.code === 'Enter') pickBlock(candidates()[P.view]);
  });

  function loop() {
    requestAnimationFrame(loop);
    if (!G.playing || document.body.dataset.screen !== 'screen-work') return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.clearRect(0, 0, VW, VH);
    ctx.translate(OX, OY);
    drawPlay(ctx);
    drawFx(ctx);
  }

  /* ───────── 画廊 ───────── */
  const GKEY = 'ukiyoe-shokunin-gallery';
  function loadGallery() { try { return JSON.parse(localStorage.getItem(GKEY) || '[]'); } catch (e) { return []; } }
  function saveGallery(score) {
    if (!P.finalCv) return false;
    const w = 360, h = Math.round(w * P.finalCv.height / P.finalCv.width);
    const c = U.canvas(w, h); c.getContext('2d').drawImage(P.finalCv, 0, 0, w, h);
    const item = { id: Date.now(), title: G.design.title, artist: G.design.artist, score, date: new Date().toLocaleDateString('ja-JP'), img: c.toDataURL('image/jpeg', 0.82) };
    const list = loadGallery(); list.unshift(item);
    while (list.length) {
      try { localStorage.setItem(GKEY, JSON.stringify(list.slice(0, 24))); return true; }
      catch (e) { if (list.length <= 1) return false; list.pop(); }
    }
    return false;
  }
  function showGallery() {
    clearTimeout(P.timer);
    const list = loadGallery(), box = $('#gallery-list');
    box.innerHTML = list.length ? list.map(it => `<figure data-id="${it.id}"><img src="${it.img}" alt="${esc(it.title)}">
      <figcaption><b>${esc(it.title)}</b>${esc(it.artist || '')}<br><small>${it.score}点・${esc(it.date)}</small>
      <button class="del" data-del="${it.id}" aria-label="削除">✕</button></figcaption></figure>`).join('')
      : '<p class="empty">まだ作品がありません。浮世絵を摺り上げると、ここに飾られます。</p>';
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      if (!confirm('この作品を画廊から外しますか？')) return;
      localStorage.setItem(GKEY, JSON.stringify(loadGallery().filter(x => String(x.id) !== b.dataset.del))); showGallery();
    });
    box.querySelectorAll('figure').forEach(f => f.onclick = () => {
      const it = list.find(x => String(x.id) === f.dataset.id);
      $('#viewer img').src = it.img; $('#viewer').classList.add('open');
    });
    G.playing = false; show('screen-gallery');
  }
  $('#viewer').onclick = () => $('#viewer').classList.remove('open');

  /* ───────── タイトル ───────── */
  function toTitle() {
    clearTimeout(P.timer); FX.t0 = -1e9; FX.stay = false; G.playing = false; G.design = null; stageBar();
    const saved = +(pref(PREF) || 0), cont = $('#btn-continue');
    cont.hidden = !(saved > 0 && saved < STAGES.length);
    cont.textContent = `つづきから（第${saved + 1}図）`;
    show('screen-title');
  }
  $('#btn-start').onclick = () => { Sfx.init(); G.total = 0; startStage(0); };
  $('#btn-continue').onclick = () => { Sfx.init(); G.total = 0; startStage(+(pref(PREF) || 0)); };
  $('#btn-home').onclick = () => { if (G.playing && ['pick', 'rub'].includes(P.phase) && !confirm('タイトルに戻りますか？')) return; toTitle(); };
  $('#btn-gallery').onclick = () => { if (G.playing && ['pick', 'rub'].includes(P.phase) && !confirm('中断して画廊へ移動しますか？')) return; showGallery(); };
  $('#btn-gallery-back').onclick = toTitle;

  /* ───────── 音 ───────── */
  Sfx.on = pref('ukiyoe-sfx') !== '0'; Sfx.bgmOn = pref('ukiyoe-bgm') !== '0';
  const syncAudioBtns = () => { $('#btn-sound').setAttribute('aria-pressed', Sfx.on); $('#btn-bgm').setAttribute('aria-pressed', Sfx.bgmOn); };
  syncAudioBtns();
  $('#btn-sound').onclick = () => { Sfx.on = !Sfx.on; pref('ukiyoe-sfx', Sfx.on ? '1' : '0'); syncAudioBtns(); Sfx.play('tap'); };
  $('#btn-bgm').onclick = () => { Sfx.setBgm(!Sfx.bgmOn); pref('ukiyoe-bgm', Sfx.bgmOn ? '1' : '0'); syncAudioBtns(); };
  document.addEventListener('pointerdown', () => Sfx.init(), { once: true });
  document.addEventListener('keydown', () => Sfx.init(), { once: true });

  texWood = R.wood(920, 1320);
  toTitle();
  requestAnimationFrame(loop);

  /* 自動テスト用 */
  G._debug = { P, startStage, pickBlock, finishRub, STAGES };
})();
