// Other training (soccer, runs, pickup games): minutes and effort, so fuel ranges, the
// recovery map and the weekly recap see all of a person's training, not only circuits.
import { entries, saveEntry, deleteEntry, today, profile } from './state.js';
import { esc, ask, overlay, guard, toast, dayPicker } from './ui.js';
import { addDays, prettyDay } from './time.js';
import { forgetHealthWorkout } from './health.js';
import { metric } from './units.js';

// [id, label, muscle groups it loads, other words people search for (2.13)]
// Names follow the 2024 Adult Compendium of Physical Activities (pacompendium.com); the muscle groups are Goku's own.
// No calorie numbers are used.
export const ACTIVITIES = [
  ['soccer', 'Soccer', ['legs', 'core', 'power'], 'futbol futsal'], ['run', 'Running', ['legs'], 'run jog jogging'],
  ['bike', 'Cycling', ['legs'], 'bike biking bicycle spin'], ['swim', 'Swimming', ['pull', 'push'], 'swim laps'],
  ['row', 'Rowing', ['pull', 'legs', 'core'], 'row erg crew rowing machine'], ['gym', 'Gymnastics', ['push', 'pull', 'core', 'power'], 'vault floor beam bars tumbling'],
  ['lift', 'Lifting', ['push', 'pull', 'legs', 'core'], 'weights weightlifting strength powerlifting gym'], ['hike', 'Walk or hike', ['legs'], 'walking hiking'],
  ['basketball', 'Basketball', ['legs', 'core', 'power']], ['volleyball', 'Volleyball', ['legs', 'power', 'push'], 'beach volleyball'],
  ['tennis', 'Tennis', ['legs', 'core', 'push']], ['baseball', 'Baseball or softball', ['legs', 'core', 'push'], 'softball t-ball'],
  ['football', 'Football', ['legs', 'power', 'push', 'core'], 'american football flag football'], ['hockey', 'Hockey', ['legs', 'core'], 'ice hockey field hockey roller hockey'],
  ['track', 'Track and field', ['legs', 'power'], 'sprint sprinting hurdles long jump high jump pole vault throwing'],
  ['cheer', 'Cheerleading', ['legs', 'power', 'core', 'push'], 'cheer stunting'], ['dance', 'Dance', ['legs', 'core'], 'dancing ballet hip hop jazz tap'],
  ['martial', 'Martial arts', ['legs', 'core', 'push', 'power'], 'karate taekwondo judo jiu jitsu bjj kung fu kickboxing mma tai chi'],
  ['boxing', 'Boxing', ['push', 'core', 'legs']], ['wrestling', 'Wrestling', ['pull', 'push', 'legs', 'core']],
  ['climb', 'Rock climbing', ['pull', 'core'], 'climbing bouldering'], ['skate', 'Skating', ['legs', 'core'], 'ice skating roller skating figure skating inline'],
  ['badminton', 'Badminton', ['legs', 'core', 'push']], ['tabletennis', 'Table tennis', ['legs', 'core'], 'ping pong'],
  ['racquetball', 'Racquetball', ['legs', 'core', 'push']], ['squash', 'Squash', ['legs', 'core', 'push']],
  ['golf', 'Golf', ['core']], ['bowling', 'Bowling', ['legs', 'core']], ['archery', 'Archery', ['pull', 'core']],
  ['fencing', 'Fencing', ['legs', 'core']], ['rugby', 'Rugby', ['legs', 'power', 'push', 'core']], ['cricket', 'Cricket', ['legs', 'core', 'push']],
  ['handball', 'Handball', ['legs', 'core', 'push', 'power']], ['frisbee', 'Ultimate frisbee', ['legs', 'power'], 'ultimate disc'],
  ['waterpolo', 'Water polo', ['pull', 'push', 'legs', 'core']], ['paddle', 'Kayaking or canoeing', ['pull', 'core'], 'kayak canoe'],
  ['surf', 'Surfing', ['pull', 'core', 'legs'], 'surf'], ['sup', 'Paddleboarding', ['core', 'pull', 'legs'], 'sup stand up paddle'],
  ['diving', 'Diving', ['legs', 'core'], 'scuba snorkeling springboard platform'], ['aqua', 'Water aerobics', ['legs', 'core'], 'water fitness aqua aerobics'],
  ['ski', 'Skiing', ['legs', 'core'], 'ski downhill cross-country cross country'], ['snowboard', 'Snowboarding', ['legs', 'core'], 'snowboard'],
  ['snowshoe', 'Snowshoeing', ['legs']], ['horse', 'Horseback riding', ['legs', 'core'], 'equestrian riding'],
  ['skateboard', 'Skateboarding', ['legs', 'core'], 'skateboard'], ['trampoline', 'Trampoline', ['legs', 'core', 'power']],
  ['jumprope', 'Jump rope', ['legs', 'power'], 'skipping rope jumping rope'], ['yoga', 'Yoga', ['core']], ['pilates', 'Pilates', ['core']],
  ['elliptical', 'Elliptical', ['legs'], 'cross trainer'], ['hiit', 'HIIT', ['legs', 'core', 'power', 'push'], 'interval training circuit bootcamp high intensity'],
  ['sport', 'Other sport', ['legs', 'core']],
  ['other', 'Something else', []],
];
export const activityName = (k, name) => name || ACTIVITIES.find(a => a[0] === k)?.[1] || 'Activity';
// Distance (2.8) is asked only where it means something; swims are in yards or meters, rows in meters.
const DISTANCE = ['run', 'bike', 'swim', 'row'];
const distUnits = (kind, p) => kind === 'row' ? 'm' : kind === 'swim' ? (metric(p) ? 'm' : 'yd') : metric(p) ? 'km' : 'mi'; // rowing machines count meters everywhere
const distText = d => d.dist ? ` · ${d.dist} ${d.distUnit}` : '';
// Pace (2.8.2), worked out as you type: runs per mile or km, rows per 500 m, rides in mph or km/h, swims per 100 yd or m.
const mmss = min => { const t = Math.round(min * 60); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
export function paceText(kind, minutes, dist, unit) {
  if (!(minutes > 0 && dist > 0)) return '';
  if (kind === 'bike') return `${Math.round(dist / (minutes / 60) * 10) / 10} ${unit === 'km' ? 'km/h' : 'mph'}`;
  if (kind === 'row') return `${mmss(minutes / (dist / 500))} per 500 m`;
  if (kind === 'swim') return `${mmss(minutes / (dist / 100))} per 100 ${unit}`;
  return `${mmss(minutes / dist)} per ${unit === 'km' ? 'km' : 'mile'}`;
}
export const activityGroups = k => ACTIVITIES.find(a => a[0] === k)?.[2] || [];

export async function activitiesOn(day) { return (await entries('activity')).filter(e => e.day === day); }
export const minutesOf = list => list.reduce((a, e) => a + (e.data.minutes || 0), 0);

export function activityRows(list, { edit = true } = {}) {
  return list.map(e => `<li><span>${esc(activityName(e.data.kind, e.data.name))} · ${esc(e.data.minutes)} min${esc(distText(e.data))}<br>
    <span class="chain">${prettyDay(e.day)} · effort ${esc(e.data.effort)}</span></span>
    ${edit ? `<button class="cta2" data-act="${esc(e.id)}" aria-label="Edit ${esc(activityName(e.data.kind, e.data.name))} on ${prettyDay(e.day)}">Edit</button>` : ''}</li>`).join('');
}

// The sport search (2.13, review 8): one box holds every sport. Focused and empty, it offers your own
// sports (the current one, setup's, then the ones logged most recently); typing searches names and other words.
const fold = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim();
export function findSports(q, limit = 8) {
  const f = fold(q); if (!f) return [];
  const scored = [];
  for (const a of ACTIVITIES) {
    const name = fold(a[1]), words = fold(a[3] || '');
    const s = name.startsWith(f) ? 3 : name.split(' ').some(w => w.startsWith(f)) ? 2 : (' ' + words).includes(' ' + f) ? 1 : name.includes(f) ? 0.5 : -1;
    if (s >= 0) scored.push([s, a]);
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, limit).map(x => x[1]);
}

export function logActivity(existing = null, onDone = () => window.goku.render()) {
  // A Custom profile starts on its own sport; everyone else on soccer, the original pack.
  const own = { run: 'run', soccer: 'soccer', team: 'sport', swim: 'swim', bike: 'bike', strength: 'lift', dance: 'dance', martial: 'martial', gymnastics: 'gym', yoga: 'yoga' };
  // A Gymnastics profile starts on Gymnastics (2.8.2).
  const first = profile().kind === 'perf' && !profile().custom ? 'gym' : profile().custom?.sports?.map(x => own[x]).find(Boolean);
  const d = existing ? structuredClone(existing.data) : { kind: first || 'soccer', minutes: 60, effort: 6 };
  let day = existing?.day || today();
  // Your sports, for the empty search: the current one, setup's, recently logged, then a few common ones.
  let yours = [d.kind, ...(profile().custom?.sports || []).map(x => own[x]).filter(Boolean)];
  const fill = () => [...new Set([...yours, 'run', 'lift', 'hike', 'other'])].slice(0, 6);
  entries('activity').then(list => { yours = [...yours, ...list.sort((a, b) => b.ts - a.ts).map(e => e.data.kind)]; }).catch(() => {});
  const { el, close } = overlay(`<div class="row"><h1>${existing ? 'Edit activity' : 'Log activity'}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="f"></div>
    <button class="cta" id="save">Save</button>
    ${existing ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete</button>' : ''}`, { label: 'Log activity' });
  const distShown = () => d.distTyped !== undefined ? d.distTyped : d.dist && d.distUnit === distUnits(d.kind, profile()) ? String(d.dist) : '';
  const pace = () => { const u = distUnits(d.kind, profile()), t = paceText(d.kind, d.minutes, +String(distShown()).replace(',', '.'), u);
    return t ? `<b class="num">${esc(t)}</b> <span class="sub">· from ${esc(d.minutes)} min and ${esc(distShown())} ${u}</span>` : ''; };
  const showPace = () => { const el2 = el.querySelector('#pace'); if (!el2) return; const t = pace(); el2.innerHTML = t; el2.hidden = !t; };
  const draw = () => {
    el.querySelector('#f').innerHTML = `<div class="row" style="margin:8px 0"><span class="lbl" style="margin:0">Day</span>${dayPicker(day, today(), 'Activity day')}</div>
      <p class="lbl" style="margin-top:12px">What</p>
      <input id="asport" value="${esc(activityName(d.kind, d.kind === 'sport' ? d.name : ''))}" autocomplete="off" autocapitalize="off" aria-label="Sport. Type to search all ${ACTIVITIES.length}" placeholder="Search sports, e.g. tennis">
      <div class="pills sugg" id="asugg" style="margin-top:6px" hidden></div>
      <p class="lbl" style="margin-top:16px">Minutes</p>
      <div class="seg">${[30, 45, 60, 90, 120].map(m => `<button data-min="${m}" aria-pressed="${d.minutes === m}">${m}</button>`).join('')}</div>
      <input id="mins" type="number" inputmode="numeric" min="1" max="600" value="${d.minutes ? esc(d.minutes) : ''}" aria-label="Minutes" style="margin-top:8px">
      ${DISTANCE.includes(d.kind) ? `<label class="f" style="margin-top:12px"><span>Distance (optional, ${distUnits(d.kind, profile())})</span><input id="adist" inputmode="decimal" value="${esc(distShown())}"></label>
        <p class="say" id="pace" aria-live="polite" style="text-align:center;margin-top:8px"${pace() ? '' : ' hidden'}>${pace()}</p>` : ''}
      <p class="lbl" style="margin-top:16px">Effort (1 easy, 10 all-out)</p>
      <div class="pills">${Array.from({ length: 10 }, (_, i) => i + 1).map(v => `<button data-eff="${v}" aria-pressed="${d.effort === v}">${v}</button>`).join('')}</div>`;
  };
  const sugg = q => { const box = el.querySelector('#asugg'); if (!box) return;
    const hits = q.trim() ? findSports(q) : fill().map(k => ACTIVITIES.find(a => a[0] === k)).filter(Boolean);
    box.innerHTML = hits.map(a => `<button data-kind="${a[0]}">${esc(a[1])}</button>`).join('')
      + (q.trim() && !hits.length ? `<button data-kind="sport" data-name="${esc(q.trim().slice(0, 40))}">Other sport: ${esc(q.trim().slice(0, 40))}</button>` : '');
    box.hidden = false; };
  el.addEventListener('keydown', e => { if (e.target.id === 'asport' && e.key === 'Enter') { e.preventDefault(); el.querySelector('#asugg button')?.click(); } });
  el.addEventListener('focusin', e => { if (e.target.id === 'asport') { e.target.select(); sugg(''); } });
  el.addEventListener('input', e => {
    if (e.target.id === 'asport') return sugg(e.target.value);
    if (e.target.id === 'mins') d.minutes = e.target.value === '' ? 0 : Math.round(+e.target.value || 0); // checked on Save, not silently clamped
    if (e.target.id === 'adist') d.distTyped = e.target.value;
    showPace();
  });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.dayshift) { const nd = addDays(day, +b.dataset.dayshift); if (nd <= today() && nd >= addDays(today(), -14)) day = nd; return draw(); }
    if (b.dataset.kind) { d.kind = b.dataset.kind; if (b.dataset.name) d.name = b.dataset.name; return draw(); }
    if (b.dataset.min) { d.minutes = +b.dataset.min; return draw(); }
    if (b.dataset.eff) { d.effort = +b.dataset.eff; return draw(); }
    if (b.id === 'save') {
      // A sport typed but not picked from the suggestions still counts (2.15): the closest match, or its own name.
      const typed = el.querySelector('#asport')?.value.trim() || '';
      if (typed && typed.toLowerCase() !== activityName(d.kind, d.kind === 'sport' ? d.name : '').toLowerCase()) {
        const hit = findSports(typed, 1)[0];
        if (hit) { d.kind = hit[0]; delete d.name; } else { d.kind = 'sport'; d.name = typed.slice(0, 40); }
      }
      if (!(d.minutes >= 1 && d.minutes <= 600)) return toast(d.minutes > 600 ? 'Up to 600 minutes. Log a longer day as two activities.' : 'Enter the minutes, 1 or more');
      // Only the sport gets a name, and only distance kinds keep a distance.
      if (d.kind !== 'sport' || !d.name?.trim()) delete d.name; else d.name = d.name.trim();
      if (d.distTyped !== undefined) { const v = +String(d.distTyped).replace(',', '.'); if (d.distTyped.trim() && !(v > 0 && v < 100000)) return toast('Enter the distance as a number'); d.dist = d.distTyped.trim() ? Math.round(v * 100) / 100 : null; }
      const newDist = d.distTyped !== undefined && d.distTyped.trim() !== '';
      delete d.distTyped;
      // The unit changes only with a newly typed distance (2.15), so 5 mi never turns into 5 km.
      if (DISTANCE.includes(d.kind) && d.dist) { if (newDist || !d.distUnit) d.distUnit = distUnits(d.kind, profile()); } else { delete d.dist; delete d.distUnit; }
      await saveEntry('activity', d, existing ? { id: existing.id, day, ts: existing.ts } : { day }); // an edited import keeps its id, so re-imports skip it
      close(); toast(existing ? 'Activity updated' : 'Activity logged'); onDone();
    }
    if (b.id === 'del' && await ask('Delete this activity?', '', [{ label: 'Delete', value: true, danger: true }])) { await forgetHealthWorkout(existing); await deleteEntry(existing.id); close(); onDone(); }
  }));
  draw();
}

export async function editActivityById(id) {
  const e = (await entries('activity')).find(x => x.id === id);
  if (e) logActivity(e);
}
