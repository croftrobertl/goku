// Checks and cleans everything that comes from an imported backup, so a bad or
// hostile file can never break the app or inject markup.
import { THEMES } from './themes.js';
import { SKINS } from './skins.js';
import { SPORTS, STYLES } from './state.js';
import { GEAR } from './moves.js';
const ID = /^[A-Za-z0-9:._-]{1,100}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// A real calendar day between 2000 and tomorrow (2.15): impossible or ancient dates would break the streak count.
const realDay = d => { if (!DAY.test(d || '')) return false; if (d === '1970-01-01') return true; /* library items (exercises, saved foods and meals) use this day */ const t = Date.parse(d + 'T00:00:00Z'); return isFinite(t) && new Date(t).toISOString().slice(0, 10) === d && d >= '2000-01-01' && t <= Date.now() + 2 * 86400000; };
const KINDS = ['engine', 'perf'];

const num = (v, lo, hi, d = null) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, lo, hi, d = null) => { const n = num(v, lo, hi, d); return n === null ? null : Math.round(n); };
const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
const bool = v => v === true;
const strs = (v, max, each) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, each)).slice(0, max) : []);
const nums = (v, max, lo, hi) => (Array.isArray(v) ? v.map(x => num(x, lo, hi)).filter(x => x !== null).slice(0, max) : []);

const tzOk = tz => { if (typeof tz !== 'string' || tz.length > 60) return false; try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
const oneOf = (v, list) => (list.includes(v) ? v : undefined);
const pick = (v, list) => (Array.isArray(v) ? v.filter(x => list.includes(x)) : undefined);
function cleanAbout(a) {
  if (!a || typeof a !== 'object') return {};
  const o = {
    birthYear: int(a.birthYear, 1900, 2100) ?? undefined, heightIn: num(a.heightIn, 20, 110) ?? undefined,
    weightLb: num(a.weightLb, 30, 800) ?? undefined, weightAt: num(a.weightAt, 0, 1e14) ?? undefined,
    experience: oneOf(a.experience, ['new', 'back', '0', '1', '3', '5', '10']), goal: typeof a.goal === 'string' && /^\w{1,20}$/.test(a.goal) ? a.goal : undefined,
    equipment: pick(a.equipment, GEAR), days: oneOf(a.days, ['2', '3', '4', '5', '6', '7']),
    diet: oneOf(a.diet, ['any', 'pescatarian', 'vegetarian', 'vegan']),
    allergies: pick(a.allergies, ['dairy', 'gluten', 'peanuts', 'nuts', 'eggs', 'soy', 'fish', 'shellfish']),
    allergyOther: typeof a.allergyOther === 'string' ? str(a.allergyOther, 80) : undefined,
    limits: typeof a.limits === 'string' ? str(a.limits, 300) : undefined, meals: oneOf(a.meals, ['2', '3', '4', '5', '6']),
    likes: Array.isArray(a.likes) ? strs(a.likes, 30, 40) : undefined, sleepH: num(a.sleepH, 3, 12) ?? undefined,
    comp: typeof a.comp === 'string' && (a.comp === '' || DAY.test(a.comp)) ? a.comp : undefined,
  };
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}
function cleanCoach(c) {
  if (!c || typeof c !== 'object') return undefined;
  const asked = Object.fromEntries(Object.entries(c.asked || {}).filter(([k, v]) => /^\w{1,20}$/.test(k) && DAY.test(v || '')).slice(0, 50));
  const feel = c.feel && DAY.test(c.feel.day || '') && ['easy', 'right', 'hard'].includes(c.feel.v) ? { day: c.feel.day, v: c.feel.v, ...([10, 20, 50, 100].includes(c.feel.g) ? { g: c.feel.g } : {}) } : undefined;
  const seen = k => (k === 'recapSeen' ? DAY.test(c[k] || '') : ID.test(c[k] || '')) ? { [k]: c[k] } : {};
  const balls = Array.isArray(c.balls) ? [...new Set(c.balls.filter(n => Number.isInteger(n) && n >= 1 && n <= 7))].sort() : null;
  const wish = ['theme', 'aura', 'title'].includes(c.wish) ? { wish: c.wish } : {};
  return { asked, ...(feel ? { feel } : {}), ...seen('recapSeen'), ...seen('progSeen'), ...(balls ? { balls } : {}), ...wish };
}
function cleanCustom(c) {
  if (!c || typeof c !== 'object') return undefined;
  const sports = Array.isArray(c.sports) ? [...new Set(c.sports.filter(s => SPORTS.some(x => x[0] === s) || (typeof s === 'string' && /^[a-z]{2,16}$/.test(s))))].slice(0, 20) : []; // 2.18: any sport Log Activity knows
  return { sports, style: STYLES.some(x => x[0] === c.style) ? c.style : 'both' };
}
function cleanAvatar(v) {
  if (!v || typeof v !== 'object') return null;
  if (['char', 'aura', 'beads'].includes(v.type) && /^\w{1,20}$/.test(v.id || '')) return { type: v.type, id: v.id };
  if (v.type === 'photo' && typeof v.img === 'string' && v.img.length < 300000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.img)) return { type: 'photo', img: v.img };
  return null;
}

