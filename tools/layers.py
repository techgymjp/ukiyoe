"""版を実際に摺って（前の色を上書きして）完成図と比べ、摺る順番を求めて検証する。

使い方: python3 tools/layers.py <id> [<id> ...]
入力:  assets/plates/<id>.png（ラベル×30。0=紙、1=主版（墨線）、2..=色版）、assets/fresh/<id>.jpg（色）
出力:  assets/plates/<id>.layers.png … 色版ごとの彫り範囲（ビット k = ラベル k+2 の色版が摺る所）
       標準出力に JSON：最も完成図に近い順番、順番ごとの食い違い、版ごとの「先に摺る版」、検証結果

求め方（色の明るさなど、順番についての仮定は置かない）
1. 版の形：色版は「自分の色の所」と「自分の色に囲まれた内側（穴・細いすき間）」を彫る。どの色版にも同じ規則。
   主版は墨線だけ。紙（ラベル 0）は彫らない
2. 摺ってみる：版の並べ方をすべて試し、後から摺った版が前の色を上書きするとして重ね、
   完成図と色分けが食い違う画素を数える
3. 食い違いが最も少ない順番を「正しい順番」とし、その順番で摺ると完成図とぴったり一致するよう、
   最後まで見えてしまう余分な彫りを削る
4. 見た目で区別できない上書き（色の差 30 以上の画素が画像の 0.8% 未満）しか生まない彫りは削る
5. 正解：すべての順番を実際に摺り、完成図と見た目が変わらない（変化 0.5% 未満）順番をすべて正しい順番とする
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
    # 1. 版の形（順番の仮定なし）
    ext = {1: lab == 1}
    for i in colors:
        own = lab == i
        inner = ndi.binary_fill_holes(ndi.binary_closing(own, structure=disk(6)))
        ext[i] = (own | inner) & ink
    # 2. 全部の順番で摺ってみる（1/2 の解像度で数える）
    sub = (slice(None, None, 2), slice(None, None, 2))
    target = np.where(ink, lab, 0)[sub]
    errs = []
    for order in itertools.permutations(blocks):
        e = int((compose({k: v[sub] for k, v in ext.items()}, order, target.shape) != target).sum())
        errs.append((e, order))
    errs.sort()
    best_err, best = errs[0]
    total = target.size
    # 3. 正しい順番で完成図とぴったり一致するよう、最後まで見えてしまう余分な彫りを削る
    for _ in range(len(blocks) + 1):
        top = compose(ext, best, lab.shape)
        wrong = (top != np.where(ink, lab, 0)) & (top > 0)
        if not wrong.any(): break
        for i in colors: ext[i] &= ~(wrong & (top == i))
    # 4. 見分けられない上書き（色の差 30 以上の画素が画像の 0.8% 未満）は彫らない（意味のない彫りを省く）
    mean = {l: rgb[lab == l].mean(0) for l in blocks}
    for i in colors:
        for j in blocks:
            if i == j: continue
            ov = ext[i] & (lab == j)
            if ov.any() and (np.abs(rgb[ov] - mean[i]).sum(1) > 30).sum() < 0.008 * H * W: ext[i] &= ~(lab == j)
    # 5. 正しい順番：すべての順番を実際に摺り、完成図と見た目が変わらない（変化 0.5% 未満）順番をすべて正解とする
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
    res = [(list(o), change(o)) for o in itertools.permutations(blocks)]
    orders = [o for o, c in res if c < 0.5]
    bad = [c for o, c in res if c >= 0.5]
    light = colors + [1]                                      # 参考：「淡い色が下・墨線が上」と仮定した場合の順番
    return {'id': pid, 'best_order': list(best), 'best_mismatch_pct': round(best_err / total * 100, 2),
            'second_mismatch_pct': round(errs[1][0] / total * 100, 2) if len(errs) > 1 else None,
            'light_order_mismatch_pct': round(dict((o, e) for e, o in errs)[tuple(light)] / total * 100, 2),
            'exact': exact, 'orders': orders, 'valid_orders': len(orders),
            'valid_max_change_pct': round(max(c for o, c in res if c < 0.5), 3),
            'invalid_min_change_pct': round(min(bad), 2) if bad else None, 'light_order_is_correct': light in orders}

for pid in sys.argv[1:]:
    print(json.dumps(build(pid), ensure_ascii=False), flush=True)
