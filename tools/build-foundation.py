#!/usr/bin/env python3
"""Updates the plain foods in data/foods.json with USDA Foundation Foods numbers (2.12). Public domain (CC0).

Usage: python3 -I tools/build-foundation.py <Foundation Foods JSON> <SR Legacy CSV folder>   (from the goku folder,
       after build-foods.py; then run build-everyday.py again)

Downloads (https://fdc.nal.usda.gov/download-datasets):
  Foundation Foods JSON (2026-10-29)   FoodData_Central_foundation_food_json_2026-10-29.zip
                                        (the CSV zip of this release leaves out food.csv and food_nutrient.csv)
  SR Legacy CSV (2018-04)              to link each Foundation food to the SR Legacy food it replaces

Foundation Foods are newer lab analyses of basic foods. USDA gives about half of them the NDB number of the
SR Legacy (2018) food they update, so that row's numbers are replaced here, nutrient by nutrient. A number
Foundation doesn't give (it skips fiber or saturated fat for some foods) keeps the SR Legacy value. The name
and household portions stay as they were. Energy: Foundation's "Energy" when given, else its Atwater
Specific Factors value (as SR Legacy used), else Atwater General.
"""
import csv, json, os, sys

FJSON, SR = sys.argv[1], sys.argv[2]
OUT = 'data/foods.json'
# foods.json columns 2-9: kcal, protein, carbs, fat, fiber, sugar, sodium_mg, satfat
COL = {'203': 3, '205': 4, '204': 5, '291': 6, '269.3': 7, '269': 7, '307': 8, '606': 9}
ENERGY = ('208', '958', '957')

def r1(v): return None if v is None else (round(v) if abs(v) >= 10 else round(v, 1))
def find(name):
    for root, _, files in os.walk(SR):
        if name in files: return os.path.join(root, name)
    raise SystemExit(f'missing {name}')

ndb = {r['NDB_number']: r['fdc_id'] for r in csv.DictReader(open(find('sr_legacy_food.csv'), encoding='utf-8'))}
desc = {r['fdc_id']: r['description'] for r in csv.DictReader(open(find('food.csv'), encoding='utf-8'))}
found = json.load(open(FJSON, encoding='utf-8'))['FoundationFoods']

db = json.load(open(OUT, encoding='utf-8'))
sr = [f for f in db['foods'] if f[12] == 'sr']
# Long SR names are cut to 80 characters in foods.json, so some read the same; those are left alone.
seen = {}
for f in sr: seen[f[0]] = seen.get(f[0], 0) + 1
rows = {f[0]: f for f in sr if seen[f[0]] == 1}
done = kept = 0
for x in found:
    name = desc.get(ndb.get(str(x.get('ndbNumber')), ''), '')[:80]
    row = rows.get(name)
    if not row: continue
    got = {}
    for n in x['foodNutrients']:
        num, a = n['nutrient']['number'], n.get('amount')
        if a is None: continue
        if num in ENERGY and n['nutrient']['unitName'] == 'kcal': got.setdefault(('e', ENERGY.index(num)), a)
        elif num in COL: got.setdefault(COL[num], a)
    e = next((got[('e', i)] for i in range(3) if ('e', i) in got), None)
    if e is None or 3 not in got: continue  # not enough to replace the row
    row[2] = r1(e)
    for c in range(3, 10):
        if c in got: row[c] = r1(got[c])
        else: kept += 1
    done += 1
src = 'USDA FoodData Central: Foundation Foods (October 2026), replacing SR Legacy numbers where USDA links the two'
if src not in db['sources']: db['sources'].insert(1, src)
json.dump(db, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('updated', done, 'SR Legacy foods; numbers Foundation skips, kept from SR Legacy:', kept, file=sys.stderr)
