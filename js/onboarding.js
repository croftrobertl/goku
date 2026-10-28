// First-launch (and "Add profile") setup. Every personal value is entered here
// and stored only on this device.
import { KINDS, newProfile, saveProfile, S, liveModules, soonModules } from './state.js';
import { showLock } from './lock.js';
import { overlay, esc, setAccent, stepper, round } from './ui.js';
import { DOW } from './time.js';

export const ACCENTS = ['#5ea4ff', '#b18cff', '#ff7ab8', '#4fd1c5', '#f2c14e', '#ff8a3d', '#7ee081'];

// Resolves with the new profile, or null if cancelled (only possible when cancellable).
export function onboard({ cancellable = false } = {}) {
  return new Promise(resolve => {
    const d = { kind: null, name: '', accent: null, modules: {}, protein: '', proteinPer: 'day', week: Array.from({ length: 7 }, () => ({ gym: 0, vault: 0 })) };
    let step = 0;
    const { el, close } = overlay(`${cancellable ? '<div class="row" style="justify-content:flex-end"><button class="cta2" id="cancel" data-close>Cancel</button></div>' : ''}
      <div class="scroll" id="ob"></div><div id="obnav"></div>`, { label: 'Set up a profile' });
    const $ = s => el.querySelector(s);
    const h = m => round(m / 60, 2);

    const steps = [
      () => `<p class="lbl">${S.profiles.length ? 'New profile' : 'Welcome'}</p>
        <h1>Goku</h1>
        <p class="sub" style="margin-top:8px">Everything you log stays on this phone. There are no accounts and nothing is sent anywhere.
        Back up from Settings so a lost phone never means lost training history.</p>
        <h2 style="margin-top:20px">What do you train?</h2>
        ${Object.entries(KINDS).map(([k, v]) => `<button class="card pick" data-kind="${k}" aria-pressed="${d.kind === k}">
          <h2>${v.label}</h2><p class="sub">${k === 'engine' ? 'Density circuits, drop sets, ghost races and a gut log.' :
          'Readiness, week planner, training load and fueling.'}</p></button>`).join('')}
        <p class="note">More sports are on the way.</p>`,
      () => `<p class="lbl">Step 2 of 4</p><h1>What should we call you?</h1>
        <label class="f"><span>First name or nickname</span>
        <input id="nm" autocomplete="off" autocapitalize="words" maxlength="24" value="${esc(d.name)}"></label>
        <p class="note">Only shown inside the app on this phone.</p>
        <h2 style="margin-top:20px">Pick your color</h2>
        <div class="swatches">${ACCENTS.map(c => `<button style="background:${c}" data-acc="${c}"
          aria-pressed="${c === (d.accent || KINDS[d.kind].accent)}" aria-label="Color ${c}"></button>`).join('')}</div>`,
      () => `<p class="lbl">Step 3 of 4</p><h1>What should the app show?</h1>
        <p class="sub">Turn on what helps. You can change this any time in Settings.</p>
        <div class="card" style="margin-top:12px">${liveModules(d.kind).map(([k, n, desc]) => `
          <label class="toggle"><span><b>${n}</b><br><span class="sub">${desc}</span></span>
          <input type="checkbox" data-mod="${k}" ${d.modules[k] !== false ? 'checked' : ''}></label>`).join('')}</div>
        ${soonModules(d.kind).length ? `<p class="note">Coming soon: ${soonModules(d.kind).map(m => esc(m[1])).join(' · ')}.</p>` : ''}`,
      () => d.kind === 'engine'
        ? `<p class="lbl">Step 4 of 4</p><h1>Protein target</h1>
          <p class="sub">Type the target you've been given. Leave it blank to skip; you can add it later in Settings.</p>
          <label class="f"><span>Grams</span><input id="pt" inputmode="numeric" pattern="[0-9]*" value="${esc(d.protein)}" placeholder="160"></label>
          <div class="seg" role="group" aria-label="Target applies to">
            <button data-per="day" aria-pressed="${d.proteinPer === 'day'}">Per day</button>
            <button data-per="meal" aria-pressed="${d.proteinPer === 'meal'}">Per meal</button></div>`
        : `<p class="lbl">Step 4 of 4</p><h1>Your usual week</h1>
          <p class="sub">Hours of training on each day. Skip it if you like; you can change it any time from the Week tab.</p>
          <p class="num sub" style="margin-top:8px" id="wtot">${round(d.week.reduce((a, x) => a + x.gym + x.vault, 0) / 60, 1)} h a week</p>
          ${DOW.map((day, i) => `<div class="card" style="margin-top:8px;padding:10px 14px"><p class="lbl">${day}</p>
            <div class="row"><span>Gymnastics</span>${stepper('gym:' + i, h(d.week[i].gym), 'gymnastics on ' + day, ' h')}</div>
            <div class="row" style="margin-top:6px"><span>Vaulting</span>${stepper('vault:' + i, h(d.week[i].vault), 'vaulting on ' + day, ' h')}</div></div>`).join('')}`,
    ];

    function draw() {
      $('#ob').innerHTML = steps[step]();
      const ready = step === 0 ? !!d.kind : step === 1 ? d.name.trim().length > 0 : true;
      $('#obnav').innerHTML = `<p class="msg" id="obm" role="status"></p>
        <button class="cta" id="next">${step === steps.length - 1 ? 'Set passcode' : 'Continue'}</button>
        ${step > 0 ? '<button class="cta2" id="back" style="width:100%;margin-top:8px">Back</button>' : ''}`;
      $('#next').dataset.ready = ready;
      setAccent(d.accent || (d.kind ? KINDS[d.kind].accent : '#5ea4ff'));
    }

    el.addEventListener('input', e => {
      if (e.target.id === 'nm') { d.name = e.target.value; $('#next').dataset.ready = d.name.trim().length > 0; $('#obm').textContent = ''; }
      if (e.target.id === 'pt') d.protein = e.target.value.replace(/\D/g, '');
    });
    el.addEventListener('change', e => { if (e.target.dataset.mod) d.modules[e.target.dataset.mod] = e.target.checked; });
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'cancel') { close(); resolve(null); return; }
      if (b.dataset.kind) { d.kind = b.dataset.kind; d.accent = null; draw(); }
      else if (b.dataset.acc) { d.accent = b.dataset.acc; draw(); }
      else if (b.dataset.per) { d.proteinPer = b.dataset.per; draw(); }
      else if (b.dataset.d && b.closest('[data-step]')) {
        const [k, i] = b.closest('[data-step]').dataset.step.split(':');
        d.week[+i][k] = Math.min(600, Math.max(0, d.week[+i][k] + +b.dataset.d * 15));
        b.closest('[data-step]').querySelector('.num').textContent = h(d.week[+i][k]) + ' h';
        $('#wtot').textContent = round(d.week.reduce((a, x) => a + x.gym + x.vault, 0) / 60, 1) + ' h a week';
      }
      else if (b.id === 'back') { step--; draw(); }
      else if (b.id === 'next') {
        if (b.dataset.ready !== 'true') { $('#obm').textContent = step === 0 ? 'Pick one to continue.' : 'Enter a name to continue.'; return; }
        if (step < steps.length - 1) { step++; draw(); $('#ob').scrollTop = 0; return; }
        const p = newProfile(d.kind, d.name.trim(), d.accent);
        for (const [k, v] of Object.entries(d.modules)) p.modules[k] = v;
        if (d.kind === 'engine') { p.settings.proteinTarget = d.protein ? +d.protein : null; p.settings.proteinPer = d.proteinPer; }
        else p.settings.weekPlan = d.week;
        close();
        await saveProfile(p);
        await showLock(p, { mode: 'create' });
        resolve(p);
      }
    });
    draw();
  });
}
