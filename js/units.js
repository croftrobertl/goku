// Units. Everything is stored in pounds, inches and fluid ounces (the export format is
// unchanged); a metric profile sees and types kilograms, centimeters and milliliters.
import { round } from './ui.js';

const KG = 0.45359237, CM = 2.54, ML = 29.5735;
export const metric = p => p?.units === 'metric';

export const weight = (lb, p) => lb == null ? '' : metric(p) ? round(lb * KG, 1) : round(lb, 1);
export const weightUnit = p => metric(p) ? 'kg' : 'lb';
export const toLb = (v, p) => v == null || v === '' || !isFinite(+v) ? null : metric(p) ? +v / KG : +v;

export const length = (inch, p) => inch == null ? null : metric(p) ? round(inch * CM, 1) : round(inch, 2);
export const lengthUnit = p => metric(p) ? 'cm' : 'in';
export const toIn = (v, p) => v == null || v === '' || !isFinite(+v) ? null : metric(p) ? +v / CM : +v;
export const lengthStep = p => metric(p) ? 0.5 / CM : 0.25; // ½ cm or ¼ inch, in inches

export const volume = (oz, p) => metric(p) ? Math.round(oz * ML / 10) * 10 : round(oz, 1);
export const volumeUnit = p => metric(p) ? 'ml' : 'oz';
export const volumeSteps = p => metric(p) ? [[-250, -250 / ML], [250, 250 / ML], [500, 500 / ML]] : [[-8, -8], [8, 8], [16, 16]];

export const kgOf = p => p?.about?.weightLb ? p.about.weightLb * KG : null;
