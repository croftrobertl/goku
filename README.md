# Goku

An offline training tracker that installs from Safari to the iPhone Home Screen.
There are no accounts, no servers, no analytics and no network requests while you use it.
Everything you enter stays on the device it was entered on.

- **Strength and conditioning profile:** gravity-chamber density circuits with drop-set chains, a
  whole-screen rep counter, ghost races against your last session, and a gut and bloating log.
- **Gymnastics and vaulting profile:** daily readiness check-in, week planner, session load
  (minutes × effort), and care checks that point to a parent, coach or doctor.

Each profile has its own 6-digit passcode. Profile names and every other personal value are
typed in on first launch; none of them are in this code.

Live at: https://croftrobertl.github.io/goku/

---

## Install on iPhone (5 steps)

1. Open **Safari** and go to **croftrobertl.github.io/goku**.
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.
4. Open **Goku from the Home Screen**, not from Safari. Data saved in a Safari tab is kept
   separately from the Home Screen app *(verify)*.
5. Pick your training type, enter your name, choose a color and modules, then set a passcode.

Each person can install it on their own phone. To share one phone, use **Add a profile** in Settings.

---

## Backups: what's stored where

| What | Where | Leaves the phone? |
|---|---|---|
| Profiles, sessions, check-ins, gut log | IndexedDB database `goku`, on this device | Only when you export it |
| Passcodes | Salted PBKDF2 hash (150,000 rounds) inside the profile | Never; exports leave it out |
| App files (HTML, JS, CSS, icons) | Service-worker cache `goku-app-<version>` | Downloaded from GitHub Pages |

The app asks the browser to protect its storage from automatic clearing. Settings → About shows
whether that was granted. iOS can still remove data if the app is deleted from the Home Screen,
so **back up regularly**. A badge appears in the header when the last backup is 7 or more days old.

**Back up:** Settings → **Export backup** opens the share sheet → **Save to Files** → iCloud Drive.
Each export covers only the profile that's open.

**Encrypted backup (optional):** Settings → **Export encrypted backup**. You choose a passphrase
(8+ characters) and the file is encrypted with AES-256-GCM, using a key derived with PBKDF2-SHA256
at 310,000 rounds. **If the passphrase is forgotten, that backup can never be opened.**

**Restore:** Settings → **Import a backup** → choose the file. A preview shows what's inside.
- **Merge** keeps everything on the phone and adds or updates entries from the file. When both
  have the same entry, the newer copy wins.
- **Replace** deletes that profile's entries on the phone, then loads the file's.
- A backup of a profile that isn't on the phone is added as a new profile, and you set its passcode.

**Forgotten passcode:** another profile on the same phone opens Settings → *Reset passcode*.
The data is kept, and the owner sets a new passcode the next time the profile opens.
With only one profile on the phone, restore from a backup instead.

---

## Reminders with Shortcuts

Web apps can't send notifications without a server, so reminders in the app are banners.
For a real nudge at a set time:

1. Open the **Shortcuts** app → **Automation** → **+** → **Time of Day**.
2. Pick the time and **Daily**, then choose **Run Immediately**.
3. Add the action **Show Notification** with text such as "Check in on Goku".
4. Tap **Done**.

Avoid an "Open URL" action. It would open Goku in a Safari tab, which has separate storage, rather
than the Home Screen app *(verify)*.

---

## Updating the app

