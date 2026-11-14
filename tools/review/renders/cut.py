"""Cut icon sheets into single transparent PNGs.
Usage: python cut.py <raw dir> <out dir>
Background = light, low-saturation pixels connected to the sheet's border (so white rice, clock faces and
highlights inside an icon stay). Edges get a soft "white to alpha" so there's no white fringe on dark screens."""
import sys, json, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

raw, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
index = {}
for f in sorted(raw.glob('*.webp'), key=lambda p: int(p.stem)):
    src = np.asarray(Image.open(f).convert('RGBA')).astype(np.int16)
    im, A = src[..., :3], src[..., 3]
    checker = (A < 20).mean() < 0.05  # a sheet whose "transparent" background is a painted checkerboard
    if checker:
        mn, mx = im.min(2), im.max(2)
        light = (mn > 188) & ((mx - mn) < 16)
        lab, _ = ndi.label(light)
        edge_ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        bgl = np.isin(lab, edge_ids[edge_ids > 0])
        # enclosed patches of the painted checkerboard (a gear's hole) are background too: they mix grey and white squares
        bright = mn.astype(float)
        for j, sl in enumerate(ndi.find_objects(lab), 1):
            if sl is None: continue
            m = lab[sl] == j
            if m.sum() > 150 and bright[sl][m].std() > 12 and (bright[sl][m] < 225).mean() > .25: bgl[sl] |= m
        fg = ~bgl
    else:
        fg = A > 24
    fg = ndi.binary_opening(fg, iterations=1)
    grown = ndi.binary_dilation(fg, iterations=3)
    comp, n = ndi.label(grown)
    objs = ndi.find_objects(comp)
    area = ndi.sum(fg, comp, range(1, n + 1))
    big = [i for i in range(1, n + 1) if area[i - 1] >= 9000]
    cen = {i: ((objs[i - 1][0].start + objs[i - 1][0].stop) / 2, (objs[i - 1][1].start + objs[i - 1][1].stop) / 2) for i in range(1, n + 1)}
    # small loose pieces (stars, Zs, sparks) join the nearest icon, if it's close
    owner = np.zeros(n + 1, int)
    for i in big: owner[i] = i
    for i in range(1, n + 1):
        if owner[i] or area[i - 1] < 60: continue
        cy, cx = cen[i]
        d, j = min((np.hypot(cy - cen[b][0], cx - cen[b][1]), b) for b in big)
        if d < 170: owner[i] = j
    comp = owner[comp]
    boxes = []
    for i in big:
        ys, xs = np.nonzero(comp == i)
        boxes.append([int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max()), i])
    # reading order: rows by vertical center, then left to right
    boxes.sort(key=lambda b: (b[0] + b[1]) / 2)
    rows, cur = [], []
    for b in boxes:
        if cur and (b[0] + b[1]) / 2 - (cur[-1][0] + cur[-1][1]) / 2 > 90: rows.append(cur); cur = []
        cur.append(b)
    if cur: rows.append(cur)
    ordered = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
    names = []
    for k, (y0, y1, x0, x1, i) in enumerate(ordered, 1):
        pad = 8
        Y0, Y1, X0, X1 = max(0, y0 - pad), min(im.shape[0], y1 + pad + 1), max(0, x0 - pad), min(im.shape[1], x1 + pad + 1)
        rgb = im[Y0:Y1, X0:X1].astype(np.float32)
        mine = (comp[Y0:Y1, X0:X1] == i) & fg[Y0:Y1, X0:X1]
        if not checker:  # keep the sheet's own soft edges and glows
            alpha = A[Y0:Y1, X0:X1].astype(np.float32) / 255 * ndi.binary_dilation(mine, iterations=3)
            rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
            h, w = rgba.shape[:2]; s = max(h, w)
            sq = np.zeros((s, s, 4), np.uint8); sq[(s - h) // 2:(s - h) // 2 + h, (s - w) // 2:(s - w) // 2 + w] = rgba
            name = f's{f.stem}-{k:02d}.png'; Image.fromarray(sq).save(out / name); names.append(name); continue
        alpha = mine.astype(np.float32)
        # soft edge: within 4 px of the background, turn white into transparency
        band = mine & ~ndi.binary_erosion(mine, iterations=4)
        a_soft = np.clip((255 - rgb.min(2)) / (255 - 20), 0, 1)
        alpha[band] = np.minimum(1, a_soft[band] * 1.15)
        col = rgb.copy()
        a3 = np.maximum(alpha, 1e-3)[..., None]
        col[band] = np.clip((rgb[band] - 255 * (1 - a3[band])) / a3[band], 0, 255)
        rgba = np.dstack([col, alpha * 255]).astype(np.uint8)
        # square canvas, icon centered
        h, w = rgba.shape[:2]; s = max(h, w)
        sq = np.zeros((s, s, 4), np.uint8); sq[(s - h) // 2:(s - h) // 2 + h, (s - w) // 2:(s - w) // 2 + w] = rgba
        name = f's{f.stem}-{k:02d}.png'
        Image.fromarray(sq).save(out / name)
        names.append(name)
    index[f.stem] = names
    print(f.stem, len(names))
json.dump(index, open(out / 'index.json', 'w'), indent=1)
