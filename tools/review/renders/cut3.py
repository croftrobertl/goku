"""Round-2 art (sheets 13-21, transparent): cut into app images.
Faces are fitted to their dark circle outline, so a neighbor's ring never bleeds in and hair can break out
at the top. Aura rings record where their empty middle is, so an avatar can sit exactly in the hole.
Run with a Python that has pillow, numpy and scipy:  python cut3.py"""
import json, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAW = pathlib.Path(__file__).parent / 'raw'
APP = pathlib.Path(__file__).parents[3] / 'img'
OUT = pathlib.Path(__file__).parent / 'round2'; OUT.mkdir(exist_ok=True)

def load(n):
    a = np.asarray(Image.open(RAW / f'{n}.webp').convert('RGBA')); return a, a[..., 3] > 24

def square(rgba, pad=0):
    im = Image.fromarray(rgba); im = im.crop(im.getbbox()); s = max(im.size) + 2 * pad
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2)); return sq

def pieces(fg, min_area, join=150):
    """Components big enough to be an item, with small loose bits (sparks, stars) joined to the nearest item."""
    lab, n = ndi.label(ndi.binary_dilation(fg, iterations=3)); area = ndi.sum(fg, lab, range(1, n + 1)); objs = ndi.find_objects(lab)
    cen = lambda i: ((objs[i - 1][0].start + objs[i - 1][0].stop) / 2, (objs[i - 1][1].start + objs[i - 1][1].stop) / 2)
    big = [i for i in range(1, n + 1) if area[i - 1] >= min_area]
    owner = np.zeros(n + 1, int)
    for i in big: owner[i] = i
    for i in range(1, n + 1):
        if owner[i]: continue
        d, j = min((np.hypot(cen(i)[0] - cen(b)[0], cen(i)[1] - cen(b)[1]), b) for b in big)
        if d < join: owner[i] = j
    comp = owner[lab]
    items = sorted(big, key=lambda i: (round(cen(i)[0] / 200), cen(i)[1]))  # rows, then left to right
    return [(comp == i) for i in items]

def save(img, path, size):
    img = img.resize((size, size), Image.LANCZOS)
    img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)

meta = {}
# --- G: the cracking scouter (one image)
a, fg = load(13); save(square(a), APP / 'pose' / 'scouter.png', 420)
# --- B: Shenron (one tall image, kept tall)
a, fg = load(18); im = Image.fromarray(a); im = im.crop(im.getbbox()); im = im.resize((360, round(360 * im.height / im.width)), Image.LANCZOS)
im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(APP / 'pose' / 'shenron.png', optimize=True)
# --- E: one Senzu bean
a, fg = load(15); save(square(a), APP / 'pose' / 'senzu.png', 96)
# --- D: Dragon Balls, lit row then grey row, 1 to 7 stars. They touch, so they're split by grid cell.
a, fg = load(16); (APP / 'balls').mkdir(exist_ok=True)
ys, xs = np.nonzero(fg); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max(); ym = (y0 + y1) / 2
rows = [(y0, int(ym)), (int(ym), y1 + 1)]; xsplit = np.linspace(x0, x1 + 1, 8).astype(int)
for r, (ra, rb) in enumerate(rows):
    for c in range(7):
        cell = np.zeros_like(fg); cell[ra:rb, xsplit[c]:xsplit[c + 1]] = True
        # a ball is round: keep the disc fitted to the cell's mask, trimming slivers of the neighbors
        m = fg & cell; yy, xx = np.nonzero(m); cy, cx = (yy.min() + yy.max()) / 2, (xx.min() + xx.max()) / 2
        rad = min(yy.max() - yy.min(), xsplit[c + 1] - xsplit[c]) / 2
        Y, X = np.mgrid[:fg.shape[0], :fg.shape[1]]; disc = np.hypot(Y - cy, X - cx) <= rad
        part = a.copy(); part[..., 3] = np.where(m & disc, part[..., 3], 0)
        save(square(part), APP / 'balls' / f"{'lit' if r == 0 else 'dim'}-{c + 1}.png", 120)
# --- C: three coach poses (wave, think, cheer)
a, fg = load(17)
for name, m in zip(['wave', 'think', 'cheer'], pieces(fg, 20000)):
    part = a.copy(); part[..., 3] = np.where(m, part[..., 3], 0); save(square(part), APP / 'pose' / f'{name}.png', 360)
