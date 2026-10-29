// First-launch (and "Add profile") setup. Every personal value is entered here
// and stored only on this device.
import { KINDS, newProfile, saveProfile, S, liveModules, soonModules, SPORTS, STYLES, presetModules, sessionNames } from './state.js';
import { showLock } from './lock.js';
import { overlay, esc, setAccent, setTheme, stepper, round } from './ui.js';
import { DOW, deviceTZ } from './time.js';
import { setupScreens, screenHTML, screenClick, screenRead, progress } from './coach.js';
import { avatarPicker, pickAvatar, photoToAvatar } from './avatar.js';

// Starting gravity from the coach answers: newer lifters start lighter, conditioning goals faster.
function startGravity(a) {
  if (a.experience === '0') return 20;
  if (a.goal === 'conditioning' && +a.experience >= 3) return 100;
  return 50;
}

// Capsule (2.2): Goku's guide through setup, an original character (a little capsule with a
// face), never a Dragon Ball character. Each step gets its own bright page color.
const STEP_COLORS = ['#ffd84d', '#ff9f5a', '#c9bdff', '#9be6c4', '#ffb59c', '#8fd3ff'];
function capsule(step, total) {
  const last = step === total - 1, first = step === 0;
  const mouth = first ? 'M47 70q13 12 26 0' : last ? 'M45 68q15 16 30 0' : step % 3 === 1 ? 'M50 72h20' : 'M48 70q12 9 24 0';
  const eyes = step % 3 === 1 && !last ? '<path d="M38 56h10M72 56h10" stroke="#141414" stroke-width="4" stroke-linecap="round"/>' : '<circle cx="44" cy="56" r="5" fill="#141414"/><circle cx="76" cy="56" r="5" fill="#141414"/>';
  const arms = last ? '<path d="M14 62l-8-14M106 62l8-14" stroke="#141414" stroke-width="5" stroke-linecap="round"/>' : first ? '<path d="M106 58l10-12" stroke="#141414" stroke-width="5" stroke-linecap="round"/>' : '';
  return `<div class="mascot" aria-hidden="true"><svg viewBox="0 0 120 110" width="104" height="96">${arms}
    <defs><clipPath id="capR"><rect x="60" y="20" width="50" height="80"/></clipPath></defs>
    <rect x="14" y="26" width="92" height="66" rx="33" fill="#fff"/>
    <rect x="14" y="26" width="92" height="66" rx="33" fill="#ff8a3d" clip-path="url(#capR)"/>
    <rect x="14" y="26" width="92" height="66" rx="33" fill="none" stroke="#141414" stroke-width="4"/>
    ${eyes}<path d="${mouth}" fill="none" stroke="#141414" stroke-width="4" stroke-linecap="round"/>
    <rect x="53" y="12" width="14" height="14" rx="4" fill="#ff8a3d" stroke="#141414" stroke-width="3"/></svg></div>`;
}

export const ACCENTS = ['#5ea4ff', '#b18cff', '#ff7ab8', '#4fd1c5', '#f2c14e', '#ff8a3d', '#7ee081'];

