// The offline food database (data/foods.json, built by tools/build-foods.py from USDA
// FoodData Central) plus the person's own foods. Loaded once, searched in memory.
import { entries } from './state.js';
import { vocabulary, exactFirst, complete } from './fuzzy.js';

const K = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'na', 'sat'];
export const NUTRIENTS = [['kcal', 'Calories', ''], ['p', 'Protein', 'g'], ['c', 'Carbohydrate', 'g'], ['f', 'Fat', 'g'],
  ['sat', 'Saturated fat', 'g'], ['fib', 'Fiber', 'g'], ['sug', 'Sugars', 'g'], ['na', 'Sodium', 'mg']];
export const SOURCE_NOTE = 'Food data: USDA FoodData Central (public domain). Brand items come from the makers’ labels as of October 2026, and restaurant items from each chain’s own nutrition page, so check the package or the chain if a recipe has changed.';

let db = null, loading = null;
export function loadFoods() {
  if (db) return Promise.resolve(db);
  const get = path => fetch(path).then(r => { if (!r.ok) throw new Error('food list'); return r.json(); });
  // Restaurant items (2.8, data/restaurants.json) carry the chain's own page and date as a[14] and a[15].
  return loading ||= Promise.all([get('data/foods.json'), get('data/everyday.json').catch(() => []), get('data/restaurants.json').catch(() => [])]).then(([j, every, chains]) => {
    db = [...every, ...chains, ...j.foods].map((a, i) => ({ i, name: tidyName(a[0], a[12]), brand: a[1], per: Object.fromEntries(K.map((k, j) => [k, a[2 + j]])),
      portions: tidyServing(a[10]), upc: a[11], src: a[12], unit: a[13], ...(a[14] ? { from: a[14], url: a[15] } : {}), key: (a[0] + ' ' + a[1]).toLowerCase() }));
    return db;
  }).catch(e => { loading = null; throw e; });
}

// Brand labels often repeat the flavor at the end ("Chocolate Shake, Chocolate"); that tail is dropped.
export function tidyName(name, src) {
  if (src !== 'brand') return name;
  const parts = name.split(', ');
  if (parts.length < 2) return name;
  const head = parts.slice(0, -1).join(', ').toLowerCase(), tail = parts.at(-1).toLowerCase().split(/[\s;]+/).filter(Boolean);
  return tail.length && tail.every(w => head.includes(w)) ? parts.slice(0, -1).join(', ') : name;
}
// "1 Shake (11.5 fl oz) (345 ml)" reads better as "1 Shake (11.5 fl oz, 345 ml)".
export const tidyServing = p => String(p || '').replace(/\(([^()|;]+)\) \(([^()|;]+)\)/g, '($1, $2)');
export const foodAt = i => db?.[i] || null;

// Serving choices: the food's own portions, then standard weights or volumes.
export function portionsOf(f) {
  const own = String(f.portions || '').split(';').filter(Boolean).map(s => { const [label, g] = s.split('|'); return { label, g: +g }; }).filter(x => x.g > 0);
  // A restaurant item with no published weight is stored per serving ("srv"), so it has no gram or ounce choices.
  if (f.unit === 'srv') return own;
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
let vocab = null;
export const foodVocab = () => vocab ||= vocabulary((db || []).map(f => f.key));
// Completions that actually lead somewhere: each suggested phrase must match at least one food.
export const suggestFoods = q => !db ? [] : complete(foodVocab(), q, 20).filter(s => { const ws = s.split(' '); return db.some(f => ws.every(w => f.key.includes(w))); }).slice(0, 5);

// Ranked search: every typed word (or its synonym or plural) must match; whole words, name
// starts and plain everyday foods rank first. When nothing matches, the empty result carries
// .suggest, a spelling fix to offer ("Did you mean…?"), never one applied on its own.
export const search = (list, q, limit = 60) => exactFirst(db ? foodVocab() : new Map(), q, groups => ranked(list, groups, limit));

function ranked(list, groups, limit) {
  if (!groups.length) return [];
  const res = [], rx = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const starts = groups.map(g => g.map(w => new RegExp('(^|[^\\p{L}])' + rx(w), 'u'))), whole = groups.map(g => g.map(w => new RegExp('(^|[^\\p{L}])' + rx(w) + '($|[^\\p{L}])', 'u')));
  const first = groups[0];
  const phrase = groups.map(g => g[0]).join(' ');
  for (const f of list) {
    if (!groups.every(g => g.some(w => f.key.includes(w)))) continue;
    let s = 0;
    const name = f.name.toLowerCase();
    if (first.some(w => name.startsWith(w))) s += 30;
    const head = name.split(',')[0];
    if (head === phrase || head === phrase + 's') s += 14; // "Rice, white, cooked" before "Rice milk"
    if (/, nfs\b/.test(name)) s += 6; // the USDA's plain "not further specified" version
    groups.forEach((g, i) => { if (whole[i].some(r => r.test(f.key))) s += 14; else if (starts[i].some(r => r.test(f.key))) s += 6; });
    if (f.brand && groups.some(g => g.some(w => f.brand.toLowerCase().includes(w)))) s += 16; // "premier protein" means the brand
    if (f.brand && groups.some(g => g.some(w => f.brand.toLowerCase() === w))) s += 20; // "gu gel" means the brand GU, not gummies
    if (f.src === 'mine') s += 40;
    if (f.src === 'common') s += 45;
    if (f.src === 'chain') s += 8; // "big mac" means McDonald's, not a store-brand sauce // the everyday list: "Apple, medium", "Eggs, scrambled"
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
