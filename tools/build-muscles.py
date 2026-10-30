#!/usr/bin/env python3
"""Builds img/muscles.svg, the muscle map shown with each exercise (2.4).
Source: tools/src/muscles-front-back.svg, "Muscles front and back.svg" by OpenStax, Tomáš Kebert and
umimeto.org, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/File:Muscles_front_and_back.svg
Changes made here (so this file and img/muscles.svg are CC BY-SA 4.0 too): muscles recolored to a neutral
grey, editor data removed, numbers rounded, and each muscle shape given a class (m-chest, m-quads, ...)
so the app can light up the ones an exercise works (each reads the CSS variable --m-<group>). The right side of each figure mirrors the left, so
one shape per muscle covers both sides. Usage: python3 -I tools/build-muscles.py (from the goku folder)."""
import re, xml.etree.ElementTree as ET

# Muscle group -> shape ids, found by pointing at each muscle on the drawing and checked by eye.
GROUPS = {
  'chest': ['path847'], 'shoulders': ['path861', 'path1452'], 'biceps': ['path881'],
  'forearms': ['path998', 'path1697', 'path908', 'path1797'], 'abs': ['path970', 'path978', 'path1012'],
  'obliques': ['path950'], 'quads': ['path1366', 'path1554'], 'adductors': ['path1440', 'path1337'],
  'hips': ['path1307'], 'shins': ['path1790'], 'neck': ['path919'], 'traps': ['path1268'], 'lats': ['path2220'],
  'triceps': ['path1542', 'path1513'], 'glutes': ['path2744'], 'hamstrings': ['path2803', 'path2931', 'path2900', 'path2962'],
  'calves': ['path3075', 'path3022', 'path1734', 'path1589', 'path1848'], 'upperback': ['path2163', 'path2085'], 'lowback': ['path1867'],
}
RECOLOR = {'#f39079': '#d8d3cb', '#f5a794': '#e0dbd3', '#a45e49': '#8f8a83', '#a35c47': '#8f8a83'}

src = open('tools/src/muscles-front-back.svg', encoding='utf-8').read()
for a, b in RECOLOR.items(): src = re.sub(a, b, src, flags=re.I)
NS = {'svg': 'http://www.w3.org/2000/svg', 'xlink': 'http://www.w3.org/1999/xlink'}
for k, v in NS.items(): ET.register_namespace('' if k == 'svg' else k, v)
root = ET.fromstring(src)
owner = {i: g for g, ids in GROUPS.items() for i in ids}
found = set()
def clean(el, parent):
    for child in list(el):
        tag = child.tag.split('}')[-1]
        if tag in ('metadata', 'namedview', 'path-effect') or 'sodipodi' in child.tag or 'inkscape' in child.tag:
            el.remove(child); continue
        clean(child, el)
    for a in list(el.attrib):
        if 'inkscape' in a or 'sodipodi' in a: del el.attrib[a]
    if el.get('id') in owner:
        g = owner[el.get('id')]
        el.set('class', 'm m-' + g); found.add(el.get('id'))
        # Each muscle's fill reads --m-<group>, so one copy of the drawing can be colored per use.
        st = el.get('style', '')
        base = (re.search(r'fill:([^;]+)', st) or [None, el.get('fill', '#d8d3cb')])[1]
        el.set('style', (re.sub(r'fill:[^;]+;?', '', st).rstrip(';') + ';' if st else '') + f'fill:var(--m-{g},{base})')
        el.attrib.pop('fill', None)
    if 'd' in el.attrib: el.set('d', re.sub(r'-?\d+\.\d+', lambda m: ('%.2f' % float(m.group())).rstrip('0').rstrip('.'), el.get('d')))
clean(root, None)
missing = set(owner) - found
assert not missing, f'shapes not found: {missing}'
root.set('width', '100%'); root.attrib.pop('height', None)
root.set('role', 'img')
out = ET.tostring(root, encoding='unicode')
out = re.sub(r'>\s+<', '><', out)
open('img/muscles.svg', 'w', encoding='utf-8').write('<!-- Based on "Muscles front and back" by OpenStax, Tomáš Kebert & umimeto.org, CC BY-SA 4.0. Recolored and tagged for Goku. -->\n' + out)
print(len(out), 'bytes;', len(found), 'muscle shapes tagged')
