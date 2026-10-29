// Readiness score and sleep target, shared by the gymnastics screens and the weekly recap.
import { ageOf } from './coach.js';

// Readiness (0–100), documented in the README. Full sleep marks at the age-group target:
// 9 h for under 18 (middle of the AASM's 8–10 h for ages 13–18), 7 h for adults (AASM/SRS "7 or more").
export const sleepTargetFor = p => { const a = ageOf(p); return a !== null && a >= 18 ? 7 : 9; };
export function readiness(c, target = 9) {
  if (!c) return null;
  const sleep = Math.min(c.sleepH / target, 1) * 30;
  const quality = (c.sleepQ - 1) / 4 * 10;
  const fatigue = (5 - c.fatigue) / 4 * 15;
  const stress = (5 - c.stress) / 4 * 10;
  const mood = (c.mood - 1) / 4 * 10;
  const fun = (c.fun - 1) / 4 * 10;
  const sore = Math.max(0, 15 - c.sore.length * 5);
  return Math.round(sleep + quality + fatigue + stress + mood + fun + sore);
}
