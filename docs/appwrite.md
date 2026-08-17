# Appwrite Setup

## Project

1. Create an Appwrite project.
2. Add an Android platform with package name `com.gymrat.app`.
3. Add a Web platform with hostname `localhost` for browser development. Register the production hostname before deploying the web build.
4. Create a database and collections named `workouts`, `equipment`, `exercises`, and `plans`.
5. Enable document security on all collections.
6. Give the `users` role create permission at collection level. Document read, update, and delete permissions are assigned by the app to the current user.

## Workouts Schema

Create these required attributes:

| Key | Type | Size |
| --- | --- | --- |
| `exercise` | string | 120 |
| `sets` | integer | - |
| `reps` | integer | - |
| `weight` | float | - |
| `performedAt` | datetime | - |
| `updatedAt` | datetime | - |
| `deleted` | boolean | - |
| `ownerId` | string | 36 |

Create a key index on `ownerId`. Appwrite may prompt for an additional index if its version requires one for the combined owner and `$updatedAt` query; use the index definition shown in that error.

## Equipment Schema

Create these attributes on `equipment`:

| Key | Type | Size | Required |
| --- | --- | --- | --- |
| `name` | string | 120 | yes |
| `measurements` | string | 16384 | yes |
| `thumbnailRemoteFileId` | string | 36 | no |
| `updatedAt` | datetime | - | yes |
| `deleted` | boolean | - | yes |
| `ownerId` | string | 36 | yes |

Create a key index on `ownerId`. Measurements are synchronized as one JSON aggregate so an equipment edit resolves as one conflict. PNG bytes remain local in this slice; `thumbnailRemoteFileId` reserves the future Appwrite Storage reference.

## Exercises Schema

Create these attributes on `exercises`:

| Key | Type | Size | Required |
| --- | --- | --- | --- |
| `name` | string | 120 | yes |
| `primaryMuscle` | string | 32 | yes |
| `secondaryMuscles` | string | 2048 | yes |
| `youtubeUrl` | string | 2048 | no |
| `repMode` | string | 16 | yes |
| `defaultSets` | integer | - | yes |
| `defaultTarget` | integer | - | yes |
| `defaultRestSeconds` | integer | - | yes |
| `defaultTempo` | string | 16 | no |
| `equipmentConfig` | string | 65535 | yes |
| `thumbnailRemoteFileId` | string | 36 | no |
| `updatedAt` | datetime | - | yes |
| `deleted` | boolean | - | yes |
| `ownerId` | string | 36 | yes |

Create a key index on `ownerId`. Secondary muscles and equipment defaults are JSON aggregates. Equipment IDs remain live references locally, while names and measurement definitions in the aggregate provide a fallback when another device has not synced the referenced equipment yet.

## Plans Schema

Create these attributes on `plans`:

| Key | Type | Size | Required |
| --- | --- | --- | --- |
| `name` | string | 120 | yes |
| `sortPosition` | integer | - | yes |
| `active` | boolean | - | yes |
| `activatedAt` | datetime | - | no |
| `splitKey` | string | 64 | yes |
| `splitLabel` | string | 120 | yes |
| `effort` | string | 16 | yes |
| `configuration` | string | 262144 | yes |
| `updatedAt` | datetime | - | yes |
| `deleted` | boolean | - | yes |
| `ownerId` | string | 36 | yes |

Create a key index on `ownerId`. The `configuration` JSON contains schema-versioned ordinal days, ordered standalone exercises and supersets, prescription snapshots, plan-level checklists, and the optional repeating deload week. It intentionally excludes day names, thumbnail data, and derived superset rest. Schema version 2 removes the legacy plan locations field. Schema version 3 adds `deloadWeek` as either `null` or an integer from 2 through 52. The app still reads versions 1 and 2 with deload disabled.

The active plan uses sort position `-1` and is pinned above the list. Inactive plans use contiguous user-controlled positions beginning at `0`. After pulling, the app deterministically resolves competing active plans and compacts inactive positions before pushing corrections. The parser accepts the legacy `queuePosition` field during migration, but new writes use `sortPosition`.

Enable anonymous sessions under **Auth > Settings**.

## Environment

Copy `.env.example` to `.env` and fill in the IDs from the Appwrite console:

```dotenv
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=project-id
EXPO_PUBLIC_APPWRITE_DATABASE_ID=database-id
EXPO_PUBLIC_APPWRITE_WORKOUTS_COLLECTION_ID=collection-id
EXPO_PUBLIC_APPWRITE_EQUIPMENT_COLLECTION_ID=equipment-collection-id
EXPO_PUBLIC_APPWRITE_EXERCISES_COLLECTION_ID=exercises-collection-id
EXPO_PUBLIC_APPWRITE_PLANS_COLLECTION_ID=plans-collection-id
EXPO_PUBLIC_APPWRITE_PLATFORM=com.gymrat.app
```

Restart Expo after changing environment variables. `EXPO_PUBLIC_*` values are bundled into the app and must never contain API keys or other secrets.

`EXPO_PUBLIC_APPWRITE_PLATFORM` is used by the native SDK only. The Web SDK validates the browser hostname against the Web platforms registered in Appwrite.
