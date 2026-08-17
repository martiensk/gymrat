# Repository Guide

## Commands

- Install with `npm install`; run Android with `npm run android` or the browser with `npm run web`.
- Verify changes in order with `npm run lint`, `npm run typecheck`, then `npx expo-doctor` for native dependency/config compatibility.
- `npx expo export --platform android` and `npx expo export --platform web` are focused production-bundle checks. Their `dist/` output is generated and ignored.
- No test runner is configured.

## Architecture

- Read `docs/vision.md` before product or architecture changes. It describes long-term direction, not work to implement unless explicitly requested.
- Read `docs/design.md` before UI changes; it defines the visual tokens, interaction sizing, and responsive layout rules.
- Keep `docs/roadmap.md` current. When a roadmap item is fully implemented and verified, strike through that item in the same change; do not mark partial work complete.
- This is a new, unreleased app and never requires legacy compatibility. Do not preserve old schemas, persisted development data, sync payloads, APIs, or behavior unless explicitly requested; update the current design directly and reset development data when needed.
- This is an Expo Router/React Native 0.86 TypeScript app. `app/_layout.tsx` initializes fonts, SQLite, and sync; route screens live under `app/`; `src/data/database.ts` owns migrations; `src/sync/sync.ts` is the only Appwrite synchronization boundary.
- SQLite is the source of truth. UI writes must commit locally and set `sync_status = 'pending'`; never make UI writes depend on network success.
- Sync pulls before pushing so a newer remote `updatedAt` can win. Deletes remain tombstones because hard deletion would not propagate to offline clients.
- Plans are normalized across SQLite tables but sync as one Appwrite document per plan. The active plan is pinned with `sortPosition = -1`; only inactive plans have user-controlled order. Days are ordinal only, and superset rest is derived from the maximum member rest. Preserve deterministic list/active reconciliation in `src/data/plans.ts`.
- Appwrite is optional at runtime: empty IDs in `.env` must leave the app usable in local-only mode. The verified collection schema and permissions are in `docs/appwrite.md`.
- `src/sync/appwrite.ts` uses the React Native Appwrite SDK; Metro substitutes `appwrite.web.ts` for browser bundles. Keep sync behavior in `sync.ts`, not in these platform adapters.
- Equipment and exercise thumbnails are normalized PNG data stored only in local SQLite. Never include `thumbnailDataUri` in Appwrite documents; Storage sync is intentionally deferred.

## Dependency Quirk

- The `expo-file-system` npm override is intentional. `react-native-appwrite@0.34.0` declares version 18, while Expo 57 requires version 57; deduplication is required for native builds and verified by Expo Doctor. Re-check Appwrite upload API compatibility before adding Storage uploads.
- SQLite web uses a WASM worker and requires the COOP/COEP development headers in `metro.config.js`. Production hosting must send the equivalent headers; web support is alpha upstream.
- `src/data/database.ts` keeps its connection on `globalThis` so Fast Refresh does not open a second OPFS access handle. Multiple browser tabs can still conflict; use one app tab while developing.
- Plans use `react-native-reanimated-dnd` with directly declared Gesture Handler/Reanimated/Worklets dependencies. Keep accessible move controls when changing drag behavior, and verify both Android and web.
