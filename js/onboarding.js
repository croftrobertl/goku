// First-launch (and "Add profile") setup. Every personal value is entered here
// and stored only on this device.
import { skin, skinId, setSkin, SKINS, w } from './skins.js';
import { THEMES } from './themes.js';
import { KINDS, newProfile, capName, saveProfile, S, liveModules, soonModules, SPORTS, STYLES, presetModules, sessionNames, profile } from './state.js';
import { findSports, activityName } from './activity.js';
import { MOVE_START, SRC } from './plan.js';
import { showLock } from './lock.js';
import { overlay, esc, setAccent, setTheme, stepper, round, ask, sources } from './ui.js';
import { DOW, deviceTZ } from './time.js';
import { setupScreens, screenHTML, screenClick, screenRead, progress, EQUIPMENT, isMinor } from './coach.js';
import { EQUIP, GEAR } from './moves.js';
import { avatarPicker, pickAvatar, photoToAvatar } from './avatar.js';

// Starting gravity from the coach answers: newer lifters start lighter, conditioning goals faster.
function startGravity(a) {
  if (a.experience === 'new' || a.experience === 'back') return 10;
  if (a.experience === '0') return 20;
  if (a.goal === 'conditioning' && +a.experience >= 3) return 100;
  return 50;
}

// The setup guide (2.7, replacing 2.2's Capsule): a star ball buddy, an orange ball with star
// eyes, drawn for Goku in the style of the splash icon; never a Dragon Ball character.
// One bright page color for all of setup (2.8.1; it changed on every step before).
const STEP_COLOR = '#ffd84d';
const STAR = 'l2 4.5 5 .5-3.8 3.3 1.1 4.9-4.3-2.5-4.3 2.5 1.1-4.9-3.8-3.3 5-.5z';
function capsule(step, total) {
  const last = step === total - 1, first = step === 0;
  const mouth = first ? 'M47 72q13 12 26 0' : last ? 'M44 70q16 17 32 0' : step % 3 === 1 ? 'M51 75h18' : 'M48 72q12 9 24 0';
  // Star eyes, or a calm squint on some steps (never on the last).
  const eyes = step % 3 === 1 && !last ? '<path d="M39 56h11M70 56h11" stroke="#141414" stroke-width="4" stroke-linecap="round"/>'
    : `<path d="M44 46${STAR}M76 46${STAR}" fill="#c4281c" stroke="#141414" stroke-width="1.6" stroke-linejoin="round"/>`;
  const arms = last ? '<path d="M18 60l-10-14M102 60l10-14" stroke="#141414" stroke-width="5" stroke-linecap="round"/>' : first ? '<path d="M103 56l11-12" stroke="#141414" stroke-width="5" stroke-linecap="round"/>' : '';
  // The skin picks the guide (2.8): Encore's is a mic buddy, Plain has none.
  if (skin().mascot === 'none') return '';
  if (skin().mascot === 'mic') {
    const micEyes = step % 3 === 1 && !last ? '<path d="M44 40h9M67 40h9" stroke="#3a2a5c" stroke-width="4" stroke-linecap="round"/>'
      : '<circle cx="48" cy="40" r="4.5" fill="#3a2a5c"/><circle cx="72" cy="40" r="4.5" fill="#3a2a5c"/><circle cx="49.5" cy="38.5" r="1.4" fill="#fff"/><circle cx="73.5" cy="38.5" r="1.4" fill="#fff"/>';
    return `<div class="mascot" aria-hidden="true"><svg viewBox="0 0 120 110" width="104" height="96">${arms.replaceAll('#141414', '#3a2a5c').replaceAll('M18 60', 'M30 44').replaceAll('M102 60', 'M90 44').replaceAll('M103 56', 'M91 44')}
      <ellipse cx="60" cy="106" rx="20" ry="3.5" fill="#3a2a5c" opacity=".15"/>
      <path d="M46 68h28l-5 34h-18z" fill="#ffb3c7" stroke="#3a2a5c" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="60" cy="40" r="30" fill="#c9b3ff" stroke="#3a2a5c" stroke-width="4"/>
      <path d="M38 30h44M34 42h52M38 54h44" stroke="#3a2a5c" stroke-width="1.6" opacity=".35"/>
      <path d="M42 22q8-8 18-9" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>
      ${micEyes}<path d="${mouth.replace(/M(\d+) (\d+)/, (m, x, y) => `M${x} ${+y - 20}`)}" fill="none" stroke="#3a2a5c" stroke-width="4" stroke-linecap="round"/></svg></div>`;
  }
  return `<div class="mascot" aria-hidden="true"><svg viewBox="0 0 120 110" width="104" height="96">${arms}
    <ellipse cx="60" cy="104" rx="26" ry="4" fill="#141414" opacity=".15"/>
    <circle cx="60" cy="58" r="42" fill="#f59a1c" stroke="#141414" stroke-width="4"/>
    <path d="M36 34q10-11 24-12" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".75"/>
    ${eyes}<path d="${mouth}" fill="none" stroke="#141414" stroke-width="4" stroke-linecap="round"/></svg></div>`;
}

