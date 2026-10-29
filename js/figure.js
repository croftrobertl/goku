// Original exercise drawings: a side-view figure built from joint angles, plus simple
// equipment shapes. Angles are degrees on screen (0 = right, 90 = down, -90 = up). The
// figure faces right; lying and plank poses have the head on the right. Each drawing is
// grounded and centered automatically.

const L = { torso: 28, neck: 4, head: 6, thigh: 21, shin: 21, upper: 14, fore: 13, foot: 6 };
const rad = a => a * Math.PI / 180;
const step = ([x, y], a, len) => [x + Math.cos(rad(a)) * len, y + Math.sin(rad(a)) * len];

// Body poses: t = torso angle (hip → shoulder); a / b = near and far leg [thigh, shin].
// Flags: toes (up on the balls of the feet), air (off the ground), bow (spine curve, +/-).
export const BODY = {
  stand: { t: -90, a: [90, 90], b: [90, 90] },
  standLean: { t: -72, a: [100, 100], b: [100, 100] },
  toes: { t: -90, a: [90, 90], b: [90, 90], toes: true },
  quarter: { t: -75, a: [65, 115], b: [65, 115] },
  squat: { t: -58, a: [8, 108], b: [12, 108] },
  sumo: { t: -80, a: [30, 100], b: [40, 100] },
  chairSquat: { t: -62, a: [0, 95], b: [0, 95], bench: 'seat' },
  hinge: { t: -18, a: [82, 96], b: [82, 96] },
  hingeBent: { t: -28, a: [70, 105], b: [70, 105] },
  hingeOne: { t: -5, a: [88, 92], b: [178, 178] },
  lunge: { t: -88, a: [15, 95], b: [115, 159] },
  lungeSide: { t: -70, a: [30, 110], b: [120, 120] },
  split: { t: -90, a: [70, 105], b: [112, 100] },
  stepStart: { t: -86, a: [20, 95], b: [90, 90], box: 'a' },
  stepTop: { t: -88, a: [90, 90], b: [100, 130], box: 'a' },
  bulgarian: { t: -82, a: [15, 95], b: [120, 200], box: 'b' },
  kneelTall: { t: -90, a: [90, 180], b: [90, 180] },
  kneelHalf: { t: -90, a: [5, 95], b: [90, 180] },
  kneelHip: { t: -80, a: [0, 95], b: [110, 180] },
  nordic: { t: -55, a: [55, 180], b: [55, 180] },
  sit: { t: -90, a: [0, 90], b: [0, 90] },
  sitBack: { t: -115, a: [-25, 40], b: [-25, 40] },
  sitLong: { t: -95, a: [0, 0], b: [0, 0] },
  sitReach: { t: -40, a: [0, 0], b: [0, 0] },
  butterfly: { t: -90, a: [25, 170], b: [-25, 190] },
  vsit: { t: -125, a: [-55, -55], b: [-55, -55] },
  lsit: { t: -90, a: [0, 0], b: [0, 0] },
  wallSit: { t: -90, a: [0, 90], b: [0, 90] },
  plankHigh: { t: -23, a: [157, 157], b: [157, 157] },
  plankLow: { t: -12, a: [168, 168], b: [168, 168] },
  pushBottom: { t: -6, a: [174, 174], b: [174, 174] },
  plankKnee: { t: -33, a: [147, -150], b: [147, -150] },
  plankIncline: { t: -45, a: [135, 135], b: [135, 135] },
  plankDecline: { t: 6, a: [174, 174], b: [174, 174], bench: 'feet' },
  climber: { t: -23, a: [60, 160], b: [157, 157] },
  pike: { t: 55, a: [112, 112], b: [112, 112] },
  bear: { t: -8, a: [100, 175], b: [100, 175] },
  supine: { t: 0, a: [180, 180], b: [180, 180] },
  supineKnees: { t: 0, a: [-135, 115], b: [-135, 115] },
  crunch: { t: -30, a: [-135, 115], b: [-135, 115] },
  supineLegsUp: { t: 0, a: [-90, -90], b: [-90, -90] },
  supineLegsLow: { t: 0, a: [190, 190], b: [190, 190] },
  supineTable: { t: 0, a: [-90, 180], b: [-90, 180] },
  deadBugReach: { t: 0, a: [-90, 180], b: [185, 185] },
  hollow: { t: -15, a: [195, 195], b: [195, 195] },
  revCrunch: { t: 0, a: [-60, -150], b: [-60, -150] },
  bicycle: { t: -28, a: [-60, 170], b: [190, 190] },
  bridge: { t: 25, a: [-160, 100], b: [-160, 100] },
  bridgeOne: { t: 25, a: [-160, 100], b: [-170, -170] },
  thrustLow: { t: 5, a: [-100, 90], b: [-100, 90], bench: 'shoulder' },
  thrustTop: { t: 0, a: [180, 90], b: [180, 90], bench: 'shoulder' },
  benchLie: { t: 0, a: [180, 90], b: [180, 90], bench: 'torso' },
  prone: { t: 0, a: [180, 180], b: [180, 180] },
  superman: { t: -12, a: [192, 192], b: [192, 192] },
  allFours: { t: -12, a: [90, 180], b: [90, 180] },
  birdDog: { t: -12, a: [90, 180], b: [180, 180] },
  catBack: { t: -12, a: [90, 180], b: [90, 180], bow: -1 },
  cowBack: { t: -12, a: [90, 180], b: [90, 180], bow: 1 },
  child: { t: 15, a: [-130, 180], b: [-130, 180] },
  cobra: { t: -35, a: [180, 180], b: [180, 180] },
  sidePlank: { t: -12, a: [168, 168], b: [168, 168] },
  copenhagen: { t: -12, a: [168, 168], b: [168, 168], bench: 'feet' },
  hang: { t: -90, a: [92, 92], b: [92, 92] },
  hangKnees: { t: -90, a: [-5, 90], b: [-5, 90] },
  hangLegs: { t: -90, a: [0, 0], b: [0, 0] },
  invRow: { t: -25, a: [155, 155], b: [155, 155] },
  invRowTop: { t: -18, a: [162, 162], b: [162, 162] },
  dipTop: { t: -90, a: [-5, 40], b: [-5, 40], bench: 'hands' },
  dipLow: { t: -92, a: [-25, 50], b: [-25, 50], bench: 'hands' },
  jumpAir: { t: -85, a: [95, 92], b: [92, 95], air: 12 },
  tuckAir: { t: -80, a: [-25, 100], b: [-20, 100], air: 14 },
  starAir: { t: -90, a: [75, 75], b: [105, 105], air: 8 },
  standWide: { t: -90, a: [75, 90], b: [105, 90] },
  landSquat: { t: -60, a: [20, 105], b: [25, 105] },
  skater: { t: -70, a: [40, 100], b: [150, 150] },
  runHigh: { t: -84, a: [-5, 90], b: [95, 100] },
  runKick: { t: -84, a: [95, 90], b: [110, -60] },
  quadStretch: { t: -90, a: [90, 90], b: [95, -85] },
  calfWall: { t: -70, a: [70, 100], b: [130, 120] },
  pigeon: { t: -70, a: [20, 165], b: [170, 180] },
  hipFlexor: { t: -95, a: [10, 92], b: [115, 180] },
  hamStretch: { t: -50, a: [0, 0], b: [-5, 120] },
  figure4: { t: 0, a: [-130, 110], b: [-120, -20] },
  downDog: { t: 50, a: [115, 115], b: [115, 115] },
  openBook: { t: 0, a: [-130, 160], b: [-130, 160] },
  lateralWalk: { t: -80, a: [75, 100], b: [105, 100] },
  clamshell: { t: 0, a: [-140, 150], b: [-140, 150] },
  clamOpen: { t: 0, a: [-150, 150], b: [-120, 175] },
  tibRaise: { t: -80, a: [80, 85], b: [80, 85] },
  balance: { t: -90, a: [90, 90], b: [20, 100] },
  carry: { t: -90, a: [80, 100], b: [100, 80] },
  handstand: { t: 90, a: [-92, -92], b: [-92, -92] },
  wheel: { t: 50, a: [115, 100], b: [115, 100] },
  tuckHold: { t: -90, a: [-20, 100], b: [-20, 100] },
  slamTop: { t: -92, a: [90, 90], b: [90, 90], toes: true },
  burpeeSquat: { t: -40, a: [-10, 120], b: [-10, 120] },
};

