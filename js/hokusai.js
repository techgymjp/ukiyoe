'use strict';
/* 葛飾北斎『冨嶽三十六景』より 2作を図案化（横大判 600 x 400）
   原画：メトロポリタン美術館所蔵（パブリックドメイン / CC0） */
Object.assign(PIG, {
  bengara: { name: '弁柄', hex: '#b4503a' },
  tokiwa:  { name: '常磐', hex: '#2c5550' },
  hada:    { name: '肌色', hex: '#e9c39e' },
  seiji:   { name: '青磁', hex: '#8fb8a6' },
});

(() => {
  const hit = document.createElement('canvas').getContext('2d');
  const inside = (d, x, y) => hit.isPointInPath(new Path2D(d), x, y);
  /* 波の「爪」：外向き法線に沿って指のように巻く白波 */
  const CLAW = 'M0 0 C -1 -5, 1 -10, 6 -11 C 10 -12, 12 -8, 9 -6 C 7 -5, 6 -7, 7 -8';
  const claws = (d, every, size, from = 0, to = 1, flip = false) => {
    const s = U.samplePath(d, 2), out = [];
    const a = Math.floor(s.length * from), b = Math.floor(s.length * to);
    for (let i = a + 2; i < b - 2; i += every) {
      const tx = s[i + 2].x - s[i - 2].x, ty = s[i + 2].y - s[i - 2].y, L = Math.hypot(tx, ty) || 1;
      let nx = ty / L, ny = -tx / L; if (flip) { nx = -nx; ny = -ny; }
      const deg = Math.atan2(ny, nx) * 180 / Math.PI + 90;
      out.push(U.tf(CLAW, s[i].x, s[i].y, deg, size * (0.8 + ((i * 37) % 10) / 25)));
    }
    return out;
  };

  /* ───────── 神奈川沖浪裏 ───────── */
  const BACK = 'M0 147 C 30 145, 60 132, 83 110 C 110 82, 140 50, 200 37 C 220 33, 240 38, 255 48';
  const CREST = 'M255 48 C 290 60, 330 95, 350 140 C 356 158, 345 175, 330 175';
  const UNDER = 'M330 175 C 300 150, 260 120, 245 75';
  const FACE = 'M245 75 C 250 110, 240 160, 245 200 C 250 230, 270 260, 300 282';
  const BAND = 'M245 75 C 220 68, 170 70, 140 98 C 125 125, 115 145, 95 158 C 70 172, 30 180, 0 188';
  const MOUND = 'M140 275 C 165 250, 185 228, 205 218 C 225 222, 245 248, 262 275';
  const RIGHT = 'M420 292 C 480 272, 545 228, 600 160';
  const FUJI = 'M352 290 L 372 270 C 378 263, 382 258, 386 257 C 390 258, 395 264, 400 270 L 422 290';
  const SNOW = 'M368 274 L 374 278 L 379 272 L 385 280 L 391 272 L 396 279 L 402 272';
  const BOAT1 = 'M18 190 C 45 225, 85 260, 135 278 L 131 292 C 85 282, 48 258, 26 228 Z';
  const BOAT2 = 'M245 300 C 285 335, 345 362, 440 370 L 438 382 C 345 378, 280 350, 242 312 Z';
  const BOAT3 = 'M333 278 C 380 298, 440 288, 485 260 C 505 246, 518 232, 527 214 L 532 222 C 520 245, 500 262, 485 272 C 440 300, 375 305, 336 290 Z';
  const DARK = 'M245 75 C 220 68, 170 70, 140 98 C 125 125, 115 145, 95 158 C 70 172, 30 180, 0 188 L 0 300 C 40 298, 100 292, 140 275 C 165 250, 185 228, 205 218 C 225 222, 245 248, 262 275 L 300 282 C 270 260, 250 230, 245 200 C 240 160, 250 110, 245 75 Z';
  const STRIPES = [
    'M440 300 C 500 285, 560 245, 600 205 L 600 230 C 560 265, 500 300, 450 315 Z',
    'M380 325 C 450 320, 530 290, 600 255 L 600 285 C 530 320, 450 340, 390 340 Z',
    'M455 372 C 510 360, 565 335, 600 315 L 600 345 C 565 365, 510 385, 460 390 Z',
    'M0 345 C 30 330, 60 338, 80 360 C 100 345, 130 345, 150 370 C 165 385, 175 395, 180 400 L 0 400 Z',
    'M205 362 C 222 350, 242 360, 252 380 L 262 400 L 198 400 Z',
  ];
  const r = U.rng(42), spray = [];
  for (let k = 0; spray.length < 34 && k < 900; k++) {
    const x = 20 + r() * 260, y = 80 + r() * 210;
    if (inside(DARK, x, y) && !inside(BOAT1, x, y)) spray.push(U.circle(+x.toFixed(1), +y.toFixed(1), +(1.2 + r() * 1.6).toFixed(1)));
  }
  const FOAM = [
    BACK + ' ' + CREST.slice(CREST.indexOf('C')) + ' ' + UNDER.slice(UNDER.indexOf('C')) + ' ' + BAND.replace('M245 75', 'L245 75') + ' Z',
    MOUND + ' C 256 292, 246 312, 236 330 C 200 318, 160 305, 120 298 C 128 290, 134 283, 140 275 Z',
    RIGHT + ' L 600 176 C 550 238, 490 282, 430 299 Z',
    'M0 330 C 30 315, 70 318, 95 335 C 70 330, 30 333, 0 345 Z',
  ];
  const wClaws = [...claws(CREST, 6, 1.25, 0, 1), ...claws(BACK, 7, 1.0, 0.72, 1), ...claws(BAND, 7, 1.0, 0, 1, true),
    ...claws(MOUND, 6, 0.9, 0, 1), ...claws(RIGHT, 6, 0.9, 0.05, 0.95)];
  const rowers = [[95, 262], [108, 268], [470, 262], [488, 250], [380, 365], [398, 368], [416, 370]].map(([x, y]) => U.circle(x, y, 3.2));

  const kanagawa = {
    id: 'kanagawa', title: '神奈川沖浪裏', yomi: 'かながわおきなみうら', level: 3, w: 600, h: 400,
    artist: '葛飾北斎', series: '冨嶽三十六景', year: '天保2年（1831年）頃',
    original: 'assets/originals/kanagawa.jpg',
    credit: '原画：葛飾北斎「冨嶽三十六景 神奈川沖浪裏」メトロポリタン美術館所蔵（パブリックドメイン / CC0）',
    desc: '世界で最も有名な浮世絵。大波の爪の向こうに小さな富士。主版はベロ藍で摺られています。',
    keyColor: 'ai', cartouche: { x: 24, y: 14 }, cartoucheCols: ['冨嶽三十六景', '神奈川沖浪裏'],
    sign: { x: 12, y: 54 }, kiwame: { x: 49, y: 146 }, artistSign: '北斎改為一筆',
    lines: [
      { name: 'うねりの背', d: BACK },
      { name: '波頭', d: CREST },
      { name: '波の内側', d: FACE },
      { name: '藍の帯', d: BAND },
      { name: '谷の白波', d: MOUND },
      { name: '富士', d: FUJI },
      { name: '右の大波', d: RIGHT },
      { name: '押送船（左）', d: BOAT1 },
      { name: '押送船（中）', d: BOAT2 },
      { name: '押送船（右）', d: BOAT3 },
    ],
    auto: [UNDER, SNOW, ...STRIPES, ...wClaws, ...rowers,
      'M380 70 C 400 50, 440 45, 460 60 C 490 40, 540 45, 560 70 C 580 75, 590 90, 575 100',
      'M40 205 L 120 268', 'M60 200 L 128 255', 'M270 318 L 430 372', 'M350 290 L 500 258'],
    regions: [
      { id: 'sky', name: '空', d: 'M0 0 H600 V300 H0 Z', color: 'nezumi', z: 1, bokashi: { x0: 0, y0: 292, x1: 0, y1: 170, a0: 0.95, a1: 0 } },
      { id: 'fuji', name: '富士', d: 'M352 290 L 368 274 L 374 278 L 379 272 L 385 280 L 391 272 L 396 279 L 402 272 L 422 290 Z', color: 'ai', z: 2 },
      { id: 'sea', name: '海', d: BACK + ' ' + CREST.slice(CREST.indexOf('C')) + ' ' + UNDER.slice(UNDER.indexOf('C')) + ' ' + FACE.slice(FACE.indexOf('C')) + ' C 340 292, 380 292, 420 290 C 480 270, 540 230, 600 160 L 600 400 L 0 400 Z', color: 'usuai', z: 3 },
      { id: 'dark', name: '波の藍', d: [DARK, ...STRIPES].join(' '), color: 'ai', z: 4 },
      { id: 'boats', name: '押送船', d: [BOAT1, BOAT2, BOAT3].join(' '), color: 'hada', z: 5 },
      { id: 'foam', name: '白波・飛沫', d: [...FOAM, ...spray].join(' '), color: 'gofun', z: 6 },
    ],
  };

  /* ───────── 凱風快晴（赤富士） ───────── */
  const LEFT = 'M0 342 C 100 310, 220 260, 300 210 C 360 162, 420 108, 452 77 L 481 77';
  const RIDGE_R = 'M481 77 C 510 100, 550 130, 600 148';
  const MTN = LEFT + ' C 510 100, 550 130, 600 148 L 600 400 L 0 400 Z';
  const FOREST = 'M0 330 C 60 320, 120 300, 170 285 C 210 280, 240 290, 270 300 C 300 320, 340 345, 380 365 C 420 385, 440 395, 450 400';
  const streaks = ['M455 84 C 448 102, 440 124, 430 152', 'M466 84 C 468 112, 472 150, 478 190', 'M476 84 C 487 112, 497 152, 505 215'];
  const wedge = (d, w0) => {
    const s = U.samplePath(d, 3), L = [], Rr = [];
    s.forEach((p, i) => {
      const q = s[Math.min(s.length - 1, i + 1)], o = s[Math.max(0, i - 1)];
      const tx = q.x - o.x, ty = q.y - o.y, n = Math.hypot(tx, ty) || 1;
      const w = w0 * (1 - i / s.length) + 0.6, nx = -ty / n * w, ny = tx / n * w;
      L.push([p.x + nx, p.y + ny]); Rr.push([p.x - nx, p.y - ny]);
    });
    return U.poly([...L, ...Rr.reverse()]);
  };
  const leftX = (y) => { // 左の稜線の x
    const pts = [[0, 342], [150, 290], [300, 210], [452, 77]];
    for (let i = 0; i < 3; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; if (y <= y0 && y >= y1) return x0 + (x1 - x0) * (y0 - y) / (y0 - y1); }
    return y > 342 ? 0 : 452;
  };
  const rr = U.rng(7), clouds = [];
  const cloud = (x0, yc, Lc, h) => {
    const top = [], bot = [], n = Math.max(6, Math.round(Lc / 3)), bumps = 2 + Math.round(Lc / 14);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + Lc * t, sn = Math.pow(Math.sin(Math.PI * t), 0.5);
      top.push([x, yc - h * sn - h * 0.45 * Math.abs(Math.sin(t * Math.PI * bumps)) * sn]);
      bot.push([x, yc + h * 0.45 * sn]);
    }
    return U.poly([...top, ...bot.reverse()]);
  };
  for (let y = 40; y < 285; y += 11 + rr() * 6) {
    let x = -10 + rr() * 30;
    const maxX = leftX(y + 6) - 14;
    while (x < maxX) {
      const Lc = Math.min(18 + rr() * 60, maxX - x);
      if (Lc > 12 && !(x < 62 && y < 128)) clouds.push(cloud(x, y, Lc, 3 + rr() * 2.5));
      x += Lc + 6 + rr() * 22;
    }
    for (let xr = 512 + rr() * 30; xr < 600; xr += 30 + rr() * 30) {
      const ry = 77 + (xr + 30 - 481) * 0.6;
      if (y < ry - 12 && y > 50) clouds.push(cloud(xr, y, 18 + rr() * 26, 3 + rr() * 2));
    }
  }
  const trees = [];
  const fs = U.samplePath(FOREST, 2);
  const yb = (x) => { let best = fs[0]; for (const q of fs) if (Math.abs(q.x - x) < Math.abs(best.x - x)) best = q; return x > 452 ? 999 : best.y; };
  for (let x = 2; x < 470; x += 5.5) for (let y = 250; y < 402; y += 5) {
    const dep = y - yb(x);
    const prob = dep < -24 ? 0 : dep < 0 ? 0.12 : U.clamp(0.35 + dep / 60, 0, 0.95);
    if (rr() > prob) continue;
    const tx = x + (rr() - 0.5) * 4, ty = y + (rr() - 0.5) * 4, sz = 1.8 + rr() * 1.6;
    trees.push(`M${tx.toFixed(1)} ${(ty - sz * 2).toFixed(1)} L${(tx + sz).toFixed(1)} ${(ty + sz * 0.5).toFixed(1)} L${(tx - sz).toFixed(1)} ${(ty + sz * 0.5).toFixed(1)} Z`);
  }
  const gaifu = {
    id: 'gaifu', title: '凱風快晴', yomi: 'がいふうかいせい', level: 2, w: 600, h: 400,
    artist: '葛飾北斎', series: '冨嶽三十六景', year: '天保2年（1831年）頃',
    original: 'assets/originals/gaifu.jpg',
    credit: '原画：葛飾北斎「冨嶽三十六景 凱風快晴」メトロポリタン美術館所蔵（パブリックドメイン / CC0）',
    desc: '通称「赤富士」。夏の朝日に染まる富士と鰯雲。少ない線と色の重なりで魅せる名品です。',
    keyColor: 'ai', cartouche: { x: 20, y: 30 }, cartoucheCols: ['冨嶽三十六景', '凱風快晴'],
    sign: { x: 86, y: 40 }, kiwame: { x: 45, y: 162 }, artistSign: '北斎改為一筆',
    note: '赤富士の主版は、山の輪郭などごくわずかな線だけ。色の重なりとぼかしで描かれた名品です。',
    lines: [
      { name: '左の稜線', d: LEFT },
      { name: '右の稜線', d: RIDGE_R },
      { name: '山頂', d: 'M446 88 L 452 80 L 458 90 L 465 82 L 472 92 L 479 83 L 486 89' },
    ],
    auto: [],
    regions: [
      { id: 'sky', name: '空', d: 'M0 0 H600 V400 H0 Z', color: 'ai', z: 1, bokashi: { x0: 0, y0: 0, x1: 0, y1: 330, a0: 1, a1: 0.45 } },
      { id: 'mountain', name: '富士の山肌', d: MTN, color: 'bengara', z: 2 },
      { id: 'summit', name: '山頂の陰', d: MTN, color: 'cha', z: 3, bokashi: { x0: 0, y0: 77, x1: 0, y1: 215, a0: 1, a1: 0 } },
      { id: 'foot', name: '裾野', d: 'M0 290 H600 V400 H0 Z', color: 'seiji', z: 4, bokashi: { x0: 0, y0: 400, x1: 0, y1: 315, a0: 0.9, a1: 0 } },
      { id: 'forest', name: '樹海', d: trees.join(' '), color: 'tokiwa', z: 5 },
      { id: 'white', name: '鰯雲と雪', d: [...clouds, ...streaks.map((s, i) => wedge(s, [3.5, 4, 4.5][i])), 'M450 79 L 483 78 L 488 87 L 479 92 L 471 85 L 463 94 L 456 87 L 446 90 Z'].join(' '), color: 'gofun', z: 6 },
    ],
  };

  DESIGNS.unshift(kanagawa, gaifu);
})();
