// The offline food database (data/foods.json, built by tools/build-foods.py from USDA
// FoodData Central) plus the person's own foods. Loaded once, searched in memory.
import { entries } from './state.js';
import { vocabulary, exactFirst, complete, words } from './fuzzy.js';

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
    // The everyday list ends with the USDA foods it copies (2.8.2), hidden so "Banana" shows once.
    const hide = new Set(every.find(x => !Array.isArray(x))?.hide || []);
    every = every.filter(Array.isArray);
    db = [...every, ...chains, ...j.foods.filter(a => !(hide.has(a[0]) && (a[12] === 'fndds' || a[12] === 'sr')))].map((a, i) => ({ i, name: tidyName(a[0], a[12]), brand: a[1], per: Object.fromEntries(K.map((k, j) => [k, a[2 + j]])),
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
// Label unit codes (2.8.2): "2 ONZ (56 g)", "20 Z (56 g)" and "16 OZA (473 ml)" read as "56 g" and "473 ml".
// 2.9: USDA labels in capitals ("1 TEASPOON (4.0 g)") read as "1 teaspoon (4 g)".
const quiet = label => label.replace(/\b[A-Z]{2,}\b/g, w => w.toLowerCase()).replace(/(\d)\.0\b/g, '$1');
export const tidyServing = p => String(p || '').split(';').map(x => { const [label, ...rest] = x.split('|'); return [quiet(label), ...rest].join('|'); }).join(';').replace(/(^|;)\s*[\d./]+\s*(?:ONZ|OZA|GRM|GR|MLT|Z)\s*\(([^()|;]+)\)(?=\|)/gi, '$1$2')
  .replace(/\(([^()|;]+)\) \(([^()|;]+)\)/g, '($1, $2)');
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
// Words seen only once or twice are mostly cut-off label text ("gelat", "gela"), so they're never offered (2.8.2).
export const suggestFoods = q => !db ? [] : complete(foodVocab(), q, 40).filter(s => { const ws = s.split(' '); return foodVocab().get(ws.at(-1)) >= 3 && db.some(f => ws.every(w => f.key.includes(w))); }).slice(0, 5);

// Ranked search: every typed word (or its synonym or plural) must match; whole words, name
// starts and plain everyday foods rank first. When nothing matches, the empty result carries
// .suggest, a spelling fix to offer ("Did you mean…?"), never one applied on its own.
export const search = (list, q, limit = 60) => {
  const chain = chainIn(list, q);
  // A chain's name (2.8.2): "chipotle bowl" lists Chipotle's own items first, the best matches of the other words on top.
  if (chain) {
    const rest = words(q).filter(w => !chain.words.includes(w)), hit = f => rest.filter(w => f.key.includes(w)).length;
    const own = list.filter(f => f.src === 'chain' && f.brand === chain.name).map(f => [hit(f), f]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
    const more = rest.length ? exactFirst(db ? foodVocab() : new Map(), q, groups => ranked(list, groups, limit)).filter(f => !own.includes(f)) : [];
    return [...own, ...more].slice(0, limit);
  }
  return exactFirst(db ? foodVocab() : new Map(), q, groups => ranked(list, groups, limit));
};
// The chain a query names, if any: "mcdonalds", "mcdonald's", "chick fil a", "dunkin".
const squash = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
let chains = null;
function chainIn(list, q) {
  chains ||= [...new Set(list.filter(f => f.src === 'chain').map(f => f.brand))].map(name => ({ name, key: squash(name).replace(/s$/, '') }));
  const ws = words(q.replace(/-/g, ' '));
  for (let n = Math.min(3, ws.length); n >= 1; n--) for (let i = 0; i + n <= ws.length; i++) {
    const k = squash(ws.slice(i, i + n).join('')).replace(/s$/, ''), c = chains.find(c => c.key === k);
    if (c && k.length >= 3) return { ...c, words: ws.slice(i, i + n) };
  }
  return null;
}

// A leading amount (2.8.2): "2 slices pizza" searches "pizza" and opens at 2 slices; "3 eggs" at 3 eggs.
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, '½': 0.5 };
const UNITWORD = /^(slices?|pieces?|cups?|bowls?|cans?|bottles?|glass(?:es)?|scoops?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|servings?|bars?|packets?)$/;
export function parseAmount(q) {
  const ws = q.trim().split(/\s+/);
  const n = /^\d+(?:[.,]\d+)?$/.test(ws[0]) ? +ws[0].replace(',', '.') : NUM[ws[0]?.toLowerCase()];
  // Numbers that are part of a name stay put: "100 calorie pack", "7 up".
  if (!n || n > 20 || ws.length < 2 || (ws.length === 2 && ws[1].length < 3)) return { q, qty: null, unit: '' };
  let i = 1, unit = '';
  if (UNITWORD.test(ws[1].toLowerCase()) && ws.length > 2) {
    unit = ws[1].toLowerCase().replace(/^glasses$/, 'glass').replace(/^(tablespoons?)$/, 'tbsp').replace(/^teaspoons?$/, 'tsp').replace(/^ounces?$/, 'oz').replace(/s$/, '');
    i = 2;
  }
  if (ws[i]?.toLowerCase() === 'of' && ws.length > i + 1) i++;
  return { q: ws.slice(i).join(' '), qty: n, unit };
}
// The serving that fits a typed unit: "slice" finds "1 piece, medium pizza" too.
export function portionFor(ps, unit) {
  if (!unit) return -1;
  const rx = unit === 'slice' || unit === 'piece' ? /\b(slice|piece)/i : new RegExp('\\b' + unit, 'i');
  const i = ps.findIndex(x => rx.test(x.label) && /^1\b/.test(x.label));
  return i >= 0 ? i : ps.findIndex(x => rx.test(x.label));
}

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
    if (f.src === 'chain') s += 8 + (groups.every((g, i) => whole[i].some(r => r.test(name))) ? 40 : 0); // "big mac" means McDonald's own item, above copies of its name (2.8.2)
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
