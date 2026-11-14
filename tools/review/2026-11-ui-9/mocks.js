// Mockups for review batch 2026-11-ui-9 (How You Feel Today), drawn inside the running app so they use its real styles.
// Answers shown are made-up examples for the pictures only.
const step = (v, label) => `<div class="step"><button type="button">−</button><span class="num">${v}</span><button type="button">+</button></div>`;
const scale = (label, lo, hi, on) => `<div class="q" style="margin-top:10px"><p class="lbl">${label}</p>
  <div class="seg">${[1, 2, 3, 4, 5].map(v => `<button aria-pressed="${v === on}">${v}</button>`).join('')}</div>
  <div class="row note" style="margin-top:4px;justify-content:space-between"><span>${lo}</span><span>${hi}</span></div></div>`;
const pills = (list, on = []) => `<div class="pills" style="margin-top:6px">${list.map(n => `<button aria-pressed="${on.includes(n)}">${n}</button>`).join('')}</div>`;
const page = inner => `<div class="row"><h1 style="text-align:left">Nutrition</h1><span class="sub">Sat, Nov 7</span></div><div class="scroll">${inner}</div>`;
window.MOCKS = {
  'feel-now': page(`<details class="card fold feel" open><summary class="lbl">How You Feel Today</summary>
    <p class="sub">Optional. It helps the pattern finder spot foods that line up with bad days.</p>
    <p class="lbl" style="margin-top:10px">Bloating (0 = None, 10 = Worst)</p>${step('none')}
    ${pills(['Heartburn', 'Cramps', 'Gas', 'Nausea', 'Low energy'])}
    <button class="link" style="margin-top:8px">Also Track Waist Size</button></details>`),
  'feel-a': page(`<details class="card fold feel" open><summary class="lbl">How You Feel Today</summary>
    <p class="sub">Optional, about 20 seconds. Patterns shows what lines up with good and bad days.</p>
    ${scale('Energy', 'Drained', 'Great', 4)}
    <div class="q" style="margin-top:10px"><p class="lbl">Sleep last night (hours)</p>${step('7.5')}</div>
    ${scale('Muscle soreness', 'None', 'Very sore', 2)}
    ${scale('Stress', 'Calm', 'Very stressed', 2)}
    ${scale('Mood', 'Low', 'Great', 4)}
    <details class="fold" style="margin-top:12px"><summary>Stomach</summary></details></details>`),
  'feel-b': page(`<details class="card fold feel" open><summary class="lbl">How You Feel Today</summary>
    <p class="sub">Optional. Patterns shows foods that line up with bad days.</p>
    <p class="lbl" style="margin-top:10px">Bloating (0 = None, 10 = Worst)</p>${step('3')}
    <p class="lbl" style="margin-top:12px">Anything Else Today?</p>
    ${pills(['Heartburn', 'Cramps', 'Gas', 'Nausea', 'Headache', 'Low energy'], ['Gas'])}
    <p class="lbl" style="margin-top:12px">Bowel Movements</p>
    <div class="seg"><button>None</button><button>Hard</button><button aria-pressed="true">Normal</button><button>Loose</button></div>
    <button class="link" style="margin-top:10px">Also Track Waist Size</button></details>`),
};
