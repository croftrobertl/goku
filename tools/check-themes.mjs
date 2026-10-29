// Fails if any theme's text colors fall below 4.5:1 on the surfaces they sit on.
import { THEMES } from '../js/themes.js';
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))]; return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
let bad = 0;
for (const [id, t] of Object.entries(THEMES)) for (const mode of ['dark', 'light']) {
  const p = t[mode];
  for (const fg of ['tx', 'tx2', 'tx3', 'ok', 'warn', 'care']) for (const bg of ['bg', 's1', 's2']) {
    const c = contrast(p[fg], p[bg]);
    if (c < 4.5) { bad++; console.log(`${id}.${mode}: ${fg} on ${bg} = ${c.toFixed(2)}`); }
  }
}
if (bad) { console.log(bad + ' contrast failures'); process.exit(1); }
console.log('All theme colors pass 4.5:1.');
