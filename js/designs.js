'use strict';
/* 顔料（絵の具）と画題データ。座標は画面 400 x 600 */
const PIG = {
  sumi:     { name: '墨',       hex: '#24201d' },
  ai:       { name: 'ベロ藍',   hex: '#1f3a68' },
  usuai:    { name: '薄藍',     hex: '#8aaecb' },
  beni:     { name: '紅',       hex: '#c33b3f' },
  momo:     { name: '桃',       hex: '#efb3b6' },
  shu:      { name: '朱',       hex: '#d6502c' },
  ki:       { name: '山吹',     hex: '#e8b02c' },
  usuki:    { name: '薄黄',     hex: '#f3e0a0' },
  kusa:     { name: '草',       hex: '#6f8a3e' },
  moegi:    { name: '萌黄',     hex: '#b7c467' },
  cha:      { name: '代赭',     hex: '#6e4a32' },
  nezumi:   { name: '鼠',       hex: '#8f8b86' },
  murasaki: { name: '紫',       hex: '#6a4c86' },
  gofun:    { name: '胡粉',     hex: '#fbf7ee' },
};

const DESIGNS = (() => {
  /* 桜の花（五弁） */
  const sakura = (cx, cy, R, rot = 0) => {
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const th = i / 90 * Math.PI * 2;
      const s = Math.abs(Math.cos(2.5 * (th - rot)));
      let r = R * (0.5 + 0.5 * Math.pow(s, 0.7));
      r *= 1 - 0.17 * Math.pow(s, 30);
      pts.push([cx + r * Math.cos(th), cy + r * Math.sin(th)]);
    }
    return U.poly(pts);
  };
  /* 蓮の葉（切れ込み付きの楕円） */
  const pad = (cx, cy, rx, ry, na) => {
    const pts = [[cx, cy]];
    const gap = 0.2;
    for (let i = 0; i <= 64; i++) {
      const a = na + gap + (Math.PI * 2 - 2 * gap) * i / 64;
      pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return U.poly(pts);
  };
  const veins = (cx, cy, rx, ry, na) => {
    const out = [];
    for (let k = 1; k < 7; k++) {
      const a = na + k * Math.PI * 2 / 7;
      out.push(`M${cx} ${cy} L${(cx + rx * 0.85 * Math.cos(a)).toFixed(1)} ${(cy + ry * 0.85 * Math.sin(a)).toFixed(1)}`);
    }
    return out;
  };
  const petal = (bx, by, deg, L, w) => {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const P = (l, s) => `${(bx + dx * l + px * s).toFixed(1)} ${(by + dy * l + py * s).toFixed(1)}`;
    return `M${bx} ${by} C${P(L * 0.3, w)} ${P(L * 0.8, w * 0.6)} ${P(L, 0)} C${P(L * 0.8, -w * 0.6)} ${P(L * 0.3, -w)} ${bx} ${by} Z`;
  };

  /* ───────── 壱：月下夜桜 ───────── */
  const flowers = [[28, 98, 11], [70, 128, 12], [95, 170, 10], [135, 182, 11], [118, 140, 9], [160, 128, 12],
    [196, 108, 11], [178, 238, 12], [214, 262, 10], [244, 282, 12], [205, 300, 9], [150, 212, 9], [228, 236, 8], [266, 302, 9], [40, 140, 8]];
  const falling = [[300, 330, 4.5], [332, 392, 4], [262, 420, 4.5], [356, 300, 3.5], [120, 330, 4], [80, 402, 4.5], [180, 380, 3.5]];
  const flowerPaths = flowers.map(([x, y, r], i) => sakura(x, y, r, i * 0.7));
  const fallPaths = falling.map(([x, y, r], i) => sakura(x, y, r, i));
  const yozakura = {
    id: 'yozakura', title: '月下夜桜', yomi: 'げっかよざくら', level: 1,
    desc: '朧月夜に枝を伸ばす山桜。ぼかし摺りの夜空が見どころ。',
    cartouche: { x: 352, y: 20 }, sign: { x: 372, y: 456 },
    lines: [
      { name: '枝（上）', d: 'M0 95 C 60 110, 110 150, 150 205 C 175 240, 205 270, 250 290' },
      { name: '枝（下）', d: 'M252 298 C 200 285, 165 255, 140 222 C 105 175, 55 140, 0 130' },
      { name: '小枝（上）', d: 'M110 160 C 130 146, 165 118, 205 110' },
      { name: '小枝（下）', d: 'M206 118 C 170 126, 142 152, 124 172' },
      { name: '月', d: 'M335 165 A60 60 0 1 0 215 165 A60 60 0 1 0 335 165' },
      { name: '遠山', d: 'M0 440 C 70 410, 130 425, 190 445 C 260 420, 340 418, 400 440' },
      { name: '川岸', d: 'M0 472 C 100 458, 300 486, 400 466' },
      { name: '水紋一', d: 'M40 515 C 80 507, 120 520, 165 511' },
      { name: '水紋二', d: 'M215 545 C 255 536, 300 550, 355 540' },
      { name: '水紋三', d: 'M80 578 C 125 569, 170 582, 215 573' },
    ],
    auto: [...flowerPaths, ...fallPaths, 'M248 492 L 302 492', 'M256 502 L 294 502', 'M264 512 L 286 512',
      'M60 112 L 52 100', 'M178 150 L 186 138', 'M226 276 L 236 266'],
    regions: [
      { id: 'sky', name: '夜空', d: 'M0 0 H400 V600 H0 Z', color: 'ai', z: 1, bokashi: { x0: 0, y0: 0, x1: 0, y1: 430, a0: 1, a1: 0.06 } },
      { id: 'moon', name: '月', d: U.circle(275, 165, 60), color: 'usuki', z: 2 },
      { id: 'hills', name: '遠山', d: 'M0 440 C 70 410, 130 425, 190 445 C 260 420, 340 418, 400 440 L400 600 L0 600 Z', color: 'murasaki', z: 3 },
      { id: 'water', name: '川面', d: 'M0 472 C 100 458, 300 486, 400 466 L400 600 L0 600 Z', color: 'usuai', z: 4 },
      { id: 'branch', name: '枝', d: 'M0 95 C 60 110, 110 150, 150 205 C 175 240, 205 270, 250 290 L 252 298 C 200 285, 165 255, 140 222 C 105 175, 55 140, 0 130 Z M110 160 C 130 146, 165 118, 205 110 L 206 118 C 170 126, 142 152, 124 172 Z', color: 'cha', z: 5 },
      { id: 'blossom', name: '桜花', d: [...flowerPaths, ...fallPaths].join(' '), color: 'momo', z: 6 },
    ],
  };

  /* ───────── 弐：霞富士帆影 ───────── */
  const kasumi = {
    id: 'kasumi', title: '霞富士帆影', yomi: 'かすみふじほかげ', level: 2,
    desc: '霞たなびく富士と、沖をゆく帆掛け舟。朝日の紅が映える一枚。',
    cartouche: { x: 352, y: 20 }, sign: { x: 30, y: 400 },
    lines: [
      { name: '富士', d: 'M130 375 C 190 345, 228 300, 250 258 L 280 258 C 302 300, 340 345, 400 375' },
      { name: '雪形', d: 'M230 290 L 239 300 L 247 291 L 256 306 L 265 292 L 274 304 L 283 291 L 292 301 L 300 290' },
      { name: '朝日', d: 'M127 120 A32 32 0 1 0 63 120 A32 32 0 1 0 127 120' },
      { name: '霞（上）', d: 'M0 328 C 50 316, 120 322, 170 330 C 220 338, 270 334, 320 342 C 355 347, 385 344, 400 341' },
      { name: '霞（下）', d: 'M0 364 C 40 370, 100 362, 160 368 C 220 374, 290 366, 340 372 C 370 375, 390 372, 400 370' },
      { name: '水平線', d: 'M0 392 C 100 388, 300 396, 400 390' },
      { name: '帆（大）', d: 'M118 402 L 162 412 L 160 468 L 116 464 Z' },
      { name: '舟（大）', d: 'M88 468 L 192 470 C 175 488, 110 490, 88 468' },
      { name: '帆（小）', d: 'M300 396 L 326 402 L 325 432 L 299 430 Z' },
      { name: '舟（小）', d: 'M284 431 L 340 432 C 330 442, 296 442, 284 431' },
      { name: '波一', d: 'M20 525 C 60 515, 100 533, 140 521 C 170 513, 200 527, 230 519' },
      { name: '波二', d: 'M190 565 C 230 555, 270 571, 310 561 C 340 554, 365 565, 390 559' },
    ],
    auto: ['M138 398 L 138 468', 'M312 392 L 312 432', 'M180 180 Q 186 173, 192 180 Q 198 173, 204 180',
      'M214 202 Q 219 197, 224 202 Q 229 197, 234 202', 'M196 222 Q 200 218, 204 222 Q 208 218, 212 222',
      'M40 425 L 70 424', 'M210 410 L 250 411', 'M330 455 L 370 454', 'M250 480 L 300 481', 'M60 560 L 110 559', 'M290 595 L 330 594'],
    keyFills: ['M88 468 L 192 470 C 175 488, 110 490, 88 468 Z', 'M284 431 L 340 432 C 330 442, 296 442, 284 431 Z'],
    regions: [
      { id: 'sky', name: '空', d: 'M0 0 H400 V600 H0 Z', color: 'ai', z: 1, bokashi: { x0: 0, y0: 0, x1: 0, y1: 255, a0: 1, a1: 0 } },
      { id: 'sun', name: '朝日', d: U.circle(95, 120, 32), color: 'beni', z: 2 },
      { id: 'fuji', name: '富士', d: 'M130 375 C 190 345, 222 307, 230 290 L 239 300 L 247 291 L 256 306 L 265 292 L 274 304 L 283 291 L 292 301 L 300 290 C 310 307, 340 345, 400 375 L 400 400 L 130 400 Z', color: 'ai', z: 3 },
      { id: 'haze', name: '霞', d: 'M0 328 C 50 316, 120 322, 170 330 C 220 338, 270 334, 320 342 C 355 347, 385 344, 400 341 L400 370 C 390 372, 370 375, 340 372 C 290 366, 220 374, 160 368 C 100 362, 40 370, 0 364 Z', color: 'momo', z: 4 },
      { id: 'sea', name: '海', d: 'M0 392 C 100 388, 300 396, 400 390 L400 600 L0 600 Z', color: 'usuai', z: 5 },
      { id: 'sail', name: '帆', d: 'M118 402 L 162 412 L 160 468 L 116 464 Z M300 396 L 326 402 L 325 432 L 299 430 Z', color: 'gofun', z: 6 },
    ],
  };

  /* ───────── 参：蓮池遊鯉 ───────── */
  const BODY = 'M0 0 C 0 -16, 16 -27, 45 -28 C 85 -29, 120 -16, 148 -7 C 160 -20, 175 -30, 186 -30 C 178 -12, 178 12, 186 30 C 175 30, 160 20, 148 7 C 120 16, 85 29, 45 28 C 16 27, 0 16, 0 0 Z';
  const FIN_U = 'M40 -24 C 46 -40, 62 -50, 72 -44 C 66 -36, 56 -28, 48 -25 Z';
  const FIN_L = 'M40 24 C 46 40, 62 50, 72 44 C 66 36, 56 28, 48 25 Z';
  const PATCH = ['M20 -16 C 35 -27, 70 -24, 82 -10 C 75 8, 40 12, 24 4 C 18 -2, 17 -10, 20 -16 Z',
    'M98 -12 C 112 -16, 128 -10, 138 -4 C 128 6, 112 9, 100 5 C 95 1, 94 -8, 98 -12 Z'];
  const DETAIL = ['M30 -24 C 36 -10, 36 10, 30 24', 'M150 0 L 178 -20', 'M150 0 L 180 0', 'M150 0 L 178 20', 'M2 -6 C 6 -3, 6 3, 2 6'];
  const k1 = [95, 235, 35, 1], k2 = [170, 482, -25, 0.9];
  const koiAuto = (k) => [...DETAIL.map(d => U.tf(d, ...k)),
    ...[[14, -12], [14, 12]].map(([x, y]) => { const p = U.tp(x, y, ...k); return U.circle(+p.x.toFixed(1), +p.y.toFixed(1), 2.6); })];
  const P1 = [85, 122, 66, 44, 0.6], P2 = [330, 550, 70, 38, 3.8], P3 = [255, 98, 42, 26, 2.4];
  const lotus = [petal(80, 112, -90, 40, 14), petal(78, 114, -125, 34, 12), petal(82, 114, -55, 34, 12), petal(76, 116, -155, 26, 10), petal(84, 116, -25, 26, 10)];
  const koi = {
    id: 'koi', title: '蓮池遊鯉', yomi: 'はすいけゆうり', level: 3,
    desc: '蓮の葉陰に遊ぶ紅白と山吹の鯉。水のぼかしと胡粉の白が決め手。',
    cartouche: { x: 352, y: 20 }, sign: { x: 30, y: 300 },
    lines: [
      { name: '紅白鯉', d: U.tf(BODY, ...k1) },
      { name: '紅白鯉の鰭（上）', d: U.tf(FIN_U, ...k1) },
      { name: '紅白鯉の鰭（下）', d: U.tf(FIN_L, ...k1) },
      { name: '山吹鯉', d: U.tf(BODY, ...k2) },
      { name: '山吹鯉の鰭（上）', d: U.tf(FIN_U, ...k2) },
      { name: '山吹鯉の鰭（下）', d: U.tf(FIN_L, ...k2) },
      { name: '蓮の葉（大）', d: pad(...P1) },
      { name: '蓮の葉（下）', d: pad(...P2) },
      { name: '蓮の葉（小）', d: pad(...P3) },
      { name: '波紋一', d: 'M245 205 A 45 15 0 0 1 335 205' },
      { name: '波紋二', d: 'M222 224 A 68 23 0 0 1 358 224' },
    ],
    auto: [...koiAuto(k1), ...koiAuto(k2), ...veins(...P1), ...veins(...P2), ...veins(...P3), ...lotus,
      'M40 420 C 60 414, 80 424, 100 418', 'M300 330 C 320 324, 340 334, 360 328', 'M20 560 C 40 554, 60 564, 80 558'],
    regions: [
      { id: 'water', name: '水', d: 'M0 0 H400 V600 H0 Z', color: 'ai', z: 1, bokashi: { x0: 0, y0: 600, x1: 0, y1: 0, a0: 1, a1: 0.28 } },
      { id: 'pads', name: '蓮の葉', d: [pad(...P1), pad(...P2), pad(...P3)].join(' '), color: 'kusa', z: 2 },
      { id: 'lotus', name: '蓮の花', d: lotus.join(' '), color: 'momo', z: 3 },
      { id: 'koi1', name: '紅白鯉の地', d: [BODY, FIN_U, FIN_L].map(d => U.tf(d, ...k1)).join(' '), color: 'gofun', z: 4 },
      { id: 'koi1p', name: '紅白鯉の斑', d: PATCH.map(d => U.tf(d, ...k1)).join(' '), color: 'shu', z: 5 },
      { id: 'koi2', name: '山吹鯉', d: [BODY, FIN_U, FIN_L].map(d => U.tf(d, ...k2)).join(' '), color: 'ki', z: 6 },
    ],
  };

  return [yozakura, kasumi, koi];
})();
