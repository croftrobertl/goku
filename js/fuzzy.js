// Forgiving search (2.1): typo correction, plurals, synonyms and word completion, shared by
// the food search and the exercise picker. Works on a vocabulary of the words in a list, so a
// misspelling is checked against ~15,000 words, not every item.

// Common shorthand and the words the lists actually use.
export const SYNONYMS = {
  oats: ['oatmeal', 'oats'], oatmeal: ['oatmeal', 'oats'], pb: ['peanut butter'], pbj: ['peanut butter', 'jelly'], oj: ['orange juice'],
  mac: ['macaroni'], fries: ['french fries', 'fries'], ketchup: ['catsup', 'ketchup'], catsup: ['catsup', 'ketchup'], burger: ['hamburger', 'burger'],
  hotdog: ['frankfurter', 'hot dog'], soda: ['soft drink', 'cola', 'soda'], coke: ['cola'], pop: ['soft drink', 'cola'], yoghurt: ['yogurt'],
  doughnut: ['doughnut', 'donut'], donut: ['doughnut', 'donut'], chickpeas: ['chickpeas', 'garbanzo'], garbanzo: ['chickpeas', 'garbanzo'],
  shake: ['shake', 'smoothie'], ramen: ['ramen', 'noodles'], tuna: ['tuna'], eggs: ['egg'], spuds: ['potato'], spud: ['potato'],
  sub: ['submarine sandwich', 'sub'], hoagie: ['submarine sandwich'], froyo: ['frozen yogurt'], icecream: ['ice cream'], pbandj: ['peanut butter', 'jelly'],
  // exercises
  pushup: ['push-up', 'push up'], pushups: ['push-up'], pullup: ['pull-up'], pullups: ['pull-up'], chinup: ['chin-up'], situp: ['crunch', 'sit-up'],
  abs: ['core', 'abs'], bicep: ['biceps'], tricep: ['triceps'], quads: ['quads'], glute: ['glutes'], butt: ['glutes'], booty: ['glutes'],
  lats: ['lats'], traps: ['traps'], hammies: ['hamstrings'], hamstring: ['hamstrings'], cardio: ['cardio'], stretch: ['stretch', 'mobility'],
  dumbbell: ['dumbbell'], db: ['dumbbell'], kb: ['kettlebell'], bb: ['barbell'], rdl: ['romanian deadlift'], ohp: ['overhead press'],
};

// Optimal string alignment distance (Levenshtein plus swapped neighbors), stopping early past max.
export function dist(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v); if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}

export const words = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);

// A vocabulary: each word with how many items use it.
export function vocabulary(texts) {
  const v = new Map();
  for (const t of texts) for (const w of new Set(words(t))) if (w.length >= 3) v.set(w, (v.get(w) || 0) + 1);
  return v;
}

// The closest real word for a typed one (or the word itself when it's already known).
export function correct(vocab, w) {
  if (w.length < 3 || vocab.has(w)) return w;
  if (w.endsWith('s') && vocab.has(w.slice(0, -1))) return w.slice(0, -1);
  if (vocab.has(w + 's')) return w + 's';
  const max = w.length < 5 ? 1 : 2;
  let best = null, bd = max + 1, bc = 0;
  for (const [cand, count] of vocab) {
    if (Math.abs(cand.length - w.length) > max) continue;
    const d = dist(w, cand, max);
    if (d < bd || (d === bd && (cand[0] === w[0]) && count > bc)) { best = cand; bd = d; bc = count; }
  }
  return best || w;
}

// Turns a typed query into the words to look for: synonyms first, then spelling fixes.
// Returns { groups: [[alternatives...], ...], fixed: the corrected query or '' when unchanged }.
export function expand(vocab, q) {
  const typed = words(q.replace(/-/g, ' '));
  const joined = typed.join('');
  const groups = [], shown = [];
  for (const w of SYNONYMS[joined] && typed.length > 1 ? [joined] : typed) {
    if (SYNONYMS[w]) { groups.push(SYNONYMS[w]); shown.push(w); continue; }
    const c = correct(vocab, w);
    groups.push(c === w ? [w] : [c, w]); shown.push(c);
  }
  const fixed = shown.join(' ');
  return { groups, fixed: fixed !== typed.join(' ') && !typed.some(w => SYNONYMS[w]) ? fixed : '' };
}

// Word completions for the last, half-typed word: the most-used words that start with it.
export function complete(vocab, q, n = 5) {
  const typed = words(q);
  const last = typed.at(-1) || '';
  if (last.length < 2 || /\s$/.test(q)) return [];
  const head = typed.slice(0, -1).join(' ');
  return [...vocab].filter(([w]) => w.startsWith(last) && w !== last).sort((a, b) => b[1] - a[1]).slice(0, n)
    .map(([w]) => (head ? head + ' ' : '') + w);
}