// The equipment question (2.8): every kind of gear in the exercise catalog, plus a "Full gym"
// shortcut that picks them all. The picker's "What I have" filter and the starter library use the answer.
const GEAR_OPTIONS = GEAR.map(k => [k, EQUIPMENT.find(e => e[0] === k)?.[1] || EQUIP.find(e => e[0] === k)[1]]);
const withGear = list => list.map(([title, qs]) => [title, qs.map(q => q.id === 'equipment' ? { ...q, options: GEAR_OPTIONS } : q)]);
const fullGym = d => GEAR.every(k => (d.about.equipment || []).includes(k));

// The name box's counter (2.8.1) shows only near the 24-character limit.
const nameCount = name => name.length >= 20 ? `${name.length} / 24` : '';

export const ACCENTS = ['#5ea4ff', '#b18cff', '#ff7ab8', '#4fd1c5', '#f2c14e', '#ff8a3d', '#7ee081'];
// Spoken names for the swatches (2.15), so a screen reader says "Blue", not a color code.
export const ACCENT_NAMES = { '#5ea4ff': 'Blue', '#b18cff': 'Purple', '#ff7ab8': 'Pink', '#4fd1c5': 'Teal', '#f2c14e': 'Gold', '#ff8a3d': 'Orange', '#7ee081': 'Green' };

// ---------- Setup for anyone (2.18, review 11) ----------
// The front door asks what brings you here, in plain goals. "Not sure yet" opens a short chat with the coach.
// Goku then says where it would start you and why, and the rest of setup follows: goals first, look and passcode last.
const GOALS = [['stronger', 'Get stronger or build muscle', 'Guided workouts at home or in a gym'], ['lose', 'Lose weight', 'Food log, weight trend and a gentle plan'],
  ['eat', 'Eat better', 'Track meals and nutrients. No workouts needed.'], ['sport', 'Get better at my sport', 'Log practices, plan your week, fuel for it'],
  ['move', 'Move more and feel better', 'A simple weekly activity goal'], ['notsure', 'Not sure yet', 'Answer a few questions and Goku suggests a start']];