// Arm poses: near and far arm [upper arm, forearm].
export const ARMS = {
  down: { a: [90, 90], b: [90, 90] },
  side: { a: [96, 96], b: [84, 84] },
  front: { a: [0, 0], b: [0, 0] },
  frontDown: { a: [30, 30], b: [30, 30] },
  overhead: { a: [-90, -90], b: [-94, -94] },
  vUp: { a: [-65, -65], b: [-115, -115] },
  curlTop: { a: [92, -75], b: [92, -75] },
  rack: { a: [100, -80], b: [100, -80] },
  goblet: { a: [115, -45], b: [115, -45] },
  pressTop: { a: [-88, -88], b: [-92, -92] },
  chest: { a: [130, -10], b: [130, -10] },
  benchDown: { a: [100, -90], b: [100, -90] },
  benchUp: { a: [-90, -90], b: [-90, -90] },
  flyOpen: { a: [80, -60], b: [80, -60] },
  hangDown: { a: [90, 90], b: [90, 90] },
  rowTop: { a: [-150, 90], b: [-150, 90] },
  pullApart: { a: [-180, -180], b: [0, 0] },
  facePull: { a: [-20, -150], b: [-20, -150] },
  forearm: { a: [90, 0], b: [90, 0] },
  pushBottom: { a: [-150, 75], b: [-150, 75] },
  tricepTop: { a: [-80, -95], b: [-80, -95] },
  tricepLow: { a: [-80, 110], b: [-80, 110] },
  raiseSide: { a: [0, 0], b: [180, 180] },
  raiseFront: { a: [-5, -5], b: [5, 5] },
  reverseFly: { a: [170, 170], b: [10, 10] },
  ytw: { a: [-20, -20], b: [-30, -30] },
  hips: { a: [115, 30], b: [115, 30] },
  crossChest: { a: [120, -40], b: [120, -40] },
  pullTop: { a: [-10, -150], b: [-10, -150] },
  hangBar: { a: [-90, -90], b: [-92, -92] },
  scapTop: { a: [-88, -88], b: [-90, -90] },
  invHang: { a: [-90, -90], b: [-90, -90] },
  invTop: { a: [-150, -60], b: [-150, -60] },
  trxRow: { a: [-35, -35], b: [-35, -35] },
  trxRowTop: { a: [130, -60], b: [130, -60] },
  trxPressLow: { a: [150, -30], b: [150, -30] },
  forward: { a: [-10, -10], b: [-10, -10] },
  toFeet: { a: [180, 180], b: [180, 180] },
  reachKnees: { a: [-160, -160], b: [-160, -160] },
  overheadLie: { a: [0, 0], b: [0, 0] },
  ceiling: { a: [-90, -90], b: [-88, -88] },
  deadBugArm: { a: [0, 0], b: [-90, -90] },
  birdArm: { a: [-4, -4], b: [90, 90] },
  sidePlankArm: { a: [90, 0], b: [-90, -90] },
  behindHead: { a: [-140, 60], b: [-140, 60] },
  dip: { a: [125, 125], b: [125, 125] },
  dipLow: { a: [165, 95], b: [165, 95] },
  runArms: { a: [60, -60], b: [125, 60] },
  swingBack: { a: [115, 115], b: [115, 115] },
  swingTop: { a: [-5, -5], b: [5, 5] },
  slamUp: { a: [-80, -80], b: [-85, -85] },
  slamDown: { a: [60, 60], b: [60, 60] },
  jack: { a: [-60, -60], b: [-120, -120] },
  pallof: { a: [100, -10], b: [100, -10] },
  pallofOut: { a: [0, 0], b: [0, 0] },
  twistA: { a: [40, 60], b: [50, 70] },
  twistB: { a: [110, 120], b: [100, 110] },
  floor: { a: [90, 90], b: [90, 90] },
  floorFront: { a: [75, 75], b: [75, 75] },
  quadHold: { a: [100, 120], b: [100, 120] },
  wallPush: { a: [-10, -10], b: [-10, -10] },
  wallBent: { a: [60, -80], b: [60, -80] },
  armCircle: { a: [-45, -45], b: [-135, -135] },
  carry: { a: [90, 90], b: [90, 90] },
  doorway: { a: [180, -90], b: [180, -90] },
  reachHigh: { a: [-75, -75], b: [-80, -80] },
  handsHips: { a: [115, 30], b: [115, 30] },
  clasp: { a: [80, -40], b: [80, -40] },
  wheelArms: { a: [70, 70], b: [70, 70] },
  hsArms: { a: [90, 90], b: [90, 90] },
  lsitArms: { a: [90, 90], b: [90, 90] },
};