1. Make the change.
2. Bump **both** `CACHE_VERSION` in `sw.js` and `VERSION` in `js/version.js` to the same new value.
3. Commit and push to `main`. GitHub Pages publishes within a minute or two.
4. The next time the app is opened, it shows **"New version available · tap to update."** It never
   reloads on its own, and it waits until a workout is finished.

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
    "units": "imperial", "dayEndsAt": 3,
    "createdAt": "ISO-8601", "updatedAt": "ISO-8601", "lastBackupAt": "ISO-8601 | null",
    "modules": { "<module>": true },
    "settings": { "...kind-specific..." },
    "lockRemember": 7
  },
  "entries": [
    { "id": "string", "type": "session | gut | exercise | checkin", "day": "YYYY-MM-DD",
      "time": "ISO-8601", "updatedAt": "ISO-8601", "data": { "...by type..." } }
  ]
}
```

- `day` is the training day in US/Eastern. Entries before `dayEndsAt` (default 3 AM) count toward
  the previous day.
- Any field ending in `At` is an ISO-8601 timestamp.
- Units are imperial: pounds for load, inches for waist and height, fluid ounces for drinks.

| `type` | `data` fields |
|---|---|
| `exercise` | `name`, `slot` (push/pull/legs/core/power/joints), `module`, `stages[]` of `{label, load}` (hardest first) |
| `session` (strength) | `gravity`, `startedAt`, `endedAt`, `sets[]` of `{exId, name, slot, round, stages[] of {label, load, reps}}`, `repTimes[]` (seconds from start for each rep; drives the ghost) |
| `gut` | `amWaist`, `pmWaist`, `bloat` (0–10), `foods[]`, `fluidsOz`, `supplements[]`, `protein[]` (grams per addition) |
| `checkin` | `sleepH`, `sleepQ`, `fatigue`, `stress`, `mood`, `fun` (each 1–5), `sore[]` (areas), `archPain`, `techPain`, `dizzy` |
| `session` (gymnastics) | `kind` (gym/vault), `minutes`, `effort` (0–10). Load = minutes × effort |

Encrypted exports wrap this object: `{ app, encrypted: true, cipher, kdf, iterations, salt, iv, data }`
(all base64).

---

## Readiness score (M1 formula, reviewed in M2)

Out of 100: sleep hours 30 (full marks at 9 h, the middle of the 8–10 h the American Academy of
Sleep Medicine recommends for ages 13–18), sleep quality 10, low tiredness 15, low stress 10,
mood 10, fun 10, and no soreness 15 (minus 5 per sore area). It's a conversation starter, not a
verdict. Low scores suggest talking to a coach and never say "skip training".

---

## Health red flags — TO BE REVIEWED BY HER DOCTOR

These flags route to a parent, coach or doctor and never to self-treatment.
**This list is a draft for her pediatrician to review and change.**

Built into M1:
- Wrists sore three check-ins in a row.
- Back pain when arching.
- Pain that changes how a skill is done.
- Dizziness or feeling faint.

Proposed for M2 (each needs doctor sign-off first):
- Pain at night or at rest, swelling, numbness or tingling.
- Frequent illness or injury, ongoing tiredness, or mood dips: possible signs of under-fueling (low
  energy availability, REDs).
- Missed or irregular periods, only if she chooses to track them.
- Any headache, confusion or vision change after a fall or a hit to the head: same-day medical care.

The app never shows weight-loss goals, calorie deficits, body-weight trends, or "good vs. bad" food
labels in the gymnastics profile. Fueling is framed only as enough energy to train, grow and recover.

---

## Testing status (M1)

Tested in the Mac browser (Chromium engine) at phone and desktop widths, in light and dark mode:
onboarding, passcodes (create, confirm, wrong tries, 30-second wait, remember-for, relock on reload,
reset by another profile), circuits and gravity levels, rep counter with drop stages, rest timer,
undo, ghost, a workout surviving a reload, gut log, check-in with body map and list, care flags,
session load, week planner, export, encrypted round trip, import (merge, replace, bad file), the
update banner, and full offline use with the server stopped.

**Not yet tested on iOS** (needs the iOS 26 simulator runtime): Home Screen install and separate
storage, Safari share sheet export, Screen Wake Lock, audio cues after screen lock, safe areas,
and Dynamic Type. Items marked *(verify)* above depend on that test.

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
js/crypto.js           passcode hashing and encrypted exports
js/time.js             US/Eastern day logic
```
