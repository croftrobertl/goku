// "Performance" profile: readiness, check-in, week planner, session load.
// Shows no weight, calorie-deficit or body-shape content.
import { profile, saveProfile, entries, saveEntry, deleteEntry, today, on } from './state.js';
import * as db from './db.js';
import { esc, ask, overlay, stepper, round, guard, toast, dayPicker } from './ui.js';
import { DOW, addDays, weekStart, weekday, prettyDay } from './time.js';
import { AREAS } from './validate.js';

export const tabs = () => [['home', 'Home'], ['week', 'Week'], ['checkin', 'Check-in'], ['history', 'History'], ['settings', 'Settings']];

// M1 readiness formula (0–100). Reviewed in M2; documented in the README.
// Sleep target: 9 h, the middle of the 8–10 h the American Academy of Sleep Medicine recommends for ages 13–18.
export function readiness(c) {
  if (!c) return null;
  const sleep = Math.min(c.sleepH / 9, 1) * 30;
  const quality = (c.sleepQ - 1) / 4 * 10;
  const fatigue = (5 - c.fatigue) / 4 * 15;
  const stress = (5 - c.stress) / 4 * 10;
  const mood = (c.mood - 1) / 4 * 10;
  const fun = (c.fun - 1) / 4 * 10;
  const sore = Math.max(0, 15 - c.sore.length * 5);
  return Math.round(sleep + quality + fatigue + stress + mood + fun + sore);
}
const word = r => r >= 75 ? 'Good to go' : r >= 55 ? 'Take it steady' : 'Talk to your coach today';

// Red flags (only when the person has "Red flags and care checks" on).
// Wrists: sore in each of the last 3 check-ins, all within the last 7 days.
export async function careFlags() {
  const p = profile();
  if (!on(p, 'care')) return [];
  const t = today();
  const cs = (await entries('checkin')).filter(c => c.day >= addDays(t, -6) && c.day <= t);
  const last3 = cs.slice(-3);
  const flags = [];
  if (last3.length === 3 && last3.every(c => c.data.sore.includes('Wrists'))) flags.push('Your wrists were sore in each of your last 3 check-ins.');
  const todayC = cs.find(c => c.day === t)?.data;
  if (todayC?.archPain) flags.push('Your back hurts when you arch.');
  if (todayC?.techPain) flags.push('Pain is changing how you do a skill.');
  if (todayC?.dizzy) flags.push('You felt dizzy or faint.');
  return flags;
}

