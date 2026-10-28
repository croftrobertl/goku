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
    ['skills', 'Playset skill unlocks', 'Bodyweight skill ladders.', true],
    ['duel', 'Duels with another profile', 'Shared challenges, only shown when the other profile taps Share.', true],
  ],
  perf: [
    ['care', 'Red flags and care checks', 'Health questions in the check-in, and a reminder to talk to a parent, coach or doctor when something needs attention.'],
    ['fuel', 'Fueling tips', 'Snack and water reminders on long training days.'],
    ['skills', 'Skill progressions', 'Mark skills as tried, landed or consistent.', true],
    ['strength', 'Strength for skills', 'Hollow holds, handstand holds and coach circuits.', true],
    ['flex', 'Flexibility progressions', 'Splits and bridge checkpoints.', true],
    ['vaulting', 'Vaulting practice', 'Compulsory moves on horse or barrel.', true],
    ['growth', 'Growth-aware recovery', 'Monthly height; flags growth spurts.', true],
    ['coach', 'Coach summary', 'A weekly summary you choose to share.', true],
  ],
};

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

export const today = p => dayKey(Date.now(), (p || profile())?.dayEndsAt ?? 3);

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