// The coach's questions. Each reply is [label, value]; the coach's next line can answer what was said.
const SAFETY_Q = 'Do either of these apply to you? A doctor has told you that you have a heart problem, diabetes, high blood pressure or another long-term condition. Or you get chest pain or feel dizzy when you\'re active.';
const CHAT = [
  { k: 'goal', say: () => "Hi, I'm your coach. What would you like help with most?",
    replies: [['Getting stronger', 'stronger'], ['Losing some weight', 'lose'], ['Eating better', 'eat'], ['Moving more', 'move'], ['Getting better at a sport', 'sport']] },
  { k: 'experience', when: c => !['eat', 'sport'].includes(c.goal), say: () => 'Got it. How active are you in a normal week?',
    replies: [['Mostly sitting', 'new'], ['On my feet, but no workouts', 'new'], ["I used to train and I'm getting back into it", 'back'], ['I work out now and then', '0'], ['I train most weeks', '1']] },
  { k: 'equipment', when: c => !['eat', 'sport'].includes(c.goal), say: c => (c.experience === 'new' ? 'Thanks for being straight with me. ' : '') + 'Do you have any equipment, or a gym?',
    replies: [['Nothing, just me', 'none'], ['Dumbbells or bands at home', 'home'], ['A gym', 'gym']] },
  { k: 'days', when: c => !['eat', 'sport'].includes(c.goal), say: () => 'How many days a week can you give it?', replies: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']] },
  { k: 'safety', when: c => !['eat', 'sport'].includes(c.goal), say: () => 'One health question before I suggest anything. ' + SAFETY_Q, replies: [['No, neither', 'no'], ['Yes', 'yes']] },
];
const chatNext = c => CHAT.find(q => c[q.k] === undefined && (!q.when || q.when(c))) || null;
const chatAsked = c => CHAT.filter(q => c[q.k] !== undefined);
const GEAR_SETS = { none: [], home: ['db', 'band'], gym: [...GEAR] };
const ABOUT_GOAL = { stronger: 'strength', lose: 'leaner', eat: 'health', move: 'health' };

// Resolves with the new profile, or null if cancelled (only possible when cancellable).
export function onboard({ cancellable = false } = {}) {
  return new Promise(resolve => {
    const was = skinId(); // the open profile's skin, put back if setup is cancelled
    const d = { goal: null, chat: {}, custom: null, kind: null, skin: was, name: '', accent: null, modules: {}, modsTouched: false, safety: null, planPick: null,
      week: Array.from({ length: 7 }, () => ({ gym: 0, vault: 0 })), avatar: null, units: 'imperial', tz: deviceTZ(), about: {}, coach: { asked: {} } };
    let step = 0, steps = [];
    const { el, close } = overlay(`${cancellable ? '<div class="row" style="justify-content:flex-end"><button class="cta2" id="cancel" data-close>Cancel</button></div>' : ''}
      <div class="scroll" id="ob"></div><div id="obnav"></div>`, { label: 'Set up a profile' });
    const $ = s => el.querySelector(s);
    const h = m => round(m / 60, 2);
    const goal = () => d.goal === 'notsure' ? d.chat.goal || null : d.goal; // the goal in effect
    const chatted = () => d.goal === 'notsure';
    const names = () => sessionNames(d.custom && !classicGym() ? d : {});
    // "Get better at my sport" with only Gymnastics and a practice log is the Gymnastics and Vaulting setup, as before.
    const classicGym = () => d.custom && d.custom.style === 'sessions' && d.custom.sports.length === 1 && d.custom.sports[0] === 'gymnastics';
    const label = t => `<div class="lbl">${progress(step, steps.length, t || '')}</div>`;

    // Where Goku would start this person. A choice made on the plan screen wins.
    function planFor() {
      if (d.kind !== 'engine') return null;
      const g = goal(), ex = d.about.experience, hold = d.safety === true;
      let id = g === 'eat' ? 'food' : g === 'move' || g === 'lose' ? 'move' : ex === 'new' ? 'starter' : ex === 'back' ? 'comeback' : 'strength';
      if (d.planPick) id = d.planPick;
      return { id, ...(hold && id !== 'food' ? { hold: true } : {}), ...(id === 'move' ? { minGoal: ex === 'new' || !ex ? MOVE_START : 90, ...(ex && !['new', 'back'].includes(ex) ? { workouts: 'circuit' } : {}) } : {}) };
    }
    // What to turn on for that plan; the person can change any of it on the next-to-last screen.
    function recommended() {
      if (d.kind !== 'engine') return d.custom && !classicGym() ? presetModules(d.kind, d.custom.sports) : {};
      const pl = planFor(), lifts = ['strength', 'comeback'].includes(pl.id) || pl.workouts === 'circuit';
      return { nutrition: true, gut: true, hypertrophy: lifts, shuffle: lifts, soccer: false, fuel: pl.id !== 'food', weight: goal() === 'lose' && !isMinor(d) };
    }

    const mini = () => capsule(2, 9).replace('width="104" height="96"', 'width="44" height="40"').replace('class="mascot"', 'class="chatface"');
    const say = t => `<div class="chatrow">${mini()}<div class="bubble">${esc(t)}</div></div>`;
    const me = t => `<div class="chatrow mine"><div class="bubble">${esc(t)}</div></div>`;
    const qStep = (title, qs) => ({ qs, html: () => `${label('Your coach')}<h1>${esc(title)}</h1>${screenHTML(qs, d).replace(`<h2>${esc(title)}</h2>`, '')}` });

    const build = () => {
      const out = [{ key: 'door', need: 'Pick one to continue.', ready: () => !!d.goal, html: () => `<h1 style="margin-top:0">What brings you here?</h1>
        <p class="sub">Pick the closest. Goku builds the rest around it, and you can change anything later. Everything you log stays on this phone.</p>
        ${GOALS.map(([k, t, sub]) => `<button class="card pick goalpick" data-goal="${k}" aria-pressed="${d.goal === k}"><b>${t}</b><br><span class="sub">${sub}</span></button>`).join('')}
        ${S.profiles.length ? '' : '<p class="doorlinks"><button class="link" id="demo">Just look around first</button><span aria-hidden="true"> · </span><button class="link" id="restore">I have a backup</button></p>'}` }];
      if (chatted()) out.push({ key: 'chat', need: 'Tap an answer to continue.', ready: () => !chatNext(d.chat), html: () => { const c = d.chat, nx = chatNext(c), asked = chatAsked(c);
        return `${asked.map(q => say(q.say(c)) + me(c._l?.[q.k] || '')).join('')}
          ${nx ? `${say(nx.say(c))}<div class="pills chatreplies">${nx.replies.map(([t, v]) => `<button data-reply="${nx.k}" data-v="${v}" data-raw>${esc(t)}</button>`).join('')}</div>
            <p class="note chatcount">Question ${asked.length + 1} of ${asked.length + CHAT.filter(q => c[q.k] === undefined && (!q.when || q.when(c))).length}</p>`
            : say(c.safety === 'yes' ? 'Thanks for telling me. Check with your doctor first, and ask what kinds and amounts of activity are safe for you. I\'ll show you where I\'d start in the meantime.' : 'Thanks. That\'s what I need. A few basics next, then I\'ll show you where I\'d start you.')}
          ${asked.length ? '<p style="text-align:center"><button class="link" id="chatBack">Change my last answer</button></p>' : ''}`; } });
      if (goal() === 'sport') out.push(
        { key: 'sports', need: 'Pick at least one.', ready: () => d.custom.sports.length > 0, html: () => `${label()}<h1>What do you do?</h1><p class="sub" style="text-align:center">Pick everything that's part of your training, or search for it.</p>
          <input id="spq" type="search" autocomplete="off" placeholder="Search sports, e.g. tennis" aria-label="Search sports" style="margin-top:10px">
          <div class="pills sugg" id="spsugg"></div>
          <div class="pills" style="margin-top:12px">${[...SPORTS.map(([k, n]) => [k, n]), ...d.custom.sports.filter(k => !SPORTS.some(x => x[0] === k)).map(k => [k, activityName(k)])]
            .map(([k, n]) => `<button data-sport="${k}" aria-pressed="${d.custom.sports.includes(k)}">${esc(n)}</button>`).join('')}</div>` },
        { key: 'style', need: 'Pick one to continue.', ready: () => !!d.custom.style, html: () => `${label()}<h1>How do you like to train?</h1>
          ${STYLES.map(([k, n, desc]) => `<button class="card pick" data-style="${k}" aria-pressed="${d.custom.style === k}"><h2>${esc(n)}</h2><p class="sub">${esc(desc)}</p></button>`).join('')}` });
      if (!d.kind) return out;
      const scr = Object.fromEntries(withGear(setupScreens(d)));
      // Goals first (2.18): training, then the basics, food and anything to watch. The front door already asked a Strength-side profile its goal.
      const training = (scr['Your training'] || []).filter(q => !(d.kind === 'engine' && q.id === 'goal'));
      if (training.length && goal() !== 'eat' && !(chatted() && d.kind === 'engine')) out.push(qStep('Your training', training));
      for (const t of ['Units and time', 'About you', 'Food']) if (scr[t]) out.push(qStep(t, scr[t]));
      const askSafety = d.kind === 'engine' && goal() !== 'eat' && !chatted();
      if (scr['Anything to watch?']) out.push({ ...qStep('Anything to watch?', scr['Anything to watch?']), key: 'watch', need: 'Answer the health question to continue.', ready: () => !askSafety || d.safety !== null,
        html: () => `${label('Your coach')}<h1>Anything to watch?</h1>${screenHTML(scr['Anything to watch?'], d).replace('<h2>Anything to watch?</h2>', '')}
          ${askSafety ? `<hr class="qsep"><div class="safetyq"><h2>One health question</h2><p class="sub">${esc(SAFETY_Q)}</p>
            <div class="seg" role="group" aria-label="Health question"><button data-safety="no" aria-pressed="${d.safety === false}">No, neither</button><button data-safety="yes" aria-pressed="${d.safety === true}">Yes</button></div>
            ${d.safety === true ? '<p class="sub" style="margin-top:8px">Thanks for telling me. Check with your doctor first, and ask what kinds and amounts of activity are safe for you.</p>' : ''}</div>` : ''}` });
      if (d.kind === 'engine') out.push({ key: 'plan', html: () => { const pl = planFor(), minor = isMinor(d), days = d.about.days || '3';
        const line = (k, t, why, change) => `<li class="planline"><span><span class="plank">${k}</span><br><b>${t}</b><br><span class="sub">${why}</span></span>${change ? `<button class="link" data-change="${change}">Change</button>` : ''}</li>`;
        const why = [goal() === 'lose' ? 'you want to lose some weight' : goal() === 'eat' ? 'you want to eat better' : goal() === 'move' ? 'you want to move more' : 'you want to get stronger',
          d.about.experience === 'new' ? "you're new to this" : d.about.experience === 'back' ? "you're getting back into it" : ''].filter(Boolean).join(' and ');
        const train = pl.hold ? line('WORKOUTS', 'Waiting for your doctor\'s OK', 'Check with your doctor first, and ask what kinds and amounts of activity are safe for you. Tap “My doctor cleared me” on Home when you have it.')
          : (pl.id === 'move' ? line('MOVE', `${pl.minGoal} minutes this week`, minor ? 'Walks and anything you log count. For ages 6 to 17 the CDC advises 60 minutes or more a day, so this is a floor to build from.' : 'Walks and anything you log count. Building toward 150 minutes a week, the amount the CDC advises for adults.', 'plan') : '')
          + (pl.id === 'food' ? '' : pl.id === 'starter' || (pl.id === 'move' && pl.workouts !== 'circuit') ? line('STRENGTH', '2 Starter workouts a week', 'One set of 8 to 12 reps of each move, about 10 minutes, no timer. The CDC advises 2 strength days a week.', pl.id === 'move' ? '' : 'plan')
            : pl.id === 'comeback' ? line('STRENGTH', `${days} timed circuits a week, starting at Easy`, 'After two solid weeks, Goku offers the next level.', 'plan')
            : line('STRENGTH', `${days} timed circuits a week at ${({ 10: 'Easy', 20: 'Medium', 50: 'Hard', 100: 'Max' })[startGravity(d.about)]}`, 'Short circuits with a rest timer and your last workout to race.', pl.id === 'move' ? '' : 'plan'));
        return `${label('Your coach')}<h1>Here's where I'd start you</h1><p class="sub">Because ${esc(why)}.</p>
          <section class="card"><ul class="list">${train}${pl.id === 'food' ? line('PLAN', 'Food Only', 'No training screens. You can add workouts any time in Settings.', 'plan') : ''}
            ${line('FOOD', 'Log what you eat', goal() === 'lose' && !minor ? 'No calorie target to start. Look at a week of your own numbers first; you can set a target any time in Nutrition.' : 'A protein range sized for you shows in Nutrition. If a coach gave you a number, type it in Settings.')}
            ${line('CHECK-IN', '20 seconds a day', 'Energy, sleep, soreness, stress and mood. The pattern finder shows what lines up with good and bad days.')}</ul>
            ${sources([SRC.cdcAdults, SRC.cdcCounts, ...(minor ? [SRC.cdcKids] : []), ...(pl.hold || d.safety !== null || chatted() ? [SRC.nhlbi, SRC.cdcAdding] : [])])}</section>
          <p class="note" style="text-align:center">A starting point, not medical advice.</p>`; } });
      out.push(
        { key: 'look', html: () => `${label()}<h1>Pick a look</h1>
          <p class="sub">It changes the words, colors and pictures. Everything else stays the same. You can switch any time in Settings.</p>
          ${Object.entries(SKINS).map(([id, k]) => `<button class="card pick" data-skin="${id}" aria-pressed="${d.skin === id}">
            <h2>${esc(k.name)}</h2><p class="sub">${esc(k.desc)}</p>
            <span class="skin-dots" aria-hidden="true">${k.dots.map(c => `<i style="background:${c}"></i>`).join('')}</span></button>`).join('')}` },
        { key: 'name', need: 'Enter a name to continue.', ready: () => d.name.trim().length > 0, html: () => `${label()}<h1>What should we call you?</h1>
          <label class="f"><span>First name or nickname</span>
          <input id="nm" autocomplete="off" autocapitalize="words" maxlength="24" value="${esc(d.name)}"></label>
          <p class="note">Only shown inside the app on this phone.<span class="count" id="nmc">${nameCount(d.name)}</span></p>
          <h2 style="margin-top:20px">Pick your color</h2>
          <div class="swatches">${ACCENTS.map(c => `<button style="background:${c}" data-acc="${c}"
            aria-pressed="${c === (d.accent || KINDS[d.kind].accent)}" aria-label="${ACCENT_NAMES[c] || 'Color'}"></button>`).join('')}</div>` },
        { key: 'avatar', html: () => `${label()}<h1>${esc(w('pickAvatar'))}</h1>${avatarPicker({ ...d, name: d.name || '?' })}` },
        { key: 'shows', html: () => { if (!d.modsTouched) d.modules = { ...d.modules, ...recommended() };
          const mods = liveModules(d.kind), rec = recommended(), row = ([k, n, desc]) => `<label class="toggle"><span><b>${n}</b><br><span class="sub">${desc}</span></span>
            <input type="checkbox" data-mod="${k}" ${d.modules[k] !== false ? 'checked' : ''}></label>`;
          const yes = mods.filter(([k]) => rec[k] !== false), no = mods.filter(([k]) => rec[k] === false);
          return `${label()}<h1>What should the app show?</h1><p class="sub">Goku turned on what fits your answers. Change anything here, or later in Settings.</p>
            <div class="card" style="margin-top:12px"><p class="lbl">Recommended for you</p>${yes.map(row).join('')}</div>
            ${no.length ? `<div class="card"><p class="lbl">Also available</p>${no.map(row).join('')}</div>` : ''}
            ${soonModules(d.kind).length ? `<p class="note">Coming soon: ${soonModules(d.kind).map(m => esc(m[1])).join(' · ')}.</p>` : ''}`; } });
      if (d.kind === 'perf') out.push({ key: 'week', html: () => `${label()}<h1>Your usual week</h1>
        <p class="sub">Hours of training on each day. Skip it if you like; you can change it any time from the Week tab.</p>
        <p class="num sub" style="margin-top:8px" id="wtot">${round(d.week.reduce((a, x) => a + x.gym + x.vault, 0) / 60, 1)} h a week</p>
        ${DOW.map((day, i) => `<div class="card" style="margin-top:8px;padding:10px 14px"><p class="lbl">${day}</p>
          <div class="row"><span>${esc(names()[0])}</span>${stepper('gym:' + i, h(d.week[i].gym), names()[0].toLowerCase() + ' on ' + day, ' h')}</div>
          ${names()[1] ? `<div class="row" style="margin-top:6px"><span>${esc(names()[1])}</span>${stepper('vault:' + i, h(d.week[i].vault), names()[1].toLowerCase() + ' on ' + day, ' h')}</div>` : ''}</div>`).join('')}` });
      return out;
    };
    steps = build();
    const cur = () => steps[Math.min(step, steps.length - 1)];
    const lastStep = () => !!d.kind && step === steps.length - 1;

    function draw() {
      const st = cur();
      $('#ob').innerHTML = (['door', 'chat', 'plan'].includes(st.key) ? '' : capsule(step, steps.length)) + st.html();
      $('.q[data-qid="equipment"] .pills')?.insertAdjacentHTML('afterbegin', `<button data-fullgym aria-pressed="${fullGym(d)}">Full gym</button>`);
      el.classList.add('capsule-setup');
      el.style.setProperty('--step', STEP_COLOR);
      $('#obnav').innerHTML = `<p class="msg" id="obm" role="status"></p>
        <button class="cta" id="next">${lastStep() ? (S.profiles.length ? 'Set passcode' : 'Finish') : st.key === 'plan' ? 'Start with this plan' : 'Continue'}</button>
        ${step > 0 ? '<button class="cta2" id="back" data-goback style="width:100%;margin-top:8px">Back</button>' : ''}`;
      $('#next').dataset.ready = st.ready ? st.ready() : true;
      setTheme('capsule', 'auto');
      setAccent(d.accent || (d.kind ? KINDS[d.kind].accent : '#5ea4ff'));
      if (st.key === 'chat') $('#ob').scrollTop = $('#ob').scrollHeight; // the newest question stays in view
    }
    const rebuild = () => { steps = build(); draw(); };

    el.addEventListener('input', e => {
      el.querySelectorAll('.msg').forEach(m => { m.textContent = ''; }); // an old error goes once the answer is being fixed
      if (e.target.id === 'nm') { d.name = e.target.value; $('#next').dataset.ready = d.name.trim().length > 0; $('#nmc').textContent = nameCount(d.name); }
      if (e.target.id === 'spq') { const q = e.target.value.trim(); // every sport Log Activity knows (2.18), not only the twelve buttons
        $('#spsugg').innerHTML = q ? findSports(q, 6).filter(a => !['sport', 'other'].includes(a[0])).map(a => `<button data-sport="${a[0]}" data-add="1">${esc(a[1])}</button>`).join('') : ''; }
    });
    el.addEventListener('change', async e => {
      if (e.target.dataset.mod) { d.modules[e.target.dataset.mod] = e.target.checked; d.modsTouched = true; }
      if (e.target.matches('[data-avatar-photo]')) {
        try { d.avatar = await photoToAvatar(e.target.files[0]); e.target.value = ''; draw(); } catch (err) { $('#obm').textContent = err.message || "That photo couldn't be read."; }
      }
    });
    el.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'cancel') { if (step > 0 && !(await ask('Discard this setup?', 'Your answers so far will be lost.', [{ label: 'Discard', value: true, danger: true }]))) return;
        // setup shows its own colors; the open profile's theme and accent come back too (2.10.2)
        setSkin(was); const p0 = profile(); if (p0) { setTheme(p0.settings?.theme, p0.settings?.mode); setAccent(p0.accent); }
        close(); resolve(null); return; }
      // Restore on a new or wiped phone (2.16): the backup's own profile is added and asked for a passcode, with no throwaway profile.
      if (b.id === 'restore') { const p = await (await import('./settings.js')).restoreFirst(); if (p) { close(); resolve(p); } return; }
      // Just look around first (2.18): a sample profile with made-up data; leaving it erases the sample.
      if (b.id === 'demo') { b.disabled = true; const p = await (await import('./demo.js')).startDemo(); close(); resolve(p); return; }
      const st = cur(), qs = st.qs || null;
      if (b.dataset.fullgym !== undefined) { d.about.equipment = fullGym(d) ? [] : [...GEAR]; draw(); return; }
      if (qs && b.closest('.q')) { if (screenClick(qs, d, b, el)) draw(); return; }
      if (b.dataset.avatar) { pickAvatar(d, b.dataset.avatar); draw(); return; }
      if (b.dataset.skin) { d.skin = b.dataset.skin; setSkin(d.skin); draw(); return; } // the guide changes with it
      if (b.dataset.goal) {
        if (d.goal !== b.dataset.goal) { d.goal = b.dataset.goal; d.chat = {}; d.planPick = null; d.safety = null; d.modsTouched = false; }
        d.accent = null;
        if (d.goal === 'sport') { d.custom ||= { sports: [], style: null }; d.kind = d.custom.style ? (d.custom.style === 'sessions' ? 'perf' : 'engine') : null; }
        else if (d.goal === 'notsure') d.kind = null;
        else { d.custom = null; d.kind = 'engine'; d.about.goal = ABOUT_GOAL[d.goal]; }
        return rebuild();
      }
      if (b.dataset.reply) { const c = d.chat, k = b.dataset.reply, v = b.dataset.v; c[k] = v; (c._l ||= {})[k] = b.textContent;
        if (k === 'goal') { if (v === 'sport') { d.custom ||= { sports: [], style: null }; d.kind = d.custom.style ? (d.custom.style === 'sessions' ? 'perf' : 'engine') : null; } else { d.custom = null; d.kind = 'engine'; d.about.goal = ABOUT_GOAL[v]; } }
        if (k === 'experience') d.about.experience = v;
        if (k === 'equipment') d.about.equipment = [...GEAR_SETS[v]];
        if (k === 'days') d.about.days = v;
        if (k === 'safety') d.safety = v === 'yes';
        return rebuild(); }
      if (b.id === 'chatBack') { const asked = chatAsked(d.chat), last = asked[asked.length - 1]; if (last) { delete d.chat[last.k]; delete d.chat._l?.[last.k]; if (last.k === 'goal') { d.kind = null; d.custom = null; } if (last.k === 'safety') d.safety = null; } return rebuild(); }
      if (b.dataset.safety) { d.safety = b.dataset.safety === 'yes'; if (qs) qs.forEach(q => screenRead([q], d, el)); return rebuild(); }
      if (b.dataset.change === 'plan') { const pick = await ask('Pick a starting point', 'You can switch later in Settings.', [['starter', 'Starter Workouts: 1 set of 8 to 12 reps, no timer'], ['comeback', 'Comeback: timed circuits from Easy'], ['strength', 'Circuits: timed, with a ghost to race'], ['move', 'Move More: weekly minutes plus workouts'], ['food', 'Food Only: no training screens']]
        .map(([value, lbl]) => ({ label: lbl, value }))); if (pick) { d.planPick = pick; d.modsTouched = false; rebuild(); } return; }
      if (b.dataset.sport) { const s = d.custom.sports, k = b.dataset.sport; s.includes(k) && !b.dataset.add ? s.splice(s.indexOf(k), 1) : s.includes(k) || s.push(k); if (d.kind) d.modules = presetModules(d.kind, s); return draw(); }
      if (b.dataset.style) {
        d.custom.style = b.dataset.style; d.kind = d.custom.style === 'sessions' ? 'perf' : 'engine';
        d.modules = presetModules(d.kind, d.custom.sports); return rebuild();
      }
      if (b.dataset.acc) { d.accent = b.dataset.acc; return draw(); }
      if (b.dataset.d && b.closest('[data-step]')) {
        const [k, i] = b.closest('[data-step]').dataset.step.split(':');
        d.week[+i][k] = Math.min(600, Math.max(0, d.week[+i][k] + +b.dataset.d * 15));
        b.closest('[data-step]').querySelector('.num').textContent = h(d.week[+i][k]) + ' h';
        $('#wtot').textContent = round(d.week.reduce((a, x) => a + x.gym + x.vault, 0) / 60, 1) + ' h a week';
        return;
      }
      if (b.id === 'back') { if (qs) qs.forEach(q => screenRead([q], d, el)); step--; steps = build(); draw(); return; }
      if (b.id !== 'next') return;
      if (b.dataset.ready !== 'true') { $('#obm').textContent = st.need || 'Pick one to continue.'; return; }
      if (qs && !screenRead(qs, d, el)) return;
      steps = build(); // answers on this screen can change what follows (age, experience)
      if (!lastStep()) { step++; draw(); $('#ob').scrollTop = 0; return; }
      const pick = d.custom ? (classicGym() ? 'perf' : 'custom') : 'engine';
      const p = newProfile(d.kind, capName(d.name), d.accent);
      if (!d.modsTouched) d.modules = { ...d.modules, ...recommended() };
      for (const [k, v] of Object.entries(d.modules)) p.modules[k] = v;
      Object.assign(p, { avatar: d.avatar, units: d.units, tz: d.tz, about: d.about, coach: d.coach });
      // The skin, and its theme when it has one (Encore → Pastel tour); a color picked in setup stays.
      p.settings.skin = d.skin;
      const theme = SKINS[d.skin].theme;
      if (theme) { p.settings.theme = theme; if (!d.accent) p.accent = THEMES[theme].accent; }
      if (pick === 'custom') p.custom = { sports: [...d.custom.sports], style: d.custom.style };
      if (d.kind === 'engine') {
        const pl = planFor(); p.plan = pl;
        p.settings.gravity = ['starter', 'comeback', 'move'].includes(pl.id) && pl.workouts !== 'circuit' ? 10 : startGravity(d.about);
        p.settings.proteinTarget = null; p.settings.proteinPer = 'day';
      } else p.settings.weekPlan = d.week;
      close();
      await saveProfile(p);
      await showLock(p, { mode: 'create' });
      resolve(p);
    });
    draw();
  });
}
