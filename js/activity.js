// Other training (soccer, runs, pickup games): minutes and effort, so fuel ranges, the
// recovery map and the weekly recap see all of a person's training, not only circuits.
import { entries, saveEntry, deleteEntry, today, profile } from './state.js';
import { esc, ask, overlay, guard, toast, dayPicker } from './ui.js';
import { addDays, prettyDay } from './time.js';
import { forgetHealthWorkout } from './health.js';

// [id, label, muscle groups it loads]
export const ACTIVITIES = [
  ['soccer', 'Soccer', ['legs', 'core', 'power']], ['run', 'Running', ['legs']], ['bike', 'Cycling', ['legs']],
  ['swim', 'Swimming', ['pull', 'push']], ['hike', 'Hiking or walking', ['legs']], ['sport', 'Other sport', ['legs', 'core']],
  ['lift', 'Other strength work', ['push', 'pull', 'legs', 'core']], ['other', 'Something else', []],
];
export const activityName = k => ACTIVITIES.find(a => a[0] === k)?.[1] || 'Activity';
export const activityGroups = k => ACTIVITIES.find(a => a[0] === k)?.[2] || [];

export async function activitiesOn(day) { return (await entries('activity')).filter(e => e.day === day); }
export const minutesOf = list => list.reduce((a, e) => a + (e.data.minutes || 0), 0);

export function activityRows(list, { edit = true } = {}) {
  return list.map(e => `<li><span>${esc(activityName(e.data.kind))} · ${esc(e.data.minutes)} min<br>
    <span class="chain">${prettyDay(e.day)} · effort ${esc(e.data.effort)}</span></span>
    ${edit ? `<button class="cta2" data-act="${esc(e.id)}" aria-label="Edit ${esc(activityName(e.data.kind))} on ${prettyDay(e.day)}">Edit</button>` : ''}</li>`).join('');
}

export function logActivity(existing = null, onDone = () => window.goku.render()) {
  // A Custom profile starts on its own sport; everyone else on soccer, the original pack.
  const own = { run: 'run', soccer: 'soccer', team: 'sport', swim: 'swim', bike: 'bike', strength: 'lift', dance: 'sport', martial: 'sport', gymnastics: 'sport', yoga: 'other' };
  const first = profile().custom?.sports?.map(x => own[x]).find(Boolean);
  const d = existing ? structuredClone(existing.data) : { kind: first || 'soccer', minutes: 60, effort: 6 };
  let day = existing?.day || today();
  const { el, close } = overlay(`<div class="row"><h1>${existing ? 'Edit activity' : 'Log activity'}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll" id="f"></div>
    <button class="cta" id="save">Save</button>
    ${existing ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete</button>' : ''}`, { label: 'Log activity' });
  const draw = () => {
    el.querySelector('#f').innerHTML = `<div class="row" style="margin:8px 0"><span class="lbl" style="margin:0">Day</span>${dayPicker(day, today(), 'Activity day')}</div>
      <p class="lbl" style="margin-top:12px">What</p>
      <div class="pills">${ACTIVITIES.map(([k, n]) => `<button data-kind="${k}" aria-pressed="${d.kind === k}">${esc(n)}</button>`).join('')}</div>
      <p class="lbl" style="margin-top:16px">Minutes</p>
      <div class="seg">${[30, 45, 60, 90, 120].map(m => `<button data-min="${m}" aria-pressed="${d.minutes === m}">${m}</button>`).join('')}</div>
      <input id="mins" type="number" inputmode="numeric" min="1" max="600" value="${d.minutes ? esc(d.minutes) : ''}" aria-label="Minutes" style="margin-top:8px">
      <p class="lbl" style="margin-top:16px">Effort (0 easy, 10 all-out)</p>
      <div class="seg">${[2, 4, 6, 8, 10].map(v => `<button data-eff="${v}" aria-pressed="${d.effort === v}">${v}</button>`).join('')}</div>`;
  };
  el.addEventListener('input', e => { if (e.target.id === 'mins') d.minutes = e.target.value === '' ? 0 : Math.max(1, Math.min(600, Math.round(+e.target.value || 0))); });
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.dayshift) { const nd = addDays(day, +b.dataset.dayshift); if (nd <= today() && nd >= addDays(today(), -14)) day = nd; return draw(); }
    if (b.dataset.kind) { d.kind = b.dataset.kind; return draw(); }
    if (b.dataset.min) { d.minutes = +b.dataset.min; return draw(); }
    if (b.dataset.eff) { d.effort = +b.dataset.eff; return draw(); }
    if (b.id === 'save') {
      if (!(d.minutes > 0)) return toast('Enter the minutes');
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