// ---------- Home ----------
export async function home() {
  const p = profile();
  const t = today();
  const c = (await db.get('entries', p.id + ':checkin:' + t))?.data;
  const r = readiness(c);
  const len = 2 * Math.PI * 72;
  const plan = p.settings.weekPlan;
  const ws = weekStart(t);
  const sessions = await db.byIndexRange('entries', 'profileDay', [p.id, ws], [p.id, addDays(ws, 6)]).then(l => l.filter(e => e.type === 'session'));
  const todays = sessions.filter(s => s.day === t);
  const planned = plan[weekday(t)];
  const weekMins = plan.reduce((a, d) => a + d.gym + d.vault, 0);
  const flags = await careFlags();

  return {
    cta: c ? ['Log a session', () => logSession()] : ['Check in · 30 s', () => openCheckin(t)],
    html: `<div class="cols"><div>
      <section class="card" aria-labelledby="h-ready">
        <p class="lbl">Today's readiness</p>
        ${c ? `<div class="ring" role="img" aria-label="Readiness ${r} out of 100, ${word(r)}">
          <svg viewBox="0 0 170 170"><circle cx="85" cy="85" r="72" fill="none" stroke="var(--s2)" stroke-width="14"/>
          <circle cx="85" cy="85" r="72" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len * r / 100} ${len}"/></svg>
          <div style="text-align:center"><div class="big num" style="font-size:2.6rem">${r}</div><div class="sub">of 100</div></div></div>
          <h1 id="h-ready" style="text-align:center">${word(r)}</h1>
          <p class="sub" style="text-align:center">From sleep, energy, stress, mood, fun and soreness.</p>`
        : `<div class="empty"><h1 id="h-ready">Check in to see readiness</h1>
          <p>Six quick questions about sleep, energy and how your body feels. It takes about 30 seconds.</p></div>`}
      </section>
      ${flags.length ? `<section class="card flag"><p class="lbl">Care check</p>
        <p>${flags.map(esc).join(' ')}</p>
        <p style="margin-top:6px">That's worth telling a parent, your coach and your doctor.</p>
        <p class="note">Don't try to treat it yourself or push through it.</p></section>` : ''}
      <section class="card">
        <div class="row"><h2>This week</h2><span class="num sub">${round(weekMins / 60, 1)} h planned</span></div>
        ${weekMins ? `<div class="week">${DOW.map((d, i) => {
          const key = addDays(ws, i), mins = plan[i].gym + plan[i].vault;
          const logged = sessions.filter(s => s.day === key).reduce((a, s) => a + s.data.minutes, 0);
          return `<button class="day ${key === t ? 'today' : ''} ${mins === 0 ? 'rest' : ''}" data-day="${i}" aria-label="${d}: ${mins ? round(mins / 60, 1) + ' hours planned' : 'rest day'}${logged ? ', ' + logged + ' minutes logged' : ''}">
            ${d}<span class="h num">${mins === 0 ? 'Rest' : round(mins / 60, 1) + 'h'}</span>${logged ? '<span class="note" style="margin:0" aria-hidden="true">✓</span>' : ''}</button>`;
        }).join('')}</div>`
        : '<div class="empty"><p>Add your usual training hours and Goku shows your week here, with rest days.</p><button class="cta2" data-day="0">Plan my week</button></div>'}
      </section>
    </div><div>
      <section class="card"><p class="lbl">Today</p>
        ${planned.gym + planned.vault === 0 ? `<p>${weekMins ? 'Rest day. Rest is part of training.' : 'No plan for today.'}</p>` :
          `<p>${planned.gym ? `Gymnastics ${round(planned.gym / 60, 1)} h` : ''}${planned.gym && planned.vault ? ' · ' : ''}${planned.vault ? `Vaulting ${round(planned.vault / 60, 1)} h` : ''}</p>`}
        ${todays.length ? `<ul class="list" style="margin-top:8px">${todays.map(s => `<li><span>${s.data.kind === 'vault' ? 'Vaulting' : 'Gymnastics'} · ${esc(s.data.minutes)} min</span>
          <span class="num sub">effort ${esc(s.data.effort)} · load ${s.data.minutes * s.data.effort}</span></li>`).join('')}</ul>` : ''}
        <p class="note">Load = minutes × effort (0–10). Trends and gentle color bands are coming in a later update.</p>
      </section>
      ${on(p, 'fuel') && planned.gym + planned.vault >= 240 ? `<section class="card"><p class="lbl">Fuel · long day</p>
        <p>Pack a snack for the break, a water bottle, and something to eat soon after you finish.</p>
        <p class="note">Energy ranges with their published source are coming in a later update. A pediatrician or sports dietitian should confirm any numbers.</p></section>` : ''}
    </div></div>`,
    bind(root) {
      root.addEventListener('click', e => { if (e.target.closest('[data-day]')) window.goku.go('week'); });
    },
  };
}

// ---------- Check-in (any of the last 14 days) ----------
let checkinDay = null;
export const openCheckin = day => { checkinDay = day; window.goku.go('checkin'); };

const bodyMap = sel => {
  const z = (area, shape) => shape.replace(/^<(\w+)/, `<$1 class="zone" role="button" tabindex="0" data-area="${area}" aria-label="${area}" aria-pressed="${sel.includes(area)}"`);
  const decor = 'fill="var(--s1)" stroke="var(--line)" stroke-width="2"';
  return `<svg class="body-map" viewBox="0 0 240 256" aria-label="Body map. Tap where it's sore.">
    <text x="60" y="10" text-anchor="middle" font-size="11" fill="var(--tx3)">Front</text>
    <text x="180" y="10" text-anchor="middle" font-size="11" fill="var(--tx3)">Back</text>
    <circle cx="60" cy="25" r="13" ${decor}/><rect x="38" y="76" width="44" height="48" rx="10" ${decor}/>
    <rect x="38" y="151" width="44" height="17" rx="6" ${decor}/><rect x="40" y="194" width="40" height="12" rx="5" ${decor}/>
    ${z('Neck', '<rect x="45" y="39" width="30" height="15" rx="5"/>')}
    ${z('Shoulders', '<rect x="20" y="55" width="80" height="19" rx="8"/>')}
    ${z('Elbows', '<circle cx="15" cy="100" r="12"/>')}${z('Elbows', '<circle cx="105" cy="100" r="12"/>')}
    ${z('Wrists', '<circle cx="12" cy="134" r="12"/>')}${z('Wrists', '<circle cx="108" cy="134" r="12"/>')}
    ${z('Hips', '<rect x="34" y="127" width="52" height="22" rx="8"/>')}
    ${z('Knees', '<rect x="36" y="170" width="48" height="22" rx="8"/>')}
    ${z('Ankles', '<rect x="36" y="208" width="48" height="18" rx="7"/>')}
    ${z('Feet', '<rect x="30" y="230" width="60" height="20" rx="8"/>')}
    <circle cx="180" cy="27" r="13" ${decor}/>
    ${z('Upper back', '<rect x="150" y="50" width="60" height="44" rx="10"/>')}
    ${z('Lower back', '<rect x="150" y="98" width="60" height="40" rx="10"/>')}
  </svg>`;
};

export async function checkinView() {
  const p = profile();
  const t = today();
  if (!checkinDay || checkinDay > t) checkinDay = t;
  const day = checkinDay;
  const id = p.id + ':checkin:' + day;
  const existing = (await db.get('entries', id))?.data;
  const prev = (await entries('checkin')).filter(x => x.day < day).pop()?.data;
  const c = existing ? structuredClone(existing) : {
    sleepH: prev?.sleepH ?? 9, sleepQ: 3, fatigue: 3, stress: 2, mood: 3, fun: 3, sore: [],
    archPain: false, techPain: false, dizzy: false,
  };
  const care = on(p, 'care');
  const scale = (k, label, lo, hi) => `<div class="q"><p class="lbl">${label}</p>
    <div class="seg" role="group" aria-label="${label}">${[1, 2, 3, 4, 5].map(v => `<button data-sc="${k}" data-v="${v}" aria-pressed="${c[k] === v}">${v}</button>`).join('')}</div>
    <div class="row note" style="margin-top:4px"><span>${lo}</span><span>${hi}</span></div></div>`;
  const yn = (k, label) => `<div class="toggle"><span>${label}</span>
    <span class="seg" style="margin:0;flex:none"><button data-yn="${k}" data-v="0" aria-pressed="${!c[k]}">No</button><button data-yn="${k}" data-v="1" aria-pressed="${c[k]}">Yes</button></span></div>`;

  return {
    cta: [existing ? 'Update check-in' : 'Save check-in', guard(async () => {
      await saveEntry('checkin', c, { id, day });
      toast(day === t ? 'Check-in saved' : 'Saved for ' + prettyDay(day));
      checkinDay = null; window.goku.go('home');
    })],
    html: `<div class="row"><h1>Check-in</h1>${dayPicker(day, t, 'Check-in day')}</div>
    <p class="sub">${existing ? 'Already saved. Change anything and tap Update.' : 'About 30 seconds. There are no wrong answers.'}</p>
    <div class="cols"><div>
      <section class="card" style="margin-top:12px">
        <div class="q"><p class="lbl">Sleep the night before (hours)</p>${stepper('sleepH', c.sleepH, 'sleep')}</div>
        ${scale('sleepQ', 'Sleep quality', 'Awful', 'Great')}
        ${scale('fatigue', 'Tiredness', 'Fresh', 'Exhausted')}
        ${scale('stress', 'Stress', 'Calm', 'Very stressed')}
        ${scale('mood', 'Mood', 'Low', 'Great')}
        ${scale('fun', 'Fun at training lately', 'None', 'Loved it')}
      </section>
    </div><div>
      <section class="card"><p class="lbl">Anything sore? Tap the map or the list</p>
        ${bodyMap(c.sore)}
        <div class="pills" style="margin-top:12px" role="group" aria-label="Sore areas">${AREAS.map(a =>
          `<button data-sore="${a}" aria-pressed="${c.sore.includes(a)}">${a}</button>`).join('')}</div>
      </section>
      ${care ? `<section class="card"><p class="lbl">Quick health check</p>
        ${yn('archPain', 'Back hurts when you arch?')}
        ${yn('techPain', 'Pain changing how you do a skill?')}
        ${yn('dizzy', 'Felt dizzy or faint?')}
        <p class="note">A "yes" shows a reminder to tell a parent and your doctor. It never tells you to train through it.</p>
      </section>` : '<p class="note">Red flags and care checks are off. You can turn them on in Settings.</p>'}
    </div></div>`,
    bind(root) {
      const toggleSore = a => { c.sore = c.sore.includes(a) ? c.sore.filter(x => x !== a) : [...c.sore, a]; sync(); };
      function sync() {
        root.querySelectorAll('[data-area],[data-sore]').forEach(n => n.setAttribute('aria-pressed', c.sore.includes(n.dataset.area || n.dataset.sore)));
        root.querySelectorAll('[data-sc]').forEach(n => n.setAttribute('aria-pressed', c[n.dataset.sc] === +n.dataset.v));
        root.querySelectorAll('[data-yn]').forEach(n => n.setAttribute('aria-pressed', !!c[n.dataset.yn] === !!+n.dataset.v));
        root.querySelector('[data-step="sleepH"] .num').textContent = c.sleepH;
      }
      root.addEventListener('click', e => {
        const area = e.target.closest('[data-area]'); if (area) return toggleSore(area.dataset.area);
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.dayshift) { checkinDay = addDays(day, +b.dataset.dayshift); if (checkinDay < addDays(t, -14)) checkinDay = addDays(t, -14); return window.goku.render(); }
        if (b.dataset.sore) toggleSore(b.dataset.sore);
        else if (b.dataset.sc) { c[b.dataset.sc] = +b.dataset.v; sync(); }
        else if (b.dataset.yn) { c[b.dataset.yn] = !!+b.dataset.v; sync(); }
        else if (b.dataset.d && b.closest('[data-step="sleepH"]')) { c.sleepH = Math.min(14, Math.max(0, c.sleepH + +b.dataset.d * 0.5)); sync(); }
      });
      root.addEventListener('keydown', e => {
        const area = e.target.closest('[data-area]');
        if (area && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleSore(area.dataset.area); }
      });
    },
  };
}

// ---------- Week planner ----------
export async function weekView() {
  const p = profile();
  const plan = p.settings.weekPlan;
  const t = today(), ws = weekStart(t);
  const sessions = (await db.byIndexRange('entries', 'profileDay', [p.id, ws], [p.id, addDays(ws, 6)])).filter(e => e.type === 'session');
  const weekLoad = sessions.reduce((a, s) => a + s.data.minutes * s.data.effort, 0);
  const h = m => round(m / 60, 2);
  const total = () => round(plan.reduce((a, d) => a + d.gym + d.vault, 0) / 60, 1);
  return {
    cta: ['Log a session', () => logSession()],
    html: `<h1>Week</h1><p class="sub">Your usual week. Change hours with + and −, in 15-minute steps.</p>
    <div class="grid" style="margin-top:12px">
      <section class="card"><p class="lbl">Planned</p><p class="big num" id="wtot">${total()} h</p></section>
      <section class="card"><p class="lbl">Load this week</p><p class="big num">${weekLoad}</p><p class="sub">minutes × effort</p></section>
    </div>
    ${DOW.map((d, i) => `<section class="card" style="${addDays(ws, i) === t ? 'border-color:var(--accent)' : ''}">
      <div class="row"><h2>${d}${addDays(ws, i) === t ? ' · today' : ''}</h2><span class="sub" id="rest${i}">${plan[i].gym + plan[i].vault ? '' : 'Rest day'}</span></div>
      <div class="row" style="margin-top:6px"><span>Gymnastics</span>${stepper('gym:' + i, h(plan[i].gym), 'gymnastics on ' + d, ' h')}</div>
      <div class="row" style="margin-top:6px"><span>Vaulting</span>${stepper('vault:' + i, h(plan[i].vault), 'vaulting on ' + d, ' h')}</div>
    </section>`).join('')}`,
    bind(root) {
      root.addEventListener('click', guard(async e => {
        const b = e.target.closest('button[data-d]'); if (!b) return;
        const [k, i] = b.closest('[data-step]').dataset.step.split(':');
        plan[+i][k] = Math.min(600, Math.max(0, plan[+i][k] + +b.dataset.d * 15));
        await saveProfile(p);
        b.closest('[data-step]').querySelector('.num').textContent = h(plan[+i][k]) + ' h';
        root.querySelector('#wtot').textContent = total() + ' h';
        root.querySelector('#rest' + i).textContent = plan[+i].gym + plan[+i].vault ? '' : 'Rest day';
      }));
    },
  };
}

// Log a new session, or edit an existing one (pass the entry).
export function logSession(existing) {
  const p = profile();
  let day = existing?.day || today();
  const planned = p.settings.weekPlan[weekday(day)];
  const s = existing ? { ...existing.data } : { kind: planned.vault > planned.gym ? 'vault' : 'gym', minutes: planned.gym || planned.vault || 120, effort: 5 };
  const { el, close } = overlay(`<div class="row"><h1>${existing ? 'Edit session' : 'Log a session'}</h1><button class="cta2" id="x" data-close>Close</button></div>
    <div class="scroll">
      <div class="row" style="margin:8px 0"><span class="lbl" style="margin:0">Day</span><span id="dp"></span></div>
      <div class="seg" role="group" aria-label="Session type"><button data-k="gym">Gymnastics</button><button data-k="vault">Vaulting</button></div>
      <div class="q"><p class="lbl">Minutes</p>${stepper('min', s.minutes, 'minutes')}</div>
      <div class="q"><p class="lbl">How hard was it overall? (0 = rest, 10 = maximal)</p>
        <div class="seg" role="group" aria-label="Session effort">${[...Array(11).keys()].map(v => `<button data-e="${v}" style="min-width:44px">${v}</button>`).join('')}</div></div>
      <p class="sub" id="load"></p>
    </div>
    <button class="cta" id="save">${existing ? 'Save changes' : 'Save session'}</button>
    ${existing ? '<button class="cta2 danger" id="del" style="width:100%;margin-top:8px">Delete session</button>' : ''}`, { label: existing ? 'Edit session' : 'Log a session' });
  const draw = () => {
    el.querySelector('#dp').innerHTML = dayPicker(day, today(), 'Session day');
    el.querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === s.kind));
    el.querySelectorAll('[data-e]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.e === s.effort));
    el.querySelector('[data-step="min"] .num').textContent = s.minutes;
    el.querySelector('#load').textContent = `Load: ${s.minutes} × ${s.effort} = ${s.minutes * s.effort}`;
  };
  el.addEventListener('click', guard(async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'x') return close();
    if (b.dataset.dayshift) { const nd = addDays(day, +b.dataset.dayshift); if (nd <= today() && nd >= addDays(today(), -60)) day = nd; }
    if (b.dataset.k) s.kind = b.dataset.k;
    if (b.dataset.e) s.effort = +b.dataset.e;
    if (b.dataset.d) s.minutes = Math.min(600, Math.max(5, s.minutes + +b.dataset.d * 15));
    if (b.id === 'save') {
      await saveEntry('session', s, existing ? { id: existing.id, day, ts: existing.ts } : { day });
      close(); toast(existing ? 'Session updated' : 'Session saved'); window.goku.render(); return;
    }
    if (b.id === 'del' && await ask('Delete this session?', 'It will be removed from your training load.', [{ label: 'Delete', value: true, danger: true }])) {
      await deleteEntry(existing.id); close(); window.goku.render(); return;
    }
    draw();
  }));
  draw();
}

// ---------- History ----------
export async function historyView() {
  const cs = (await entries('checkin')).reverse();
  const ss = (await entries('session')).reverse();
  return {
    html: `<h1>History</h1>
    <section class="card" style="margin-top:12px"><p class="lbl">Check-ins</p>
      ${cs.length ? `<ul class="list">${cs.map(c => `<li><span>${prettyDay(c.day)}<br><span class="chain">${esc(c.data.sleepH)} h sleep${c.data.sore.length ? ' · sore: ' + c.data.sore.map(esc).join(', ') : ''}</span></span>
        <span class="row" style="gap:8px"><span class="num">${readiness(c.data)}</span><button class="cta2" data-ci="${esc(c.day)}" aria-label="Edit check-in from ${prettyDay(c.day)}">Edit</button></span></li>`).join('')}</ul>`
        : '<div class="empty"><h2>No check-ins yet</h2><p>Your daily check-ins show up here, with the readiness score for each day.</p></div>'}
    </section>
    <section class="card"><p class="lbl">Sessions</p>
      ${ss.length ? `<ul class="list">${ss.map(s => `<li><span>${prettyDay(s.day)} · ${s.data.kind === 'vault' ? 'Vaulting' : 'Gymnastics'}<br>
        <span class="chain">${esc(s.data.minutes)} min · effort ${esc(s.data.effort)}</span></span>
        <span class="row" style="gap:8px"><span class="num">${s.data.minutes * s.data.effort}</span>
        <button class="cta2" data-edit="${esc(s.id)}" aria-label="Edit session from ${prettyDay(s.day)}">Edit</button></span></li>`).join('')}</ul>`
        : '<div class="empty"><p>Log sessions from Home or Week. Each one adds to your training load.</p></div>'}
    </section>`,
    bind(root) {
      root.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.ci) openCheckin(b.dataset.ci);
        if (b.dataset.edit) logSession(ss.find(s => s.id === b.dataset.edit));
      });
    },
  };
}
