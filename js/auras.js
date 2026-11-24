import { art, skin, skinId } from './skins.js';
// Super Saiyan aura forms (2.20, review 19): the streak powers up the avatar's aura, drawn as flames
// behind it. Dragon Ball skin; the Eras Tour look (2.28) has stage-glow rings; Plain keeps the gold and blue rings.
// [streak days, name, inner, middle, edge, flame height, lightning color, Ultra Instinct wisps]
export const FORMS = [
  [7, 'Super Saiyan', '#fff3a0', '#ffd21f', '#f0a800', 16],
  [14, 'Super Saiyan 2', '#fff3a0', '#ffd21f', '#f0a800', 18, '#7fe8ff'],
  [21, 'Super Saiyan 3', '#fff3a0', '#ffc81f', '#e89a00', 26, '#7fe8ff'],
  [30, 'Super Saiyan God', '#ffd0c8', '#ff5a4a', '#c9201a', 17],
  [60, 'Super Saiyan Blue', '#e4fbff', '#4fd8ff', '#1f8fe0', 18],
  [100, 'Ultra Instinct', '#ffffff', '#cfd8ea', '#8fa0c6', 20, null, true],
];
export const formFor = days => FORMS.filter(f => days >= f[0]).pop() || null;
// A look can name the six levels its own way (2.28: the Eras look's stage glows).
export const formName = f => skin().forms?.[FORMS.indexOf(f)] || f[1];

// Rob's aura renders (2.21): one ring per form. RING gives each ring's empty middle (center and radius, as
// fractions of the picture), measured by tools/review/renders/cut3.py, so the avatar sits right in the hole.
const RING = {"ss1": [0.5125, 0.632, 0.217], "ss2": [0.4994, 0.6279, 0.2066], "ss3": [0.4947, 0.6842, 0.1772], "god": [0.4946, 0.6347, 0.2133], "blue": [0.5107, 0.6393, 0.206], "ui": [0.5015, 0.619, 0.2116]};
const FILE = ['ss1', 'ss2', 'ss3', 'god', 'blue', 'ui'];
// The Eras look's stage-glow rings (2.28), measured the same way (scratchpad ringmeasure.js).
const RING_ERAS = {"ss1": [0.5059, 0.5134, 0.3063], "ss2": [0.501, 0.5114, 0.3032], "ss3": [0.4985, 0.5081, 0.3055], "god": [0.5216, 0.4937, 0.2905], "blue": [0.501, 0.504, 0.3086], "ui": [0.4977, 0.5119, 0.301]};
export function auraSVG(form, px) {
  const eras = skinId() === 'encore', name = FILE[FORMS.indexOf(form)], [cx, cy, r] = (eras ? RING_ERAS : RING)[name];
  const size = Math.round(px * .44 / r), left = Math.round(px / 2 - cx * size), top = Math.round(px / 2 - cy * size);
  return `<img class="saura" src="${art(`aura/${name}.png`)}" alt="" aria-hidden="true" width="${size}" height="${size}" style="left:${left}px;top:${top}px">`;
}
