# GymRat Native (Ionic + Capacitor)

Native-capable workout tracker scaffold for iOS, Android, and web.

## Stack

- Ionic React (UI + responsive layouts)
- Capacitor (native runtime bridge)
- TypeScript + Vite
- Storage abstraction with pluggable providers
  - `local`: implemented with `@capacitor/preferences`
  - `appwrite`: scaffolded stub
  - `google-sheets`: scaffolded stub

## Current feature bones

- Equipment CRUD
- Exercise CRUD with:
  - Goal/current sets + reps
  - Multi-field intensity (`label:value | label:value`)
  - Tempo
  - Rest
  - Optional video URL
- Program builder with:
  - Days/week
  - Deload frequency
  - Day entries
  - Superset tags
  - Entry-level override fields
- Workout mode:
  - Program/day picker
  - Grouped supersets
  - Quick logging + recent history
- Theme mode selector:
  - `System`, `Light`, `Dark`
  - Persisted with Capacitor Preferences
- Desktop preferences window:
  - Open via gear icon to the left of app title
  - Contains sync provider, theme, import, and export controls

## Run locally

```bash
npm install
npm run dev
```

## Build + native sync

```bash
npm run build
npx cap add ios
npx cap add android
npm run cap:sync
```

Then open native projects:

```bash
npm run cap:ios
npm run cap:android
```

## Storage architecture

Providers live in:

- `src/storage/localProvider.ts`
- `src/storage/appwriteProvider.ts`
- `src/storage/googleSheetsProvider.ts`

Provider selection is exposed in app state (`src/state/AppDataContext.tsx`).
For now, non-local options are intentionally disabled in UI until authentication and API wiring are added.