function solve(body, arms) {
  const hip = [0, 0];
  const shoulder = step(hip, body.t, L.torso);
  const mid = step(hip, body.t, L.torso / 2);
  const bow = body.bow || 0;
  const bend = [mid[0] + Math.cos(rad(body.t - 90)) * bow * 12, mid[1] + Math.sin(rad(body.t - 90)) * bow * 12];
  const neck = step(shoulder, body.t, L.neck);
  const head = step(neck, body.t, L.head);
  const leg = ([th, sh]) => {
    const k = step(hip, th, L.thigh), an = step(k, sh, L.shin);
    const foot = body.toes ? step(an, sh, L.foot * .7) : step(an, Math.abs(((sh % 360) + 360) % 360 - 90) < 45 ? 0 : sh - 90, L.foot);
    return [k, an, foot];
  };
  const arm = ([up, fo]) => { const e = step(shoulder, up, L.upper); return [e, step(e, fo, L.fore)]; };
  return { hip, shoulder, bend, head, legA: leg(body.a), legB: leg(body.b), armA: arm(arms.a), armB: arm(arms.b) };
}

const fix = n => n.toFixed(1);
const line = (a, b, cls) => `<line x1="${fix(a[0])}" y1="${fix(a[1])}" x2="${fix(b[0])}" y2="${fix(b[1])}" class="${cls}"/>`;
const poly = (list, cls) => `<polyline points="${list.map(p => fix(p[0]) + ',' + fix(p[1])).join(' ')}" class="${cls}"/>`;
const rect = (x, y, w, h, cls = 'prop') => `<rect x="${fix(x)}" y="${fix(y)}" width="${fix(Math.max(w, 1))}" height="${fix(Math.max(h, 1))}" rx="1.5" class="${cls}"/>`;

