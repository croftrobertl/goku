// Mockups for review batch 2026-11-ui-8 (2.13 sports list), drawn inside the running app so they use its real styles.
const head = t => `<div class="row"><h1 style="text-align:left">${t}</h1><button class="cta2">Close</button></div>`;
const pills = (list, on) => `<div class="pills">${list.map(n => `<button aria-pressed="${n === on}">${n}</button>`).join('')}</div>`;
const rest = `<p class="lbl" style="margin-top:16px">Minutes</p><div class="seg">${[30, 45, 60, 90, 120].map(m => `<button aria-pressed="${m === 60}">${m}</button>`).join('')}</div>`;
const NOW = ['Soccer', 'Running', 'Cycling', 'Swimming', 'Rowing', 'Gymnastics', 'Lifting', 'Walk or hike', 'Basketball', 'Volleyball', 'Tennis', 'Baseball or softball',
  'Football', 'Hockey', 'Track and field', 'Cheerleading', 'Dance', 'Martial arts', 'Boxing', 'Wrestling', 'Rock climbing', 'Skating', 'Other sport', 'Something else'];
const NEW = ['Badminton', 'Table tennis', 'Racquetball', 'Squash', 'Golf', 'Bowling', 'Archery', 'Fencing', 'Rugby', 'Cricket', 'Handball', 'Ultimate frisbee',
  'Water polo', 'Kayaking or canoeing', 'Surfing', 'Paddleboarding', 'Diving', 'Water aerobics', 'Skiing', 'Snowboarding', 'Snowshoeing', 'Horseback riding',
  'Skateboarding', 'Trampoline', 'Jump rope', 'Yoga', 'Pilates', 'Elliptical', 'HIIT'];
const ALL = [...NOW.slice(0, -2), ...NEW, 'Other sport', 'Something else'];
window.MOCKS = {
  // A: your sports first, then a search box for the rest
  'sport-a': head('Log Activity') + `<p class="lbl">What</p>${pills(['Gymnastics', 'Running', 'Lifting', 'Cheerleading', 'Walk or hike', 'Something else'], 'Gymnastics')}
    <input placeholder="Another sport, e.g. tennis" style="margin-top:10px" value="ten">
    <div class="pills sugg" style="margin-top:6px"><button>Tennis</button><button>Table tennis</button></div>
    <p class="note" style="margin-top:6px">Your sports from setup and the ones you've logged come first. Type to find any of the 53.</p>${rest}`,
  // B: the most common ones, the rest behind a fold, in groups
  'sport-b': head('Log Activity') + `<p class="lbl">What</p>${pills(['Gymnastics', 'Running', 'Lifting', 'Soccer', 'Swimming', 'Cycling', 'Walk or hike', 'Something else'], 'Gymnastics')}
    <details open style="margin-top:8px"><summary>More Sports</summary>
      <p class="lbl" style="margin-top:8px">Team</p>${pills(['Basketball', 'Volleyball', 'Football', 'Baseball or softball', 'Hockey', 'Cheerleading', 'Rugby', 'Water polo'])}
      <p class="lbl" style="margin-top:8px">Racket</p>${pills(['Tennis', 'Badminton', 'Table tennis', 'Racquetball', 'Squash'])}
      <p class="lbl" style="margin-top:8px">Water and Snow</p>${pills(['Kayaking or canoeing', 'Surfing', 'Paddleboarding', 'Skiing', 'Snowboarding'])}
      <p class="lbl" style="margin-top:8px">And More</p>${pills(['Dance', 'Martial arts', 'Yoga', 'Pilates', 'Golf', '…'])}
    </details>${rest}`,
  // C: every sport as a button, as now
  'sport-c': head('Log Activity') + `<p class="lbl">What</p>${pills(ALL, 'Gymnastics')}${rest}`,
};
