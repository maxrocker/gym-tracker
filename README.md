# Gym Tracker

A mobile-first, offline-first Progressive Web App for tracking gym progress — machines, sets,
body weight, and history. No backend, no accounts, no cost. All data lives in your phone's
IndexedDB; the only way data leaves the device is the JSON backup you export yourself.

## Stack

Vite + React + TypeScript, [Dexie.js](https://dexie.org) (IndexedDB) for storage, Recharts for
charts, `vite-plugin-pwa` for the service worker / manifest / installability.

## Local development

```bash
npm install
npm run dev
```

Open the printed `localhost` URL on your phone (same Wi-Fi) or in a desktop browser's device
toolbar to test the mobile layout.

## Historical data import (one-time)

If you have `workout-history.txt` (tab-separated export from iPhone Notes) in the project root:

```bash
node scripts/migrate.js
```

This parses the file and writes `migrated-data.json` in the project root, printing a summary
(machines created, entries, sets, body weight entries, date range, and any cells it couldn't
parse so you can fix them by hand). Then, in the app: **Settings → Import backup** and pick
`migrated-data.json`.

You can re-run the script as many times as you like — it never modifies the source file or your
already-imported app data until you actually choose to import.

Optional arguments: `node scripts/migrate.js <path-to-file> <output-path>`.

## Deploying

The build is a static site — deploy the `dist/` folder anywhere that serves static files.

### Vercel

```bash
npm run build
npx vercel --prod
```

Or connect the repo in the Vercel dashboard with build command `npm run build` and output
directory `dist`. No configuration needed — `vite.config.ts` already uses relative asset paths
(`base: './'`), so it works at a domain root out of the box.

### GitHub Pages

1. `npm run build`
2. Push the contents of `dist/` to a `gh-pages` branch (or use an action like
   `peaceiris/actions-gh-pages`), or run `npx gh-pages -d dist` after `npm install -D gh-pages`.
3. Enable Pages for that branch in the repo settings.

Because `base: './'` is relative, this works whether the site ends up at
`https://<user>.github.io/` (user/org page) or `https://<user>.github.io/<repo>/` (project page)
— no extra `base` configuration needed either way.

## Installing on your phone

**iPhone (Safari):** open the deployed URL → Share button → **Add to Home Screen**.
**Android (Chrome):** open the deployed URL → ⋮ menu → **Install app** (or **Add to Home
screen**).

Once installed it opens full-screen, works offline (the app shell is cached by the service
worker), and re-caches itself automatically when you deploy an update.

## Backup & restore

**This is the only backup mechanism — there is no cloud sync.** Go to **Settings → Export
backup** regularly (e.g. after a few weeks of logging), especially before switching phones or
clearing browser data. The exported `.json` file contains every machine (photos included, as
base64), every logged entry, body weight history, and day notes.

To restore: **Settings → Import backup** and select a previously exported file (or the migration
script's `migrated-data.json`). Importing **replaces all current data** — export a fresh backup
first if you have anything you don't want to lose.

## Previewing with sample data

**Settings → Load sample data** adds a few months of synthetic machines/entries/body-weight
history so you can see the charts populated before you've logged anything real. It's additive —
use **Erase all data** first if you want a clean slate afterwards.

## Data model

- **Machine** — number (optional), name, category (strength / cardio / bodyweight), unit (kg /
  km / freetext), optional photo.
- **WorkoutEntry** — one per machine per day, holding an ordered array of **sets**
  (`{ value, rawText, effort }`), so a single session's multiple sets (e.g. 90 / 90 / 100) are
  tracked individually. `effort` is one of 🥵 (hard) / 😢 (painful) / 🥱 (easy).
- **BodyWeight** — one entry per day (kg), editable.
- **DayNote** — one freeform note per day (e.g. "Schulterschmerzen").

## Project structure

```
src/
  db.ts              Dexie schema + query helpers
  types.ts           Data model
  utils/             date, image resize, backup export/import, sample data, parsing helpers
  components/        shared UI (bottom nav, set editor, entry editor, photo, toast)
  screens/           Today / Machines / Machine detail / Progress / Body weight / Settings
scripts/
  migrate.js         one-time historical data migration (see above)
```
