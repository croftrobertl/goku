#!/usr/bin/env python3
"""Builds data/everyday.json: friendly names for everyday foods, each pointing at one USDA food.
Usage: python3 -I tools/build-everyday.py   (run from the goku folder, after build-foods.py)
Each line of tools/everyday-foods.txt is "name | words | serving". Every comma-separated phrase in
"words" must appear in the USDA name; survey foods (as eaten) win over SR Legacy, then the shortest
name. The chosen serving moves to the front. Every match is printed so it can be checked by eye."""
import json, re, sys

foods = json.load(open('data/foods.json', encoding='utf-8'))['foods']
generic = [f for f in foods if f[12] in ('fndds', 'sr')]
out, missing = [], []
for line in open('tools/everyday-foods.txt', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#'): continue
    name, words, serving = [x.strip() for x in line.split('|')]
    exact = words.startswith('=') and words[1:].strip().lower()
    phrases = [p.strip().lower() for p in words.split(',') if p.strip()]
    def ok(f):
        n = f[0].lower()
        if exact: return n == exact
        return all(re.search(r'(^|[^a-z])' + re.escape(p) + r'($|[^a-z])', n) for p in phrases)
    cands = sorted((f for f in generic if ok(f)), key=lambda f: (f[12] != 'fndds', len(f[0])))
    if not cands:
        missing.append(name); continue
    f = list(cands[0])
    ps = [p for p in f[10].split(';') if p]
    if '~' in serving:  # "1 cup (8 fl oz)~1 fl oz (NFS)*8": a new serving made from a listed one
        label, rest = serving.split('~'); base, times = rest.rsplit('*', 1)
        src = next((p for p in ps if p.split('|')[0] == base), None)
        if src: ps.insert(0, f"{label}|{round(float(src.split('|')[1]) * float(times), 1)}"); serving = label
    pick = next((p for p in ps if p.split('|')[0].lower().startswith(serving.lower())), None)
    if not pick: print(f'  ! no serving starting "{serving}" for {name}: {[p.split("|")[0] for p in ps]}')
    if pick: ps.remove(pick); ps.insert(0, pick)
    f[10] = ';'.join(ps)
    print(f'{name:38} <- {f[0][:60]:60} [{f[12]}] {f[2]} kcal/100g | first serving: {ps[0] if ps else "100 g"}')
    f[0], f[1], f[12] = name, '', 'common'
    out.append(f)
json.dump(out, open('data/everyday.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(f'\n{len(out)} everyday foods; not matched: {missing}', file=sys.stderr)
