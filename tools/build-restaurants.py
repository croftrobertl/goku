#!/usr/bin/env python3
"""Builds data/restaurants.json (2.8): menu items from US restaurant chains, in the food list's row format.

Source: tools/src/restaurants.json, the numbers each chain publishes on its own nutrition page or PDF,
typed in with the page's address and the date it was read. Nutrition facts are facts; only the
numbers and the chains' item names are used. Re-read the pages and update the file when menus change.

Each row: [name, chain, kcal, protein, carbs, fat, fiber, sugar, sodium_mg, satfat, portions, upc, 'chain', unit, from, url]
Values are per 100 g (or ml) when the chain publishes the serving weight. When it doesn't, the row is
stored per serving with unit "srv" and a single portion of 100, so the app offers only "1 serving".
Usage: python3 -I tools/build-restaurants.py (from the goku folder)."""
import json, datetime

src = json.load(open('tools/src/restaurants.json', encoding='utf-8'))
K = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'na', 'sat']

def r1(v): return None if v is None else (round(v) if abs(v) >= 10 else round(v, 1))
def pretty(day): d = datetime.date.fromisoformat(day); return f'{d:%B} {d.day}, {d.year}'

rows, seen = [], set()
for chain in src:
    # No possessive (2.8.2): "McDonald's's" and "Dunkin''s" read wrong.
    # 2.12: "asof" is the date a chain's own guide gives, when it gives one (Whataburger's is from 2021).
    asof = f" as of {pretty(chain['asof'])}" if chain.get('asof') else ''
    when = f"{chain['chain']} nutrition information{', which the chain publishes through Nutritionix' if 'nutritionix' in chain['source'] else ''}{asof}, read {pretty(chain['retrieved'])}"
    for it in chain['items']:
        if it.get('kcal') is None or (chain['chain'], it['name']) in seen: continue
        seen.add((chain['chain'], it['name']))
        size, unit = (it.get('grams'), 'g') if it.get('grams') else (it.get('ml'), 'ml') if it.get('ml') else (None, 'srv')
        per = [r1(it.get(k) * 100 / size) if size and it.get(k) is not None else it.get(k) for k in K]
        label = (it.get('serving') or '1 serving').replace('|', '/').replace(';', ',')[:48]
        rows.append([it['name'][:80], chain['chain'], *per, f'{label}|{r1(size) if size else 100}', '', 'chain', unit, when, it.get('source') or chain['source']])  # an item can have its own page (2.12, Publix)

json.dump(rows, open('data/restaurants.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'items from', len(src), 'chains')
