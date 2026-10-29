#!/usr/bin/env python3
"""Builds Goku's offline food database from USDA FoodData Central (public domain, CC0).

Usage: python3 -I tools/build-foods.py <folder with the unzipped FDC CSV releases> <goku/data>

Sources (download from https://fdc.nal.usda.gov/download-datasets):
  SR Legacy (2018-04)        generic foods with household portions
  FNDDS survey (2024-10-31)  foods as eaten (smoothies, sandwiches, cereals with milk) with portions
  Branded (2026-10-29)       label data; only a list of well-known US brands is kept

Writes data/foods.json: {v, built, sources, n: [fields], foods: [[...], ...]}
Each food: [name, brand, kcal, protein, carbs, fat, fiber, sugar, sodium_mg, satfat, portions, upc, src, unit]
Nutrients are per 100 g (or per 100 ml when unit is "ml"). Portions: "label|grams;label|grams".
"""
import csv, glob, json, os, re, sys
csv.field_size_limit(10**9)

SRC, OUT = sys.argv[1], sys.argv[2]
N = {'1008': 2, '2047': 2, '1003': 3, '1005': 4, '1004': 5, '1079': 6, '2000': 7, '1093': 8, '1258': 9,
     # FNDDS survey foods use the older nutrient numbers
     '208': 2, '203': 3, '205': 4, '204': 5, '291': 6, '269': 7, '307': 8, '606': 9}

def table(release, name):
    paths = glob.glob(os.path.join(SRC, f'*{release}*', '**', name), recursive=True)
    if not paths: raise SystemExit(f'missing {release}/{name}')
    with open(paths[0], newline='', encoding='utf-8') as f:
        yield from csv.DictReader(f)

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def r1(v): return None if v is None else (round(v) if abs(v) >= 10 else round(v, 1))

def nutrients(release, ids):
    out = {}
    for row in table(release, 'food_nutrient.csv'):
        i = row['fdc_id']
        if i not in ids: continue
        k = N.get(row['nutrient_id'])
        if k is None: continue
        a = num(row['amount'])
        if a is None: continue
        d = out.setdefault(i, {})
        if k == 2 and row['nutrient_id'] == '2047' and 2 in d: continue  # prefer plain Energy (1008)
        d[k] = a
    return out

SMALL = {'a', 'an', 'and', 'or', 'of', 'with', 'in', 'on', 'the', 'to', 'for', 'oz', 'fl', 'g', 'ml', 'lb'}
def tidy(s):
    """Branded names arrive in capitals; make them readable without losing brand words."""
    s = re.sub(r'\s+', ' ', s or '').strip()
    if sum(c.isupper() for c in s) > 0.6 * max(1, sum(c.isalpha() for c in s)):
        words = s.lower().split(' ')
        s = ' '.join(w if (i and w in SMALL) else w[:1].upper() + w[1:] for i, w in enumerate(words))
    return s[:80]

foods = []

# ---------- Generic: SR Legacy and FNDDS ----------
def generic(release, tag):
    names = {r['fdc_id']: r['description'] for r in table(release, 'food.csv')
             if r['data_type'] in ('sr_legacy_food', 'survey_fndds_food')}
    units = {r['id']: r['name'] for r in table(release, 'measure_unit.csv')}
    portions = {}
    for r in table(release, 'food_portion.csv'):
        g = num(r['gram_weight'])
        if r['fdc_id'] not in names or not g or g <= 0: continue
        desc = (r.get('portion_description') or '').strip()
        if not desc or desc.lower() == 'quantity not specified':
            amt, unit, mod = (r.get('amount') or '').strip(), units.get(r.get('measure_unit_id'), ''), (r.get('modifier') or '').strip()
            if unit == 'undetermined': unit = ''
            if mod.isdigit(): mod = ''  # FNDDS modifiers are codes, not words
            desc = ' '.join(x for x in [re.sub(r'\.0$', '', amt), unit, mod] if x).strip()
        if not desc or desc.lower() == 'quantity not specified': continue
        desc = desc.replace('|', '/').replace(';', ',')[:48]
        portions.setdefault(r['fdc_id'], [])
        if all(p[0] != desc for p in portions[r['fdc_id']]): portions[r['fdc_id']].append((desc, round(g, 1)))
    nut = nutrients(release, set(names))
    for i, name in names.items():
        d = nut.get(i, {})
        if 2 not in d: continue
        ps = ';'.join(f'{a}|{g}' for a, g in portions.get(i, [])[:6])
        foods.append([name[:80], '', r1(d.get(2)), r1(d.get(3)), r1(d.get(4)), r1(d.get(5)), r1(d.get(6)), r1(d.get(7)), r1(d.get(8)), r1(d.get(9)), ps, '', tag, 'g'])

