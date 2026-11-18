"""色分解した浮世絵を「摺りたて」の状態に修復する。

使い方: python3 tools/freshen.py <id> [<id> ...]
入力:  assets/originals/<id>.jpg（原画）, assets/plates/<id>.png（ラベル×30）
出力:  assets/fresh/<id>.jpg（ゲームで摺る色）

- 紙の黄ばみ（色かぶり）を取り、白い和紙の色にそろえる
- 版ごとの色ムラ・染みを均し、褪せた色の鮮やかさを戻す
- 墨のかすれ（擦り切れて灰色になった所）を塞いで真っ黒にする
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

FRESH_PAPER = np.array([247, 242, 229], float)
INK = np.array([28, 25, 26], float)

def freshen(pid):
    rgb = np.asarray(Image.open(f'assets/originals/{pid}.jpg').convert('RGB')).astype(float)
    lab = np.round(np.asarray(Image.open(f'assets/plates/{pid}.png')).astype(float) / 30).astype(int)
    paper = rgb[lab == 0]
    aged = np.median(paper, 0) if len(paper) > 500 else np.percentile(rgb.reshape(-1, 3), 97, 0)
    if aged @ np.array([0.3, 0.59, 0.11]) < 215: aged = np.array([232, 214, 186], float)   # 紙が少ない作品は標準の黄ばみで補正
    rgb = np.clip(rgb * (FRESH_PAPER / np.maximum(aged, 40)), 0, 255)          # 色かぶりを取る
    out = rgb.copy()
    for l in range(1, lab.max() + 1):
        m = lab == l
        if not m.any(): continue
        mean = rgb[m].mean(0)
        smooth = np.stack([ndi.uniform_filter(np.where(m, rgb[..., c], mean[c]), 5) for c in range(3)], -1)
        v = mean + (smooth[m] - mean) * 0.55                                       # 染みとムラを均す（細部は少し残す）
        v = 0.45 * v + 0.55 * (mean + (rgb[m] - mean) * 0.5)
        g = v.mean(1, keepdims=True); v = g + (v - g) * 1.35                       # 褪色を戻す
        if l != 1: v = 255 - (255 - v) / 0.94                                      # 絵の具の濃さ
        ml = mean @ np.array([0.3, 0.59, 0.11]); mc = mean.max() - mean.min()
        if l != 1 and ml > 212 and mc < 32: v = FRESH_PAPER * 0.75 + v * 0.25     # 紙の黄ばみが版になった所は白い紙に
        out[m] = v
    lum = out @ np.array([0.3, 0.59, 0.11])
    chroma = out.max(-1) - out.min(-1)
    neutral = chroma < 38                                                          # 墨は無彩色（藍などの色は対象外）
    dark = (lum < 80) & neutral & (lab > 0)
    yy, xx = np.mgrid[-9:10, -9:10]
    closed = ndi.binary_closing(dark, structure=(xx * xx + yy * yy) <= 81)
    worn = closed & ~dark & neutral & (lum < 175) & (lab > 0)                      # 擦り切れて灰色になった墨
    w = np.clip((110 - lum) / 70, 0, 1) * neutral
    w[worn] = 1
    w = ndi.gaussian_filter(w, 0.8) * 0.92
    out = out * (1 - w[..., None]) + INK * w[..., None]
    out[lab == 0] = FRESH_PAPER
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'assets/fresh/{pid}.jpg', quality=90)
    print(pid, 'aged paper', aged.astype(int))

for pid in sys.argv[1:]:
    freshen(pid)
