// Equipment pictures and plain words for the equipment question (2.29, review 39). Original drawings, 64 x 64.
const K='#1b1b1f',G='#8b93a1',L='#c9ced8',R='#e5533d',B='#3f7fe0',Y='#f2b632',W='#b9814a',N='#4a4f5a',E='#4caf7a';
const S=`stroke="${K}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
const r=(x,y,w,h,f,q=2)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${q}" fill="${f}" ${S}/>`;
const c=(x,y,q,f)=>`<circle cx="${x}" cy="${y}" r="${q}" fill="${f}" ${S}/>`;
const p=(d,f='none',x='')=>`<path d="${d}" fill="${f}" ${S} ${x}/>`;
const tube=(d,f,w=4)=>`<path d="${d}" fill="none" stroke="${K}" stroke-width="${w+4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${f}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const GEAR_ART={
 db:r(20,29,24,6,L)+r(13,19,8,26,N)+r(6,23,7,18,N)+r(43,19,8,26,N)+r(51,23,7,18,N),
 kb:tube('M22 30 Q18 9 32 9 Q46 9 42 30',G,5)+c(32,41,17,N)+p('M24 36a10 10 0 0 1 6-5','none','style="stroke:#fff;opacity:.6"'),
 bb:r(2,30,60,4,L)+r(9,14,6,36,R)+r(16,20,5,24,N)+r(49,14,6,36,R)+r(43,20,5,24,N),
 bench:r(6,25,52,10,B,4)+p('M14 35v19M50 35v19M8 54h12M44 54h12'),
 band:tube('M14 46 Q32 2 50 46',R,4)+r(6,44,16,9,N,4)+r(42,44,16,9,N,4),
 bar:p('M10 58V12M54 58V12')+tube('M6 14H58',L,4)+r(17,11,9,7,N)+r(38,11,9,7,N),
 trx:c(32,8,4,G)+p('M32 12 18 42M32 12 46 42','none','style="stroke:'+Y+';stroke-width:5"')+p('M18 42 10 54H26ZM46 42 38 54H54Z')+r(8,51,20,7,N,3)+r(36,51,20,7,N,3),
 ball:c(32,32,24,N)+p('M12 20Q32 30 52 20M12 44Q32 34 52 44')+`<rect x="18" y="25" width="28" height="14" rx="7" fill="#fff" ${S}/><text x="32" y="36" font-size="11" font-weight="800" text-anchor="middle" font-family="system-ui" fill="${K}">5 lb</text>`,
 machine:r(6,6,18,50,L)+[14,21,28,35,42].map(y=>r(9,y,12,5,N,1)).join('')+p('M24 10H46V22')+r(36,36,18,6,R,3)+r(50,20,6,20,R,3)+p('M45 42V56M38 56H54M38 24H54'),
 cable:r(6,5,12,53,L)+r(9,34,6,18,N,1)+c(24,12,5,G)+p('M18 12H19M28 14 44 34')+r(36,34,18,6,N,3)+p('M6 58H30'),
 cardio:p('M8 50 48 44 58 48 16 56Z',N)+p('M46 44 52 14')+r(38,10,18,8,B,3)+p('M50 22H36'),
 sled:p('M4 54H44L38 47H10Z',R)+p('M12 47V14M34 47V14')+r(16,38,14,9,N,1)+r(17,30,12,8,G,1)+tube('M44 24Q50 16 53 24T61 24',W,4)+tube('M46 40Q51 32 54 40T61 40',W,4),
 rope:p('M14 22Q10 58 32 56Q54 54 50 22','none','style="stroke:'+B+';stroke-width:4"')+r(10,6,8,18,R,4)+r(46,6,8,18,R,4),
 wheel:r(2,28,22,8,N,4)+r(40,28,22,8,N,4)+r(22,26,20,12,G)+r(23,8,18,48,Y,8)+p('M29 14V50M35 14V50'),
 slider:`<ellipse cx="22" cy="38" rx="18" ry="11" fill="${N}" ${S}/><ellipse cx="22" cy="35" rx="18" ry="11" fill="${Y}" ${S}/><ellipse cx="42" cy="28" rx="18" ry="11" fill="${N}" ${S}/><ellipse cx="42" cy="25" rx="18" ry="11" fill="${Y}" ${S}/>`,
 ankle:p('M26 4V34Q26 44 34 46L54 50Q58 58 52 58H18Q14 58 14 50V4','#f0c9a4')+r(9,28,22,15,B,5)+p('M16 28V43M24 28V43'),
 vest:p('M18 6 26 8Q32 20 38 8L46 6 52 24 48 28V56H16V28L12 24Z',N)+p('M32 18V56')+r(19,32,9,8,G)+r(36,32,9,8,G)+r(19,44,9,8,G)+r(36,44,9,8,G)+r(14,26,36,4,R,1),
};
export const gearPic=k=>GEAR_ART[k]?`<svg class="gpic" viewBox="0 0 64 64" aria-hidden="true">${GEAR_ART[k]}</svg>`:'';
export const GEAR_WHY={db:'Short hand weights, one for each hand',kb:'A heavy ball with a handle on top',bb:'A long bar with plates on both ends',bench:'Something sturdy to sit, lie or step on',band:'A stretchy strap you pull against',bar:'An overhead bar to hang from and pull up on',trx:'Straps with handles that hang from a door or beam',ball:'A weighted ball to hold or throw',machine:'Gym machines with a seat and a stack of weights',cable:'A handle on a cable, pulled against weights',cardio:'Treadmill, bike, rower or elliptical',sled:'A weighted sled to push, or thick ropes to wave',rope:'A rope you turn and jump over',wheel:'A wheel with handles that you roll on the floor',slider:'Smooth discs that go under your feet or hands',ankle:'Small weights that strap around your ankles',vest:'A vest with weight built in'};
export const GEAR_GROUPS=[['For home',['db','kb','band','ball','bench','bar','trx','wheel','slider','ankle','vest','rope']],['Mostly at a gym',['bb','machine','cable','cardio','sled']]];

// The family's own equipment (2.29, review 38). Rob, Erica and Alice share one list; Lennon gets the light pieces.
const ALL = ['db', 'kb', 'ball', 'wheel', 'slider', 'ankle', 'vest'];
export const FAMILY_GEAR = { rob: ALL, erica: ALL, alice: ALL, lennon: ['ball', 'slider'] };
// Their dumbbells: one 2.5 lb and one 5 lb plate per end, the same on both ends, handle not counted. Pounds per dumbbell.
export const FAMILY_DB = { rob: [5, 10, 15], erica: [5, 10, 15], alice: [5, 10, 15] };
// Adds the list to a profile made before it existed. Once: what someone later removes stays removed.
export function addFamilyGear(p) {
  const list = FAMILY_GEAR[p?.who];
  if (!list || p.settings?.familyGear) return false;
  (p.about ||= {}).equipment = [...new Set([...(p.about.equipment || []), ...list])];
  p.settings.familyGear = true;
  return true;
}
// The next dumbbell they can build, up or down; null is no weight. Already past the heaviest: stays put.
export function nextDb(list, now, up) {
  const w = now || 0;
  if (up) return list.find(x => x > w + .001) ?? (now || null);
  return [...list].reverse().find(x => x < w - .001) ?? null;
}

// Safety notes and sources for the home pieces (2.29). Checked against each page on 2026-11-24.
const a = (url, name) => `<a href="${url}" target="_blank" rel="noopener">${name}</a>`;
const HARVARD = 'Harvard Health, ' + a('https://www.harvardhealth.org/staying-healthy/wearable-weights-how-they-can-help-or-hurt', 'Wearable weights') + ' (Feb. 15, 2021)';
const HENRY = 'Henry Ford Health, ' + a('https://www.henryford.com/blog/2025/04/should-you-wear-a-weighted-vest-while-working-out', 'Should You Wear a Weighted Vest While Working Out?') + ' (Apr. 8, 2025)';
const CC_ROUTINE = 'Cleveland Clinic, ' + a('https://health.clevelandclinic.org/workout-routine', 'workout routine') + ' (Mar. 10, 2025)';
const CC_LUNGE = 'Cleveland Clinic, ' + a('https://health.clevelandclinic.org/lunges-muscles-worked', 'lunges') + ' (Apr. 25, 2025)';
const ACE_HIIT = 'ACE, ' + a('https://www.acefitness.org/resources/pros/expert-articles/7584/the-perfect-hiit-workout-for-2020/', 'The Perfect HIIT Workout for 2020') + ' (June 17, 2020)';
const ACE_PLANK = 'ACE, ' + a('https://www.acefitness.org/resources/pros/expert-articles/5176/how-to-use-gliders-for-dynamic-planks/', 'How to Use Gliders for Dynamic Planks') + ' (Nov. 21, 2014)';
const ACE_CLIMB = 'ACE, ' + a('https://www.acefitness.org/resources/everyone/exercise-library/258/mountain-climbers/', 'Mountain Climbers');
const NHS = 'North Tees and Hartlepool NHS, ' + a('https://www.nth.nhs.uk/resources/standing-exercises/', 'Standing exercises') + ' (reviewed Mar. 30, 2026)';
const RNOH = 'Royal National Orthopaedic Hospital, ' + a('https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/functional-fitness-exercise-pack', 'Functional fitness exercise pack') + ' (updated July 16, 2025)';
export const GEAR_NOTE = {
  vest: 'Safety: Harvard Health says a vest should be no more than 10% of your body weight (15 lb for someone who weighs 150 lb). Henry Ford Health suggests starting at 3% or less, and walking rather than running. Check with a doctor first if you have back, joint or balance problems.',
  ankle: 'Safety: Harvard Health says to use ankle weights for leg and hip moves, never for walking or aerobics. Start with no weight and add it once the move feels easy (NHS).',
  slider: 'No sliders? Hand towels work on hard, smooth floors and paper plates on low carpet (ACE).' };
export const VEST_SRC = [HARVARD, HENRY];
export const VEST_MINOR = 'No guidance found for under-18s; ask your coach or doctor first.';
export const MOVE_SRC = { 'slider-reverse-lunge': [ACE_HIIT, CC_LUNGE], 'slider-side-lunge': [ACE_HIIT, CC_LUNGE], 'slider-climber': [ACE_CLIMB, ACE_HIIT], 'slider-knee-elbow': [ACE_PLANK, ACE_HIIT],
  'slider-bridge-curl': [ACE_HIIT, CC_ROUTINE], 'slider-arm-slide': [ACE_PLANK, ACE_HIIT], 'aw-side-leg-lift': [HARVARD, NHS], 'aw-hip-abduction': [NHS, HARVARD], 'aw-kickback': [NHS, HARVARD],
  'aw-hamstring-curl': [RNOH, HARVARD, NHS], 'vest-walk': [HENRY, HARVARD], 'vest-squat': [CC_ROUTINE, HARVARD, HENRY], 'vest-reverse-lunge': [CC_LUNGE, HARVARD, HENRY], 'vest-plank': [CC_ROUTINE, HARVARD, HENRY] };
