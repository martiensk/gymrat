# GymRat

An Android-first workout log built with Expo, React Native, and TypeScript. SQLite is the app's source of truth, so reads and writes work without a connection. Appwrite synchronizes queued changes when connectivity returns or the app enters the foreground.

The app currently includes the Library and Plans slices. Library supports searchable equipment and exercises, repeatable equipment measurements, exercise prescriptions, primary and secondary muscles, live equipment defaults, optional offline PNG/JPEG thumbnails, and exercise details. Plans supports one pinned active plan, a user-ordered inactive list, ordinal days, custom locations, prescription snapshots, supersets, checklists, and accessible drag/reorder controls.

## Start

Requirements: Node.js. Android development additionally needs an emulator or device with Expo Go.

```sh
npm install
cp .env.example .env
npm run android
```

For browser development, run:

```sh
npm run web
```

Expo's development server supplies the cross-origin isolation headers required by SQLite. Production web hosting must provide the headers described in [Web Hosting](#web-hosting).

Keep only one browser tab open for the app during development. SQLite's alpha web backend uses an exclusive OPFS access handle; a second tab can prevent the database from opening.

The app works in local-only mode while the Appwrite variables are empty. Follow [`docs/appwrite.md`](docs/appwrite.md) to enable sync.

## Verify

```sh
npm run lint
npm run typecheck
npx expo-doctor
```

## Offline Model

- UI operations commit to `gymrat.db` first and are marked `pending`.
- Sync pulls documents changed since the last Appwrite cursor, then pushes rows that remain pending.
- Deletes are tombstones, allowing deletion to propagate to other devices.
- Concurrent edits use last-write-wins based on the client-generated `updatedAt` value.
- Failed sync leaves local changes pending and retries on the next connectivity or foreground event.
- Equipment metadata and measurements sync as one aggregate. Equipment PNGs are currently device-local and are not sent to Appwrite Storage.
- Exercise metadata, muscles, and equipment defaults sync as one aggregate. Performance history remains empty until workout execution is implemented.
- Each plan syncs as one ordered aggregate. Superset rest is derived from the highest member rest and is not duplicated in storage.

Anonymous Appwrite sessions keep the scaffold usable without a sign-in screen. Replace anonymous auth before production if users need to recover data after reinstalling or use it across devices.

## Web Hosting

`expo-sqlite` web support is currently alpha and requires a secure context plus these response headers for every page and asset:

```text
Cross-Origin-Embedder-Policy: credentialless
Cross-Origin-Opener-Policy: same-origin
```

Build the static site with `npx expo export --platform web`, then configure those headers in the hosting provider. Browser and native SQLite databases are separate local stores; Appwrite sync is what connects them.
