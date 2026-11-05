# Goku

An offline training tracker that installs from Safari to the iPhone Home Screen.
There are no accounts, no servers, no analytics and no network requests while you use it.
Everything you enter stays on the device it was entered on.

- **Strength and conditioning profile:** gravity-chamber density circuits with drop-set chains, a
  whole-screen rep counter, ghost races against your last session, and a gut and bloating log.
- **Gymnastics and vaulting profile:** daily readiness check-in, week planner, session load
  (minutes × effort), and care checks that point to a parent, coach or doctor.

Each profile has its own 6-digit passcode, theme (six themes, each with light and dark), and
sound setting. Profile names and every other personal value are typed in on first
launch; none of them are in this code.

**Tailored from the first launch.** Setup asks about 3 minutes of coach questions: units and time
zone, birth year, height and weight, training history, goal, equipment and training days (strength),
diet and allergies, and any injuries. After that the coach asks one or two follow-ups a day on Home
(meals a day, favorite protein foods, sleep, how the week felt, competition dates, schedule changes).
Every answer changes something: the starting gravity, which exercises are in the library, the weekly
session goal, fuel ranges and protein ideas, sleep targets, reminders, and the competition countdown.
All answers can be changed in Settings → About you. Text boxes note that the keyboard's mic can be
used to dictate.

**Training extras (1.4).**
- *Other training:* log soccer, runs, games or anything else (minutes and effort). It counts toward
  the fuel ranges, the recovery map and the weekly recap.
- *Senzu map:* how many days since each muscle group was trained, from circuits and other training.
  It reports what you did; it doesn't prescribe recovery hours.
- *Power level records:* the most reps in one set for each exercise and drop stage, shown in the
  Library, with an alert in the workout the moment you beat one. *Dumbbell math* in the exercise
  editor shows pair totals and raises loads by your dumbbell step.
- *Level up:* after you beat your ghost twice in a row at one gravity, the coach offers the next
  level or more load.
- *2.11.0:* many more barcodes. A KIND breakfast bar wouldn't scan: USDA lists 478 KIND barcodes and
  the search list kept 238. Now every other current US product in USDA Branded Foods (October 2026)
  with a barcode, calories and a gram or ml serving, 301,195 more, can be scanned; KIND goes to 459.
  They live in data/upc/ (tools/build-barcodes.py), small files grouped by the barcode's first digits
  (the biggest is 380 KB, about 85 KB compressed), so search and the first download stay the same
  size. A scan checks the search list first, then fetches that one file the first time, and keeps it
  for offline use. Scanned offline in a group not fetched yet, Goku says it needs internet this once.
- *2.10.2:* cancelling Add a profile puts the open profile's theme and accent back (setup had left
  the app in its own blue default until the next restart).
- *2.10.1:* fixes found on the iPhone simulator. The setup color fills the screen down through the
  home-bar area; Library section counts stay lowercase ("· 2 moves"); the install screen's Safari
  link is "Try It in Safari Anyway" with the warning in plain words under it; "Units and Time" shows
  once in setup; the look picker's Encore and Plain cards no longer take on those looks' borders
  (skin styles now apply only from the page itself); and before any profile exists, a new version
  goes live at once instead of waiting for Safari to close.
- *2.10.0:* picks from review 6. Exercise and stage names on the workout screen stay as written
  (2.9.0's Title Case had caught them). Weight trend on Strength profiles' Stats: every weigh-in is
  kept and smoothed with The Hacker's Diet method (John Walker, "Pencil and Paper": each day moves
  the trend a tenth of the way to that day's weight), and a weight goal can track itself on the
  trend. Gymnastics profiles never show weight, as their setup promises. During a set: "Last time:
  14 reps · Beat it with 15" for that exercise and stage, and plates per side for barbell lifts (bar
  and plates set in the exercise editor). The level is picked only in Today's Workout. Smaller:
  Edit Home says Today's Workout, Quick Add → Supplements always opens today, Settings option names
  use Title Case, "Remember this phone for", "Next Hard workout, you race it live", "Fuel Timing".
  From review 7: the Last Session and Food Today tiles on Stats get a small trend line (the last 8
  workouts' reps per minute; the last 7 days' calories, with the average of the logged days before today).
