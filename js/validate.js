// Checks and cleans everything that comes from an imported backup, so a bad or
// hostile file can never break the app or inject markup.
import { THEMES } from './themes.js';
const ID = /^[A-Za-z0-9:._-]{1,100}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ['engine', 'perf'];

const num = (v, lo, hi, d = null) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const int = (v, lo, hi, d = null) => { const n = num(v, lo, hi, d); return n === null ? null : Math.round(n); };
const str = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
const bool = v => v === true;
const strs = (v, max, each) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, each)).slice(0, max) : []);
const nums = (v, max, lo, hi) => (Array.isArray(v) ? v.map(x => num(x, lo, hi)).filter(x => x !== null).slice(0, max) : []);

export const AREAS = ['Neck', 'Shoulders', 'Elbows', 'Wrists', 'Upper back', 'Lower back', 'Hips', 'Knees', 'Ankles', 'Feet'];

const stages = v => (Array.isArray(v) ? v.slice(0, 8).map(s => ({ label: str(s?.label, 40), load: num(s?.load, 0, 2000), reps: int(s?.reps, 0, 10000, 0) })) : []);

const DATA = {
  exercise: d => ({ name: str(d.name, 40), slot: str(d.slot, 12, 'push'), module: d.module === 'soccer' ? 'soccer' : null,
    order: int(d.order, 0, 10000, 999), mode: d.mode === 'hold' ? 'hold' : 'reps',
    stages: stages(d.stages).map(({ label, load }) => ({ label, load })) }),
  session: d => ('kind' in d
    ? { kind: d.kind === 'vault' ? 'vault' : 'gym', minutes: int(d.minutes, 0, 1440, 0), effort: int(d.effort, 0, 10, 0) }
    : { gravity: [10, 20, 50, 100].includes(d.gravity) ? d.gravity : 50, startedAt: num(d.startedAt, 0, 1e14, 0), endedAt: num(d.endedAt, 0, 1e14, 0),
      sets: Array.isArray(d.sets) ? d.sets.slice(0, 500).map(s => ({ exId: ID.test(s?.exId) ? s.exId : '', name: str(s?.name, 40), slot: str(s?.slot, 12),
        round: int(s?.round, 1, 100, 1), stages: stages(s?.stages) })) : [],
      repTimes: nums(d.repTimes, 20000, 0, 1e6) }),
  gut: d => ({ amWaist: num(d.amWaist, 10, 100), pmWaist: num(d.pmWaist, 10, 100), bloat: int(d.bloat, 0, 10), foods: strs(d.foods, 100, 40),
    fluidsOz: int(d.fluidsOz, 0, 1000, 0), supplements: strs(d.supplements, 50, 40), protein: nums(d.protein, 100, 0, 500) }),
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
    ? prof.settings.weekPlan.map(d => ({ gym: int(d?.gym, 0, 1440, 0), vault: int(d?.vault, 0, 1440, 0) })) : null;
  const clean = {
    id: prof.id, kind: prof.kind, name, accent: /^#[0-9a-f]{6}$/i.test(prof.accent || '') ? prof.accent : null,
    units: 'imperial', dayEndsAt: int(prof.dayEndsAt, 0, 6, 3), createdAt: num(prof.createdAt, 0, 1e14, Date.now()),
    lastBackupAt: num(prof.lastBackupAt, 0, 1e14, 0),
    modules: Object.fromEntries(Object.entries(prof.modules || {}).filter(([k, v]) => /^\w{1,20}$/.test(k) && typeof v === 'boolean')),
    settings: { sound: prof.settings?.sound !== false, haptics: prof.settings?.haptics !== false,
      theme: THEMES[prof.settings?.theme] ? prof.settings.theme : 'capsule', mode: ['auto', 'dark', 'light'].includes(prof.settings?.mode) ? prof.settings.mode : 'auto', ...(prof.kind === 'engine'
      ? { gravity: [10, 20, 50, 100].includes(prof.settings?.gravity) ? prof.settings.gravity : 50, shuffleSeed: int(prof.settings?.shuffleSeed, 0, 1e6, 0),
        proteinTarget: int(prof.settings?.proteinTarget, 1, 1000), proteinPer: prof.settings?.proteinPer === 'meal' ? 'meal' : 'day' }
      : { weekPlan: plan, sharing: false }) },
    lockRemember: [0, 1, 7, 30].includes(prof.lockRemember) ? prof.lockRemember : 7,
  };
  let skipped = 0;
  const out = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !ID.test(e.id || '') || !DATA[e.type] || !DAY.test(e.day || '') || typeof e.data !== 'object' || !e.data) { skipped++; continue; }
    const ts = Number.isFinite(e.ts) ? e.ts : Date.parse(e.day + 'T12:00:00Z');
    out.push({ id: e.id, profileId: clean.id, type: e.type, day: e.day, ts, updatedAt: Number.isFinite(e.updatedAt) ? e.updatedAt : ts, data: DATA[e.type](e.data) });
  }
  return { prof: clean, entries: out, skipped };
}