// Resolves with the new profile, or null if cancelled (only possible when cancellable).
export function onboard({ cancellable = false } = {}) {
  return new Promise(resolve => {
    const d = { pick: null, custom: null, kind: null, name: '', accent: null, modules: {}, protein: '', proteinPer: 'day', week: Array.from({ length: 7 }, () => ({ gym: 0, vault: 0 })),
      avatar: null, units: 'imperial', tz: deviceTZ(), about: {}, coach: { asked: {} } };
    let step = 0;
    const { el, close } = overlay(`${cancellable ? '<div class="row" style="justify-content:flex-end"><button class="cta2" id="cancel" data-close>Cancel</button></div>' : ''}
      <div class="scroll" id="ob"></div><div id="obnav"></div>`, { label: 'Set up a profile' });
    const $ = s => el.querySelector(s);
    const h = m => round(m / 60, 2);

    // One coach question per screen, about 3 minutes in all.
    const screens = () => setupScreens(d.kind ? d : { kind: 'engine' });
    const extra = () => d.pick === 'custom' ? 2 : 0; // Custom adds "What do you do?" and "How do you train?"
    const firstQ = () => 3 + extra();
    const qAt = i => d.kind && i >= firstQ() && i < firstQ() + screens().length ? screens()[i - firstQ()][1] : null;
    const qSteps = () => screens().map(([title], i) => () => `<div class="lbl">${label()}</div><h1>${esc(title)}</h1>${screenHTML(screens()[i][1], d)}`);
    const label = () => progress(step, steps.length, step >= firstQ() && qAt(step) ? 'Your coach' : '');
    let steps = [];
    const names = () => sessionNames(d.pick === 'custom' ? d : {});
    const build = () => [
      () => `<p class="lbl">${S.profiles.length ? 'New profile' : 'Welcome'}</p>
        <h1>Goku</h1>
        <p class="sub" style="margin-top:8px">Everything you log stays on this phone. There are no accounts and nothing is sent anywhere.
        Back up from Settings so a lost phone never means lost training history.</p>
        <h2 style="margin-top:20px">What do you train?</h2>
        ${Object.entries(KINDS).map(([k, v]) => `<button class="card pick" data-kind="${k}" aria-pressed="${d.pick === k}">
          <h2>${v.label}</h2><p class="sub">${k === 'engine' ? 'Timed circuits, drop sets and ghost races, with an exercise library and a food log.' :
          'Daily readiness, a week planner, training load, a skill tree and a food log.'}</p></button>`).join('')}
        <button class="card pick" data-kind="custom" aria-pressed="${d.pick === 'custom'}"><h2>Custom</h2>
          <p class="sub">Any sport or mix. A few questions build Goku around how you train.</p></button>`,
      ...(d.pick === 'custom' ? [
        () => `<div class="lbl">${label()}</div><h1>What do you do?</h1><p class="sub" style="text-align:center">Pick everything that's part of your training.</p>
          <div class="pills" style="margin-top:12px">${SPORTS.map(([k, n]) => `<button data-sport="${k}" aria-pressed="${d.custom.sports.includes(k)}">${esc(n)}</button>`).join('')}</div>`,
        () => `<div class="lbl">${label()}</div><h1>How do you like to train?</h1>
          ${STYLES.map(([k, n, desc]) => `<button class="card pick" data-style="${k}" aria-pressed="${d.custom.style === k}"><h2>${esc(n)}</h2><p class="sub">${esc(desc)}</p></button>`).join('')}`,
      ] : []),
      () => `<div class="lbl">${label()}</div><h1>What should we call you?</h1>
        <label class="f"><span>First name or nickname</span>
        <input id="nm" autocomplete="off" autocapitalize="words" maxlength="24" value="${esc(d.name)}"></label>
        <p class="note">Only shown inside the app on this phone.</p>
        <h2 style="margin-top:20px">Pick your color</h2>
        <div class="swatches">${ACCENTS.map(c => `<button style="background:${c}" data-acc="${c}"
          aria-pressed="${c === (d.accent || KINDS[d.kind].accent)}" aria-label="Color ${c}"></button>`).join('')}</div>`,
      () => `<div class="lbl">${label()}</div><h1>Choose your fighter</h1>${avatarPicker({ ...d, name: d.name || '?' })}`,
      ...qSteps(),
      () => `<div class="lbl">${label()}</div><h1>What should the app show?</h1>
        <p class="sub">Turn on what helps. You can change this any time in Settings.</p>
        <div class="card" style="margin-top:12px">${liveModules(d.kind).map(([k, n, desc]) => `
          <label class="toggle"><span><b>${n}</b><br><span class="sub">${desc}</span></span>
          <input type="checkbox" data-mod="${k}" ${d.modules[k] !== false ? 'checked' : ''}></label>`).join('')}</div>
        ${soonModules(d.kind).length ? `<p class="note">Coming soon: ${soonModules(d.kind).map(m => esc(m[1])).join(' · ')}.</p>` : ''}`,
      () => d.kind === 'engine'
        ? `<div class="lbl">${label()}</div><h1>Protein target</h1>
          <p class="sub">If a coach or dietitian gave you a number, type it. Otherwise leave it blank: Goku shows a range sized for you on Home.</p>
          <label class="f"><span>Grams</span><input id="pt" inputmode="numeric" pattern="[0-9]*" value="${esc(d.protein)}" placeholder="160"></label>
          <div class="seg" role="group" aria-label="Target applies to">
            <button data-per="day" aria-pressed="${d.proteinPer === 'day'}">Per day</button>
            <button data-per="meal" aria-pressed="${d.proteinPer === 'meal'}">Per meal</button></div>`
        : `<div class="lbl">${label()}</div><h1>Your usual week</h1>
          <p class="sub">Hours of training on each day. Skip it if you like; you can change it any time from the Week tab.</p>
          <p class="num sub" style="margin-top:8px" id="wtot">${round(d.week.reduce((a, x) => a + x.gym + x.vault, 0) / 60, 1)} h a week</p>
          ${DOW.map((day, i) => `<div class="card" style="margin-top:8px;padding:10px 14px"><p class="lbl">${day}</p>
            <div class="row"><span>${esc(names()[0])}</span>${stepper('gym:' + i, h(d.week[i].gym), names()[0].toLowerCase() + ' on ' + day, ' h')}</div>
            ${names()[1] ? `<div class="row" style="margin-top:6px"><span>${esc(names()[1])}</span>${stepper('vault:' + i, h(d.week[i].vault), names()[1].toLowerCase() + ' on ' + day, ' h')}</div>` : ''}</div>`).join('')}`,
    ];
    steps = build();

    function draw() {
      $('#ob').innerHTML = capsule(step, steps.length) + steps[step]();
      el.classList.add('capsule-setup');
      el.style.setProperty('--step', STEP_COLORS[step % STEP_COLORS.length]);
      const st = step - (step >= 1 ? extra() : 0); // the step counting from the name screen
      const ready = step === 0 ? !!d.pick : extra() && step === 1 ? d.custom.sports.length > 0 : extra() && step === 2 ? !!d.custom.style
        : st === 1 ? d.name.trim().length > 0 : true;
      $('#obnav').innerHTML = `<p class="msg" id="obm" role="status"></p>
        <button class="cta" id="next">${step === steps.length - 1 ? 'Set passcode' : 'Continue'}</button>
        ${step > 0 ? '<button class="cta2" id="back" style="width:100%;margin-top:8px">Back</button>' : ''}`;
      $('#next').dataset.ready = ready;
      setTheme('capsule', 'auto');
      setAccent(d.accent || (d.kind ? KINDS[d.kind].accent : '#5ea4ff'));
    }

    el.addEventListener('input', e => {
      if (e.target.id === 'nm') { d.name = e.target.value; $('#next').dataset.ready = d.name.trim().length > 0; $('#obm').textContent = ''; }
      if (e.target.id === 'pt') d.protein = e.target.value.replace(/\D/g, '');
    });
    el.addEventListener('change', async e => {
      if (e.target.dataset.mod) d.modules[e.target.dataset.mod] = e.target.checked;
      if (e.target.matches('[data-avatar-photo]')) {
        try { d.avatar = await photoToAvatar(e.target.files[0]); t.value = ''; e.target.value = ''; draw(); } catch (err) { $('#obm').textContent = err.message || "That photo couldn't be read."; }
      }
    });
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'cancel') { close(); resolve(null); return; }
      const qs = qAt(step);
      if (qs && b.closest('.q')) { if (screenClick(qs, d, b, el)) draw(); return; }
      if (b.dataset.avatar) { pickAvatar(d, b.dataset.avatar); draw(); return; }
      if (b.dataset.kind) {
        d.pick = b.dataset.kind; d.accent = null;
        if (d.pick === 'custom') {
          d.custom ||= { sports: [], style: null }; // coming back keeps earlier answers, and the kind they chose
          d.kind = d.custom.style ? (d.custom.style === 'sessions' ? 'perf' : 'engine') : null;
          d.modules = d.kind ? presetModules(d.kind, d.custom.sports) : {};
        } else { d.kind = d.pick; d.modules = {}; }
        steps = build(); draw();
      }
      else if (b.dataset.sport) { const s = d.custom.sports, k = b.dataset.sport; s.includes(k) ? s.splice(s.indexOf(k), 1) : s.push(k); d.modules = d.kind ? presetModules(d.kind, s) : {}; draw(); }
      else if (b.dataset.style) {
        d.custom.style = b.dataset.style; d.kind = d.custom.style === 'sessions' ? 'perf' : 'engine';
        d.modules = presetModules(d.kind, d.custom.sports); steps = build(); draw();
      }
      else if (b.dataset.acc) { d.accent = b.dataset.acc; draw(); }
      else if (b.dataset.per) { d.proteinPer = b.dataset.per; draw(); }
      else if (b.dataset.d && b.closest('[data-step]')) {
        const [k, i] = b.closest('[data-step]').dataset.step.split(':');
        d.week[+i][k] = Math.min(600, Math.max(0, d.week[+i][k] + +b.dataset.d * 15));
        b.closest('[data-step]').querySelector('.num').textContent = h(d.week[+i][k]) + ' h';
        $('#wtot').textContent = round(d.week.reduce((a, x) => a + x.gym + x.vault, 0) / 60, 1) + ' h a week';
      }
      else if (b.id === 'back') { if (qs) qs.forEach(q => screenRead([q], d, el)); step--; draw(); }
      else if (b.id === 'next') {
        if (b.dataset.ready !== 'true') { $('#obm').textContent = step === 0 || (extra() && step <= 2) ? 'Pick one to continue.' : 'Enter a name to continue.'; return; }
        if (qs && !screenRead(qs, d, el)) return;
        if (step < steps.length - 1) { step++; draw(); $('#ob').scrollTop = 0; return; }
        const p = newProfile(d.kind, d.name.trim(), d.accent);
        for (const [k, v] of Object.entries(d.modules)) p.modules[k] = v;
        Object.assign(p, { avatar: d.avatar, units: d.units, tz: d.tz, about: d.about, coach: d.coach });
        if (d.pick === 'custom') p.custom = { sports: [...d.custom.sports], style: d.custom.style };
        if (d.kind === 'engine') p.settings.gravity = startGravity(d.about);
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