# --- F: six aura rings; find each ring's empty middle (transparent area the flames enclose)
a, fg = load(14); (APP / 'aura').mkdir(exist_ok=True)
rings = sorted(pieces(fg, 20000, join=220), key=lambda m: np.nonzero(m)[1].mean())  # strictly left to right (SS3 sits higher)
for name, m in zip(['ss1', 'ss2', 'ss3', 'god', 'blue', 'ui'], rings):
    part = a.copy(); part[..., 3] = np.where(m, part[..., 3], 0)
    im = Image.fromarray(part); bb = im.getbbox(); crop = np.asarray(im.crop(bb))
    solid = ndi.binary_closing(crop[..., 3] > 40, iterations=3)
    holes = ndi.binary_fill_holes(solid) & ~solid; lab, n = ndi.label(holes)
    sizes = ndi.sum(holes, lab, range(1, n + 1)); hole = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(hole); h, w = crop.shape[:2]
    S = 240; scale = S / max(h, w); canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    small = Image.fromarray(crop).resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    ox, oy = (S - small.width) // 2, (S - small.height) // 2; canvas.paste(small, (ox, oy))
    canvas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(APP / 'aura' / f'{name}.png', optimize=True)
    r = np.sqrt(hole.sum() / np.pi)
    meta[name] = dict(cx=round((xs.mean() * scale + ox) / S, 4), cy=round((ys.mean() * scale + oy) / S, 4), r=round(r * scale / S, 4))
# --- A1-A3: fighter faces, fitted to their dark circle outline
def faces(n, names):
    a, fg = load(n); H, W = fg.shape; dark = a[..., :3].max(2) < 90
    cols = np.linspace(0, W, len(names) + 1).astype(int); yy, xx = np.mgrid[:H, :W]; fits = []
    for k in range(len(names)):
        sub = fg[:, cols[k]:cols[k + 1]]; ys, xs = np.nonzero(sub); bottom = ys.max(); cw = cols[k + 1] - cols[k]
        # the circle's own outer edge in its lower part (nothing breaks out there): left, right and bottom
        edge = np.zeros_like(fg); edge[:, cols[k]:cols[k + 1]] = sub & ~ndi.binary_erosion(sub, iterations=1)
        ey, ex = np.nonzero(edge & (yy > bottom - cw * .45) & (yy <= bottom))
        A = np.c_[2 * ex, 2 * ey, np.ones(len(ex))]; b = ex ** 2. + ey ** 2.
        cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]; fits.append((cx, cy, np.sqrt(c + cx ** 2 + cy ** 2)))
    for k, (cx, cy, r) in enumerate(fits):
        R = r + 1; d = np.hypot(xx - cx, yy - cy); disc = d < R
        others = np.zeros_like(fg)
        for j, (ox_, oy_, rr) in enumerate(fits):
            if j != k: others |= np.hypot(xx - ox_, yy - oy_) < rr + 8
        out = fg & ~disc & (yy < cy) & ~others & (np.abs(xx - cx) < r + 60)
        lab, nn = ndi.label(out); sizes = ndi.sum(out, lab, range(1, nn + 1))
        touch = set(np.unique(lab[ndi.binary_dilation(disc, iterations=2) & out]))
        keep = np.isin(lab, [i for i in range(1, nn + 1) if sizes[i - 1] > 300 and i in touch])
        alpha = np.where(keep, a[..., 3], a[..., 3] * np.clip(R - d + .5, 0, 1)) * fg
        part = a.copy(); part[..., 3] = alpha.astype(np.uint8)
        save(square(part), APP / 'char' / f'{names[k]}.png', 192)
        meta['face-' + names[k]] = [round(cx), round(cy), round(r)]
faces(21, ['gohan', 'krillin', 'trunks', 'bulma', 'tien'])
faces(20, ['yamcha', 'frieza', 'cell', 'buu', 'android18'])
faces(19, ['broly', 'beerus', 'whis', 'jiren'])
json.dump(meta, open(OUT / 'meta.json', 'w'), indent=1)
print(json.dumps(meta)[:900])
