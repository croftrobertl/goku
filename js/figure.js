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
  // Gym machines (2.8). bench: machine (seat with a backrest), stool (no backrest), incline,
  // recline (leg press) and long (lying leg curl) put a seat or pad under the body.
  seatTall: { t: -90, a: [0, 90], b: [0, 90], bench: 'machine' },
  seatLegOut: { t: -90, a: [0, 0], b: [0, 0], bench: 'machine' },
  seatCurl: { t: -90, a: [0, 110], b: [0, 110], bench: 'machine' },
  seatSpread: { t: -90, a: [14, 90], b: [-14, 90], bench: 'machine' },
  stoolSit: { t: -90, a: [0, 90], b: [0, 90], bench: 'stool' },
  stoolLean: { t: -72, a: [0, 90], b: [0, 90], bench: 'stool' },
  benchIncline: { t: -35, a: [180, 90], b: [180, 90], bench: 'incline' },
  legPressIn: { t: -135, a: [-98, 8], b: [-98, 8], bench: 'recline' },
  legPressOut: { t: -135, a: [-45, -45], b: [-45, -45], bench: 'recline' },
  leanHinge: { t: -62, a: [96, 92], b: [96, 92] },
  hackTop: { t: -100, a: [82, 92], b: [82, 92] },
  hackLow: { t: -108, a: [0, 100], b: [0, 100] },
  proneLong: { t: 0, a: [180, 180], b: [180, 180], bench: 'long' },
  proneCurl: { t: 0, a: [180, -70], b: [180, -70], bench: 'long' },
  hyperDown: { t: 45, a: [135, 135], b: [135, 135] },
  hyperUp: { t: -45, a: [135, 135], b: [135, 135] },
  abWheelIn: { t: -30, a: [80, 180], b: [80, 180] },
  abWheelOut: { t: -6, a: [165, 180], b: [165, 180] },
  cableKneel: { t: -80, a: [90, 180], b: [90, 180] },
  cableCrunch: { t: 20, a: [90, 180], b: [90, 180], bow: -1 },
  pistolTop: { t: -90, a: [90, 90], b: [20, 20] },
  pistolLow: { t: -50, a: [5, 112], b: [-8, -8] },
  sledA: { t: -35, a: [40, 110], b: [150, 130] },
  sledB: { t: -35, a: [150, 130], b: [40, 110] },
  runA: { t: -80, a: [50, 105], b: [125, 165] },
  runB: { t: -80, a: [125, 165], b: [50, 105] },
  walkA: { t: -88, a: [70, 95], b: [108, 100] },
  walkB: { t: -88, a: [108, 100], b: [70, 95] },
  rowCatch: { t: -60, a: [-50, 50], b: [-50, 50] },
  rowFinish: { t: -110, a: [-2, 2], b: [-2, 2] },
  bikeA: { t: -62, a: [-15, 85], b: [30, 100] },
  bikeB: { t: -62, a: [30, 100], b: [-15, 85] },
  ellA: { t: -86, a: [75, 100], b: [110, 95] },
  ellB: { t: -86, a: [110, 95], b: [75, 100] },
  climbA: { t: -80, a: [20, 100], b: [95, 95], box: 'a' },
  climbB: { t: -80, a: [95, 95], b: [20, 100], box: 'b' },
  hop: { t: -90, a: [88, 92], b: [92, 88], toes: true, air: 5 },
  ropeStance: { t: -65, a: [45, 100], b: [110, 95] },
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
  // Gym machines (2.8)
  pushdownTop: { a: [95, -45], b: [95, -45] },
  pushdownLow: { a: [95, 88], b: [95, 88] },
  sapUp: { a: [-35, -35], b: [-35, -35] },
  sapDown: { a: [95, 95], b: [95, 95] },
  rowSitTop: { a: [150, -5], b: [150, -5] },
  rowPull: { a: [100, 0], b: [100, 0] },
  pulldownLow: { a: [110, -80], b: [110, -80] },
  deckOpen: { a: [170, -90], b: [10, -90] },
  deckClosed: { a: [0, -90], b: [0, -90] },
  cxOpen: { a: [-25, -25], b: [-155, -155] },
  cxClose: { a: [45, 45], b: [55, 55] },
  skullLow: { a: [-80, -5], b: [-80, -5] },
  pullover: { a: [45, 45], b: [45, 45] },
  kickIn: { a: [170, 90], b: [170, 90] },
  kickOut: { a: [170, 170], b: [170, 170] },
  arnoldIn: { a: [60, -90], b: [60, -90] },
  snatchTop: { a: [-88, -88], b: [90, 90] },
  renegade: { a: [-150, 90], b: [90, 90] },
  hsBent: { a: [20, 100], b: [20, 100] },
  chopHigh: { a: [-140, -140], b: [-140, -140] },
  chopLow: { a: [55, 55], b: [55, 55] },
  throughBack: { a: [105, 105], b: [105, 105] },
  throughFront: { a: [80, 80], b: [80, 80] },
  crunchHold: { a: [-50, 150], b: [-50, 150] },
  crunchHoldDown: { a: [-10, 110], b: [-10, 110] },
  preacherLow: { a: [35, 50], b: [35, 50] },
  preacherTop: { a: [35, -70], b: [35, -70] },
  sledArms: { a: [20, 10], b: [20, 10] },
  runArmsB: { a: [125, 60], b: [60, -60] },
  walkArms: { a: [70, 60], b: [110, 100] },
  walkArmsB: { a: [110, 100], b: [70, 60] },
  rowReach: { a: [5, 5], b: [5, 5] },
  bikeArms: { a: [50, 50], b: [50, 50] },
  airArmsA: { a: [30, 30], b: [75, 55] },
  airArmsB: { a: [75, 55], b: [30, 30] },
  ellArms: { a: [60, -20], b: [80, -10] },
  ellArmsB: { a: [80, -10], b: [60, -20] },
  railHold: { a: [55, 30], b: [55, 30] },
  ropeArms: { a: [80, 20], b: [100, 160] },
  wavesUp: { a: [20, -10], b: [30, 0] },
  wavesDown: { a: [50, 60], b: [40, 50] },
  thrustHold: { a: [183, 183], b: [183, 183] },
  hyperArms: { a: [100, -40], b: [100, -40] },
  hyperArmsUp: { a: [150, 10], b: [150, 10] },
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
  // Gym machines: seats, pads and frames that hold part of the body up off the floor.
  const SEAT = { machine: 24, stool: 23, incline: 22, recline: 14 };
  if (SEAT[body.bench]) low = Math.max(low, f.hip[1] + SEAT[body.bench]);
  if (body.bench === 'long') low = Math.max(low, Math.max(f.hip[1], f.shoulder[1]) + BENCH);
  const handLow = Math.max(f.armA[1][1], f.armB[1][1]), ankleLow = Math.max(f.legA[1][1], f.legB[1][1]);
  if (has('wheel')) low = Math.max(low, handLow + 8);
  if (has('rower')) low = Math.max(low, f.hip[1] + 13);
  if (has('bike') || has('airBike')) low = Math.max(low, ankleLow + 10);
  const lift = has('treadmill') ? 5 : has('elliptical') ? 7 : has('hyper') ? 6 : 0;
  const ground = h - 8;
  let dy = ground - low - (body.air || 0) - lift;
  if (has('bar')) dy = 10 - Math.min(f.armA[1][1], f.armB[1][1]); // hanging: hands on the bar, feet off the floor
  if (has('assist')) dy = 12 - Math.min(f.armA[1][1], f.armB[1][1]); // assisted pull-up: knees on a pad
  if (has('barTop')) dy = 50 - Math.min(f.armA[1][1], f.armB[1][1]); // muscle-up: leaning on top of the bar
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
  out.push(...gym(F, body, has, props, { w, ground, minX: minX + dx, maxX: maxX + dx, bench }));
  if (!has('bar') && !has('barTop')) out.push(line([4, ground], [w - 4, ground], 'ground'));
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
  if (has('yoke')) out.push(line([F.shoulder[0] - 6, F.shoulder[1] - 2], [F.shoulder[0] + 6, F.shoulder[1] - 2], 'prop thick'));
  if (has('wheel')) { const p = [(F.armA[1][0] + F.armB[1][0]) / 2, Math.max(F.armA[1][1], F.armB[1][1]) + 4]; out.push(`<circle cx="${fix(p[0])}" cy="${fix(p[1])}" r="4" class="prop"/>`, `<circle cx="${fix(p[0])}" cy="${fix(p[1])}" r="1.4" class="prop dot"/>`); }
  return `<svg viewBox="0 0 ${w} ${h}" class="fig" aria-hidden="true">${out.join('')}</svg>`;
}