export const AREAS = ['Neck', 'Shoulders', 'Elbows', 'Wrists', 'Upper back', 'Lower back', 'Hips', 'Knees', 'Ankles', 'Feet'];

const stages = v => (Array.isArray(v) ? v.slice(0, 8).map(s => ({ label: str(s?.label, 40), load: num(s?.load, 0, 2000), reps: int(s?.reps, 0, 10000, 0) })) : []);

const ids = v => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && /^\w{1,20}$/.test(x)))].slice(0, 40) : [];

// Food log items carry their own numbers; every field is checked and anything odd dropped.
const NK = ['kcal', 'p', 'c', 'f', 'fib', 'sug', 'na', 'sat'];
const per = v => Object.fromEntries(NK.map(k => [k, v && typeof v === 'object' ? num(v[k], 0, 100000) : null]));
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
function foodItem(it) {
  if (!it || typeof it !== 'object') return null;
  const base = { meal: MEALS.includes(it.meal) ? it.meal : 'snacks', name: str(it.name, 80).trim() || 'Food', brand: str(it.brand, 40), n: per(it.n) };
  if (it.quick === true) return { ...base, quick: true };
  return { ...base, src: ['sr', 'fndds', 'fdn', 'brand', 'chain', 'common', 'mine'].includes(it.src) ? it.src : 'mine', per: per(it.per), unit: ['ml', 'srv'].includes(it.unit) ? it.unit : 'g',
    portions: str(it.portions, 400), pl: str(it.pl, 48) || 'serving', pg: num(it.pg, 0.1, 5000, 100), qty: num(it.qty, 0.01, 5000, 1) };
}

