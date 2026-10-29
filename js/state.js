// App state: the list of profiles and which one is open.
import * as db from './db.js';
import { dayKey } from './time.js';

export const KINDS = {
  engine: { label: 'Strength and conditioning', theme: 'Gravity chamber', accent: '#5ea4ff', initial: 'D' },
  perf: { label: 'Gymnastics and vaulting', theme: 'Performance', accent: '#b18cff', initial: 'P' },
};

// [key, name, description, soon?]. "soon" modules are listed as coming, never as dead toggles.
export const MODULES = {
  engine: [
    ['gut', 'Gut and bloating log', 'Waist, bloating, foods, fluids, supplements and protein.'],
    ['hypertrophy', 'Home hypertrophy tracker', 'Weekly hard sets per muscle group.'],
    ['shuffle', 'Shuffle', 'A fresh circuit from your library on demand.'],
    ['soccer', 'Soccer engine pack', 'Adds explosive-power and joint-armor exercises to circuits.'],
    ['fuel', 'Fuel ranges', 'Protein and carbohydrate ranges for your weight and training, with sources.'],
    ['skills', 'Playset skill unlocks', 'Bodyweight skill ladders.', true],
  ],
  perf: [
    ['care', 'Red flags and care checks', 'Health questions in the check-in, and a reminder to talk to a parent, coach or doctor when something needs attention.'],
    ['fuel', 'Fuel ranges and tips', 'Protein and carbohydrate ranges for each training day, with sources, plus snack and water tips.'],
    ['skills', 'Skill tree', 'Each skill climbs Learning, With spot, Solo and Competition-ready, with dates.'],
    ['strength', 'Strength for skills', 'Hollow holds, handstand holds and coach circuits.', true],
    ['vaulting', 'Vaulting practice', 'Compulsory moves on horse or barrel.', true],
    ['growth', 'Growth-aware recovery', 'Monthly height; flags growth spurts.', true],
    ['coach', 'Coach summary', 'A weekly summary you choose to share.', true],
  ],
};

// Custom profiles (1.7) are built from these answers on top of one of the two presets:
// guided workouts use the strength engine, logged practices use the performance engine.
export const SPORTS = [['strength', 'Strength or gym'], ['run', 'Running'], ['soccer', 'Soccer'], ['swim', 'Swimming'], ['bike', 'Cycling'],
  ['dance', 'Dance'], ['martial', 'Martial arts'], ['gymnastics', 'Gymnastics'], ['team', 'Team sport'], ['yoga', 'Yoga or flexibility'],
  ['fitness', 'General fitness'], ['other', 'Something else']];
export const STYLES = [['guided', 'Guided workouts', 'Follow timed circuits on your phone, with rest timers and a ghost to race.'],
  ['sessions', 'Log my practices', "Log what you did and how hard it was, check in on how you feel, and plan your week."],
  ['both', 'Both', 'Guided circuits, plus logging your other sports and practices.']];
const sportName = id => SPORTS.find(s => s[0] === id)?.[1];
const join = list => list.length > 2 ? list.slice(0, -1).join(', ') + ' and ' + list.at(-1) : list.join(' and ');
export const kindLabel = p => p.custom?.sports?.length ? join(p.custom.sports.slice(0, 3).map(sportName).filter(Boolean).map((n, i) => i ? n.toLowerCase() : n)) + (p.custom.sports.length > 3 ? ' and more' : '')
  : p.custom ? 'Custom' : KINDS[p.kind].label;
// The two session types a practice-log profile tracks: [first, second or null].
export function sessionNames(p) {
  if (!p.custom) return ['Gymnastics', 'Vaulting'];
  const named = (p.custom.sports || []).filter(s => !['strength', 'fitness', 'other'].includes(s)).map(sportName);
  return named.length ? [named[0], named[1] || null] : ['Training', null];
}
// Starting features for a Custom profile from its sports.
export function presetModules(kind, sports) {
  const has = (...ids) => ids.some(id => sports.includes(id));
  return kind === 'engine'
    ? { gut: false, hypertrophy: has('strength', 'fitness'), shuffle: true, soccer: has('soccer', 'team'), fuel: true }
    : { care: true, fuel: true, skills: has('gymnastics', 'dance', 'martial', 'yoga') };
}

export const liveModules = kind => MODULES[kind].filter(m => !m[3]);
export const soonModules = kind => MODULES[kind].filter(m => m[3]);
export const on = (p, key) => p.modules[key] !== false;

export const S = { profiles: [], current: null };

export async function loadProfiles() {
  S.profiles = (await db.all('profiles')).sort((a, b) => a.createdAt - b.createdAt);
  return S.profiles;
}

export const profile = () => S.profiles.find(p => p.id === S.current) || null;

export async function saveProfile(p) {
  p.updatedAt = Date.now();
  await db.put('profiles', p);
  const i = S.profiles.findIndex(x => x.id === p.id);
  if (i >= 0) S.profiles[i] = p; else S.profiles.push(p);
}

export function newProfile(kind, name, accent) {
  const mods = {};
  for (const [k] of liveModules(kind)) mods[k] = true;
  return {
    id: db.uid(), kind, name, accent: accent || KINDS[kind].accent,
    units: 'imperial', dayEndsAt: 3, createdAt: Date.now(), updatedAt: Date.now(),
    lastBackupAt: 0, modules: mods,
    settings: kind === 'engine'
      ? { gravity: 50, shuffleSeed: 0, proteinTarget: null, proteinPer: 'day' }
      : { weekPlan: Array.from({ length: 7 }, () => ({ gym: 0, vault: 0 })), sharing: false },
    lock: { pin: null, remember: 7, until: 0, fails: 0, waitUntil: 0, needsNewPin: false },
  };
}

export const today = p => { const x = p || profile(); return dayKey(Date.now(), x?.dayEndsAt ?? 3, x?.tz); };

export async function entries(type, p = profile()) {
  return (await db.byIndex('entries', 'profileType', [p.id, type])).sort((a, b) => a.ts - b.ts);
}

export async function saveEntry(type, data, { id, day, ts } = {}) {
  const p = profile();
  const now = Date.now();
  const e = { id: id || db.uid(), profileId: p.id, type, day: day || today(p), ts: ts || now, updatedAt: now, data };
  await db.put('entries', e);
  return e;
}

export const deleteEntry = id => db.del('entries', id);
