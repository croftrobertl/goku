"""Cut the coach-pose and face sheets (solid white backgrounds) into transparent PNGs, plus variants:
coach poses without the baked-in text banner, and faces clipped to their circle."""
import numpy as np, pathlib, json
from PIL import Image
from scipy import ndimage as ndi

RAW = pathlib.Path('/Users/rob/goku/tools/review/renders/raw'); OUT = pathlib.Path('/Users/rob/goku/tools/review/renders/chars'); OUT.mkdir(exist_ok=True)

def unwhite(path):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.int16); mn, mx = im.min(2), im.max(2)
    light = (mn > 222) & ((mx - mn) < 26)
    lab, _ = ndi.label(light); edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0]); fg = ~bg
    alpha = fg.astype(np.float32)
    band = fg & ~ndi.binary_erosion(fg, iterations=3)          # soft edge: white turns into transparency
    soft = np.clip((255 - mn) / (255 - 30), 0, 1)
    alpha[band] = np.minimum(1, soft[band] * 1.2)
    rgb = im.astype(np.float32); a3 = np.maximum(alpha, 1e-3)[..., None]
    col = np.where(band[..., None], np.clip((rgb - 255 * (1 - a3)) / a3, 0, 255), rgb)
    return np.dstack([col, alpha * 255]).astype(np.uint8), fg

def pieces(fg, min_h):
    lab, k = ndi.label(ndi.binary_dilation(fg, iterations=4))
    out = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h >= min_h and w >= min_h * .6: out.append((sl, i, lab))
    return sorted(out, key=lambda p: (p[0][0].start // 200, p[0][1].start))

def square(rgba):
    im = Image.fromarray(rgba); bb = im.getbbox(); im = im.crop(bb); s = max(im.size)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2)); return sq

meta = {}
# --- coach poses (sheet 11): 6 badges
rgba, fg = unwhite(RAW / '11.webp')
POSES = ['coach', 'recharge', 'yougotthis', 'restday', 'letstrain', 'protips']
for name, (sl, i, lab) in zip(POSES, pieces(fg, 250)):
    part = rgba[sl].copy(); part[..., 3] = np.where(lab[sl] == i, part[..., 3], 0)
    square(part).save(OUT / f'pose-{name}.png')
    # without text: the banner is the lowest ~31% of the badge; keep everything above it
    h = part.shape[0]; cut = int(h * .66)
    top = part[:cut].copy()
    # fade the last 18 px so the cut edge isn't a hard line
    fade = np.linspace(1, 0, 18)[:, None]; top[-18:, :, 3] = (top[-18:, :, 3] * fade).astype(np.uint8)
    square(top).save(OUT / f'pose-{name}-notext.png')
# --- faces (sheet 12): 5 round portraits (names under them are smaller and skipped)
rgba, fg = unwhite(RAW / '12.webp')
FACES = ['goku', 'gokusleep', 'vegeta', 'piccolo', 'roshi']
for name, (sl, i, lab) in zip(FACES, pieces(fg, 250)):
    part = rgba[sl].copy(); mine = lab[sl] == i; part[..., 3] = np.where(mine, part[..., 3], 0)
    square(part).save(OUT / f'face-{name}.png')
    # clipped: fit the circle from the lower half of the outline (hair only breaks out at the top and sides)
    ys, xs = np.nonzero(mine & ~ndi.binary_erosion(mine, iterations=1)); H = mine.shape[0]
    keep = ys > H * .55; ys, xs = ys[keep].astype(float), xs[keep].astype(float)
    Am = np.c_[2 * xs, 2 * ys, np.ones_like(xs)]; bm = xs ** 2 + ys ** 2
    cx, cy, c = np.linalg.lstsq(Am, bm, rcond=None)[0]; r = np.sqrt(c + cx ** 2 + cy ** 2) - 2
    yy, xx = np.mgrid[:H, :mine.shape[1]]; d = np.hypot(xx - cx, yy - cy)
    a = np.clip(r - d + .5, 0, 1); clip = part.copy(); clip[..., 3] = (clip[..., 3] * a).astype(np.uint8)
    y0, y1, x0, x1 = int(max(0, cy - r - 2)), int(cy + r + 3), int(max(0, cx - r - 2)), int(cx + r + 3)
    square(clip[y0:y1, x0:x1]).save(OUT / f'face-{name}-circle.png')
    meta[name] = dict(cx=round(cx), cy=round(cy), r=round(r))
print(sorted(p.name for p in OUT.glob('*.png'))); print(meta)