const dot = (p, r = 2.2) => `<circle cx="${fix(p[0])}" cy="${fix(p[1])}" r="${r}" class="prop dot"/>`;
const ring = (p, r) => `<circle cx="${fix(p[0])}" cy="${fix(p[1])}" r="${r}" class="prop"/>`;
const off = (p, a, d) => step(p, a, d);

// Gym machines and cardio kit (2.8), drawn behind the figure. Parts are placed from the
// figure's joints, so one prop fits every pose that uses it.
function gym(F, body, has, props, { w, ground, minX, maxX, bench }) {
  const out = [], hA = F.armA[1], hB = F.armB[1], H = F.hip, S = F.shoulder;
  const toGround = (p, cls = 'prop thick') => out.push(line(p, [p[0], ground], cls));
  // Seats and pads
  if (body.bench === 'machine') { bench(H[0] - 12, H[0] + 8, H[1] + 3); out.push(line([H[0] - 7, H[1] + 3], [H[0] - 7, S[1] - 2], 'prop thick')); }
  if (body.bench === 'stool') bench(H[0] - 9, H[0] + 7, H[1] + 3);
  if (body.bench === 'incline' || body.bench === 'recline') {
    const side = body.bench === 'incline' ? body.t + 90 : body.t - 90;
    const p0 = off(off(H, body.t, -3), side, 5), p1 = off(off(S, body.t, 4), side, 5);
    out.push(line(p0, p1, 'prop thick'));
    if (body.bench === 'incline') bench(H[0] - 12, H[0] + 4, H[1] + 3);
    toGround(p0); toGround(off(p0, body.t, 14));
  }
  if (body.bench === 'long') bench(F.legA[0][0] + 3, S[0] + 4, Math.max(H[1], S[1]) + 3);
  if (has('stack')) { const top = 22, hgt = ground - top; out.push(rect(5, top, 9, hgt), ...[1, 2, 3, 4].map(i => line([5, top + i * hgt / 5], [14, top + i * hgt / 5], 'prop'))); }
  if (has('chestPad')) { const x = S[0] + 6; out.push(line([x, S[1] + 3], [x, H[1] - 8], 'prop thick'), line([x, H[1] - 8], [x + 6, H[1] - 8], 'prop'), line([x + 6, H[1] - 8], [x + 6, ground], 'prop')); }
  if (has('grip')) [hB, hA].forEach(p => out.push(line([p[0], p[1] - 4], [p[0], p[1] + 4], 'prop thick')));
  if (has('roller')) out.push(dot(F.legA[1], 3.2));
  if (has('kneeRoll')) out.push(dot(off(F.legB[0], 0, 0), 3), dot(F.legA[0], 3.2));
  if (has('kneePad')) { const k = F.legA[0]; out.push(rect(k[0] - 9, k[1] - 7, 11, 3)); }
  if (has('yoke')) { const x = S[0] - 9; out.push(line([x, S[1] - 2], [x, ground], 'prop')); }
  // Cable machines: a tower with a pulley, high, at hand height or low; in front, or behind (Back).
  const cab = props.find(p => /^cable(Hi|Mid|Lo)(Back)?$/.test(p));
  const tower = (x, py, to) => { const px = x + (x < w / 2 ? 3 : -3); out.push(rect(x - 2, 4, 4, ground - 4), dot([px, py]), line([px, py], to, 'prop strap')); };
  if (cab) tower(cab.endsWith('Back') ? 6 : w - 6, cab.includes('Hi') ? 8 : cab.includes('Lo') ? ground - 5 : hA[1], hA);
  if (has('cableX')) { tower(6, 8, hB); tower(w - 6, 8, hA); }
  if (has('latBar')) {
    const y = Math.min(hA[1], hB[1]), post = hA[0] - 24;
    out.push(line([post, 5], [hA[0] + 6, 5], 'prop thick'), line([post, 5], [post, ground], 'prop thick'), line([hA[0], y], [hA[0], 5], 'prop strap'),
      dot([hA[0], 5]), line([hA[0] - 12, y], [hA[0] + 12, y], 'prop thick'));
  }
  if (has('smith')) { const x = hA[0]; out.push(line([x, 4], [x, ground], 'prop thick')); }
  // Leg press: the foot plate square to the legs, on a sloped rail.
  if (has('footplate')) {
    const an = F.legA[1], len = Math.hypot(an[0] - H[0], an[1] - H[1]), d = [(an[0] - H[0]) / len, (an[1] - H[1]) / len], n = [-d[1], d[0]];
    const c = [an[0] + d[0] * 3, an[1] + d[1] * 3];
    out.push(line([c[0] + n[0] * 11, c[1] + n[1] * 11], [c[0] - n[0] * 11, c[1] - n[1] * 11], 'prop thick'));
    const r0 = [c[0] + n[0] * 9 + d[0] * 6, c[1] + n[1] * 9 + d[1] * 6], t = (ground - r0[1]) / d[1];
    out.push(line(r0, [r0[0] + d[0] * t, ground], 'prop'));
  }
  // Hack squat: a back pad that slides on a sloped rail.
  if (has('hackPad')) {
    const side = body.t - 90, p0 = off(off(H, body.t, 2), side, 5), p1 = off(off(S, body.t, 3), side, 5);
    out.push(line(p0, p1, 'prop thick'));
    const back = body.t + 180, t = (ground - p0[1]) / Math.sin(rad(back));
    out.push(line(p0, off(p0, back, t), 'prop'));
  }
  // Back extension: hips on a pad, heels under a roller, on a 45° frame.
  if (has('hyper')) {
    const la = 135, pad0 = off(off(H, la, 1), la - 90, 4), pad1 = off(off(H, la, 10), la - 90, 4);
    const an = F.legA[1], heel = off(an, la + 90, 4);
    out.push(line(pad0, pad1, 'prop thick'), dot(heel, 2.6), line(pad1, an, 'prop'));
    toGround(pad1, 'prop'); toGround(an, 'prop');
  }
  if (has('assist')) {
    const k = F.legA[0], ft = F.legA[2], y = Math.min(hA[1], hB[1]) - 1.5, top = k[1] + 2.5;
    out.push(line([hA[0] - 22, y], [hA[0] + 22, y], 'prop thick'), rect(Math.min(ft[0], k[0]) - 2, top, Math.abs(k[0] - ft[0]) + 6, 3));
    toGround([(k[0] + ft[0]) / 2, top + 3]);
  }
  if (has('barTop')) { const y = Math.min(hA[1], hB[1]) + 1.5; out.push(line([hA[0] - 22, y], [hA[0] + 22, y], 'prop thick')); }
  if (has('preacher')) {
    const e = F.armA[0], up = Math.atan2(e[1] - S[1], e[0] - S[0]) * 180 / Math.PI;
    const p0 = off(off(S, up, 4), up + 90, 4), p1 = off(e, up + 90, 4);
    out.push(line(p0, p1, 'prop thick')); toGround(off(p0, up, 6), 'prop');
  }
  // Sled: a low frame on the floor with two upright poles to push.
  if (has('sled')) { const x = Math.max(hA[0], hB[0]); out.push(rect(x - 2, ground - 6, 22, 6), line(hA, [x + 1, ground - 6], 'prop thick')); }
  // Cardio machines
  if (has('treadmill')) {
    const x0 = minX - 12, x1 = maxX + 8, top = ground - 5, hy = H[1] - 4;
    out.push(rect(x0, top, x1 - x0, 5), line([x1, top], [x1 + 3, hy], 'prop thick'), line([x1 + 3, hy], [x1 - 7, hy], 'prop thick'));
  }
  if (has('rower')) {
    const ry = H[1] + 7, x0 = H[0] - 18, x1 = Math.max(F.legA[2][0], F.legB[2][0]) + 10, fly = [x1 + 3, ry - 6];
    out.push(line([x0, ry], [x1, ry], 'prop thick'), rect(H[0] - 7, H[1] + 3, 14, 3), ring(fly, 6), dot(fly, 1.6), line(hA, fly, 'prop strap'),
      line([F.legA[1][0] + 4, F.legA[1][1] - 7], [F.legA[1][0] + 7, ry], 'prop thick'));
    toGround([x0 + 3, ry], 'prop'); toGround([x1 - 3, ry], 'prop');
  }
  if (has('bike') || has('airBike')) {
    const a = F.legA[1], b = F.legB[1], c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], r = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
    out.push(ring(c, fix(r)), line(a, b, 'prop'), rect(H[0] - 8, H[1] + 2, 13, 3), line([H[0] - 2, H[1] + 5], c, 'prop thick'), line(c, [c[0], ground], 'prop thick'),
      line([c[0] - 18, ground - 1], [c[0] + 22, ground - 1], 'prop thick'));
    if (has('bike')) out.push(line(c, hA, 'prop thick'), line([hA[0] - 2, hA[1]], [hA[0] + 5, hA[1]], 'prop thick'));
    else { const fan = [c[0] + 20, c[1] - 4]; out.push(ring(fan, 11), dot(fan, 1.8), line(c, hA, 'prop'), line(c, hB, 'prop'), line(fan, [fan[0], ground], 'prop thick')); }
  }
  if (has('rail')) { const x = Math.max(hA[0], hB[0]) + 3; out.push(line([x - 9, hA[1]], [x, hA[1]], 'prop thick'), line([x, hA[1]], [x, ground], 'prop thick')); }
  if (has('elliptical')) {
    const fx = maxX + 12, piv = [fx - 2, ground - 16];
    [F.legB, F.legA].forEach(l => { const p0 = [l[1][0] - 3, Math.max(l[1][1], l[2][1]) + 2], p1 = [Math.max(l[2][0], l[1][0]) + 3, p0[1]]; out.push(line(p0, p1, 'prop thick'), line(p1, piv, 'prop')); });
    out.push(line(hA, piv, 'prop thick'), line(hB, piv, 'prop'), rect(fx - 6, ground - 16, 10, 16), line([minX - 8, ground - 1], [fx, ground - 1], 'prop thick'));
  }
  const rope = props.find(p => p === 'ropeOver' || p === 'ropeUnder');
  if (rope) {
    const cx = (hA[0] + hB[0]) / 2, cy = rope === 'ropeOver' ? F.head[1] - 22 : ground + 6;
    out.push(`<path d="M${fix(hB[0])},${fix(hB[1])} C${fix(cx - 26)},${fix(cy)} ${fix(cx + 26)},${fix(cy)} ${fix(hA[0])},${fix(hA[1])}" class="prop"/>`);
  }
  const waves = props.find(p => p === 'wavesA' || p === 'wavesB');
  if (waves) {
    const end = [w - 6, ground - 2], n = 3, amp = waves === 'wavesA' ? 6 : -6;
    let d = `M${fix(hA[0])},${fix(hA[1])}`;
    for (let i = 0; i < n; i++) {
      const p = [hA[0] + (end[0] - hA[0]) * (i + 1) / n, hA[1] + (end[1] - hA[1]) * (i + 1) / n];
      const q = [hA[0] + (end[0] - hA[0]) * (i + .5) / n, hA[1] + (end[1] - hA[1]) * (i + .5) / n + (i % 2 ? -amp : amp)];
      d += ` Q${fix(q[0])},${fix(q[1])} ${fix(p[0])},${fix(p[1])}`;
    }
    out.push(`<path d="${d}" class="prop"/>`, dot(end, 2.4));
  }
  return out;
}
