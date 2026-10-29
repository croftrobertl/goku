// The offline food database (data/foods.json, built by tools/build-foods.py from USDA
// FoodData Central) plus the person's own foods. Loaded once, searched in memory.
import { entries } from './state.js';

const K = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'na', 'sat'];
export const NUTRIENTS = [['kcal', 'Calories', ''], ['p', 'Protein', 'g'], ['c', 'Carbohydrate', 'g'], ['f', 'Fat', 'g'],
  ['sat', 'Saturated fat', 'g'], ['fib', 'Fiber', 'g'], ['sug', 'Sugars', 'g'], ['na', 'Sodium', 'mg']];
export const SOURCE_NOTE = 'Food data: USDA FoodData Central (public domain). Brand items come from the makers’ labels as of October 2026, so check the package if a recipe has changed.';

let db = null, loading = null;
export function loadFoods() {
  if (db) return Promise.resolve(db);
  return loading ||= fetch('data/foods.json').then(r => { if (!r.ok) throw new Error('food list'); return r.json(); }).then(j => {
    db = j.foods.map((a, i) => ({ i, name: a[0], brand: a[1], per: Object.fromEntries(K.map((k, j) => [k, a[2 + j]])), portions: a[10], upc: a[11], src: a[12], unit: a[13],
      key: (a[0] + ' ' + a[1]).toLowerCase() }));
    return db;
  }).catch(e => { loading = null; throw e; });
}
export const foodAt = i => db?.[i] || null;

// Serving choices: the food's own portions, then standard weights or volumes.
export function portionsOf(f) {
  const own = String(f.portions || '').split(';').filter(Boolean).map(s => { const [label, g] = s.split('|'); return { label, g: +g }; }).filter(x => x.g > 0);
  const std = f.unit === 'ml' ? [{ label: 'fl oz (29.6 ml)', g: 29.57 }, { label: '100 ml', g: 100 }, { label: 'ml', g: 1 }]
    : [{ label: 'oz (28.35 g)', g: 28.35 }, { label: '100 g', g: 100 }, { label: 'g', g: 1 }];
  return [...own, ...std];
}

// The serving to offer first: a medium one, else one whole item, else the first listed.
export function defaultPortion(ps) {
  const i = ps.findIndex(x => /\bmedium\b/i.test(x.label));
  if (i >= 0) return i;
  const j = ps.findIndex(x => /^1 (?!.*\b(inch|tbsp|tsp|tablespoon|teaspoon|slice|piece|oz|fl oz|g|ml)\b)/i.test(x.label));
  return j >= 0 ? j : 0;
}

// Nutrients for an amount: per-100 values scaled by grams (or ml). Unknown stays unknown.
export function scale(per, grams) {
  return Object.fromEntries(K.map(k => [k, per[k] == null ? null : Math.round(per[k] * grams / 100 * 10) / 10]));
}
export const sumN = items => Object.fromEntries(K.map(k => [k, Math.round(items.reduce((a, it) => a + (it.n?.[k] || 0), 0) * 10) / 10]));

// The person's own foods (from a label) shaped like database foods.
export async function myFoods() {
  return (await entries('myfood')).map(e => ({ i: 'my:' + e.id, mine: e, name: e.data.name, brand: e.data.brand || '', per: e.data.per, unit: e.data.unit || 'g',
    portions: `${e.data.serving}|${e.data.servingG}`, upc: e.data.upc || '', src: 'mine', key: (e.data.name + ' ' + (e.data.brand || '')).toLowerCase() }));
}

// Ranked search: every word must match; whole words, name starts and plain generic foods rank first.
export function search(list, q, limit = 60) {
  const words = q.toLowerCase().replace(/[^\p{L}\p{N}%&' ]+/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const res = [], esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const starts = words.map(w => new RegExp('(^|[^\\p{L}])' + esc(w), 'u')), whole = words.map(w => new RegExp('(^|[^\\p{L}])' + esc(w) + '($|[^\\p{L}])', 'u'));
  for (const f of list) {
    if (!words.every(w => f.key.includes(w))) continue;
    let s = 0;
    const name = f.name.toLowerCase();
    if (name.startsWith(words[0])) s += 30;
    const head = name.split(',')[0];
    if (head === words.join(' ') || head === words.join(' ') + 's') s += 14; // "Rice, white, cooked" before "Rice milk"
    if (/, nfs\b/.test(name)) s += 6; // the USDA's plain "not further specified" version
    starts.forEach((r, i) => { if (whole[i].test(f.key)) s += 14; else if (r.test(f.key)) s += 6; });
    if (f.src === 'mine') s += 40;
    if (f.src === 'fndds') s += 10; // foods as people eat them: cooked rice, a glass of milk
    if (f.src === 'sr') s += 6;
    s -= name.length / 12;
    res.push([s, f]);
  }
  return res.sort((a, b) => b[0] - a[0]).slice(0, limit).map(x => x[1]);
}

// Barcodes: UPC-A and EAN-13 differ by a leading zero; the database drops leading zeros.
export function byBarcode(list, code) {
  // A typed 8-digit code may be either an EAN-8 or a short UPC-E, so both forms are tried.
  for (const one of String(code).split(',')) {
    const c = one.replace(/\D/g, '').replace(/^0+/, '');
    const f = c && list.find(x => x.upc && x.upc.replace(/^0+/, '') === c);
    if (f) return f;
  }
  return null;
}

export const kcalOf = n => n?.kcal == null ? null : Math.round(n.kcal);
export const fmt = (v, unit = 'g') => v == null ? '—' : (unit === 'mg' ? Math.round(v) : v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + (unit ? ' ' + unit : '');
