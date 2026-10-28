// First-launch (and "Add profile") setup. Every personal value is entered here
// and stored only on this device.
import { KINDS, MODULES, newProfile, saveProfile, S } from './state.js';
import { showLock } from './lock.js';
import { overlay, esc } from './ui.js';

export const ACCENTS = ['#5ea4ff', '#b18cff', '#ff7ab8', '#4fd1c5', '#f2c14e', '#ff8a3d', '#7ee081'];

export function onboard() {
  return new Promise(resolve => {
    const d = { kind: null, name: '', accent: null, modules: {}, protein: '', proteinPer: 'day' };
    let step = 0;
    const { el, close } = overlay('<div class="scroll" id="ob"></div><div id="obnav"></div>', { label: 'Set up a profile' });
    const $ = s => el.querySelector(s);

    const steps = [
      () => `<p class="lbl">${S.profiles.length ? 'New profile' : 'Welcome'}</p>
        <h1>Goku</h1>
        <p class="sub" style="margin-top:8px">Everything you log stays on this phone. There are no accounts and nothing is sent anywhere.
        Back up from Settings so a lost phone never means lost training history.</p>
        <h2 style="margin-top:20px">What do you train?</h2>
        ${Object.entries(KINDS).map(([k, v]) => `<button class="card" data-kind="${k}" aria-pressed="${d.kind === k}"
          style="display:block;width:100%;text-align:left;${d.kind === k ? 'border-color:var(--accent)' : ''}">
          <h2>${v.label}</h2><p class="sub">${k === 'engine' ? 'Density circuits, drop sets, ghost races and a gut log.' :
          'Readiness, week planner, training load and fueling.'}</p></button>`).join('')}`,
      () => `<p class="lbl">Step 2 of 4</p><h1>What should we call you?</h1>
        <label class="f"><span>First name or nickname</span>
        <input id="nm" autocomplete="off" autocapitalize="words" maxlength="24" value="${esc(d.name)}"></label>
        <p class="note">Only shown inside the app on this phone.</p>
        <h2 style="margin-top:20px">Pick your color</h2>
        <div class="swatches">${ACCENTS.map(c => `<button style="background:${c}" data-acc="${c}"
          aria-pressed="${c === (d.accent || KINDS[d.kind].accent)}" aria-label="Color ${c}"></button>`).join('')}</div>`,
      () => `<p class="lbl">Step 3 of 4</p><h1>What should the app show?</h1>
        <p class="sub">Turn on what helps. You can change this any time in Settings.</p>
        <div class="card" style="margin-top:12px">${MODULES[d.kind].map(([k, n, desc]) => `
          <label class="toggle"><span><b>${n}</b><br><span class="sub">${desc}</span></span>
          <input type="checkbox" data-mod="${k}" ${d.modules[k] !== false ? 'checked' : ''}></label>`).join('')}</div>`,
      () => d.kind === 'engine'
        ? `<p class="lbl">Step 4 of 4</p><h1>Protein target</h1>
          <p class="sub">Type the target you've been given. Leave it blank to skip; you can add it later in Settings.</p>
          <label class="f"><span>Grams</span><input id="pt" inputmode="numeric" pattern="[0-9]*" value="${esc(d.protein)}" placeholder="160"></label>
          <div class="seg" role="group" aria-label="Target applies to">
            <button data-per="day" aria-pressed="${d.proteinPer === 'day'}">Per day</button>
            <button data-per="meal" aria-pressed="${d.proteinPer === 'meal'}">Per meal</button></div>`
        : `<p class="lbl">Step 4 of 4</p><h1>Your week</h1>
          <p class="sub">The planner starts with 16 hours of gymnastics and 5 of vaulting across the week, with Sunday as rest.
          Change any day from the Week tab.</p>
          <p class="note" style="margin-top:16px">Health note: if something hurts in a way that changes how you do a skill,
          the app will always point you to a parent, your coach or your doctor.</p>`,
    ];

    function draw() {
      $('#ob').innerHTML = steps[step]();
      const ready = step === 0 ? !!d.kind : step === 1 ? d.name.trim().length > 0 : true;
      $('#obnav').innerHTML = `<p class="msg" id="obm" role="status"></p>
        <button class="cta" id="next">${step === steps.length - 1 ? 'Set passcode' : 'Continue'}</button>
        ${step > 0 ? '<button class="cta2" id="back" style="width:100%;margin-top:8px">Back</button>' : ''}`;
      $('#next').dataset.ready = ready;
      document.documentElement.style.setProperty('--accent', d.accent || (d.kind ? KINDS[d.kind].accent : '#5ea4ff'));
    }

    el.addEventListener('input', e => {
      if (e.target.id === 'nm') { d.name = e.target.value; $('#next').dataset.ready = d.name.trim().length > 0; $('#obm').textContent = ''; }
      if (e.target.id === 'pt') d.protein = e.target.value.replace(/\D/g, '');
    });
    el.addEventListener('change', e => { if (e.target.dataset.mod) d.modules[e.target.dataset.mod] = e.target.checked; });
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.kind) { d.kind = b.dataset.kind; d.accent = null; draw(); }
      else if (b.dataset.acc) { d.accent = b.dataset.acc; draw(); }
      else if (b.dataset.per) { d.proteinPer = b.dataset.per; draw(); }
      else if (b.id === 'back') { step--; draw(); }
      else if (b.id === 'next') {
        if (b.dataset.ready !== 'true') { $('#obm').textContent = step === 0 ? 'Pick one to continue.' : 'Enter a name to continue.'; return; }
        if (step < steps.length - 1) { step++; draw(); return; }
        const p = newProfile(d.kind, d.name.trim(), d.accent);
        for (const [k, v] of Object.entries(d.modules)) p.modules[k] = v;
        if (d.kind === 'engine') { p.settings.proteinTarget = d.protein ? +d.protein : null; p.settings.proteinPer = d.proteinPer; }
        close();
        await saveProfile(p);
        await showLock(p, { mode: 'create' });
        resolve(p);
      }
    });
    draw();
  });
}
