#!/usr/bin/env python3
"""Builds Goku's scan-only barcode files from USDA FoodData Central Branded Foods (public domain, CC0).

Usage: python3 -I tools/build-barcodes.py <unzipped branded CSV folder> <goku/data>

data/foods.json holds the searchable list (about 105,000 branded products). Every other current
US product with a barcode goes here instead, so a scan can still find it (2.11, after a KIND
breakfast bar wasn't found: USDA had 478 KIND barcodes and the search list kept 238).

Files: data/upc/<first 3 digits>.json, each {"v", "built", "foods": [[...], ...]} in the same
food format as foods.json. Barcodes have their leading zeros dropped, as in foods.json, and are
grouped by the first 3 digits that remain. The app fetches one small file the first time a
barcode in that group is scanned, and keeps it for offline use.
"""
import csv, glob, json, os, re, sys
csv.field_size_limit(10**9)

SRC, OUT = sys.argv[1], sys.argv[2]
BUILT = '2026-11-05'
N = {'1008': 2, '2047': 2, '1003': 3, '1005': 4, '1004': 5, '1079': 6, '2000': 7, '1093': 8, '1258': 9}

def table(name):
    paths = glob.glob(os.path.join(SRC, '**', name), recursive=True)
    if not paths: raise SystemExit(f'missing {name}')
    with open(paths[0], newline='', encoding='utf-8') as f:
        yield from csv.DictReader(f)

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def r1(v): return None if v is None else (round(v) if abs(v) >= 10 else round(v, 1))

# Same name clean-up as build-foods.py: branded names arrive in capitals.
SMALL = {'a', 'an', 'and', 'or', 'of', 'with', 'in', 'on', 'the', 'to', 'for', 'oz', 'fl', 'g', 'ml', 'lb'}
def tidy(s):
    s = re.sub(r'\s+', ' ', s or '').strip()
    if sum(c.isupper() for c in s) > 0.6 * max(1, sum(c.isalpha() for c in s)):
        words = s.lower().split(' ')
        s = ' '.join(w if (i and w in SMALL) else w[:1].upper() + w[1:] for i, w in enumerate(words))
    return s[:80]

have = {str(f[11]).lstrip('0') for f in json.load(open(os.path.join(OUT, 'foods.json'), encoding='utf-8'))['foods'] if f[11]}

# The newest record for each current US barcode that isn't in the search list already.
picked = {}
for r in table('branded_food.csv'):
    if r.get('market_country') not in ('United States', '') or r.get('discontinued_date'): continue
    upc = re.sub(r'\D', '', r['gtin_upc'] or '').lstrip('0')
    if len(upc) < 6 or upc in have: continue
    size, unit = num(r['serving_size']), (r['serving_size_unit'] or '').lower()
    if not size or unit not in ('g', 'grm', 'ml', 'mlt'): continue
    old = picked.get(upc)
    if old and old['modified_date'] >= r['modified_date']: continue
    picked[upc] = {'fdc_id': r['fdc_id'], 'modified_date': r['modified_date'], 'brand': r['brand_name'] or r['brand_owner'],
                   'house': r['household_serving_fulltext'], 'size': size, 'unit': 'ml' if unit in ('ml', 'mlt') else 'g'}
print('barcodes', len(picked), file=sys.stderr)

ids = {p['fdc_id'] for p in picked.values()}
desc = {r['fdc_id']: r['description'] for r in table('food.csv') if r['fdc_id'] in ids}
nut = {}
for row in table('food_nutrient.csv'):
    i = row['fdc_id']
    if i not in ids: continue
    k = N.get(row['nutrient_id']); a = num(row['amount'])
    if k is None or a is None: continue
    d = nut.setdefault(i, {})
    if k == 2 and row['nutrient_id'] == '2047' and 2 in d: continue  # prefer plain Energy (1008)
    d[k] = a

groups = {}
for upc, p in picked.items():
    d = nut.get(p['fdc_id'], {})
    if 2 not in d: continue
    house = re.sub(r'\s+', ' ', p['house'] or '').strip().replace('|', '/').replace(';', ',')
    u = p['unit']
    label = (f'{house} ({r1(p["size"])} {u})' if house and not re.search(r'\d+\s*(g|ml)\b', house, re.I) else house or f'1 serving ({r1(p["size"])} {u})')[:48]
    brand = tidy(p['brand'])[:40]
    name = tidy(desc.get(p['fdc_id'], ''))
    if brand and name.lower().startswith(brand.lower()): name = name[len(brand):].strip(' -,') or name
    if not name: continue
    groups.setdefault(upc[:3], []).append([name[:80], brand, r1(d.get(2)), r1(d.get(3)), r1(d.get(4)), r1(d.get(5)), r1(d.get(6)), r1(d.get(7)),
                                           r1(d.get(8)), r1(d.get(9)), f'{label}|{r1(p["size"])}', upc, 'brand', u])

folder = os.path.join(OUT, 'upc')
os.makedirs(folder, exist_ok=True)
for f in glob.glob(os.path.join(folder, '*.json')): os.remove(f)
# A big group (some makers' barcodes start the same) is split one digit further, so a first scan
# downloads at most a few hundred KB: <3 digits>.json then just says {"split": 4}, and so on.
SPLIT = 3000
files = {}
def place(k, foods):
    if len(foods) <= SPLIT or len(k) >= 7: files[k] = {'v': 1, 'built': BUILT, 'foods': foods}; return
    files[k] = {'v': 1, 'built': BUILT, 'split': len(k) + 1}  # and again, until each file is small
    sub = {}
    for a in foods: sub.setdefault(a[11][:len(k) + 1], []).append(a)
    for k2, f2 in sub.items(): place(k2, f2)
for k, foods in groups.items(): place(k, foods)
total = size = 0
for k, body in sorted(files.items()):
    path = os.path.join(folder, k + '.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(body, f, ensure_ascii=False, separators=(',', ':'))
    total += len(body.get('foods', [])); size += os.path.getsize(path)
print('files', len(files), 'foods', total, 'bytes', size, 'biggest', max(len(b.get('foods', [])) for b in files.values()), file=sys.stderr)