- *2.9.0:* changes picked in phone review 5. Flat panels: black borders, no offset shadows (that
  shadow also nudged cards left, cutting them off). Pages no longer slide under the bottom bar (the
  bar's full height, the iPhone home-bar area and the + button are now counted). Quick Add is one
  panel with two groups, Food & Drink (Food, Water, Supplements) and Activity (the screen's action,
  Activity, Rest Day). Title Case for headings, labels, buttons and tabs; exercise, food and
  supplement names stay as written. The box you're typing in gets an orange edge inside its border;
  sheets no longer ring the Close button when they open. Workouts use plain levels (Easy, Medium,
  Hard, Max = the old ×10, ×20, ×50, ×100, so history and ghosts carry over), and Train goes
  straight to Today's Workout without the ki question; "Today's ki" is "Today's Progress".
  Anything that unfolds ends in "Show ▾", anything that opens ends in an orange ›. Nutrition shows
  protein, macros and the calorie split without a tap; the split always adds up to 100%. 31 more
  Everkinetic drawings (65 in all), each checked by eye; exercises without one show the muscle map
  and steps instead of a stick figure. USDA serving names are no longer in capitals.
- *2.8.2:* changes picked in the second phone review. Pages whose action lived in the center
  button (check-in, Week, Library, Skills) have it as a button at the bottom again. Readiness reads
  "Talk to a parent or coach before training" after a yes to back pain, pain changing a skill or
  dizziness; St. John's wort warnings show NIH's lead-in; "Lose fat" isn't offered under 18. "New
  record" shows once, when the set ends; the weight buttons hide during rest; holding Finish opens
  one dialog; barbell and machine weights step by 5 lb (2.5 kg). A time-zone change starts with the
  next day. Food search ranks a chain's own item first, reads "2 slices pizza" as 2 slices, lists a
  chain's menu by its name and points supplements to Supplements; Banana shows once and an egg has
  no "slice". Past days are named in Nutrition. Why? does its math in lb for pound users, and
  "Build muscle" aims for the middle of the protein range. Encore and Plain drop the Dragon Ball
  fighters, words and theme names; Encore says Chapter, charm and intensity. New profile names start
  with a capital letter, and Back during setup goes back a step. From the third review: each exercise shows its
  weight × reps history with an estimated one-rep best (Epley formula), the Week planner takes
  hours in one tap, Log activity shows pace as you type, Add food offers "Same dinner as
  yesterday" while that meal is empty, Home has "Same As Last Time", an exercise can set its own
  rest, and Custom profiles get goal ideas from the sports they picked. From the fourth: Add food asks "Which meal
  is this?" first, adult profiles get weight goal ideas at the CDC's steady 1 to 2 lb a week (cited
  on screen), and swimming has gentler goal ideas.
- *2.8.1:* changes picked in the first phone review. Setup has a "Pick a look" step for the skin,
  one page color throughout, a "24 / 24" counter on the name, 7 training days a week, and the
  Soccer pack off for Strength profiles. The center button is "Quick add". "Hold to finish" sits
  under Finish instead of popping up. Edit session can add a round or an exercise. New exercise
  uses the move picker's seven groups, and Dumbbell math shows only for dumbbell exercises. Goal
  ideas fit the profile type, and the goal editor uses the skin's words. Fueling ratios read per lb
  for pound users. Settings lists the same 15 time zones as setup. A practice-log profile's power
  level counts against at least 3 sessions, a rest day fills Ki once it's marked, the keyboard-mic
  hint shows only on touch screens, and Android's Back closes the open sheet first.
- *2.8.0:* skins. Each profile picks a skin in Settings: Dragon Ball, Encore (an original pop-tour
  look: Spotlight, Tour, rain checks, Take the stage, bead-bracelet avatars, a mic buddy in setup and
  the Pastel tour theme) or Plain. Features are the same in every skin. Search finds exactly what
  you typed and only offers a spelling fix ("Did you mean banana?"); it never swaps the word. The
  food list has 125,000 foods (the hand-picked brands plus the 1,700 biggest US brands in USDA's
  data, sports fuel included) and 465 items from 18 restaurant chains, each credited to the chain's
  own nutrition page and date. 60 gym moves with drawings (machines, cables, cardio machines, sled,
  ropes), and setup asks about every kind of gear, with Full gym. 30 more supplements, St. John's
  wort interaction text from NIH's NCCIH, and about 150 common medicines recognized. Workouts show
  a weight row under the rep counter; Edit session has weight boxes. Log activity adds Rowing,
  Gymnastics, Lifting, distance and a name for Other sport. A logged food can move to another meal
  or day, and Remove has Undo. Fixes: the Nutrition day no longer carries over between profiles,
  the custom exercise editor no longer breaks after a blank stage, fuel counts the minutes actually
  trained, Quick add and labels refuse impossible numbers, fast water taps all count, a quick second
  tap no longer lands under a closed sheet, and switching profiles opens on Home.
- *2.7.0:* the Ki gauge is an aura orb (an ember at 0%, aura rings fill to 100%, rays at 100%).
  Library rows show each exercise's drawing (or muscle map); tap one for how-to with Edit inside.
  History marks training days as Dragon Balls, rest days as rings. Nutrition's calorie panel holds
  + Food, + Water and Scan. Theme is the one color choice; the accent lives under Customize this
  theme. Setup's guide is a star ball buddy instead of Capsule.
- *2.6.0:* Home is one panel and the rest rows. Only the workout keeps its panel, with Enter the
  chamber inside (gravity moved behind Change gravity); coach, circuit, other training and fuel are
  one-line rows that open in place. One Ki gauge replaces the strip: a ring for training and
  protein today, with training, protein, water, streak and power level (to Saga) on tap. On
  desktop, Today is the panel and rows beside a scouter column with the gauge open. Fighters are
  kanji emblems, and picking one no longer changes the app's colors; the theme does.
