// Mockups for review batch 2026-11-ui-3, drawn inside the running app so they use its real styles.
// Each entry is the inner HTML of a sheet. Numbers are made-up examples for the pictures only.
const head = (t, close = 'Close') => `<div class="row"><h1 style="text-align:left">${t}</h1><button class="cta2">${close}</button></div>`;
const chart = (pts, label) => { const w = 300, h = 120, xs = pts.map((_, i) => 12 + i * (w - 24) / (pts.length - 1)), lo = Math.min(...pts) - 4, hi = Math.max(...pts) + 4;
  const y = v => h - 12 - (v - lo) / (hi - lo) * (h - 28);
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" role="img" aria-label="${label}">
    <line x1="12" y1="${h - 12}" x2="${w - 12}" y2="${h - 12}" stroke="var(--line)" stroke-width="1"/>
    <polyline fill="none" stroke="var(--accent-line)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${pts.map((v, i) => xs[i] + ',' + y(v)).join(' ')}"/>
    ${pts.map((v, i) => `<circle cx="${xs[i]}" cy="${y(v)}" r="4" fill="var(--accent-line)"/>`).join('')}
    <text x="${w - 12}" y="${y(pts.at(-1)) - 10}" text-anchor="end" font-size="12" fill="var(--tx2)">${pts.at(-1)} lb</text></svg>`; };
const rows = list => `<ul class="list">${list.map(([a, b, c]) => `<li><span>${a}<br><span class="chain">${b}</span></span><b class="num">${c}</b></li>`).join('')}</ul>`;
const HIST = [['Mon, Nov 2', '25 lb × 10', 'est. 33 lb'], ['Thu, Oct 29', '25 lb × 8', 'est. 32 lb'], ['Mon, Oct 26', '20 lb × 12', 'est. 28 lb'], ['Thu, Oct 22', '20 lb × 10', 'est. 27 lb']];
const seg = (vals, on) => `<div class="seg">${vals.map(v => `<button aria-pressed="${v === on}">${v}</button>`).join('')}</div>`;

window.MOCKS = {
  'rm-a': head('Goblet squat') + `<div class="scroll"><section class="card"><p class="lbl">Your history</p>
      ${chart([27, 28, 32, 33], 'Estimated best lift, rising from 27 to 33 lb')}
      <p class="sub" style="text-align:center">Estimated one-rep best, from your heaviest set each session</p></section>
      <section class="card">${rows(HIST.slice(0, 3))}<p class="note">Estimate: weight × (1 + reps ÷ 30), the Epley formula. It's an estimate; Goku never asks you to test a one-rep max.</p></section></div>`,
  'rm-b': head('Goblet squat') + `<div class="scroll"><section class="card"><p class="lbl">Your history</p>${rows(HIST)}
      <p class="note">Estimate: weight × (1 + reps ÷ 30), the Epley formula. It's an estimate; Goku never asks you to test a one-rep max.</p></section></div>`,
  'week-a': head('Week', 'Done') + `<section class="card"><div class="row"><h2 style="margin:0">Tue</h2><span class="sub">2½ h</span></div>
      <p class="lbl" style="margin-top:10px">Gymnastics</p>${seg(['0', '1', '1½', '2', '2½', '3', '4'], '2½')}
      <div class="row" style="margin-top:10px"><span class="sub">Fine-tune</span><div class="step"><button>−</button><span class="num">2.5 h</span><button>+</button></div></div>
      <p class="note">Tap the hours, or use − and + for 15-minute steps.</p></section>`,
  'week-b': head('Week', 'Done') + `<section class="card"><div class="row"><h2 style="margin:0">Tue</h2><span class="sub">2½ h</span></div>
      <label class="f" style="margin-top:10px"><span>Gymnastics, hours</span><input value="2.5" inputmode="decimal"></label>
      <button class="cta2" style="width:100%;margin-top:8px">Same hours on Mon to Fri</button>
      <p class="note">Type the hours, e.g. 2.5 for two and a half.</p></section>`,
  'pace-a': head('Log activity') + `<div class="pills"><button>Soccer</button><button aria-pressed="true">Running</button><button>Cycling</button><button>Swimming</button></div>
      <p class="lbl" style="margin-top:12px">Minutes</p><input value="32" inputmode="numeric">
      <p class="lbl" style="margin-top:12px">Distance (optional)</p><input value="3.3" inputmode="decimal">
      <p class="say" style="margin-top:8px;text-align:center"><b class="num">9:42 per mile</b> <span class="sub">· from 32 min and 3.3 mi</span></p>`,
  'pace-b': head('History', 'Back') + `<section class="card"><p class="lbl">Other training</p>${rows([['Running · 32 min · 3.3 mi', 'Mon, Nov 2 · effort 6', '9:42 /mi'], ['Cycling · 45 min · 12 mi', 'Sat, Oct 31 · effort 5', '16 mph'], ['Swimming · 30 min · 1,650 yd', 'Thu, Oct 29 · effort 6', '1:49 /100 yd']])}
      <p class="note">Pace shows on your history after you save.</p></section>`,
  'repeat-a': head('Add food') + `<div class="seg meals"><button aria-pressed="true">Breakfast</button><button>Lunch</button><button>Dinner</button><button>Snacks</button></div>
      <input placeholder="Search foods, e.g. banana" style="margin-top:10px">
      <ul class="list" style="margin-top:8px"><li><button class="itemrow"><span><b>Same breakfast as yesterday</b><br><span class="chain">Oatmeal, cooked · Banana · Milk, 2%</span></span><span class="num">512</span></button></li></ul>
      <p class="lbl" style="margin-top:10px">Recent</p>${rows([['Greek yogurt, plain', '1 6 oz container', '100'], ['Bagel, plain', '1 regular', '277']])}`,
  'repeat-b': `<div class="row"><h1 style="margin:0">Nutrition</h1><span class="sub">Mon, Nov 2</span></div>
      <section class="card sum" style="margin-top:12px"><p class="big num" style="text-align:center">0 <span class="sub">calories today</span></p>
      <button class="cta2" style="width:100%;margin-top:8px">Copy all of yesterday · 4 meals, 1,840 cal</button></section>
      <p class="sub" style="text-align:center">Nothing logged yet. Tap + Food to start the day.</p>`,
  'again-a': `<section class="card chamber"><p class="lbl">Gravity chamber · today</p><h2>Density circuit</h2>
      <p class="sub">×50 gravity · 4 moves · 4 rounds · 45s rest</p>
      <button class="cta" style="margin-top:12px">Enter the chamber</button>
      <button class="cta2" style="width:100%;margin-top:8px">Same as last time · Perfect Pushup, Goblet squat, Plank, Row</button></section>`,
  'rest-a': head('Edit exercise') + `<div class="scroll"><label class="f"><span>Name</span><input value="Goblet squat"></label>
      <p class="lbl" style="margin-top:12px">Rest after this exercise</p>${seg(['Circuit (45 s)', '60 s', '90 s', '2 min'], '90 s')}
      <p class="note">A heavy lift can rest longer; the rest of the circuit keeps its own rest.</p></div>`,
  'rest-b': head('Edit exercise') + `<div class="scroll"><label class="f"><span>Name</span><input value="Goblet squat"></label>
      <p class="lbl" style="margin-top:12px">Rest after this exercise</p>${seg(['Circuit (45 s)', '60 s', '90 s', '2 min'], '90 s')}
      <label class="toggle" style="margin-top:10px"><span>Pair with the next exercise<br><span class="sub">A superset: no rest between the two, then the rest above</span></span><input type="checkbox" checked></label></div>`,
};
