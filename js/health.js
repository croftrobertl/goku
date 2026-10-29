// Scouter link: imports sleep and workouts that an Apple Shortcut exports from the Health app
// into a text file. No server; the file goes from Shortcuts to Files to Goku.
// Accepted lines (comma or tab separated, header lines and blanks ignored):
//   sleep,<start date-time>,<end date-time>      one line per sleep sample; summed per night
//   sleep,YYYY-MM-DD,<hours>                     already totaled
//   workout,<start date-time>,<end date-time>,<name>
//   workout,YYYY-MM-DD,<name>,<minutes>
import * as db from './db.js';
import { profile } from './state.js';
import { dayKey, addDays } from './time.js';
import { round } from './ui.js';

const DAYRX = /^\d{4}-\d{2}-\d{2}$/;
const kindFor = name => {
  const n = String(name).toLowerCase();
  if (/soccer|football/.test(n)) return 'soccer';
  if (/run|jog/.test(n)) return 'run';
  if (/cycl|bike|biking/.test(n)) return 'bike';
  if (/swim/.test(n)) return 'swim';
  if (/walk|hik/.test(n)) return 'hike';
  if (/strength|functional|weight|core|hiit|cross/.test(n)) return 'lift';
  return 'sport';
};
const when = v => { const t = Date.parse(String(v).trim().replace(' at ', ' ')); return isFinite(t) ? t : null; };

// Overlapping samples (iPhone and Apple Watch both recording) are merged, not added.
function mergedHours(spans) {
  spans.sort((x, y) => x[0] - y[0]);
  let total = 0, [s, e] = spans[0];
  for (const [a, b] of spans.slice(1)) { if (a <= e) e = Math.max(e, b); else { total += e - s; [s, e] = [a, b]; } }
  return (total + e - s) / 3600000;
}

export function parseHealth(text, p) {
  const sleep = {}, spans = {}, workouts = [], seen = {};
  let bad = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const f = line.split(/\t|,(?=\s*\S)/).map(x => x.trim());
    const type = f[0].toLowerCase();
    if (type === 'type') continue; // a header row
    if (type === 'sleep') {
      if (DAYRX.test(f[1]) && isFinite(+f[2])) { sleep[f[1]] = Math.max(sleep[f[1]] || 0, +f[2]); continue; }
      const a = when(f[1]), b = when(f[2]);
      if (a && b && b > a && b - a < 16 * 3600000) { (spans[dayKey(b, 0, p.tz)] ||= []).push([a, b]); continue; } // a night counts toward the morning you woke
    } else if (type === 'workout') {
      if (DAYRX.test(f[1]) && isFinite(+f[3])) {
        const w = { day: f[1], kind: kindFor(f[2]), minutes: Math.round(+f[3]) }, k = `${w.day}:${w.kind}:${w.minutes}`;
        seen[k] = (seen[k] || 0) + 1; workouts.push({ ...w, key: `${k}:${seen[k]}` }); continue; // two identical runs stay two
      }
      const a = when(f[1]), b = when(f[2]);
      if (a && b && b > a) { workouts.push({ day: dayKey(a, p.dayEndsAt ?? 3, p.tz), kind: kindFor(f[3] || ''), minutes: Math.round((b - a) / 60000), key: 't' + Math.round(a / 60000) }); continue; }
    }
    bad++;
  }
  for (const [d, list] of Object.entries(spans)) sleep[d] = Math.max(sleep[d] || 0, mergedHours(list));
  const nights = Object.entries(sleep).filter(([, h]) => h > 0 && h <= 16).map(([day, h]) => ({ day, hours: round(h, 2) }));
  return { nights, workouts: workouts.filter(w => w.minutes > 0 && w.minutes <= 1440 && DAYRX.test(w.day)), bad };
}

// Adds only what's new. A night is never shortened (a later export may cut it off partway),
// imported workouts you edited or deleted stay that way, and a workout you already logged
// by hand (same day and type, within 15 minutes) isn't added twice.
export async function saveHealth({ nights, workouts }) {
  const p = profile(), now = Date.now(), oldest = addDays(dayKey(now, 3, p.tz), -60);
  const have = new Map((await db.byIndex('entries', 'profile', p.id)).map(e => [e.id, e]));
  const gone = new Set((await db.getMeta('healthDeleted:' + p.id)) || []);
  const manual = [...have.values()].filter(e => e.type === 'activity' && e.data.source !== 'health');
  const rows = [];
  for (const n of nights) {
    const id = `${p.id}:sleep:${n.day}`;
    if (n.day >= oldest && !(have.get(id)?.data.hours >= n.hours)) rows.push({ id, profileId: p.id, type: 'sleep', day: n.day, ts: now, updatedAt: now, data: { hours: n.hours, source: 'health' } });
  }
  for (const w of workouts) {
    const id = `${p.id}:health:${w.day}:${w.key}`;
    if (w.day < oldest || have.has(id) || gone.has(id)) continue;
    if (manual.some(m => m.day === w.day && m.data.kind === w.kind && Math.abs(m.data.minutes - w.minutes) <= 15)) continue;
    rows.push({ id, profileId: p.id, type: 'activity', day: w.day, ts: now, updatedAt: now, data: { kind: w.kind, minutes: w.minutes, effort: 5, source: 'health' } });
  }
  if (rows.length) await db.putMany('entries', rows);
  return rows.length;
}

// Remembered so a later import doesn't bring a deleted workout back.
export async function forgetHealthWorkout(e) {
  if (e?.data?.source !== 'health') return;
  const key = 'healthDeleted:' + profile().id, list = (await db.getMeta(key)) || [];
  await db.setMeta(key, [...new Set([...list, e.id])].slice(-500));
}

export const RECIPE = [
  'Open the Shortcuts app and tap + to make a new shortcut. Name it "Goku Scouter".',
  'Add "Find Health Samples". Set Type to Sleep Analysis, add the filter Start Date is in the last 7 days, and the filter Value is Asleep (on iOS 16 and later, pick each Asleep stage, not In Bed).',
  'Add "Repeat with Each". Inside it add "Text" with: sleep, then Start Date, then End Date, separated by commas. Format both dates as ISO 8601.',
  'After the repeat, add "Find Workouts" for the last 7 days, then another "Repeat with Each" with Text: workout, Start Date, End Date, Type.',
  'Add "Combine Text" (New Lines) for both lists, then "Save File" to iCloud Drive or On My iPhone as goku-scouter.txt.',
  'Run it, then in Goku tap Settings → Import from Health and pick goku-scouter.txt. Running it again later only adds what is new.',
];