generic('sr_legacy', 'sr')
generic('survey', 'fndds')
print('generic', len(foods), file=sys.stderr)

# ---------- Branded: well-known US brands only ----------
BRANDS = [l.strip().lower() for l in open(os.path.join(os.path.dirname(__file__), 'food-brands.txt'), encoding='utf-8')
          if l.strip() and not l.startswith('#')]
PER_BRAND, TOTAL = 260, 20000
def brand_of(row):
    owner, name = (row['brand_owner'] or '').lower(), (row['brand_name'] or '').lower()
    for b in BRANDS:
        if name == b or name.startswith(b + ' ') or owner == b or owner.startswith(b + ' ') or owner.startswith(b + ','):
            return b
    return None

desc = {r['fdc_id']: r['description'] for r in table('branded', 'food.csv')}
picked = {}
for r in table('branded', 'branded_food.csv'):
    if r.get('market_country') not in ('United States', '') or r.get('discontinued_date'): continue
    b = brand_of(r)
    if not b: continue
    size, unit = num(r['serving_size']), (r['serving_size_unit'] or '').lower()
    if not size or unit not in ('g', 'grm', 'ml', 'mlt'): continue
    key = (r['gtin_upc'] or '') or (b, desc.get(r['fdc_id'], ''))
    old = picked.get(key)
    if old and old['modified_date'] >= r['modified_date']: continue
    picked[key] = {**r, '_b': b, '_unit': 'ml' if unit in ('ml', 'mlt') else 'g', '_size': size}
# Newest products first, capped per brand so a giant store brand can't crowd out the rest.
by_brand = {}
for r in sorted(picked.values(), key=lambda r: r['modified_date'], reverse=True):
    lst = by_brand.setdefault(r['_b'], [])
    if len(lst) < PER_BRAND: lst.append(r)
chosen = [r for lst in by_brand.values() for r in lst]
chosen.sort(key=lambda r: r['modified_date'], reverse=True)
chosen = chosen[:TOTAL]
nut = nutrients('branded', {r['fdc_id'] for r in chosen})
nb = 0
for r in chosen:
    d = nut.get(r['fdc_id'], {})
    if 2 not in d: continue
    house = re.sub(r'\s+', ' ', r['household_serving_fulltext'] or '').strip().replace('|', '/').replace(';', ',')
    u = r['_unit']
    label = (f'{house} ({r1(r["_size"])} {u})' if house and not re.search(r'\d+\s*(g|ml)\b', house, re.I) else house or f'1 serving ({r1(r["_size"])} {u})')[:48]
    brand = tidy(r['brand_name'] or r['brand_owner'])[:40]
    name = tidy(desc.get(r['fdc_id'], ''))
    if brand and name.lower().startswith(brand.lower()): name = name[len(brand):].strip(' -,') or name
    foods.append([name[:80], brand, r1(d.get(2)), r1(d.get(3)), r1(d.get(4)), r1(d.get(5)), r1(d.get(6)), r1(d.get(7)), r1(d.get(8)), r1(d.get(9)),
                  f'{label}|{r1(r["_size"])}', (r['gtin_upc'] or '').lstrip('0'), 'brand', u])
    nb += 1
print('branded', nb, 'brands', len(by_brand), file=sys.stderr)

os.makedirs(OUT, exist_ok=True)
out = {'v': 1, 'built': '2026-10-29',
       'sources': ['USDA FoodData Central: SR Legacy (April 2018)', 'USDA FoodData Central: FNDDS survey foods (October 2024)',
                   'USDA FoodData Central: Branded Foods (October 2026), label data supplied by manufacturers'],
       'n': ['name', 'brand', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium', 'satfat', 'portions', 'upc', 'src', 'unit'],
       'foods': foods}
with open(os.path.join(OUT, 'foods.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('total', len(foods), os.path.getsize(os.path.join(OUT, 'foods.json')), file=sys.stderr)
