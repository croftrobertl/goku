// Mockups for review batch 2026-11-ui-5, drawn inside the running app so they use its real styles.
// Load in the app page, then call showMock(id); hideMock() removes it.
const ic = d => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  food: ic('<path d="M12 7c-3-3-8-1-8 4 0 5 4 10 8 10s8-5 8-10c0-5-5-7-8-4z"/><path d="M12 7c0-2 1-4 3-4"/>'),
  water: ic('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
  pill: ic('<rect x="3" y="9" width="18" height="7" rx="3.5"/><path d="M12 9v7"/>'),
  bolt: ic('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  run: ic('<circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 3 2-5M7 12l3-3h4l3 3"/>'),
  moon: ic('<path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  close: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  act: ic('<circle cx="12" cy="5" r="2"/><path d="M12 7v7M8 22l4-8 4 8M6 11h12"/>'),
};
const head = (t, close = 'Close') => `<div class="row"><h1 style="text-align:left">${t}</h1><button class="cta2">${close}</button></div>`;
const fan = (items, close = true) => `<div class="kimenu">${items.map(([label, icon, x, y, main], i) =>
  `<button class="kiitem" style="--x:${x}px;--y:${y}px;${main ? 'min-width:120px;padding:14px 10px;font-size:1rem' : ''}">${icon}<span>${label}</span></button>`).join('')}
  ${close ? `<button class="kiclose">${I.close}</button>` : ''}</div>`;
const flat = `.card,.cta,.cta2,.chip,.seg button,.pills button,.kiitem,.kiclose,nav.tabs .center .ki-btn,.macros>div{box-shadow:none!important}.card{margin:0 0 18px!important}.cta{width:100%!important}
  .overlay{padding-left:16px!important;padding-right:16px!important}`;
const sheetRow = (icon, t, s) => `<button class="card pick" style="display:flex;align-items:center;gap:14px;margin:0 0 10px!important;padding:12px 14px">${icon}<span style="flex:1"><b>${t}</b><br><span class="sub">${s}</span></span><span style="font-size:1.4rem;color:var(--tx2)">›</span></button>`;

window.MOCKS = {
  // Quick Add
  'qa-a': { kind: 'kiov', css: flat, html: fan([['Food &amp; Drink', I.food, -88, -150, true], ['Activity', I.run, 88, -150, true]]) },
  'qa-a2': { kind: 'kiov', css: flat, html: fan([['Train', I.bolt, -132, -60], ['Add Exercise', I.plus, -58, -150], ['Log Activity', I.act, 58, -150], ['Rest Day', I.moon, 132, -60]]) },
  'qa-b': { kind: 'sheet', css: flat, html: `<div style="background:var(--bg);border-top:2.5px solid var(--ink);border-radius:22px 22px 0 0;padding:18px 16px 26px">
      <h2 style="margin:0 0 12px">Quick Add</h2>
      <p class="lbl" style="text-align:left;margin:4px 0 8px">Food &amp; Drink</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${[['Food', I.food], ['Water', I.water], ['Supplements', I.pill]].map(([t, i]) => `<button class="cta2" style="min-height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">${i}<span style="font-size:.85rem">${t}</span></button>`).join('')}</div>
      <p class="lbl" style="text-align:left;margin:16px 0 8px">Activity</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${[['Train', I.bolt], ['Exercise', I.plus], ['Activity', I.act], ['Rest Day', I.moon]].map(([t, i]) => `<button class="cta2" style="min-height:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">${i}<span style="font-size:.8rem">${t}</span></button>`).join('')}</div>
      <button class="cta" style="margin-top:18px">Close</button></div>` },

  // Spacing, focus and Title Case on the Interaction Check
  'focus-a': { kind: 'page', css: flat + `input:focus-visible{outline:none!important;border-color:var(--accent-line)!important;box-shadow:0 0 0 2px var(--accent-line) inset!important}`, html: head('Interaction Check') + `
      <p class="lbl" style="margin-top:10px">Your Medicines</p>
      <input placeholder="Add a medicine, e.g. Synthroid" style="border-color:var(--accent-line);box-shadow:0 0 0 2px var(--accent-line) inset">
      <button class="cta2" style="margin-top:12px;padding:0 22px">Add</button>
      <p class="sub" style="margin-top:8px">Saved on this phone and in your backups.</p>
      <p class="lbl" style="margin-top:22px">Supplements to Check</p>
      <div class="pills" style="justify-content:center"><button>Vitamin D</button><button>Ginseng</button></div>
      <input placeholder="Thinking of starting one? e.g. iron" style="margin-top:12px">
      <p class="sub" style="margin-top:8px">Add a medicine above to check these.</p>
      <p class="note" style="margin-top:14px">Whichever box you're typing in gets the orange edge, inside its border, so it never pokes past the screen or under the button below.</p>` },
  'focus-b': { kind: 'page', css: flat, html: head('Interaction Check') + `
      <p class="lbl" style="margin-top:10px">Your Medicines</p>
      <input placeholder="Add a medicine, e.g. Synthroid">
      <button class="cta2" style="margin-top:12px;padding:0 22px">Add</button>
      <p class="sub" style="margin-top:8px">Saved on this phone and in your backups.</p>
      <p class="lbl" style="margin-top:22px">Supplements to Check</p>
      <div class="pills" style="justify-content:center"><button>Vitamin D</button><button>Ginseng</button></div>
      <input placeholder="Thinking of starting one? e.g. iron" style="margin-top:12px">
      <p class="sub" style="margin-top:8px">Add a medicine above to check these.</p>
      <p class="note" style="margin-top:14px">No colored edge on any box; the blinking cursor shows where you're typing.</p>` },

  // Ki and gravity
  'ki-a': { kind: 'page', css: flat, html: head("Today's Workout") + `
      <section class="card" style="margin-top:14px!important"><p class="lbl" style="text-align:left">Density Circuit · 4 moves</p>
        <p class="big" style="font-size:1.6rem;margin:4px 0">Hard</p><p>4 rounds · 45 s rest · up to 20 min</p>
        <p class="sub">Each set to failure, then a drop. Your first Hard workout sets the time to beat.</p></section>
      <p class="lbl" style="margin-top:14px">Level</p>
      <div class="seg"><button>Easy</button><button>Medium</button><button aria-pressed="true" style="background:var(--accent);color:var(--on-accent)">Hard</button><button>Max</button></div>
      <p class="sub" style="text-align:center;margin-top:8px">Easy 3 rounds · Medium 4 · Hard 4 with less rest · Max 5</p>
      <button class="cta" style="margin-top:22px">Start Workout</button>` },
  'ki-b': { kind: 'page', css: flat, html: head('How Do You Feel Today?') + `
      <div class="pills" style="margin-top:8px;justify-content:center"><button>Wiped out</button><button>A bit tired</button><button aria-pressed="true" style="background:var(--accent);color:var(--on-accent)">Ready</button><button>Strong</button></div>
      <section class="card" style="margin-top:14px!important"><p class="lbl" style="text-align:left">Suggested</p>
        <p class="big" style="font-size:1.6rem;margin:4px 0">Hard</p><p>4 rounds · 45 s rest · up to 20 min</p></section>
      <p class="lbl" style="margin-top:14px">Or Pick a Level</p>
      <div class="seg"><button>Easy</button><button>Medium</button><button aria-pressed="true" style="background:var(--accent);color:var(--on-accent)">Hard</button><button>Max</button></div>
      <button class="cta" style="margin-top:22px">Start Workout</button>` },

  // Tap signals (Stats cards from your screenshot)
  'tap-a': { kind: 'page', css: flat, html: `<div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px">
        <section class="card" style="margin:0!important"><p class="lbl">Last Session</p><p class="big" style="font-size:1.6rem">—</p><p class="sub">No sessions yet</p></section>
        <section class="card" style="margin:0!important"><p class="lbl">Food Today</p><p class="big" style="font-size:1.6rem">20 cal</p><p class="sub">1 g protein</p></section></div>
      <button class="card pick" style="display:flex;align-items:center;justify-content:space-between;margin-top:14px!important"><b style="font-size:1.1rem">Fuel Timing</b><span style="font-size:1.1rem;color:var(--accent-text);font-weight:800">Show ▾</span></button>
      <button class="card pick" style="display:flex;align-items:center;justify-content:space-between"><b style="font-size:1.1rem">Hard Sets This Week</b><span style="font-size:1.5rem;color:var(--accent-text);font-weight:800">›</span></button>
      <p class="note" style="margin-top:6px">Anything you can tap ends in an orange › (opens) or Show ▾ (unfolds). Cards without one only show information.</p>` },
  'tap-b': { kind: 'page', css: flat, html: `<div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px">
        <section class="card" style="margin:0!important;border-style:solid"><p class="lbl">Last Session</p><p class="big" style="font-size:1.6rem">—</p><p class="sub">No sessions yet</p></section>
        <section class="card" style="margin:0!important"><p class="lbl">Food Today</p><p class="big" style="font-size:1.6rem">20 cal</p><p class="sub">1 g protein</p></section></div>
      <button class="card pick" style="display:flex;align-items:center;justify-content:center;margin-top:14px!important;border-color:var(--accent-line);border-width:3px;background:color-mix(in srgb,var(--accent) 12%,var(--s1))"><b style="font-size:1.1rem">Fuel Timing</b></button>
      <button class="card pick" style="display:flex;align-items:center;justify-content:center;border-color:var(--accent-line);border-width:3px;background:color-mix(in srgb,var(--accent) 12%,var(--s1))"><b style="font-size:1.1rem">Hard Sets This Week</b></button>
      <p class="note" style="margin-top:6px">Anything you can tap has an orange border and a light orange fill. Black-bordered cards only show information.</p>` },

  // Nutrition top, nutrients always showing
  'nut-a': { kind: 'page', css: flat, html: `<h1 style="text-align:left;margin-top:8px">Nutrition</h1><section class="card sum" style="text-align:center">
      <p class="big num" style="font-size:3rem;margin:0">20</p><p style="margin:0 0 12px">calories today</p>
      <div style="display:flex;justify-content:space-between;font-weight:800"><span>Protein</span><span>1 g / 135 g</span></div>
      <div class="bar" style="height:14px;border:2px solid var(--ink);border-radius:9px;margin:6px 0 4px;background:#fff"><i style="display:block;width:1%;height:100%;background:var(--ink)"></i></div>
      <p style="text-align:left;margin:0 0 12px">134 g to go</p>
      <div class="macros" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"><div style="background:#c9b8ff">1 g<br><small>Protein</small></div><div style="background:#9fe3c4">1 g<br><small>Carbs</small></div><div style="background:#ffb59a">1 g<br><small>Fat</small></div><div style="background:#fff">1 g<br><small>Fiber</small></div></div>
      <p style="margin:12px 0 0;text-decoration:underline;font-weight:700">All Nutrients ›</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px"><button class="cta2">+ Food</button><button class="cta2">+ Water</button><button class="cta2">Scan</button></div></section>
      <p class="note">Protein and the four tiles always show. The percentages, your protein range and every other nutrient are one tap away in All Nutrients.</p>` },
};

// The "mannequin" drawing style: each body part drawn as a filled, outlined shape in the muscle map's
// colors, with the worked part in red. Works on Goku's own figure SVG.
window.mannequin = (svg, { red = true } = {}) => {
  const d = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const body = [...d.querySelectorAll('.limb,.torso,.headc')];
  body.forEach(el => {
    const ol = el.cloneNode(true); ol.setAttribute('class', 'mq-ol'); el.before(ol);
    const isArm = el.classList.contains('arm'), far = el.classList.contains('far');
    const base = el.classList.contains('torso') ? 'mq-torso' : el.classList.contains('headc') ? 'mq-head' : 'mq-limb';
    el.setAttribute('class', `${base}${isArm && red ? ' mq-red' : ''}${far ? ' mq-far' : ''}`);
    if (el.classList.contains('mq-head')) ol.setAttribute('class', 'mq-headol');
  });
  const st = document.createElementNS(NS, 'style');
  st.textContent = `.mq-ol{fill:none;stroke:#5d544b;stroke-linecap:round;stroke-linejoin:round;stroke-width:10.5}
    .mq-ol.torso{stroke-width:14}
    .mq-limb,.mq-torso{fill:none;stroke:#ddd6cc;stroke-linecap:round;stroke-linejoin:round;stroke-width:8}
    .mq-torso{stroke-width:11.5}
    .mq-red{stroke:#cf4a35} .mq-far{stroke:#c9c1b6} .mq-red.mq-far{stroke:#e8907f}
    .mq-head{fill:#ddd6cc;stroke:none} .mq-headol{fill:#ddd6cc;stroke:#5d544b;stroke-width:2.2}`;
  d.prepend(st);
  // Outline widths follow the part: torso copies get the wider outline.
  d.querySelectorAll('.mq-ol').forEach(o => { if (o.nextElementSibling?.classList.contains('mq-torso')) o.classList.add('torso'); });
  return d.outerHTML;
};

window.showMock = id => {
  hideMock();
  const m = MOCKS[id];
  const st = document.createElement('style'); st.id = 'mockcss'; st.textContent = m.css || ''; document.head.append(st);
  const o = document.createElement('div'); o.id = 'mockov';
  if (m.kind === 'kiov') { o.className = 'overlay kiov'; o.innerHTML = `<div class="inner">${m.html}</div>`; }
  else if (m.kind === 'sheet') { o.className = 'overlay kiov'; o.style.padding = '0'; o.innerHTML = `<div class="inner" style="justify-content:flex-end">${m.html}</div>`; }
  else { o.className = 'overlay'; o.innerHTML = `<div class="inner">${m.html}</div>`; }
  document.body.append(o);
};
window.hideMock = () => { document.getElementById('mockov')?.remove(); document.getElementById('mockcss')?.remove(); };
