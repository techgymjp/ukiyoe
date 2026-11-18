"""色版を「重なる層」にし、どの版がどの版の下に敷かれるか（摺る順番の決まり）を求めて検証する。

使い方: python3 tools/layers.py <id> [<id> ...]
入力:  assets/plates/<id>.png（ラベル×30。1=主版、2..=色版、淡い色ほど番号が小さい）
出力:  assets/plates/<id>.layers.png … 版ごとの彫り範囲（ビット k = ラベル k+2 の色版が覆う所）
       標準出力に、版ごとの「先に摺る必要がある版」と検証結果を JSON で

層の作り方（実際の摺りと同じく、下地の版は上の版の下まで広く敷く）
- 色版 i は、自分の色の所に加え、すぐ近く（すき間・穴・境目）にある「より濃い版」の所まで広げる
- 版 i が版 j の色の所を十分な面積（画像の 0.5% 以上）覆うとき「i は j の下」＝ i を先に摺る
- 覆う面積が小さすぎる重なりは、見分けられず不公平なので削る
- 主版（墨線）は最初に摺る。色版は墨線の所には広げない
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
    thresh = 0.005 * H * W
    ext = {}
    for i in colors:
        own = lab == i
        later = (lab > i)                                             # より濃い色版（主版・紙は含まない）
        reach = ndi.binary_closing(own, structure=disk(10)) | ndi.binary_dilation(own, structure=disk(4))
        reach = ndi.binary_fill_holes(reach)
        cover = reach & later
        e = own.copy()
        for j in colors:
            if j <= i: continue
            ov = cover & (lab == j)
            if ov.sum() >= thresh: e |= ov                          # 十分に重なる所だけ下に敷く
        ext[i] = e
    # 先に摺る必要がある版（i が j の色の所を覆う → i は j の下）
    after = {j: sorted(i for i in colors if i < j and (ext[i] & (lab == j)).any()) for j in colors}
    # 保存（ビット k = ラベル k+2）
    bits = np.zeros((H, W), np.uint8)
    for i in colors: bits[ext[i]] |= np.uint8(1 << (i - 2))
    Image.fromarray(bits).save(f'assets/plates/{pid}.layers.png', optimize=True)
    # 検証：ラベル画像で「最後に塗られた版」を求める
    def compose(order):
        top = np.where(lab == 1, 1, 0)
        for i in order: top = np.where(ext[i] & (lab != 1), i, top)
        return top
    ok_order = colors
    exact = bool((compose(ok_order) == np.where(lab >= 1, lab, 0)).all())
    swaps = {}
    for j in colors:
        for i in after[j]:
            bad = [c for c in colors if c != i]; bad.insert(bad.index(j) + 1, i)   # 下の版 i を j の後に摺ってしまう
            diff = int((compose(bad) != compose(ok_order)).sum())
            swaps[f'{i}->{j}'] = round(diff / (H * W) * 100, 2)
    return {'id': pid, 'colors': colors, 'after': after, 'exact': exact, 'swap_diff_pct': swaps}

for pid in sys.argv[1:]:
    print(json.dumps(build(pid), ensure_ascii=False))
