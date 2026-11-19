// 使い方: Web サーバーで index.html を開ける状態にして node tools/orders.js（Playwright が必要）
// 結果は orders.json に出力。js/meisaku.js の orders（先頭は tools/layers.py の摺師の順番）に反映する
// ゲームの描画エンジンで、主版が最初のすべての順番を実際に摺って完成図と比べ、正しい順番を決める
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(800);
  const n = await p.evaluate(() => window.UKIYOE._debug.STAGES.length);
  const out = {};
  for (let i = 0; i < n; i++) {
    await p.evaluate((i) => window.UKIYOE._debug.startStage(i), i); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const G = window.UKIYOE, d = G.design, st = G.st, nb = st.blocks.length, dm = R.dims(d);
      st.results = st.blocks.map(() => ({ amount: 0.5, dx: 0, dy: 0, cov: new Float32Array(dm.GW * dm.GH).fill(1.2) }));
      const lab = k => (k === 0 ? 1 : st.blocks[k].region.label), idx = l => (l === 1 ? 0 : st.blocks.findIndex(b => b.region && b.region.label === l));
      const px = order => { const c = R.render(d, st, { S: 0.5, order }); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
      const diff = (a, b) => { let n = 0; for (let k = 0; k < a.length; k += 4) if (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]) > 30) n++; return n / (a.length / 4) * 100; };
      const best = d.orders[0].map(idx);           // 摺師の順番（主版→淡い色→濃い色。tools/layers.py）
      const ref = px(best);
      const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(q => [x, ...q]));
      const res = perms([...Array(nb).keys()]).filter(o => o[0] === 0).map(o => ({ o: o.map(lab), c: diff(px(o), ref) }));
      const ok = res.filter(x => x.c < 1.0), bad = res.filter(x => x.c >= 1.0);
      return { id: d.id, orders: ok.map(x => x.o), okMax: Math.max(...ok.map(x => x.c)), badMin: bad.length ? Math.min(...bad.map(x => x.c)) : null };
    });
    out[r.id] = r;
    console.log(`${String(i + 1).padStart(2)} ${r.id.padEnd(13)} 正解${String(r.orders.length).padStart(2)}通り(変化最大${r.okMax.toFixed(2)}%) まちがいの変化最小${r.badMin == null ? '-' : r.badMin.toFixed(2)}%`);
  }
  fs.writeFileSync('orders.json', JSON.stringify(out));
  await b.close();
})();