- *2.5.0 (includes 2.4):* simpler screens. Home opens on Today (the workout and what's timed for
  today) with a one-line strip for the streak and power level; a Stats switch holds the week, trend,
  Senzu map, recap and hard sets; the game cards (Dragon Balls, wish, saga, duel, Scouter) moved to
  one Saga screen opened from the strip. Nutrition starts with one calorie ring; tap it for protein
  and nutrients. No emoji in the interface, plainer wording, source notes folded behind one
  "Sources" link per card, and the quick-action hint shows once and fades. Also: a body map on Stats
  (Recovery: muscles colored by days since trained; This week: sets per muscle), mini muscle maps on
  circuit cards without a drawing, supplement stacks (save today's supplements, log them with one
  tap), and a stronger interaction check (below).
- *2.4.0:* real exercise drawings and a muscle map. 34 exercises show Everkinetic's start and
  finish drawings (CC BY-SA 4.0), each pair checked by eye against Goku's steps, with a note when the
  drawing uses different equipment; the rest keep Goku's own figures. Every exercise's "?" shows a
  front and back muscle map (OpenStax, T. Kebert and umimeto.org, CC BY-SA 4.0) with the main muscles
  in red and the supporting ones lighter. Credits are in each "?" and in img/CREDITS.md.
  Supplements got their own Nutrition card: a forgiving search of 47 supplements, then how many
  and the dose from the label (Goku never suggests a dose). An interaction check compares the last
  30 days of supplements with medicines you list, using NIH Office of Dietary Supplements fact
  sheets quoted word for word (see "Supplement interactions" below).
- *2.3.0:* Train by feel (pick how much ki you have and the coach suggests a gravity, or choose any
  level); a radial Ki menu behind the center button (log food, water, activity or a rest day from
  anywhere) with short center labels; the workout first on Home with a compact Scouter; Fuel now, a
  prompt timed to a practice start time you set in Week (carbohydrate 1–4 hours before, protein
  within 2 hours after) with one-tap logging of everyday foods; a streak-at-risk banner from 6 PM
  when nothing is logged yet; fanned circuit cards with the exercise drawings and a "?" for each; a
  month training calendar in History (trained, rest, logged, records or skill stages, Senzu saves);
  poster bosses whose HP drops on their own when linked to an exercise or skill; a full-screen Arc
  cleared moment; and giant-number setup for training days and meals.
- *2.2.0:* an icon tab bar with a big center action (Train, Check in, or the screen's own action)
  and More for the rest; a week strip with one day editor; the Scouter, a green scouter gauge with a
  power level (0 to 9,000: training days, fuel days and recovery over the last 7 days), clearly
  labeled as a game score and not a health measure; the Saga map, 4-week arcs each with a boss goal
  the person sets; Home grouped into Today, This week and Saga; full-color setup steps with a guide character,
  an original mascot (no Dragon Ball characters or art); aura stages from the streak (gold at 7 days,
  blue at 30); Shenron's wish once all seven Dragon Balls are gathered (the Eternal Dragon theme, an
  eternal aura, or a title); and the Kamehameha finish: hold Finish to charge it before a workout
  ends (keyboards finish straight away). Dark mode shadows now use the theme color.
