// Weight trend (2.10, review 6): every weigh-in is kept, and a smoothed trend line shows the
// direction, because day-to-day weight swings with water. Strength profiles only: the
// Gymnastics setup promises weight is never shown on any screen, chart or summary.
// Smoothing: John Walker, The Hacker's Diet, "Pencil and Paper" (fourmilab.ch/hackdiet):
// today's trend = yesterday's trend + a tenth of (today's weight − yesterday's trend);
// the first weigh-in starts the trend. Here one step is taken per weigh-in.
import { esc, toast, overlay, sources } from './ui.js';
import { profile, saveProfile, saveEntry, today, on } from './state.js';
import { weight, weightUnit, toLb } from './units.js';
import { addDays, prettyDay, daysBetween, dayKey, zoneOf } from './time.js';
import { isMinor } from './coach.js';

export const weightOn = p => p.kind === 'engine' && on(p, 'weight') && (!isMinor(p) || p.modules.weight === true);

// [{ day, lb, trend }] oldest first.
export function weightTrend(all) {
  const list = all.filter(e => e.type === 'weigh').sort((a, b) => a.day.localeCompare(b.day));
  let tr = null;
  return list.map(e => { tr = tr == null ? e.data.lb : tr + (e.data.lb - tr) / 10; return { day: e.day, lb: e.data.lb, trend: tr }; });
}
// The trend on a day: the last value on or before it, else the first one after.
export const trendOn = (pts, day) => (pts.filter(x => x.day <= day).pop() || pts[0])?.trend ?? null;

const WEEKS = 4;
export function weightCard(p, all, t) {
  if (!weightOn(p)) return '';
  const pts = weightTrend(all), from = addDays(t, -7 * WEEKS + 1), shown = pts.filter(x => x.day >= from), u = weightUnit(p);
  const head = `<div class="row"><p class="lbl" style="margin:0">Weight trend</p><span class="sub">${WEEKS} weeks</span></div>`;
  const btns = `<div class="wtbtns"><button class="cta2" id="weighIn">+ Weigh-in</button><button class="cta2" id="weightHide">Hide</button></div>`;
  if (shown.length < 2) return `<section class="card wtrend">${head}
    <p class="sub" style="margin-top:8px">${pts.length ? 'One more weigh-in draws your trend line.' : 'Weigh in a few mornings a week, before eating, and the trend line shows where your weight is really heading.'}</p>${btns}</section>`;
  const W = 340, H = 130, P = 12, vals = shown.flatMap(x => [x.lb, x.trend]);
  const lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5;
  const X = d => P + (W - 2 * P) * daysBetween(from, d) / (7 * WEEKS - 1), Y = v => P + (H - 2 * P) * (hi - v) / (hi - lo);
  const dots = shown.map(x => `<circle cx="${X(x.day).toFixed(1)}" cy="${Y(x.lb).toFixed(1)}" r="3.5" class="wt-dot"/>`).join('');
  const line = shown.map((x, i) => `${i ? 'L' : 'M'}${X(x.day).toFixed(1)},${Y(x.trend).toFixed(1)}`).join(' ');
  const now = shown.at(-1).trend, then = trendOn(pts, from), diff = now - then;
  const change = Math.abs(diff) < 0.1 ? 'steady' : `${diff < 0 ? 'down' : 'up'} ${weight(Math.abs(diff), p)} ${u}`;
  const span = Math.max(1, Math.round(daysBetween(shown[0].day, t) / 7));
  return `<section class="card wtrend">${head}
    <svg viewBox="0 0 ${W} ${H}" class="wtchart" role="img" aria-label="Weight trend ${change} over ${span} week${span === 1 ? '' : 's'}">${dots}<path d="${line}" class="wt-line"/></svg>
    <p style="margin:0"><b class="num">${weight(now, p)} ${u}</b> trend · ${change} in ${span} week${span === 1 ? '' : 's'}</p>
    <p class="sub" style="margin:4px 0 0">Dots are weigh-ins; the line is the trend. Daily ups and downs are mostly water. Last weigh-in: ${prettyDay(pts.at(-1).day)}.</p>
    ${btns}
    ${sources(['Trend: John Walker, <a href="https://www.fourmilab.ch/hackdiet/e4/pencilpaper.html" target="_blank" rel="noopener">The Hacker\'s Diet, “Pencil and Paper”</a> (each day moves the trend a tenth of the way to that day\'s weight).'])}</section>`;
}

export function bindWeight(root, p, all) {
  root.querySelector('#weighIn')?.addEventListener('click', () => weighIn(p, all));
  root.querySelector('#weightHide')?.addEventListener('click', async () => {
    p.modules = { ...p.modules, weight: false }; await saveProfile(p);
    toast('Weight trend hidden. Turn it back on in Settings.'); window.goku.render();
  });
}

export function weighIn(p = profile(), all = []) {
  const last = weightTrend(all).at(-1)?.lb ?? p.about?.weightLb ?? null, t = today(p);
  const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Weigh-in</h1><button class="cta2" id="x" data-close>Close</button></div>
    <label class="f"><span>Today's weight (${weightUnit(p)})</span><input id="wv" inputmode="decimal" value="${last != null ? esc(weight(last, p)) : ''}"></label>
    <p class="note">Same time each day works best, like after waking up. A second weigh-in today replaces the first.</p>
    <p class="msg" id="wm" role="status"></p>
    <button class="cta" id="ok" style="margin-top:12px">Save</button>`, { label: 'Weigh-in' });
  el.querySelector('#wv').focus();
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.id !== 'ok') return;
    const lb = toLb(el.querySelector('#wv').value.replace(',', '.'), p);
    if (!(lb >= 30 && lb <= 800)) { el.querySelector('#wm').textContent = `That weight doesn't look right. Use ${weightUnit(p)}.`; return; }
    await logWeigh(p, lb, t);
    close(); toast('Weigh-in saved'); window.goku.render();
  });
}

// One weigh-in per day; it also keeps the profile's weight current for the fuel ranges.
export async function logWeigh(p, lb, day = today(p)) {
  await saveEntry('weigh', { lb: Math.round(lb * 10) / 10 }, { id: p.id + ':weigh:' + day, day });
  p.about = { ...p.about, weightLb: Math.round(lb * 10) / 10, weightAt: Date.now() }; await saveProfile(p);
}

// A weight typed in setup or a coach question counts as a weigh-in too, once.
export async function syncWeigh(p, all) {
  const a = p.about || {};
  if (!weightOn(p) || !a.weightLb || !a.weightAt) return null;
  const day = dayKey(a.weightAt, p.dayEndsAt ?? 3, zoneOf(p));
  if (all.some(e => e.type === 'weigh' && (e.day === day || e.ts >= a.weightAt - 60000))) return null;
  return saveEntry('weigh', { lb: a.weightLb }, { id: p.id + ':weigh:' + day, day });
}
