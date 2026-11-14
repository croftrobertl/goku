#!/usr/bin/env python3
"""Builds a one-file UI review page from tools/review/<batch>/items.json and its shots/ folder.

items.json: {"batch": "...", "title": "...", "items": [{"id", "area", "title", "why",
  "now": [{"img", "caption"}], "options": [{"id", "label", "desc", "img"?, "rec"?}]}]}
Each "img" names a file in shots/. Pictures are shrunk to 600 px wide JPEGs and embedded,
so the page works on a phone with nothing else to load.
Usage: python3 -I tools/review/build.py <batch folder> (from the goku folder)."""
import base64, json, pathlib, subprocess, sys, tempfile

here = pathlib.Path(__file__).parent
folder = pathlib.Path(sys.argv[1])
spec = json.loads((folder / 'items.json').read_text(encoding='utf-8'))

names = {s['img'] for it in spec['items'] for s in it.get('now', [])} | {o['img'] for it in spec['items'] for o in it['options'] if o.get('img')}
images, tmp = {}, pathlib.Path(tempfile.mkdtemp())
for n in sorted(names):
    src = folder / 'shots' / n
    if not src.exists(): sys.exit(f'Missing picture: {src}')
    out = tmp / (src.stem + '.jpg')
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '68', '--resampleWidth', '600', str(src), '--out', str(out)], check=True, capture_output=True)
    images[n] = 'data:image/jpeg;base64,' + base64.b64encode(out.read_bytes()).decode()
spec['images'] = images

data = json.dumps(spec, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
page = (here / 'template.html').read_text(encoding='utf-8').replace('/*DATA*/', data)
dest = folder / 'review.html'
dest.write_text(page, encoding='utf-8')
# A local copy wrapped the way the Artifact host wraps it, for checking in a browser before publishing.
skeleton = ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}'
            'img{max-width:100%}[hidden]{display:none!important}</style></head><body>')
(folder / 'preview.html').write_text(skeleton + page + '</body></html>', encoding='utf-8')
print(f'{dest}: {len(spec["items"])} items, {len(images)} pictures, {len(page.encode()) / 1e6:.1f} MB')