- *2.1.0:* forgiving search for foods and exercises (`js/fuzzy.js`: spelling fixes such as
  "bananna" → banana, plurals, shorthand such as pb, oats, pushup and abs, and word suggestions as
  you type, each checked to lead to a real result); 160 everyday foods with friendly names listed
  first (`tools/everyday-foods.txt` → `tools/build-everyday.py` → `data/everyday.json`, each one
  pointing at one USDA food); tidier brand names and servings; empty meals fold away; the food list
  loads quietly after start; Ki charge bars for calories and protein (the protein one bursts at the
  goal; animations follow Reduce Motion); water shown as glasses (8 oz or 250 ml each, a picture of
  what's logged, not a target); weekly calories and water in the Arc recap; the avatar's aura glows
  on days the protein goal is reached; coach tips as speech bubbles; the workout screen in the panel
  look with a "How to do" link for the current exercise.
- *Manga panel look* (2.0.0): every screen restyled from the Dribbble study: ink outlines and hard
  offset shadows (light ink in dark mode), bold section titles in full-strength text instead of
  small grey capitals, regular-font numbers, color-coded macro tiles (protein, carbs, fat, fiber).
  All six themes keep their colors. Nutrition has one Add food button (the meal is picked in the
  sheet), Scan a barcode on its own row with a barcode picture, up and down arrows for the amount,
  and a centered How you feel section. Popup buttons stay inside the screen.
- *Nutrition* (1.9.0): a food log in the style of the big calorie-counting apps, fully offline.
  - 32,906 foods: 13,224 generic and as-eaten foods (USDA SR Legacy 2018 and FNDDS survey foods 2024)
    and 19,682 brand items from 273 well-known US brands (USDA Branded Foods, October 2026, label data
    from the makers). Built by `tools/build-foods.py` from the public-domain USDA FoodData Central
    downloads; the brand list is `tools/food-brands.txt`.
  - Breakfast, lunch, dinner and snacks; calories, protein, carbs, fat and fiber with a calorie split;
    all 8 nutrients per day; water. An optional calorie target the person sets (Goku never picks one).
  - Search ranked for plain foods first, serving sizes from USDA portions or the label, Recent foods,
    My foods, saved meals, Quick add, and Add from a label (saved to My foods, with an optional barcode).
  - Barcode scanning with the camera (ZXing 0.23.0, Apache-2.0, `vendor/zxing.min.js` with its license),
    or typing the numbers. Frames are read live; nothing is recorded.
  - The old Gut tab is folded in: optional symptom check-ins (bloating, heartburn, cramps, gas, nausea,
    low energy, waist if wanted, supplements) and the pattern finder, which now uses logged foods.
  - The Capsule pantry's foods moved to My foods; old quick protein taps still count toward the day.
- *One protein number:* your own target if you set one, otherwise the bottom of the coach range,
  with the range shown beside it.
- *Streak with Senzu beans:* any logged day counts. Rest days count too, up to the days your plan
  leaves free each week (7 minus your weekly goal; your schedule's rest days; 2 with no plan), so a
  streak can't run on rest alone. Every 7 days in a row earns a bean (up to 3), and a missed day
  spends one instead of ending the streak.
- *Training trend* (1.5.0): the last 8 weeks as bars, with a dashed line for the average of the 4
  weeks before this one. Gymnastics counts load (minutes × effort, the session-RPE method: Foster C,
  et al. J Strength Cond Res. 2001;15(1):109–115); strength counts training minutes, because circuits
  don't ask for an effort score. Trend only: no zones and no injury-risk score, because the science
  behind those numbers is disputed.
- *Skill tree* (gymnastics, 1.5.0): a Skills tab where each skill climbs Learning → With spot → Solo →
  Competition-ready, grouped by event, with the date of each move. Competition-ready asks for the
  coach's OK first.
- *Fuel timing* (1.5.0): on training days, protein every 3–4 hours and within 2 hours after training
  (0.25–0.40 g/kg a dose), carbohydrate during sessions over an hour (30–60 g an hour), and fast
  refuelling when training again within 4 hours (1.2 g/kg an hour). Caffeine is left out on purpose.
- *Dragon Ball milestones* (1.5.0): seven orbs for real achievements (first session or check-in, 7 and
  30 days in a row, a first record or skill moved up, a goal week, 25 sessions or a competition-ready
  skill, 100 days logged). Worked out from the log; History shows all seven, Home celebrates new ones.
- *Exercise library* (1.8.0): 120 exercises (push, pull, legs, core, jumps, cardio, mobility,
  gymnastics basics) with a search box, Group and Equipment drop-downs, and a **?** button that opens
  two drawings (start and finish), numbered steps written for beginners, and one tip. The drawings
  and text are original to Goku. Photos from free-exercise-db were considered and rejected: its text
  matches Bodybuilding.com's pages word for word (typos included), so its photos can't be assumed
  free to use. Adding an exercise sets its drop chain (for example push-up → incline → knee).
- *Custom profile* (1.7.0): besides the two presets, setup offers Custom. It asks which sports you do
  and whether you like guided workouts, logging your practices, or both, then builds the profile on
  the matching engine (guided or both: circuits plus other training; practices: readiness, week plan
  and load) with features switched on to fit, and names sessions after your sports.
- *Centered layout* (1.7.0): titles, headers, section labels, option buttons and choice cards are
  centered; lists and paragraphs stay left-aligned for easier reading.
- *Edit Home* (1.6.0): Settings → Arrange Home cards reorders or hides each profile's Home cards.
  The main card (Gravity chamber or Readiness) and the Care check always show.
- *Gut pattern finder* (1.6.0): after 14 days with a bloating score, including 3 days of 6 or more,
  Nutrition lists foods and supplements that show up more often on those high-bloating days, with
  the counts (only items on 3 or more high days, and at least 20 points more often than on other days).
  Worded as a pattern, never a cause. The 6-out-of-10 line and the 20-point gap are Goku's choices.
- *Flexibility in the skill tree* (1.6.0): splits, bridge and similar goals climb Working on it →
  Close → Full → Held with control, with no coach check and no competition-ready orb.
- *Duels* (1.6.0): profiles on the same phone that each turn Duels on in Settings see training days
  this week (days with a session or other training) side by side, and last week's winner. Off until
  chosen; importing a backup turns it off again.
- *Trend pace mark and contrast* (1.6.0): this week's bar shows where an average week would be by
  today. In light mode, rings, bars and selection outlines use a darker accent shade that reaches
  3:1 contrast on the cards.
- *Arc recap:* the first visit each week shows last week's numbers and one focus for the week ahead.
- *Why?* buttons next to fuel ranges, readiness, the weekly goal, the streak and level-up explain
  the math with your own numbers.
- *Scouter link:* an Apple Shortcut exports sleep and workouts from the Health app to a text file;
  Settings → Import from Health reads it (Settings shows the steps). Importing the same file twice
  adds nothing. **The shortcut recipe hasn't been run on a real iPhone yet.**

**Avatars.** Pick a fighter (an original inked emblem in a Dragon Ball character's colors with a
kanji that fits them, labeled with their name; no official artwork is included; a fighter is only
the avatar, the theme sets the colors), a power-up aura around your own initial,
or a photo from your phone (resized to 192 px, kept on the phone and in backups only).

Before relying on it for workouts, run **Settings → Test my phone**. It checks saving, offline use,
the share sheet and keep-awake automatically, then walks through a test beep and a
60-second hands-off test of the screen staying on and the rest beep playing.

Live at: https://croftrobertl.github.io/goku/

---

## Install on iPhone (5 steps)

1. Open **Safari** and go to **croftrobertl.github.io/goku**.
2. Tap **Share**. It's in Safari's toolbar, or inside the **☰** or **•••** menu.
3. Tap **View More** if you see it, then **Add to Home Screen**, then **Add**.
4. Open **Goku from the Home Screen**, not from Safari. Data saved in a Safari tab is kept
   separately from the Home Screen app.
5. Pick your training type, enter your name, choose a color and modules, then set a passcode.

Each person can install it on their own phone. To share one phone, use **Add a profile** in Settings.

---

## Backups: what's stored where

| What | Where | Leaves the phone? |
|---|---|---|
| Profiles, sessions, check-ins, food log | IndexedDB database `goku`, on this device | Only when you export it |
| Passcodes | Salted PBKDF2 hash (150,000 rounds) inside the profile | Never; exports leave it out |
| App files (HTML, JS, CSS, icons) | Service-worker cache `goku-app-<version>` | Downloaded from GitHub Pages |

The app asks the browser to protect its storage from automatic clearing. Settings → About shows
whether that was granted. iOS can still remove data if the app is deleted from the Home Screen,
so **back up regularly**. A badge appears in the header when the last backup is 7 or more days old.

**Back up:** Settings → **Export backup** prepares the file, then **Save or share** opens the share
sheet → **Save to Files** → iCloud Drive. Each export covers only the profile that's open. The
"last backup" date only changes when the share sheet reports a save, or when you choose Download.

**Encrypted backup (optional):** Settings → **Export encrypted backup**. You choose a passphrase
(8+ characters) and the file is encrypted with AES-256-GCM, using a key derived with PBKDF2-SHA256
at 310,000 rounds. **If the passphrase is forgotten, that backup can never be opened.**

**Restore:** Settings → **Import a backup** → choose the file. A preview shows what's inside.
Every field is checked and cleaned first; damaged entries are skipped and counted in the preview.
- A backup of **the open profile** can be merged or replaced:
  - **Merge** keeps everything on the phone and adds or updates entries from the file. When both
    have the same entry, the newer copy wins.
  - **Replace** swaps the profile's entries for the file's in a single all-or-nothing step: if
    anything fails, nothing on the phone changes.
- A backup of **another profile on this phone** is refused. Open that profile (with its passcode) and
  import it there, so no profile can overwrite another.
- A backup of a profile that **isn't on the phone** is added as a new profile, and you set its passcode.

**Forgotten passcode:** another profile on the same phone opens Settings → *Reset passcode*.
The data is kept. The owner sets a new passcode the next time the profile opens and is told when,
and from which profile, it was reset. With only one profile on the phone, restore from a backup instead.

**Delete a profile:** Settings → *Delete this profile*. It offers an export first, asks for that
profile's passcode, then erases the profile and all its entries.

**App switcher:** iOS takes the app-switcher picture before Goku hears it's being hidden, so the
switcher can show the last screen you were on. The passcode still applies when the app is opened.
To keep a screen private, tap **Lock now** in Settings before leaving the app.

---

## Reminders with Shortcuts

Web apps can't send notifications without a server, so reminders in the app are banners.
For a real nudge at a set time:

1. Open the **Shortcuts** app → **Automation** → **+** → **Time of Day**.
2. Pick the time and **Daily**, then choose **Run Immediately**.
3. Add the action **Show Notification** with text such as "Check in on Goku".
4. Tap **Done**.

Avoid an "Open URL" action. It would open Goku in a Safari tab, which has separate storage, rather
than the Home Screen app.

---

## Updating the app

1. Make the change. Any new file the app loads must be added to `FILES` in `sw.js`.
2. Run `tools/release.sh 1.2.0` (the new version). It sets the version in `sw.js` and
   `js/version.js` together, then checks that every offline file exists, every app file is in the
   offline list, and every script parses. Don't publish if it reports a problem.
3. Commit and push to `main`. GitHub Pages publishes within a minute or two. The offline worker
   downloads each file with `?v=<version>`, so GitHub's 10-minute cache can't mix old and new files.
4. The next time the app is opened, a bar says **"A new version of Goku is ready"** with *Later* and
   *Update*. It never reloads on its own and stays hidden during a workout.

---

## Export format (schemaVersion 1)

A stable JSON format, so a future native app could import the full history.

```json
{
  "app": "goku",
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-10-28T19:15:43.005Z",
  "profile": {
    "id": "uuid", "kind": "engine | perf", "name": "string", "accent": "#5ea4ff",
    "units": "imperial | metric", "tz": "America/New_York", "dayEndsAt": 3,
    "createdAt": "ISO-8601", "updatedAt": "ISO-8601", "lastBackupAt": "ISO-8601 | null",
    "modules": { "<module>": true },
    "settings": { "...kind-specific..." },
    "lockRemember": 7
  },
  "entries": [
    { "id": "string", "type": "session | gut | exercise | checkin | activity | rest | sleep", "day": "YYYY-MM-DD",
      "time": "ISO-8601", "updatedAt": "ISO-8601", "data": { "...by type..." } }
  ]
}
```

- `day` is the training day in the profile's time zone (US/Eastern for profiles made before 1.3). Entries before `dayEndsAt` (default 3 AM) count toward
  the previous day.
- Any field ending in `At` is an ISO-8601 timestamp.
- Units are imperial: pounds for load, inches for waist and height, fluid ounces for drinks.

| `type` | `data` fields |
|---|---|
| `exercise` | `name`, `slot` (push/pull/legs/core/power/joints), `module`, `order`, `stages[]` of `{label, load}` (hardest first) |
| `session` (strength) | `gravity`, `startedAt`, `endedAt`, `sets[]` of `{exId, name, slot, round, stages[] of {label, load, reps}}`, `repTimes[]` (seconds from start for each rep; drives the ghost) |
| `gut` | `amWaist`, `pmWaist`, `bloat` (0–10), `foods[]`, `fluidsOz`, `supplements[]`, `protein[]` (grams per addition) |
| `activity` | `kind` (soccer/run/bike/swim/hike/sport/lift/other), `minutes`, `effort` (0–10), `source` (`health` if imported) |
| `rest` | none: a planned rest day |
| `skill` | `name`, `event` (vault/floor/beam/bars/other), `stage` (0 Learning – 3 Competition-ready), `log[]` of `{stage, day}` |
| `sleep` | `hours`, `source` (`health`) |
| `checkin` | `sleepH`, `sleepQ`, `fatigue`, `stress`, `mood`, `fun` (each 1–5), `sore[]` (areas), `archPain`, `techPain`, `dizzy` |
| `session` (gymnastics) | `kind` (gym/vault), `minutes`, `effort` (0–10). Load = minutes × effort |

Encrypted exports wrap this object: `{ app, encrypted: true, cipher, kdf, iterations, salt, iv, data }`
(all base64).

---

## Fuel ranges and their sources

Shown on Home when a weight is saved, with the sources as footnotes.
- **Protein:** 1.4–2.0 g per kg a day; about 0.25 g per kg per meal. Jäger R, et al. ISSN Position
  Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20 (checked against the open-access text).
- **Carbohydrate:** 3–5 g/kg (light or skill work), 5–7 (about an hour), 6–10 (1–3 hours), 8–12 (4–5+
  hours). Thomas DT, Erdman KA, Burke LM. Nutrition and Athletic Performance. Med Sci Sports Exerc.
  2016;48(3):543–568. **These tiers were checked against several published reproductions of the
  statement's table; the original is paywalled and wasn't read directly.** Which tier a day falls in
  (under 45 min, under 90, under 4 h, 4 h or more) is Goku's mapping of the statement's wording.
- **Before practice (Fuel now):** 1–4 g of carbohydrate per kg in the 1–4 hours before exercise.
  Thomas, Erdman & Burke 2016 (above). **Checked only against published reproductions, not the
  paywalled original.** Goku's reading is about 1 g per kg for each hour before the start (3 hours
  out: about 3 g per kg). Under an hour out, it only suggests water.
- **Fuel timing:** Kerksick CM, et al. International Society of Sports Nutrition position stand:
  nutrient timing. J Int Soc Sports Nutr. 2017;14:33 (checked against the open-access text).
- Under 18, the card says the ranges come from adult studies and should be confirmed by a
  pediatrician or sports dietitian.
- Sleep notes: AASM pediatric consensus (2016) 8–10 h for ages 13–18; AASM/SRS adult consensus (2015)
  7 or more hours.

## Supplement interactions

- **Source (2.5):** the plain-language "Does X interact with medications or other dietary supplements?"
  sections of 31 NIH Office of Dietary Supplements consumer fact sheets (copied 2026-10-29,
  checksum-locked in `tools/build-interactions.py`). Black cohosh, valerian and ashwagandha have no
  consumer section, so they keep the health professional text from 2.4 (32 sheets, plus one
  paragraph from the Ashwagandha sheet). ODS's site policy says most of its information is public domain and
  may be reproduced unchanged. The text was copied on 2026-10-29 and checked against the live pages
  by checksum; `tools/build-interactions.py` refuses to build if a word changes.
- **What Goku adds:** a label for the three sections that have no NIH heading (shown as "heading
  added by Goku"), and the medicine names each section matches on: the names NIH writes, plus
  common members of the drug classes it names (for example lisinopril for "ACE inhibitors").
- **What the check does:** medicines you list against supplements logged in the last 30 days, plus
  any you type in as "thinking of starting"; supplements against each other where NIH says so
  (iron and calcium, magnesium and zinc, valerian and melatonin); NIH's own spacing sentence shown
  first when a paragraph has one; and a plain "Goku doesn't recognize X" for a medicine it can't
  match. Common US brand names are matched too (Eliquis, Crestor, Protonix, Ozempic and others).
- **Limits, said in the app:** it only knows the medicines NIH names; it can miss other names for a
  medicine; no match is never shown as "safe"; and it tells people to ask a pharmacist or doctor.
  Medicines are saved on the phone and in backups. No NIH text exists in Goku for creatine, protein powder, melatonin
  and the other supplements without a fact sheet section, and the app says so.

## Readiness score

Out of 100: sleep hours 30 (full marks at 9 h under 18, the middle of the AASM's 8–10 h for ages
13–18, and at 7 h for adults, per the AASM/SRS "7 or more"), sleep quality 10, low tiredness 15, low stress 10,
mood 10, fun 10, and no soreness 15 (minus 5 per sore area). It's a conversation starter, not a
verdict. Low scores suggest talking to a coach and never say "skip training".

---

## Health red flags — TO BE REVIEWED BY THE ATHLETE'S DOCTOR

These flags route to a parent, coach or doctor and never to self-treatment.
**This list is a draft for a doctor to review and change.**

Each person chooses their own guardrails. "Red flags and care checks" is on by default for the
gymnastics profile; turning it off hides both the health questions and the reminders.

Built in:
- Wrists sore in each of the last 3 check-ins, all within 7 days (a skipped day doesn't reset it).
- **Draft, needs sign-off:** the same rule for every other area on the body map (neck, shoulders,
  elbows, upper and lower back, hips, knees, ankles, feet).
- Back pain when arching.
- Pain that changes how a skill is done.
- Dizziness or feeling faint.

Proposed for M2 (each needs doctor sign-off first):
- Pain at night or at rest, swelling, numbness or tingling.
- Frequent illness or injury, ongoing tiredness, or mood dips: possible signs of under-fueling (low
  energy availability, REDs).
- Missed or irregular periods, only if she chooses to track them.
- Any headache, confusion or vision change after a fall or a hit to the head: same-day medical care.

The gymnastics profile has no weight-loss goals, calorie deficits, body-weight trends, or "good vs. bad"
food labels. Fueling is framed only as enough energy to train, grow and recover.

---

## Testing status (1.6.0)

**1.6.0 in the Mac browser at phone width** (light and dark): Edit Home (move, hide, locked cards,
order kept), five tabs with Check-in opened from Home, Duels alone and with two profiles, gut
pattern finder with 20 scored days, a flexibility goal moving up with no coach check, the darker
light-mode ring, the folded fuel-timing card. **Not yet on the iOS simulator or a real iPhone,
including the tab labels at the largest text sizes.**

### 1.5.0

**1.5.0 in the Mac browser at phone width** (light and dark): 8-week trend for both profiles with
8 weeks of data, Why on the trend, skill tree (add with quick picks, move up, the competition-ready
check, stage history), six tabs on one line, Dragon Ball celebration card and History list for both
profiles, fuel timing with and without a saved weight. **Not yet on the iOS simulator or a real iPhone.**

**Mac browser** (Chromium engine) at 320 px, phone and desktop widths, in light and dark mode:
upgrading from 1.0.2 with existing data; onboarding with Cancel; passcodes (create, change with Cancel,
wrong tries, wait, remember-for, relock without losing unsaved input, a single lock screen, reset by
another profile with notice, verify before delete); one workout per tap, double-tap protection, rest
that stray taps can't skip, undo across reps, drops, sets and rests, an abandoned workout saved at its
last rep; backdated gut log and edited sessions; export sheet; import refusing another profile's
backup, cleaning damaged entries, and an all-or-nothing Replace rolled back after a forced failure;
red-flag rule across a skipped day and the care toggle; text contrast ≥ 4.5:1 in both modes
(including a yellow accent); text scaling; desktop sidebar; and full offline use.

**iPhone 17 simulator, iOS 27.0** (no iOS 26 simulator was available; phones on iOS 26 may differ):
- Works: Add to Home Screen with the orb icon and cover image; full-screen launch; Safari tab and
  Home Screen app keep separate data; both profile types set up; fast taps on the rep counter,
  keypad, steppers and body map (6 quick reps counted 6, no zoom); scrolling that starts on a button;
  safe areas around the Dynamic Island and home indicator; Dynamic Type at the largest standard size;
  passcode relock after 2 minutes away with "Always ask"; export through the share sheet to Files
  (one file); import with Merge, including a 1.1.0 backup; the update bar and Update.
- Doesn't work: the app-switcher picture still shows the last screen (see *App switcher* above).
- 1.2.0 on the simulator: themes in light and dark, the Dragon Radar week, and the automatic part
  of Test my phone (all six checks pass, including keep-awake support).
- Not testable in the simulator: whether the screen really stays on, and audio after the screen
  locks. **Settings → Test my phone** checks both on a real iPhone. (The rep buzz was removed in
  1.7.0: on a real iPhone the test showed web apps can't trigger it.)
- 1.3.0: full setup in metric and US units (82 kg saved as 180.8 lb; protein 115–164 g, 21 g a meal
  checked by hand), allergy and diet filtering, equipment-based library, coach follow-ups capped at
  two a day, older profiles offered setup with data kept, and the avatar picker and photo avatar
  from the iPhone photo library on the simulator.
- 1.4.0 in the browser: activity logging into fuel (110 min → high tier, 82 kg × 6 = 492 g), Senzu
  map, Why explanations, streak, level-up after three rising sessions, weekly recap, records,
  pantry logging, the 10-screen setup, and the Health file parser (sleep segments summed per night,
  workouts mapped, repeat imports ignored).
- Each release also gets an independent code review; 1.2.0's found five issues and 1.3.0's found
  nine, all fixed.

---

## Files

```
index.html             app page (strict Content-Security-Policy: no external requests)
manifest.webmanifest   install metadata
sw.js                  offline cache and update flow
css/app.css            one design system, dark and light
js/app.js              boot, routing, profile switching, update banner
js/db.js               IndexedDB wrapper and schema migrations
js/state.js            profiles, modules, entries
js/lock.js             passcode lock screen
js/onboarding.js       first-launch setup
js/engine.js           strength and conditioning profile
js/perf.js             gymnastics and vaulting profile
js/settings.js         settings, export and import
js/validate.js         checks and cleans imported backups
tools/release.sh       bumps the version and checks a release before publishing
tools/check-themes.mjs fails the release if any theme color is below 4.5:1 contrast
js/themes.js           the six themes (light and dark palettes)
js/devcheck.js         Settings → Test my phone
js/coach.js            coach questions, setup and daily follow-ups
js/fuel.js             protein and carbohydrate ranges with sources
js/avatar.js           fighter emblems, auras and photo avatars
js/units.js            US and metric units
js/activity.js         other training log
js/insights.js         streak, recovery map, records, progression, recap numbers
js/homecards.js        streak and weekly recap cards
js/why.js              "Why?" explanations
js/trend.js            8-week training trend
js/skills.js           gymnastics skill tree
js/milestones.js       Dragon Ball milestones
js/homelayout.js       Edit Home: card order and hiding
js/duel.js             Duels between profiles
js/figure.js           original exercise drawings (side-view figure from joint angles)
js/moves.js            the 120-exercise catalog: steps, tips, drop chains
js/movepicker.js       Library search, ? popups, adding exercises
js/foods.js            the offline food list: loading, search, servings
js/fuzzy.js            spelling fixes, synonyms and suggestions for food and exercise search
js/scouter.js          the Scouter gauge and power level
js/skins.js            skins: Dragon Ball, Encore and Plain words, avatars, mascot and card style
js/saga.js             the Saga map: arcs, poster bosses and the Arc cleared screen
js/calendar.js         the History training calendar
js/muscles.js          muscles each exercise works, the muscle map, and which drawing goes with which exercise
js/supplements.js      the supplement list, dose and amount, and the interaction check
data/interactions.json NIH interaction text (tools/build-interactions.py)
img/                   exercise drawings and the muscle map (credits in img/CREDITS.md)
data/everyday.json     160 everyday foods (built by tools/build-everyday.py)
js/nutrition.js        the Nutrition tab, adding foods, meals, labels, symptoms
js/scan.js             barcode scanner
data/foods.json        124,697 foods (built by tools/build-foods.py)
data/restaurants.json  465 restaurant items from 18 chains (tools/build-restaurants.py, tools/src/restaurants.json)
vendor/zxing.min.js    ZXing barcode reader (Apache-2.0, see ZXING-LICENSE.txt)
tools/figures.html     dev page: every exercise's two drawings (open at 127.0.0.1)
js/health.js           Scouter link: Health file import
js/perf-score.js       readiness score and sleep target
js/crypto.js           passcode hashing and encrypted exports
js/time.js             day logic in each profile's time zone
```
