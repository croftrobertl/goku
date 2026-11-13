// "Just look around first" (2.18, review 11): a sample profile with a few weeks of made-up data, so a new person
// can tap through every screen before answering anything. Leaving it erases the sample. Nothing here is real.
import { S, newProfile, saveProfile, saveEntry, loadProfiles } from './state.js';
import * as db from './db.js';
import { dayKey } from './time.js';
import { todaysCircuit } from './engine.js';

export const isDemo = p => p?.demo === true;

export async function startDemo() {
  const p = newProfile('engine', 'Sample');
  Object.assign(p, { demo: true, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, about: { birthYear: new Date().getFullYear() - 35, heightIn: 68, weightLb: 170, experience: '1', goal: 'strength', equipment: [], days: '3' },
    coach: { asked: {} }, plan: { id: 'strength' } });
  p.lock.noPin = true; // a sample has nothing to protect
  p.settings.kcalTarget = 2300; p.settings.proteinTarget = 130;
  await saveProfile(p);
  S.current = p.id;
  const circuit = await todaysCircuit(); // builds the starter library for this profile
  const now = Date.now(), day = ts => dayKey(ts, p.dayEndsAt, p.tz);
  const meals = [['breakfast', 'Oatmeal, cooked', 300, 10, 54, 5], ['breakfast', 'Banana', 105, 1, 27, 0], ['lunch', 'Chicken breast, grilled', 280, 52, 0, 6], ['lunch', 'Rice, white, cooked', 240, 4, 53, 0],
    ['dinner', 'Salmon, cooked', 360, 39, 0, 22], ['dinner', 'Broccoli, cooked', 55, 4, 11, 1], ['snacks', 'Greek yogurt, plain', 130, 17, 6, 4]];
  for (let i = 27; i >= 0; i--) { // today too, part-way through the day
    const ts = now - i * 86400000, dy = day(ts);
    if (i % 7 !== 2 && i % 7 !== 5 && i % 2) {
      const start = ts - 3600000;
      await saveEntry('session', { gravity: 50, startedAt: start, endedAt: start + (15 + i % 4) * 60000, repTimes: [],
        sets: [1, 2, 3, 4].flatMap(r => circuit.map(e => ({ exId: e.id, name: e.data.name, slot: e.data.slot, round: r, stages: [{ label: e.data.stages[0]?.label || '', load: null, reps: 9 + Math.floor((27 - i) / 6) + (r % 2) }] }))) }, { day: dy, ts });
    }
    if (i % 7 === 5) await saveEntry('activity', { kind: 'run', minutes: 30, effort: 5 }, { day: dy, ts });
    const items = meals.filter((_, k) => (k + i) % 6 !== 0).map(([meal, name, kcal, pr, c, f]) => ({ meal, name, brand: '', src: 'common', unit: 'g', portions: '', pl: 'serving', pg: 100, qty: 1,
      n: { kcal, p: pr, c, f, fib: 3, sug: 4, na: 150, sat: 2 }, per: { kcal, p: pr, c, f, fib: 3, sug: 4, na: 150, sat: 2 } }));
    if (i === 0) items.splice(3);
    await saveEntry('food', { items, water: 40 + (i % 3) * 8 }, { id: p.id + ':food:' + dy, day: dy, ts });
    await saveEntry('gut', { energy: 2 + (i * 3) % 4, soreness: 1 + (i * 2) % 4, stress: 1 + i % 4, mood: 2 + (i * 5) % 4, sleepH: 6.5 + (i % 4) * 0.5, bloat: (i * 3) % 6,
      foods: items.map(x => x.name), supplements: [], protein: [], fluidsOz: 0 }, { id: p.id + ':gut:' + dy, day: dy, ts });
    if (i % 3 === 0) await saveEntry('weigh', { lb: 172 - (27 - i) * 0.08 }, { id: p.id + ':weigh:' + dy, day: dy, ts });
  }
  return p;
}

// Leaving the sample erases it and goes back to the real setup.
export async function endDemo(p) {
  await db.deleteProfile(p.id);
  await db.setMeta('lastProfile', null);
  await loadProfiles();
  location.reload();
}
