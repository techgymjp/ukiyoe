"""版を実際に摺って（前の色を上書きして）完成図と比べ、摺る順番を求めて検証する。

使い方: python3 tools/layers.py <id> [<id> ...]
入力:  assets/plates/<id>.png（ラベル×30。0=紙、1=主版（墨線）、2..=色版）、assets/fresh/<id>.jpg（色）
出力:  assets/plates/<id>.layers.png … 色版ごとの彫り範囲（ビット k = ラベル k+2 の色版が摺る所）
       標準出力に JSON：最も完成図に近い順番、順番ごとの食い違い、版ごとの「先に摺る版」、検証結果

求め方（摺師の原則に合わせる）
1. 摺る順番：まず主版（輪郭線・墨線）を摺って見当（位置合わせ）の基準にする。
   続いて色板を「淡い色から濃い色へ」。明るさが近い（差 15 未満）ときは「面積の広い版から細かい版へ」
2. 版の形：その順番で摺ると完成図になるよう彫る。色板は墨線にかからないよう彫り、自分の色の所に加え、
   後から摺る濃い色の下に隠れる所（自分の色に囲まれた内側と、まわり 3 画素）まで広く彫る。紙（ラベル 0）は彫らない
3. 検証：その順番で実際に重ね摺り（後の版が前の色を上書き）して、完成図とぴったり一致することを確かめる
4. 見た目で区別できない上書き（色の差 30 以上の画素が画像の 0.8% 未満）しか生まない彫りは削る
5. 正解：主版が最初の順番をすべて実際に摺り、完成図と見た目が変わらない（変化 0.5% 未満）順番をすべて正解とする
"""
import sys, json, itertools
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r

def compose(ext, order, shape):
    top = np.zeros(shape, np.int16)
    for i in order: top[ext[i]] = i
    return top

def build(pid):
    lab = np.round(np.asarray(Image.open(f'assets/plates/{pid}.png')).astype(float) / 30).astype(int)
    H, W = lab.shape
    rgb = np.asarray(Image.open(f'assets/fresh/{pid}.jpg').convert('RGB').resize((W, H))).astype(float)
    blocks = sorted(int(l) for l in np.unique(lab) if l >= 1)
    colors = [b for b in blocks if b >= 2]
    ink = lab > 0
    # 1. 摺る順番：主版が最初、続いて淡い色から濃い色へ（明るさが近ければ広い版から）
    mean = {l: rgb[lab == l].mean(0) for l in blocks}
    lum = {l: float(mean[l] @ [0.299, 0.587, 0.114]) for l in colors}
    area = {l: int((lab == l).sum()) for l in colors}
    seq = sorted(colors, key=lambda l: -lum[l])
    for _ in range(len(seq)):
        for n in range(len(seq) - 1):
            a_, b_ = seq[n], seq[n + 1]
            if abs(lum[a_] - lum[b_]) < 15 and area[b_] > area[a_]: seq[n], seq[n + 1] = b_, a_
    best = tuple([1] + seq)
    # 2. 版の形：後から摺る版の下に隠れる所まで広く彫る
    ext = {1: lab == 1}
    for n, i in enumerate(seq):
        own = lab == i
        later = np.isin(lab, seq[n + 1:])                 # 後から摺る濃い色（墨線は含めない＝墨線にかけない）
        reach = ndi.binary_fill_holes(ndi.binary_closing(own, structure=disk(6))) | ndi.binary_dilation(own, structure=disk(3))
        ext[i] = own | (reach & later)
    # 3. 検証：その順番で摺ると完成図とぴったり一致するか
    total = H * W
    sim_err = int((compose(ext, best, lab.shape) != np.where(ink, lab, 0)).sum())
    # 4. 見分けられない上書き（色の差 30 以上の画素が画像の 0.8% 未満）は彫らない（意味のない彫りを省く）
    for i in colors:
        for j in blocks:
            if i == j: continue
            ov = ext[i] & (lab == j)
            if ov.any() and (np.abs(rgb[ov] - mean[i]).sum(1) > 30).sum() < 0.008 * H * W: ext[i] &= ~(lab == j)
    # 5. 正しい順番：主版が最初の順番をすべて実際に摺り、完成図と見た目が変わらない（変化 0.5% 未満）順番をすべて正解とする
    full = np.where(ink, lab, 0)
    ref = compose(ext, best, lab.shape)
    exact = bool((ref == full).all())
    palette = np.zeros((max(blocks) + 1, 3)); 
    for l in blocks: palette[l] = mean[l]
    palette[0] = (247, 242, 229)
    def change(order):
        top = compose(ext, order, lab.shape)
        diff = top != ref
        return float((np.abs(palette[top[diff]] - palette[ref[diff]]).sum(1) > 30).sum() / (H * W) * 100) if diff.any() else 0.0
    bits = np.zeros((H, W), np.uint8)
    for i in colors: bits[ext[i]] |= np.uint8(1 << (i - 2))
    Image.fromarray(bits).save(f'assets/plates/{pid}.layers.png', optimize=True)
    res = [(list(o), change(o)) for o in itertools.permutations(blocks) if o[0] == 1]
    orders = [o for o, c in res if c < 0.5]
    bad = [c for o, c in res if c >= 0.5]
    return {'id': pid, 'best_order': list(best), 'lum': {l: round(lum[l]) for l in seq}, 'area_pct': {l: round(area[l] / total * 100, 1) for l in seq},
            'mismatch_before_trim_pct': round(sim_err / total * 100, 3), 'exact': exact, 'orders': orders, 'valid_orders': len(orders),
            'valid_max_change_pct': round(max(c for o, c in res if c < 0.5), 3),
            'invalid_min_change_pct': round(min(bad), 2) if bad else None}

for pid in sys.argv[1:]:
    print(json.dumps(build(pid), ensure_ascii=False), flush=True)
