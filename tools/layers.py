"""色版を「重なる層」にし、どの版がどの版の下に敷かれるか（摺る順番の決まり）を求めて検証する。

使い方: python3 tools/layers.py <id> [<id> ...]
入力:  assets/plates/<id>.png（ラベル×30。1=主版、2..=色版、淡い色ほど番号が小さい）
出力:  assets/plates/<id>.layers.png … 色版ごとの彫り範囲（ビット k = ラベル k+2 の色版が覆う所）
       標準出力に、版ごとの「先に摺る必要がある版」と検証結果を JSON で

層の作り方（下の層から摺る。下地の版は上の層の下まで広く敷く）
- 層の重なり：淡い色版が一番下、濃い色版がその上、主版（墨線）が一番上
- 色版 i は、自分の色の所に加え、すぐ近く（すき間・穴・境目）にある上の層（濃い色版・墨線）の所まで広げる
- 版 i が上の層 j の所を十分な面積（色版は画像の 0.5%、墨線は 0.4% 以上）覆うとき「i は j の下」＝ i を先に摺る
- 覆う面積が小さすぎる重なりや、色が近くて見た目で区別できない重なりは、不公平なので削る
検証：決まりどおりの順で重ねると原画の色分けと完全に一致し、決まりを破る順（下の版を後に摺る）では
     上の版の一部が隠れて見た目が変わる（変わる画素数を出力する）
"""
import sys, json, itertools
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r

def build(pid):
    lab = np.round(np.asarray(Image.open(f'assets/plates/{pid}.png')).astype(float) / 30).astype(int)
    H, W = lab.shape
    colors = sorted(int(l) for l in np.unique(lab) if l >= 2)
    stack = colors + [1]                                  # 下の層から：淡い色版 → 濃い色版 → 主版（墨線）が一番上
    rank = {l: r for r, l in enumerate(stack)}
    th = {l: 0.005 * H * W for l in colors}; th[1] = 0.004 * H * W   # 墨線は細いので、重なりの基準を少し小さく
    ext = {}
    for i in colors:
        own = lab == i
        reach = ndi.binary_closing(own, structure=disk(10)) | ndi.binary_dilation(own, structure=disk(4))
        reach = ndi.binary_fill_holes(reach)
        e = own.copy()
        for j in stack:
            if rank[j] <= rank[i]: continue
            ov = reach & (lab == j)
            if ov.sum() >= th[j]: e |= ov                 # 十分に重なる所だけ、上の層の下に敷く
        ext[i] = e
    ext[1] = lab == 1
    # 見た目で区別できない重なりは決まりから外す：下の版 i を上の版 j の後に摺っても、
    # 色の差（30 以上）で変わる画素が画像の 0.8% 未満なら、i を j の下に敷かない（どちらが先でもよい）
    rgb = np.asarray(Image.open(f'assets/fresh/{pid}.jpg').convert('RGB').resize((W, H))).astype(float)
    mean = {l: rgb[lab == l].mean(0) for l in stack}
    for i in colors:
        for j in stack:
            if rank[j] <= rank[i]: continue
            ov = ext[i] & (lab == j)
            if not ov.any(): continue
            visible = (np.abs(rgb[ov] - mean[i]).sum(1) > 30).sum()
            if visible < 0.008 * H * W: ext[i] &= ~(lab == j)
    # 先に摺る必要がある版（i が j の所の下に敷かれている → i を先に）
    after = {j: sorted(i for i in colors if rank[i] < rank[j] and (ext[i] & (lab == j)).any()) for j in stack}
    bits = np.zeros((H, W), np.uint8)
    for i in colors: bits[ext[i]] |= np.uint8(1 << (i - 2))
    Image.fromarray(bits).save(f'assets/plates/{pid}.layers.png', optimize=True)
    def compose(order):                                   # 各画素で最後に摺られた版
        top = np.zeros((H, W), int)
        for i in order: top = np.where(ext[i], i, top)
        return top
    ok = compose(stack)
    exact = bool((ok == np.where(lab >= 1, lab, 0)).all())
    swaps = {}
    for j in stack:
        for i in after[j]:
            bad = [c for c in stack if c != i]; bad.insert(bad.index(j) + 1, i)   # 下の版 i を j の後に摺ってしまう
            swaps[f'{i}->{j}'] = round(int((compose(bad) != ok).sum()) / (H * W) * 100, 2)
    return {'id': pid, 'stack': stack, 'after': after, 'exact': exact, 'swap_diff_pct': swaps}

for pid in sys.argv[1:]:
    print(json.dumps(build(pid), ensure_ascii=False))
