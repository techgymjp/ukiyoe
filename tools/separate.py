"""本物の浮世絵画像を「主版（墨線）＋色版」に色分解する。

使い方:
  python3 tools/separate.py <入力画像> <id> <幅> <高さ> <色版の数> [crop=x0,y0,x1,y1] [dark=L閾値]

出力:
  assets/originals/<id>.jpg   … 原画（幅x高さ の2倍解像度）
  assets/plates/<id>.png      … ラベル画像（値＝ラベル×30。0=紙, 1=主版, 2..=色版。淡い色から濃い色の順）
  標準出力に各版の平均色と面積をJSONで表示
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)

def kmeans(X, k, iters=30, seed=0):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), 1)]
    for _ in range(k - 1):  # k-means++
        d = ((X[:, None] - C[None]) ** 2).sum(-1).min(1)
        C = np.vstack([C, X[rng.choice(len(X), 1, p=d / d.sum())]])
    for _ in range(iters):
        lab = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([X[lab == i].mean(0) if (lab == i).any() else C[i] for i in range(k)])
    return C

def majority(labels, n, size=3):
    best = np.zeros(labels.shape, np.float32) - 1
    out = labels.copy()
    for i in range(n):
        s = ndi.uniform_filter((labels == i).astype(np.float32), size)
        m = s > best
        out[m] = i; best[m] = s[m]
    return out

def main():
    src, pid, W, H, k = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
    opts = dict(a.split('=') for a in sys.argv[6:])
    im = Image.open(src).convert('RGB')
    if 'crop' in opts:
        im = im.crop(tuple(int(v) for v in opts['crop'].split(',')))
    im = im.resize((W * 2, H * 2), Image.LANCZOS)
    im.save(f'assets/originals/{pid}.jpg', quality=88)
    rgb = np.asarray(im).astype(np.float64)
    lab = srgb_to_lab(rgb)
    L, chroma = lab[..., 0], np.hypot(lab[..., 1], lab[..., 2])

    # 紙：明るく彩度の低い部分（周囲の紙色から推定）
    border = np.concatenate([lab[:6].reshape(-1, 3), lab[-6:].reshape(-1, 3)])
    paperL = float(np.percentile(L, 97)) if 'paperL' not in opts else float(opts['paperL'])
    paper = (L > paperL - float(opts.get('paperTol', 6))) & (chroma < float(opts.get('paperChroma', 22)))

    # 主版：暗く細い線（太い暗部は色版へ）
    dark = L < float(opts.get('dark', 32))
    blobs = ndi.binary_opening(dark, structure=np.ones((7, 7)))
    key = dark & ~blobs
    key = ndi.binary_dilation(key, iterations=1) & (L < float(opts.get('dark', 32)) + 12)

    rest = ~paper & ~key
    X = lab[rest]
    sub = X[np.random.default_rng(1).choice(len(X), min(60000, len(X)), replace=False)]
    C = kmeans(sub, k)
    order = np.argsort(-C[:, 0])  # 淡い色から
    C = C[order]
    lbl = np.zeros(L.shape, np.uint8)
    lbl[key] = 1
    idx = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1)
    lbl[rest] = idx + 2
    lbl = majority(lbl, k + 2, 3)
    Image.fromarray((lbl * 30).astype(np.uint8)).save(f'assets/plates/{pid}.png', optimize=True)  # 値はラベル×30

    info = {'paper': '#%02x%02x%02x' % tuple(rgb[lbl == 0].mean(0).astype(int)) if (lbl == 0).any() else None, 'plates': []}
    for i in range(1, k + 2):
        m = lbl == i
        info['plates'].append({'label': i, 'hex': '#%02x%02x%02x' % tuple(rgb[m].mean(0).astype(int)), 'area': round(float(m.mean()), 4)})
    print(json.dumps(info, ensure_ascii=False))
    # 確認用の色分解プレビュー
    pal = np.array([[255, 255, 255]] + [[int(p['hex'][j:j + 2], 16) for j in (1, 3, 5)] for p in info['plates']], np.uint8)
    Image.fromarray(pal[lbl]).save(f'/tmp/sep_{pid}.png') if 'preview' in opts else None

main()