const DATA = {
  exercise: d => ({ name: str(d.name, 40), slot: str(d.slot, 12, 'push'), ...(/^[a-z]{1,12}$/.test(d.group || '') ? { group: d.group } : {}), module: d.module === 'soccer' ? 'soccer' : null,
    order: int(d.order, 0, 10000, 999), mode: d.mode === 'hold' ? 'hold' : 'reps', ...(/^[a-z0-9-]{1,40}$/.test(d.moveId || '') ? { moveId: d.moveId } : {}),
    stages: stages(d.stages).map(({ label, load }) => ({ label, load })), ...([60, 90, 120].includes(d.rest) ? { rest: d.rest } : {}) }),
  session: d => ('kind' in d
    ? { kind: d.kind === 'vault' ? 'vault' : 'gym', minutes: int(d.minutes, 0, 1440, 0), effort: int(d.effort, 0, 10, 0) }
    : { gravity: [10, 20, 50, 100].includes(d.gravity) ? d.gravity : 50, startedAt: num(d.startedAt, 0, 1e14, 0), endedAt: num(d.endedAt, 0, 1e14, 0),
      sets: Array.isArray(d.sets) ? d.sets.slice(0, 500).map(s => ({ exId: ID.test(s?.exId) ? s.exId : '', name: str(s?.name, 40), slot: str(s?.slot, 12),
        round: int(s?.round, 1, 100, 1), stages: stages(s?.stages) })) : [],
      repTimes: nums(d.repTimes, 20000, 0, 1e6), ...(d.starter === true ? { starter: true } : {}) }),
  gut: d => ({ amWaist: num(d.amWaist, 10, 100), pmWaist: num(d.pmWaist, 10, 100), bloat: int(d.bloat, 0, 10), foods: strs(d.foods, 100, 40),
    fluidsOz: num(d.fluidsOz, 0, 1000, 0), supplements: strs(d.supplements, 50, 40), protein: nums(d.protein, 100, 0, 500),
    ...(Array.isArray(d.supps) ? { supps: d.supps.slice(0, 50).filter(x => x && typeof x === 'object' && str(x.name, 40).trim()).map(x => ({ name: str(x.name, 40).trim(), dose: num(x.dose, 0, 100000),
      unit: ['mg', 'mcg', 'g', 'IU', 'mL'].includes(x.unit) ? x.unit : 'mg', form: ['capsule', 'tablet', 'softgel', 'gummy', 'scoop', 'packet', 'drop', 'shot', 'serving'].includes(x.form) ? x.form : 'serving',
      qty: int(x.qty, 1, 20, 1) })) } : {}),
    ...Object.fromEntries(['heartburn', 'cramps', 'gas', 'nausea', 'lowEnergy'].filter(k => d[k] === true).map(k => [k, true])),
    // 2.14 daily check-in: 1 to 5 answers and last night's sleep, kept only when answered
    ...Object.fromEntries(['energy', 'soreness', 'stress', 'mood'].map(k => [k, int(d[k], 1, 5)]).filter(([, v]) => v !== null)),
    ...(num(d.sleepH, 0, 14) !== null ? { sleepH: num(d.sleepH, 0, 14) } : {}) }),
  food: d => ({ items: Array.isArray(d.items) ? d.items.slice(0, 200).map(foodItem).filter(Boolean) : [], water: num(d.water, 0, 1000) }),
  myfood: d => ({ name: str(d.name, 60).trim() || 'Food', brand: str(d.brand, 40), upc: String(d.upc || '').replace(/\D/g, '').slice(0, 14), unit: d.unit === 'ml' ? 'ml' : 'g',
    serving: str(d.serving, 48) || '1 serving', servingG: num(d.servingG, 0.1, 5000, 100), per: per(d.per) }),
  meal: d => ({ name: str(d.name, 40).trim() || 'Meal', items: Array.isArray(d.items) ? d.items.slice(0, 60).map(foodItem).filter(Boolean) : [] }),
  activity: d => ({ kind: ['soccer', 'run', 'bike', 'swim', 'row', 'gym', 'lift', 'hike', 'basketball', 'volleyball', 'tennis', 'baseball', 'football', 'hockey', 'track', 'cheer', 'dance', 'martial', 'boxing', 'wrestling', 'climb', 'skate', 'badminton', 'tabletennis', 'racquetball', 'squash', 'golf', 'bowling', 'archery', 'fencing', 'rugby', 'cricket', 'handball', 'frisbee', 'waterpolo', 'paddle', 'surf', 'sup', 'diving', 'aqua', 'ski', 'snowboard', 'snowshoe', 'horse', 'skateboard', 'trampoline', 'jumprope', 'yoga', 'pilates', 'elliptical', 'hiit', 'sport', 'other'].includes(d.kind) ? d.kind : 'other',
    minutes: int(d.minutes, 1, 1440, 30), effort: int(d.effort, 0, 10, 5), ...(d.source === 'health' ? { source: 'health' } : {}),
    ...(str(d.name, 40).trim() ? { name: str(d.name, 40).trim() } : {}),
    ...(num(d.dist, 0.01, 100000) && ['mi', 'km', 'yd', 'm'].includes(d.distUnit) ? { dist: num(d.dist, 0.01, 100000), distUnit: d.distUnit } : {}) }),
  rest: () => ({}),
  weigh: d => ({ lb: num(d.lb, 30, 800, 150) }),
  arc: d => ({ name: str(d.name, 40).trim() || 'Arc', boss: str(d.boss, 80).trim() || 'My goal', start: DAY.test(d.start || '') ? d.start : '1970-01-01', weeks: int(d.weeks, 1, 52, 4), done: DAY.test(d.done || '') ? d.done : null,
    link: d.link?.type === 'weight' ? { type: 'weight', target: num(d.link.target, 0.5, 200, 4) }
      : d.link && (d.link.type === 'ex' || d.link.type === 'skill') && str(d.link.id, 64) ? { type: d.link.type, id: str(d.link.id, 64), ...(d.link.type === 'ex' ? { stage: str(d.link.stage, 40) } : {}), target: int(d.link.target, 1, 999, 1) } : null }),
  skill: d => ({ name: str(d.name, 40).trim() || 'Skill', event: ['vault', 'floor', 'beam', 'bars', 'flex', 'other'].includes(d.event) ? d.event : 'other',
    stage: int(d.stage, 0, 3, 0), log: Array.isArray(d.log) ? d.log.slice(-40).filter(l => DAY.test(l?.day || '')).map(l => ({ stage: int(l.stage, 0, 3, 0), day: l.day })) : [] }),
  sleep: d => ({ hours: num(d.hours, 0, 24, 0), source: 'health' }),
  checkin: d => ({ sleepH: num(d.sleepH, 0, 24, 8), sleepQ: int(d.sleepQ, 1, 5, 3), fatigue: int(d.fatigue, 1, 5, 3), stress: int(d.stress, 1, 5, 3),
    mood: int(d.mood, 1, 5, 3), fun: int(d.fun, 1, 5, 3), sore: strs(d.sore, 10, 20).filter(a => AREAS.includes(a)),
    archPain: bool(d.archPain), techPain: bool(d.techPain), dizzy: bool(d.dizzy) }),
};

