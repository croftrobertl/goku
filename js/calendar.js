// Training calendar (2.3): a month grid in History. Each day shows what happened:
// trained, rest, something else logged, a new record (engine) or skill stage (gymnastics),
// and the days a Senzu bean saved the streak.
import { esc } from './ui.js';
import { addDays, weekStart, prettyDay } from './time.js';
import { streak } from './insights.js';
import { restAllowance } from './homecards.js';

let shown = null; // 'YYYY-MM' of the month on screen

const monthName = ym => new Date(ym + '-01T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shift = (ym, n) => { const d = new Date(ym + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };

// A day's record: any set that beat every earlier one for that exercise and stage.
function recordDays(all) {
  const best = {}, out = new Set();
  for (const s of all.filter(e => e.type === 'session' && e.data.sets).sort((a, b) => a.day.localeCompare(b.day) || a.ts - b.ts))
    for (const set of s.data.sets) for (const st of set.stages || []) {
      const k = set.exId + '|' + st.label;
      if (best[k] != null && st.reps > best[k]) out.add(s.day);
      if (best[k] == null || st.reps > best[k]) best[k] = st.reps;
    }
  return out;
}

function states(p, all, t, skills) {
  const by = {};
  const add = (d, k) => (by[d] ||= new Set()).add(k);
  for (const e of all) add(e.day, e.type === 'session' || e.type === 'activity' ? 'train' : e.type === 'rest' ? 'rest' : 'log');
  for (const d of recordDays(all)) add(d, 'rec');
  for (const s of skills) for (const l of s.data.log || []) if (l.stage > 0) add(l.day, 'rec');
  for (const d of streak(all, t, restAllowance(p)).savedDays) add(d, 'bean');
  return by;
}

const words = (st, kind) => [st.has('train') && 'trained', st.has('rest') && !st.has('train') && 'rest day', st.has('log') && !st.has('train') && 'logged',
  st.has('rec') && (kind === 'perf' ? 'skill stage' : 'new record'), st.has('bean') && 'saved by a Senzu bean'].filter(Boolean);

function grid(p, by, t) {
  const ym = shown, first = ym + '-01', start = weekStart(first);
  const cells = [];
  for (let d = start, i = 0; i < 42; d = addDays(d, 1), i++) {
    if (i >= 35 && d.slice(0, 7) !== ym) break;
    const st = by[d] || new Set(), inMonth = d.slice(0, 7) === ym, w = words(st, p.kind);
    const cls = [st.has('train') ? 'tr' : st.has('rest') ? 'rs' : st.has('log') ? 'lg' : '', st.has('bean') ? 'bn' : '', d === t ? 'now' : '', inMonth ? '' : 'out', d > t ? 'fut' : ''].filter(Boolean).join(' ');
    cells.push(`<button class="cd ${cls}" data-cd="${d}" aria-label="${esc(prettyDay(d))}: ${w.length ? w.join(', ') : 'nothing logged'}"${inMonth ? '' : ' tabindex="-1"'}>
      <span class="num">${+d.slice(8)}</span>${st.has('rec') ? '<i class="rec" aria-hidden="true">★</i>' : ''}${st.has('bean') ? '<i class="bean" aria-hidden="true"></i>' : ''}</button>`);
  }
  const days = Object.keys(by).filter(d => d.startsWith(ym));
  const trained = days.filter(d => by[d].has('train')).length;
  return `<div class="row"><button class="cta2" data-cal="-1" aria-label="Previous month">‹</button><h2 style="margin:0">${monthName(ym)}</h2>
      <button class="cta2" data-cal="1" aria-label="Next month"${ym >= t.slice(0, 7) ? ' disabled' : ''}>›</button></div>
    <div class="calgrid" role="group" aria-label="${monthName(ym)}">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => `<span class="cw" aria-hidden="true">${x}</span>`).join('')}${cells.join('')}</div>
    <p class="sub" id="calday" role="status" style="text-align:center">${trained} training day${trained === 1 ? '' : 's'} · ${days.length} day${days.length === 1 ? '' : 's'} with anything logged</p>`;
}

export function calendarCard(p, all, t, skills = []) {
  if (!shown || shown > t.slice(0, 7)) shown = t.slice(0, 7);
  const by = states(p, all, t, skills);
  return `<section class="card cal" id="cal" data-t="${t}">${grid(p, by, t)}
    <p class="calkey sub" aria-hidden="true"><span class="cd tr"></span>trained <span class="cd rs"></span>rest <span class="cd lg"></span>logged <span class="reck">★</span>${p.kind === 'perf' ? 'skill stage' : 'record'} <span class="cd bn"><i class="bean"></i></span>Senzu save</p></section>`;
}

export function bindCalendar(root, p, all, t, skills = []) {
  const card = root.querySelector('#cal'); if (!card) return;
  const by = states(p, all, t, skills);
  card.addEventListener('click', e => {
    const nav = e.target.closest('[data-cal]');
    if (nav) { const key = card.querySelector('.calkey').outerHTML; shown = shift(shown, +nav.dataset.cal); card.innerHTML = grid(p, by, t) + key; card.querySelector(`[data-cal="${nav.dataset.cal}"]`)?.focus(); return; }
    const d = e.target.closest('[data-cd]'); if (!d) return;
    const w = words(by[d.dataset.cd] || new Set(), p.kind);
    card.querySelector('#calday').textContent = `${prettyDay(d.dataset.cd)}: ${w.length ? w.join(', ') : 'nothing logged'}`;
  });
}
