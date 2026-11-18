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
  const G = { idx: 0, design: null, st: null, total: 0, combo: 0, retries: 0, playing: false };
  // Android アプリ（Capacitor）で動いているか。Web 版では Capacitor がないので何もしない
  const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const plugin = name => (NATIVE && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : null);
  const MAX_RETRIES = 5;   // 広告を見て版をやり直せる回数（1ゲーム）
  // 全画面広告を出してから次へ進む（プレイ開始・タイトルへ戻る・再開・次の図へ のたびに毎回）
  const withAd = fn => () => Ads.showInterstitial().then(fn);
  const PICK_SEC = 15, HIKEY = 'ukiyoe-shokunin-best';
  window.UKIYOE = G; // @web-only
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
  // パネルの中身が変わって盤面の大きさが変わった時も描き直す
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(cv.parentElement);
  function show(id) {
    if (id !== 'screen-work') { const pz = document.getElementById('pause'); if (pz) pz.hidden = true; }
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
    $('#stagebar').innerHTML = G.design ? `<b>第${G.idx + 1}図</b> / 全${STAGES.length}図<span>得点 ${G.total}</span>${G.combo > 1 ? `<em>${G.combo}連続</em>` : ''}` : '';
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
  let RUB_R = 90; const RUB_K = 0.04;   // 大きなばれんで、ひとなでで色が移る
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
    const order = extra >= 0 ? P.picked.concat(extra) : P.picked;   // 摺った順番に重ねる
    const c = R.render(G.design, st, { S, order });
    st.results = saved;
    return c;
  }
  /* 摺る順番の判定：版を摺ると、前に摺った色を上書きする。すべての順番を実際に摺ってみて
     完成図と見た目が変わらない順番（orders。tools/layers.py で求めたもの）だけが正解。
     いま選んだ版で、まだ正解の順番のどれかに進めるなら摺れる */
  const labelOf = k => (k === 0 ? 1 : G.st.blocks[k].region.label);
  function canPrint(k, picked = P.picked) {
    if (picked.includes(k)) return false;
    const seq = picked.concat(k).map(labelOf);
    return (G.design.orders || []).some(o => seq.every((l, n) => o[n] === l));
  }
  const nextValid = () => G.st.blocks.findIndex((_, k) => canPrint(k));
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
    RUB_R = Math.round(Math.max(W, H) * 0.17);
    G.st = newState(d);
    Object.assign(P, { phase: 'intro', expect: 0, picked: [], rubs: [], hover: null, finalCv: null, current: -1, view: 0, pickFor: -1, bonusSum: 0, layers: {} });
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
    P.expect = nextValid();
    P.phase = 'pick'; panelPick();
  }
  function setPicking(on) { if (document.body.classList.contains('picking') !== on) { document.body.classList.toggle('picking', on); requestAnimationFrame(resize); } }
  function candidates() { return P.order.filter(k => !P.picked.includes(k)); }
  function panelPick() {
    const st = G.st, th = thumbs(G.design, st), n = st.blocks.length, cs = candidates();
    setPicking(true);
    P.view = U.clamp(P.view || 0, 0, cs.length - 1);
    const k = cs[P.view];
    if (P.pickFor !== P.picked.length) { P.pickFor = P.picked.length; P.pickT0 = performance.now(); }
    P.preview = k;
    panel.innerHTML = `<p class="howto">第<b>${P.picked.length + 1}</b>版 / 全${n}版：<b>次に摺る版</b>はどれ？<br><small>めくると、摺った時の色が紙にうっすら映ります。版を摺ると前の色を上書きします。完成図になる順番は？</small></p>
      <div class="ptime"><div id="pk-time"></div><span id="pk-bonus"></span></div>
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
  const pickLeft = () => Math.max(0, PICK_SEC - (performance.now() - P.pickT0) / 1000);
  function pickBlock(k) {
    if (P.phase !== 'pick' || P.picked.includes(k)) return;
    P.pickBonus = Math.round(50 * pickLeft() / PICK_SEC);
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
    $('#b-fin').onclick = () => (covMean() >= 0.6 ? completeRub() : finishRub());
  }
  /* 8割こすれたら残りを一気に摺り切って100%に */
  function completeRub() {
    if (P.phase !== 'rub' || P.completing) return;
    P.completing = true; Sfx.rubStop();
    P.cov.fill(1.2); P.dirty = true;
    setTimeout(() => { P.completing = false; finishRub(); }, 350);
  }
  function finishRub() {
    if (P.phase !== 'rub') return;
    Sfx.rubStop();
    const st = G.st, k = P.current, mean = covMean();
    st.results[k].cov = P.cov;
    P.picked.push(k); P.rubs.push(mean);
    P.base = renderPicked(1);
    Sfx.play('paper');
    P.picked.pop();
    const ok = canPrint(k);
    P.picked.push(k);
    if (!ok) { gameOver(); return; }
    P.expect = nextValid();
    G.combo++;
    const bonus = Math.round(P.pickBonus * (1 + Math.min(G.combo - 1, 10) * 0.1));
    G.total += bonus; P.bonusSum = (P.bonusSum || 0) + bonus; stageBar();
    Sfx.play('good'); toast(`正解！ ${bonus > 0 ? `早さボーナス +${bonus}` : ''}${G.combo > 1 ? `　${G.combo}連続！` : ''}`, 'good');
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
    P.finalCv = R.render(G.design, G.st, { S: 2, order: P.picked });
    saveGallery(score);
    const last = G.idx + 1 >= STAGES.length;
    panel.innerHTML = `<div class="role"><span class="role-seal">完</span>第${G.idx + 1}図 クリア</div>
      <h2>${G.design.title}<span class="yomi">${G.design.artist}</span></h2>
      <p class="howto">摺り上がり！ <b>${score}点</b>${P.bonusSum ? `＋早さボーナス <b>${P.bonusSum}点</b>` : ''}　${last ? '' : 'まもなく次の浮世絵へ…'}</p>
      <div class="controls"><button class="btn primary big" id="b-next">${last ? '結果を見る' : '次の浮世絵へ'}</button></div>
      <p class="note desc">${G.design.credit}</p>`;
    $('#b-next').onclick = nextStage;
    P.timer = setTimeout(nextStage, 4200);
    if (G.retries) $('#b-next').insertAdjacentHTML('afterend', `<p class="note">やり直し ${G.retries}回</p>`);
  }
  function nextStage() {
    clearTimeout(P.timer);
    if (P.phase !== 'clear' || P.leaving) return;
    if (G.idx + 1 >= STAGES.length) { ending(); return; }
    P.leaving = true;
    Ads.showInterstitial().then(() => { P.leaving = false; startStage(G.idx + 1); });
  }
  function gameOver() {
    P.phase = 'over'; clearTimeout(P.timer); G.combo = 0; stageBar();
    fx('GAME OVER', '版の順番がちがう！', false, '#ff8a6a', true);
    if (G.total > +(pref(HIKEY) || 0)) pref(HIKEY, String(G.total));
    Sfx.play('bad');
    const th = thumbs(G.design, G.st);
    panel.innerHTML = `<div class="role"><span class="role-seal">終</span>${G.design.title}</div>
      <p class="howto">この順番では、あとから摺った版が先の色を上書きして、完成図と違ってしまいます。正しい順番の例：</p>
      <div class="blocks answer">${G.design.orders[0].map(l => (l === 1 ? 0 : G.st.blocks.findIndex(b => b.region && b.region.label === l))).map((k, n) => `<div class="blockcard"><img src="${th[k]}" alt=""><span>${n + 1}番目</span></div>`).join('')}</div>
      <div class="controls"><button class="btn primary big" id="b-retry">この図からやり直す</button></div>
      <div class="controls"><button class="btn" id="b-share">シェア</button><button class="btn" id="b-title">タイトルへ</button></div>`;
    $('#b-retry').onclick = withAd(() => startStage(G.idx));
    $('#b-title').onclick = withAd(toTitle);
    $('#b-share').onclick = () => share(`浮世絵職人で第${G.idx + 1}図「${G.design.title}」まで挑戦！ 得点 ${G.total}点`);
    offerRetry();
  }
  /* リワード広告：順番をまちがえた版を摺る前に戻ってやり直す（1ゲーム5回まで）。
     失敗した摺り上がりを見届けられるよう少し待ってから案内し、数秒で自動的に消す */
  function offerRetry() {
    if (!Ads.rewardAvailable || G.retries >= MAX_RETRIES) return;
    const myPhase = P.timer = setTimeout(() => {
      if (P.phase !== 'over') return;
      const box = document.createElement('div');
      box.className = 'retry-offer';
      box.innerHTML = `<button class="btn primary big" id="b-reward">広告を見て、この版の前からやり直す</button><small>残り ${MAX_RETRIES - G.retries} 回</small>`;
      panel.prepend(box);
      $('#b-reward').onclick = async () => {
        box.remove();
        const r = await Ads.showRewarded();
        if (r === 'rewarded' && P.phase === 'over') undoWrong();
      };
      P.offerTimer = setTimeout(() => box.remove(), 7000);
    }, 2500);
  }
  function undoWrong() {
    clearTimeout(P.timer); clearTimeout(P.offerTimer);
    const k = P.picked.pop(); P.rubs.pop();
    G.st.results[k] = undefined;
    P.base = renderPicked(1);
    FX.t0 = -1e9; FX.stay = false;
    G.retries++;
    P.phase = 'pick'; P.view = 0; P.pickFor = -1;
    toast(`やり直し（${G.retries}回目）`, 'good');
    panelPick();
  }
  /* シェア：アプリでは Android の共有メニュー、Web では共有 API か X（旧 Twitter） */
  async function share(text) {
    const url = NATIVE ? 'https://play.google.com/store/apps/details?id=jp.techgym.ukiyoe' : location.href.split('#')[0];
    const nativeShare = plugin('Share');
    if (nativeShare) { try { await nativeShare.share({ title: '浮世絵職人', text, url, dialogTitle: 'シェア' }); } catch (e) { /* キャンセル */ } }
    else if (navigator.share) { try { await navigator.share({ title: '浮世絵職人', text, url }); } catch (e) { /* キャンセル */ } }
    else window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  }
  function ending() {
    P.phase = 'end'; pref(PREF, '0');
    const best = +(pref(HIKEY) || 0), isBest = G.total > best;
    if (isBest) pref(HIKEY, String(G.total));
    fx('免許皆伝', `全${STAGES.length}図 摺り上がり　総得点 ${G.total}点`, true, '#ffd75a', true);
    panel.innerHTML = `<div class="role"><span class="role-seal">極</span>全図クリア</div>
      <h2>全${STAGES.length}図 摺り上がり</h2>
      <p class="howto">総得点 <b>${G.total}</b> 点。${isBest ? '<b>ハイスコア更新！</b>' : `ハイスコアは ${best} 点。`}</p>
      <div class="controls"><button class="btn primary big" id="b-again">最初から遊ぶ</button></div>
      ${G.retries ? `<p class="note">やり直し ${G.retries}回</p>` : ''}
      <div class="controls"><button class="btn" id="b-share">シェア</button><button class="btn" id="b-gal">画廊を見る</button><button class="btn" id="b-title">タイトルへ</button></div>`;
    $('#b-again').onclick = withAd(() => newGame(0));
    $('#b-gal').onclick = showGallery;
    $('#b-title').onclick = withAd(toTitle);
    $('#b-share').onclick = () => share(`浮世絵職人で全${STAGES.length}図を摺り上げた！ 総得点 ${G.total}点${G.retries ? `（やり直し ${G.retries}回）` : ''}`);
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
    if (P.phase === 'pick') {                                       // 完成図は最初だけ。選ぶ間は摺りかけの紙を見せる
      g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
      g.drawImage(P.base, PAPER.x, PAPER.y, PAPER.w, PAPER.h); g.restore();
      const k = P.preview;
      if (k != null) {                                              // この版を摺るとどうなるか、うっすら映す
        const b = G.st.blocks[k];
        if (!P.layers[k]) P.layers[k] = R.blockContent(G.design, G.st, b, 1);
        g.save(); g.globalAlpha = 0.45 + 0.25 * Math.sin(performance.now() / 260);
        g.drawImage(P.layers[k], 0, 0, W, H); g.restore();
      }
      const left = pickLeft(), f = $('#pk-time'), bt = $('#pk-bonus');
      if (f) { f.style.width = left / PICK_SEC * 100 + '%'; f.classList.toggle('low', left < 5); bt.textContent = left > 0 ? `早さボーナス +${Math.round(50 * left / PICK_SEC)}` : '時間切れ（ボーナスなし）'; }
      const label = P.picked.length ? `いまの摺り（${P.picked.length}版）＋この版` : 'まっさらな紙＋この版';
      g.save(); g.font = `700 14px ${R.FONT}`; const tw = g.measureText(label).width + 20;
      g.fillStyle = 'rgba(36,32,29,0.85)'; g.fillRect(PAPER.x, PAPER.y, tw, 24);
      g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(label, PAPER.x + 10, PAPER.y + 12); g.restore();
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
    if (covMean() >= 0.8) completeRub();
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
    if (P.phase === 'rub' && P.started && covMean() >= 0.6) completeRub();
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
    syncUi();
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
    const best = +(pref(HIKEY) || 0), hb = $('#hiscore'); if (hb) hb.textContent = best ? `ハイスコア ${best}点` : '';
    show('screen-title');
  }
  const newGame = i => { Sfx.init(); G.total = 0; G.combo = 0; G.retries = 0; startStage(i); };
  $('#btn-start').onclick = withAd(() => newGame(0));
  $('#btn-continue').onclick = withAd(() => newGame(+(pref(PREF) || 0)));
  $('#btn-howto').onclick = () => { Sfx.play('tap'); show('screen-howto'); window.scrollTo(0, 0); };
  $('#btn-howto-start').onclick = withAd(() => newGame(+(pref(PREF) || 0) < STAGES.length ? +(pref(PREF) || 0) : 0));
  $('#btn-howto-back').onclick = withAd(toTitle);
  $('#btn-home').onclick = () => { if (G.playing && ['intro', 'pick', 'rub'].includes(P.phase)) { setPaused(true); return; } Ads.showInterstitial().then(toTitle); };
  $('#btn-gallery').onclick = () => { if (G.playing && ['intro', 'pick', 'rub'].includes(P.phase)) { setPaused(true); return; } showGallery(); };
  $('#btn-gallery-back').onclick = toTitle;

  /* ───────── 一時停止・戻るボタン・広告の出る画面 ───────── */
  let pausedAt = 0;
  const inPlay = () => G.playing && document.body.dataset.screen === 'screen-work' && ['intro', 'pick', 'rub'].includes(P.phase);
  function setPaused(on) {
    const box = $('#pause');
    if (on === !box.hidden) return;
    if (on) {
      if (!inPlay()) return;
      box.hidden = false; pausedAt = performance.now(); pDown = false; Sfx.rubStop();
      if (P.phase === 'intro') clearTimeout(P.timer);
    } else {
      box.hidden = true;
      if (P.phase === 'pick') P.pickT0 += performance.now() - pausedAt;   // 止めていた間は時間ゲージを進めない
      if (P.phase === 'intro') P.timer = setTimeout(toPick, 3000);
    }
    syncUi();
  }
  $('#btn-pause').onclick = () => setPaused(true);
  $('#btn-resume').onclick = withAd(() => setPaused(false));
  $('#btn-pause-title').onclick = withAd(() => { $('#pause').hidden = true; toTitle(); });
  // アプリが裏に回ったら一時停止して音を止める
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { setPaused(true); Sfx.suspend(); }
    else Sfx.resume();
  });
  // Android の戻るボタン：プレイ中は一時停止、一時停止中は再開、遊び方・画廊はタイトルへ、タイトル・結果画面ではアプリを閉じる
  if (plugin('App')) {
    plugin('App').addListener('backButton', () => {
      const scr = document.body.dataset.screen;
      if (!$('#pause').hidden) withAd(() => setPaused(false))();
      else if (inPlay()) setPaused(true);
      else if (scr === 'screen-howto') withAd(toTitle)();
      else if (scr === 'screen-gallery') toTitle();
      else if ($('#viewer').classList.contains('open')) $('#viewer').classList.remove('open');
      else plugin('App').exitApp();
    });
  }
  // バナーはタイトル・遊び方・画廊・一時停止・結果の画面だけ（プレイ中は出さない）
  function syncUi() {
    const play = inPlay() && $('#pause').hidden;
    const result = document.body.dataset.screen === 'screen-work' && ['clear', 'over', 'end'].includes(P.phase);
    document.body.classList.toggle('playing', play);
    document.body.classList.toggle('is-result', result);
    Ads.setBanner(!play);
  }
  // タイトル画面：ビルド番号（アプリのみ）と、EU など同意が必要な地域での「広告の設定」
  if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('#buildInfo').textContent = window.APP_VERSION;
  Ads.initDone.then(() => { if (Ads.privacyOptionsRequired) $('#adPrivacy').hidden = false; });
  $('#adPrivacyLink').onclick = e => { e.preventDefault(); Ads.showPrivacyOptions(); };

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
  G._debug = { P, startStage, pickBlock, finishRub, STAGES, setPaused, undoWrong }; // @web-only
})();