// Returns { prof, entries, skipped } or throws with a plain-language message.
export function cleanBackup(prof, entries) {
  if (!prof || typeof prof !== 'object') throw new Error('This backup has no profile in it.');
  if (!ID.test(prof.id || '')) throw new Error('This backup has a damaged profile ID.');
  if (!KINDS.includes(prof.kind)) throw new Error("This backup's profile type isn't one this version of Goku knows.");
  const name = str(prof.name, 24).trim();
  if (!name) throw new Error('This backup has no profile name.');
  const plan = Array.isArray(prof.settings?.weekPlan) && prof.settings.weekPlan.length === 7
    ? prof.settings.weekPlan.map(d => ({ gym: int(d?.gym, 0, 1440, 0), vault: int(d?.vault, 0, 1440, 0), at: int(d?.at, 0, 1439, null) })) : null;
  const clean = {
    id: prof.id, kind: prof.kind, name, accent: /^#[0-9a-f]{6}$/i.test(prof.accent || '') ? prof.accent : null,
    units: prof.units === 'metric' || prof.units === 'imperial' ? prof.units : undefined, tz: tzOk(prof.tz) ? prof.tz : undefined,
    about: prof.about ? cleanAbout(prof.about) : undefined, coach: cleanCoach(prof.coach), custom: cleanCustom(prof.custom),
    avatar: 'avatar' in prof ? cleanAvatar(prof.avatar) : undefined,
    dayEndsAt: int(prof.dayEndsAt, 0, 6, 3), createdAt: num(prof.createdAt, 0, 1e14, Date.now()),
    lastBackupAt: num(prof.lastBackupAt, 0, 1e14, 0),
    modules: Object.fromEntries(Object.entries(prof.modules || {}).filter(([k, v]) => /^\w{1,20}$/.test(k) && typeof v === 'boolean')),
    settings: { sound: prof.settings?.sound !== false, duel: false, kcalTarget: int(prof.settings?.kcalTarget, 800, 6000), trackWaist: prof.settings?.trackWaist === true, // sharing is chosen again on each phone
      homeOrder: ids(prof.settings?.homeOrder), homeHidden: ids(prof.settings?.homeHidden), meds: strs(prof.settings?.meds, 30, 60).map(m => m.trim()).filter(Boolean),
      stacks: Array.isArray(prof.settings?.stacks) ? prof.settings.stacks.slice(0, 10).filter(s => s && str(s.name, 30).trim() && Array.isArray(s.items)).map(s => ({ name: str(s.name, 30).trim(),
        items: s.items.slice(0, 20).filter(x => x && str(x.name, 40).trim()).map(x => ({ name: str(x.name, 40).trim(), dose: num(x.dose, 0, 100000), unit: ['mg', 'mcg', 'g', 'IU', 'mL'].includes(x.unit) ? x.unit : 'mg',
          form: ['capsule', 'tablet', 'softgel', 'gummy', 'scoop', 'packet', 'drop', 'serving'].includes(x.form) ? x.form : 'serving', qty: int(x.qty, 1, 20, 1) })) })).filter(s => s.items.length) : [],
      theme: THEMES[prof.settings?.theme] ? prof.settings.theme : 'capsule', skin: SKINS[prof.settings?.skin] ? prof.settings.skin : 'dbz', mode: ['auto', 'dark', 'light'].includes(prof.settings?.mode) ? prof.settings.mode : 'auto', ...(prof.kind === 'engine'
      ? { gravity: [10, 20, 50, 100].includes(prof.settings?.gravity) ? prof.settings.gravity : 50, shuffleSeed: int(prof.settings?.shuffleSeed, 0, 1e6, 0),
        proteinTarget: int(prof.settings?.proteinTarget, 1, 1000), proteinPer: prof.settings?.proteinPer === 'meal' ? 'meal' : 'day',
        pantry: Array.isArray(prof.settings?.pantry) ? prof.settings.pantry.slice(0, 40).map(x => ({ n: str(x?.n, 40).trim(), g: int(x?.g, 0, 300, 0) })).filter(x => x.n) : [],
        dbStep: num(prof.settings?.dbStep, 1, 50, 5),
        ...(num(prof.settings?.bar, 5, 100) ? { bar: num(prof.settings.bar, 5, 100) } : {}),
        ...(Array.isArray(prof.settings?.plates) ? { plates: [...new Set(prof.settings.plates.map(x => num(x, 0.5, 120)).filter(Boolean))].slice(0, 12), platesUnit: prof.settings.platesUnit === 'kg' ? 'kg' : 'lb' } : {}) }
      : { weekPlan: plan, sharing: false, bodyGoals: prof.settings?.bodyGoals === true }) },
    lockRemember: [0, 1, 7, 30].includes(prof.lockRemember) ? prof.lockRemember : 7,
    // The starting point from setup (2.18)
    ...(prof.kind === 'engine' && ['strength', 'starter', 'move', 'food', 'comeback'].includes(prof.plan?.id) ? { plan: { id: prof.plan.id, ...(prof.plan.hold === true ? { hold: true } : {}), ...(int(prof.plan.sets, 1, 3) ? { sets: int(prof.plan.sets, 1, 3) } : {}),
      ...(int(prof.plan.minGoal, 30, 150) ? { minGoal: int(prof.plan.minGoal, 30, 150) } : {}), ...(prof.plan.workouts === 'circuit' ? { workouts: 'circuit' } : {}) } } : {}),
  };
  let skipped = 0;
  const out = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !ID.test(e.id || '') || !DATA[e.type] || !realDay(e.day) || typeof e.data !== 'object' || !e.data) { skipped++; continue; }
    const ts = Number.isFinite(e.ts) ? e.ts : Date.parse(e.day + 'T12:00:00Z');
    out.push({ id: e.id, profileId: clean.id, type: e.type, day: e.day, ts, updatedAt: Number.isFinite(e.updatedAt) ? e.updatedAt : ts, data: DATA[e.type](e.data) });
  }
  return { prof: clean, entries: out, skipped };
}