// One drawing. pose = [bodyKey, armsKey, props]. Props: db, kb, bb, band, bandAnchor, bar,
// trx, wall, ball, mat, bench (under the torso, shoulders, feet or hands, set by the body).
export function figureSVG([bodyKey, armsKey, props = []], { w = 120, h = 112 } = {}) {
  const body = BODY[bodyKey] || BODY.stand;
  const f = solve(body, ARMS[armsKey] || ARMS.down);
  const has = p => props.includes(p);
  const BOX = 14, BENCH = 16;
  const head = [[f.head[0], f.head[1] + L.head], [f.head[0], f.head[1] - L.head], [f.head[0] - L.head, f.head[1]], [f.head[0] + L.head, f.head[1]]];
  const onBox = body.box === 'a' ? f.legA : body.box === 'b' ? f.legB : null;
  const floorPts = [f.hip, f.shoulder, ...head, ...f.armA, ...f.armB, ...(onBox === f.legA ? [] : f.legA), ...(onBox === f.legB ? [] : f.legB)];
  // What touches the floor: the lowest point, or a box or bench height below a raised part.
  let low = Math.max(...floorPts.map(p => p[1]));
  if (onBox) low = Math.max(low, Math.max(onBox[1][1], onBox[2][1]) + BOX);
  if (body.bench === 'shoulder') low = Math.max(low, f.shoulder[1] + BENCH);
  if (body.bench === 'torso') low = Math.max(low, Math.max(f.hip[1], f.shoulder[1]) + BENCH);
  if (body.bench === 'feet') low = Math.max(...[f.hip, f.shoulder, ...f.armA, ...f.armB].map(p => p[1]), Math.max(f.legA[1][1], f.legB[1][1]) + BENCH);
  if (body.bench === 'hands') low = Math.max(Math.max(f.legA[1][1], f.legB[1][1], f.legA[2][1]), Math.max(f.armA[1][1], f.armB[1][1]) + BENCH + 4);
  const ground = h - 8;
  let dy = ground - low - (body.air || 0);
  if (has('bar')) dy = 10 - Math.min(f.armA[1][1], f.armB[1][1]); // hanging: hands on the bar, feet off the floor
  const all = [...floorPts, ...f.legA, ...f.legB];
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]));
  const dx = w / 2 - (minX + maxX) / 2;
  const T = p => [p[0] + dx, p[1] + dy];
  const F = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Array.isArray(v[0]) ? v.map(T) : T(v)]));
  const out = [];
  if (has('mat')) out.push(rect(minX + dx - 4, ground - 1.5, maxX - minX + 8, 2, 'prop soft'));
  if (has('wall')) { const x = Math.max(F.armA[1][0], F.armB[1][0]) + 2; out.push(line([x, 6], [x, ground], 'prop wall')); }
  if (has('wallBack')) { const x = Math.min(F.shoulder[0], F.hip[0], F.head[0] - L.head) - 2; out.push(line([x, 6], [x, ground], 'prop wall')); }
  if (has('wallFeet')) { const x = Math.max(F.legA[2][0], F.legB[2][0], F.legA[1][0]) + 2; out.push(line([x, 6], [x, ground], 'prop wall')); }
  const bench = (x0, x1, top) => out.push(rect(x0, top, x1 - x0, 4), line([x0 + 3, top + 4], [x0 + 3, ground], 'prop'), line([x1 - 3, top + 4], [x1 - 3, ground], 'prop'));
  if (body.bench === 'torso') bench(Math.min(F.hip[0], F.shoulder[0]) - 6, Math.max(F.hip[0], F.shoulder[0]) + 4, Math.max(F.hip[1], F.shoulder[1]) + 3);
  if (body.bench === 'shoulder') bench(F.shoulder[0] - 8, F.shoulder[0] + 14, F.shoulder[1] + 3);
  if (body.bench === 'feet') { const ft = F.legA[1]; bench(ft[0] - 10, ft[0] + 8, ft[1] + 2); }
  if (body.bench === 'hands') { const hd = F.armA[1]; bench(hd[0] - 14, hd[0] + 4, hd[1] + 2); }
  if (body.bench === 'seat') { bench(F.hip[0] - 12, F.hip[0] + 6, F.hip[1] + 3); out.push(line([F.hip[0] - 11, F.hip[1] + 3], [F.hip[0] - 13, F.hip[1] - 20], 'prop')); }
  if (onBox) { const ft = body.box === 'a' ? F.legA : F.legB, top = Math.max(ft[1][1], ft[2][1]) + 1; out.push(rect(ft[1][0] - 9, top, 20, ground - top)); }
  if (has('benchHands')) { const hd = F.armA[1]; out.push(rect(hd[0] - 6, hd[1] + 1, 18, ground - hd[1] - 1)); }
  if (has('bar')) { const y = Math.min(F.armA[1][1], F.armB[1][1]) - 1.5; out.push(line([F.armA[1][0] - 22, y], [F.armA[1][0] + 22, y], 'prop thick')); }
  if (has('lowBar')) { const y = Math.min(F.armA[1][1], F.armB[1][1]) - 1.5; out.push(line([F.armA[1][0] - 12, y], [F.armA[1][0] + 12, y], 'prop thick'), line([F.armA[1][0] + 10, y], [F.armA[1][0] + 10, ground], 'prop')); }
  if (has('trx')) out.push(line(F.armA[1], [F.armA[1][0] + (F.armA[1][0] >= F.shoulder[0] ? 16 : -4), 4], 'prop strap'));
  if (has('band')) out.push(`<path d="M${fix(F.armA[1][0])},${fix(F.armA[1][1])} Q${fix(F.armA[1][0] + 8)},${fix((F.armA[1][1] + F.legA[1][1]) / 2)} ${fix(F.legA[1][0] + 2)},${fix(F.legA[1][1])}" class="prop band"/>`);
  if (has('bandAnchor')) { const hd = F.armA[1]; out.push(line(hd, [w - 8, hd[1]], 'prop band'), `<circle cx="${w - 7}" cy="${fix(hd[1])}" r="2.2" class="prop dot"/>`); }
  if (has('bandKnees')) out.push(line(F.legA[0], F.legB[0], 'prop band'));
  if (!has('bar')) out.push(line([4, ground], [w - 4, ground], 'ground'));
  if (body.air) out.push(`<ellipse cx="${fix((F.legA[1][0] + F.legB[1][0]) / 2)}" cy="${ground}" rx="10" ry="1.6" class="shadow"/>`);
  // Far limbs, body, head, near limbs.
  out.push(poly([F.hip, ...F.legB], 'limb far'), poly([F.shoulder, ...F.armB], 'limb arm far'));
  out.push(`<path d="M${fix(F.hip[0])},${fix(F.hip[1])} Q${fix(F.bend[0])},${fix(F.bend[1])} ${fix(F.shoulder[0])},${fix(F.shoulder[1])}" class="torso"/>`);
  out.push(`<circle cx="${fix(F.head[0])}" cy="${fix(F.head[1])}" r="${L.head}" class="headc"/>`);
  out.push(poly([F.hip, ...F.legA], 'limb'), poly([F.shoulder, ...F.armA], 'limb arm'));
  const hands = [F.armB[1], F.armA[1]];
  if (has('db')) hands.forEach((p, i) => out.push(`<g class="kit${i ? '' : ' far'}">${rect(p[0] - 5, p[1] - 1.2, 10, 2.4, '')}${rect(p[0] - 6.5, p[1] - 3.2, 3, 6.4, '')}${rect(p[0] + 3.5, p[1] - 3.2, 3, 6.4, '')}</g>`));
  if (has('db1')) { const p = F.armA[1]; out.push(`<g class="kit">${rect(p[0] - 5, p[1] - 1.2, 10, 2.4, '')}${rect(p[0] - 6.5, p[1] - 3.2, 3, 6.4, '')}${rect(p[0] + 3.5, p[1] - 3.2, 3, 6.4, '')}</g>`); }
  if (has('kb')) { const p = [(F.armA[1][0] + F.armB[1][0]) / 2, (F.armA[1][1] + F.armB[1][1]) / 2]; out.push(`<g class="kit"><circle cx="${fix(p[0])}" cy="${fix(p[1] + 6)}" r="5"/><path d="M${fix(p[0] - 3)},${fix(p[1] + 2)} Q${fix(p[0])},${fix(p[1] - 3)} ${fix(p[0] + 3)},${fix(p[1] + 2)}" class="handle"/></g>`); }
  if (has('bb')) { const p = F.armA[1]; out.push(`<g class="kit"><circle cx="${fix(p[0])}" cy="${fix(p[1])}" r="8" class="plate"/><circle cx="${fix(p[0])}" cy="${fix(p[1])}" r="1.6" class="hub"/></g>`); }
  if (has('ball')) { const p = [(F.armA[1][0] + F.armB[1][0]) / 2, (F.armA[1][1] + F.armB[1][1]) / 2 - 3]; out.push(`<circle cx="${fix(p[0])}" cy="${fix(p[1])}" r="6.5" class="kit"/>`); }
  if (has('ballFloor')) out.push(`<circle cx="${fix(F.armA[1][0] + 4)}" cy="${ground - 6.5}" r="6.5" class="kit"/>`);
  return `<svg viewBox="0 0 ${w} ${h}" class="fig" aria-hidden="true">${out.join('')}</svg>`;
}
