import * as SQLite from 'expo-sqlite';

import type { Workout, WorkoutDraft } from '../types/workout';

type WorkoutRow = {
  id: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  performed_at: string;
  updated_at: string;
  deleted: number;
  sync_status: Workout['syncStatus'];
};

type DatabaseGlobal = typeof globalThis & {
  __gymratDatabase?: ReturnType<typeof SQLite.openDatabaseAsync>;
};

// Metro can re-evaluate modules during web Fast Refresh while the previous
// SQLite worker still owns its exclusive file handle.
const databaseGlobal = globalThis as DatabaseGlobal;
const database = databaseGlobal.__gymratDatabase ??= SQLite.openDatabaseAsync('gymrat.db');
let initialization: Promise<void> | undefined;

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    exercise: row.exercise,
    sets: row.sets,
    reps: row.reps,
    weight: row.weight,
    performedAt: row.performed_at,
    updatedAt: row.updated_at,
    deleted: Boolean(row.deleted),
    syncStatus: row.sync_status,
  };
}

export async function initializeDatabase() {
  if (initialization) return initialization;

  initialization = migrateDatabase();
  return initialization;
}

async function migrateDatabase() {
  const db = await database;
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');

  if ((version?.user_version ?? 0) < 1) {
    await db.withTransactionAsync(() => db.execAsync(`
      CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY NOT NULL,
      exercise TEXT NOT NULL,
      sets INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      performed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
      CREATE INDEX IF NOT EXISTS workouts_sync_status
      ON workouts (sync_status);
      CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
      CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      thumbnail_data_uri TEXT,
      thumbnail_remote_file_id TEXT,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
      CREATE INDEX IF NOT EXISTS equipment_name ON equipment (name);
      CREATE INDEX IF NOT EXISTS equipment_sync_status
      ON equipment (sync_status);
      CREATE TABLE IF NOT EXISTS equipment_measurements (
      id TEXT PRIMARY KEY NOT NULL,
      equipment_id TEXT NOT NULL,
      label TEXT NOT NULL,
      unit TEXT NOT NULL,
      increment REAL NOT NULL,
      default_value REAL,
      position INTEGER NOT NULL,
      FOREIGN KEY (equipment_id) REFERENCES equipment (id) ON DELETE CASCADE
    );
      CREATE INDEX IF NOT EXISTS equipment_measurements_equipment
      ON equipment_measurements (equipment_id, position);
      PRAGMA user_version = 1;
    `));
  }

  if ((version?.user_version ?? 0) < 2) {
    await db.withTransactionAsync(() => db.execAsync(`
      ALTER TABLE equipment_measurements
        ADD COLUMN retired INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE exercises (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        thumbnail_data_uri TEXT,
        thumbnail_remote_file_id TEXT,
        primary_muscle TEXT NOT NULL,
        youtube_url TEXT,
        rep_mode TEXT NOT NULL CHECK (rep_mode IN ('count', 'time')),
        default_sets INTEGER NOT NULL,
        default_target INTEGER NOT NULL,
        default_rest_seconds INTEGER NOT NULL,
        default_tempo TEXT,
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX exercises_name ON exercises (name);
      CREATE INDEX exercises_sync_status ON exercises (sync_status);
      CREATE TABLE exercise_secondary_muscles (
        exercise_id TEXT NOT NULL,
        muscle TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (exercise_id, muscle),
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
      );
      CREATE TABLE exercise_equipment (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL,
        equipment_id TEXT NOT NULL,
        equipment_name_snapshot TEXT NOT NULL,
        position INTEGER NOT NULL,
        UNIQUE (exercise_id, equipment_id),
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
      );
      CREATE INDEX exercise_equipment_exercise
        ON exercise_equipment (exercise_id, position);
      CREATE INDEX exercise_equipment_equipment
        ON exercise_equipment (equipment_id);
      CREATE TABLE exercise_measurement_defaults (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_equipment_id TEXT NOT NULL,
        measurement_id TEXT NOT NULL,
        label_snapshot TEXT NOT NULL,
        unit_snapshot TEXT NOT NULL,
        increment_snapshot REAL NOT NULL,
        default_value REAL,
        position INTEGER NOT NULL,
        UNIQUE (exercise_equipment_id, measurement_id),
        FOREIGN KEY (exercise_equipment_id) REFERENCES exercise_equipment (id) ON DELETE CASCADE
      );
      CREATE INDEX exercise_measurement_defaults_equipment
        ON exercise_measurement_defaults (exercise_equipment_id, position);
      CREATE INDEX exercise_measurement_defaults_measurement
        ON exercise_measurement_defaults (measurement_id);
      PRAGMA user_version = 2;
    `));
  }

  const equipmentColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(exercise_equipment)',
  );
  const measurementColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(exercise_measurement_defaults)',
  );
  const equipmentColumnNames = new Set(equipmentColumns.map((column) => column.name));
  const measurementColumnNames = new Set(measurementColumns.map((column) => column.name));
  const needsSnapshotRepair =
    !equipmentColumnNames.has('equipment_name_snapshot') ||
    !measurementColumnNames.has('label_snapshot') ||
    !measurementColumnNames.has('unit_snapshot') ||
    !measurementColumnNames.has('increment_snapshot');

  if ((version?.user_version ?? 0) < 3 || needsSnapshotRepair) {
    await db.withTransactionAsync(async () => {
      if (!equipmentColumnNames.has('equipment_name_snapshot')) {
        await db.execAsync(
          "ALTER TABLE exercise_equipment ADD COLUMN equipment_name_snapshot TEXT NOT NULL DEFAULT '';",
        );
      }
      if (!measurementColumnNames.has('label_snapshot')) {
        await db.execAsync(
          "ALTER TABLE exercise_measurement_defaults ADD COLUMN label_snapshot TEXT NOT NULL DEFAULT '';",
        );
      }
      if (!measurementColumnNames.has('unit_snapshot')) {
        await db.execAsync(
          "ALTER TABLE exercise_measurement_defaults ADD COLUMN unit_snapshot TEXT NOT NULL DEFAULT '';",
        );
      }
      if (!measurementColumnNames.has('increment_snapshot')) {
        await db.execAsync(
          'ALTER TABLE exercise_measurement_defaults ADD COLUMN increment_snapshot REAL NOT NULL DEFAULT 1;',
        );
      }
      await db.execAsync(`
        UPDATE exercise_equipment
        SET equipment_name_snapshot = COALESCE(
          (SELECT name FROM equipment WHERE equipment.id = exercise_equipment.equipment_id),
          equipment_name_snapshot
        )
        WHERE equipment_name_snapshot = '';
        UPDATE exercise_measurement_defaults
        SET label_snapshot = COALESCE(
              (SELECT label FROM equipment_measurements
               WHERE equipment_measurements.id = exercise_measurement_defaults.measurement_id),
              label_snapshot
            ),
            unit_snapshot = COALESCE(
              (SELECT unit FROM equipment_measurements
               WHERE equipment_measurements.id = exercise_measurement_defaults.measurement_id),
              unit_snapshot
            ),
            increment_snapshot = COALESCE(
              (SELECT increment FROM equipment_measurements
               WHERE equipment_measurements.id = exercise_measurement_defaults.measurement_id),
              increment_snapshot
            );
        PRAGMA user_version = 3;
      `);
    });
  }

  const planTables = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (
      'plans', 'plan_days', 'plan_checklist_items', 'plan_day_items',
      'plan_exercises', 'plan_exercise_equipment', 'plan_exercise_measurements'
    )`,
  );
  if ((version?.user_version ?? 0) < 4 || planTables.length < 7) {
    await db.withTransactionAsync(() => db.execAsync(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        queue_position INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 0,
        activated_at TEXT,
        split_key TEXT NOT NULL,
        split_label TEXT NOT NULL,
        effort TEXT NOT NULL CHECK (effort IN ('one_rir', 'failure')),
        deload_week INTEGER CHECK (deload_week BETWEEN 2 AND 52),
        updated_at TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        sync_status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE INDEX IF NOT EXISTS plans_sync_status ON plans (sync_status, updated_at);
      CREATE UNIQUE INDEX IF NOT EXISTS plans_one_active
        ON plans (active) WHERE active = 1 AND deleted = 0;
      CREATE TABLE IF NOT EXISTS plan_days (
        id TEXT PRIMARY KEY NOT NULL,
        plan_id TEXT NOT NULL,
        ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 1 AND 7),
        UNIQUE (plan_id, ordinal),
        FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS plan_days_plan ON plan_days (plan_id, ordinal);
      CREATE TABLE IF NOT EXISTS plan_checklist_items (
        id TEXT PRIMARY KEY NOT NULL,
        plan_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('warmup', 'cooldown')),
        label TEXT NOT NULL,
        position INTEGER NOT NULL,
        UNIQUE (plan_id, kind, position),
        FOREIGN KEY (plan_id) REFERENCES plans (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS plan_checklist_plan
        ON plan_checklist_items (plan_id, kind, position);
      CREATE TABLE IF NOT EXISTS plan_day_items (
        id TEXT PRIMARY KEY NOT NULL,
        plan_day_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('standalone', 'superset')),
        position INTEGER NOT NULL,
        UNIQUE (plan_day_id, position),
        FOREIGN KEY (plan_day_id) REFERENCES plan_days (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS plan_day_items_day
        ON plan_day_items (plan_day_id, position);
      CREATE TABLE IF NOT EXISTS plan_exercises (
        id TEXT PRIMARY KEY NOT NULL,
        plan_day_item_id TEXT NOT NULL,
        source_exercise_id TEXT NOT NULL,
        name_snapshot TEXT NOT NULL,
        rep_mode_snapshot TEXT NOT NULL CHECK (rep_mode_snapshot IN ('count', 'time')),
        sets INTEGER NOT NULL,
        target INTEGER NOT NULL,
        rest_seconds INTEGER NOT NULL,
        tempo TEXT,
        position INTEGER NOT NULL,
        UNIQUE (plan_day_item_id, position),
        FOREIGN KEY (plan_day_item_id) REFERENCES plan_day_items (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS plan_exercises_item
        ON plan_exercises (plan_day_item_id, position);
      CREATE INDEX IF NOT EXISTS plan_exercises_source ON plan_exercises (source_exercise_id);
      CREATE TABLE IF NOT EXISTS plan_exercise_equipment (
        id TEXT PRIMARY KEY NOT NULL,
        plan_exercise_id TEXT NOT NULL,
        source_equipment_id TEXT NOT NULL,
        name_snapshot TEXT NOT NULL,
        position INTEGER NOT NULL,
        UNIQUE (plan_exercise_id, position),
        FOREIGN KEY (plan_exercise_id) REFERENCES plan_exercises (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS plan_exercise_equipment_exercise
        ON plan_exercise_equipment (plan_exercise_id, position);
      CREATE INDEX IF NOT EXISTS plan_exercise_equipment_source
        ON plan_exercise_equipment (source_equipment_id);
      CREATE TABLE IF NOT EXISTS plan_exercise_measurements (
        id TEXT PRIMARY KEY NOT NULL,
        plan_exercise_equipment_id TEXT NOT NULL,
        source_measurement_id TEXT NOT NULL,
        label_snapshot TEXT NOT NULL,
        unit_snapshot TEXT NOT NULL,
        increment_snapshot REAL NOT NULL,
        target REAL,
        position INTEGER NOT NULL,
        UNIQUE (plan_exercise_equipment_id, position),
        FOREIGN KEY (plan_exercise_equipment_id)
          REFERENCES plan_exercise_equipment (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS plan_exercise_measurements_equipment
        ON plan_exercise_measurements (plan_exercise_equipment_id, position);
      CREATE INDEX IF NOT EXISTS plan_exercise_measurements_source
        ON plan_exercise_measurements (source_measurement_id);
      PRAGMA user_version = 4;
    `));
  }

  const planColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(plans)');
  const planColumnNames = new Set(planColumns.map((column) => column.name));
  const planIndexes = await db.getAllAsync<{ name: string }>('PRAGMA index_list(plans)');
  const planIndexNames = new Set(planIndexes.map((index) => index.name));
  const planVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const needsPlanSortRepair =
    planColumnNames.has('queue_position') ||
    !planColumnNames.has('sort_position') ||
    !planIndexNames.has('plans_sort_order') ||
    planIndexNames.has('plans_queue');

  if ((planVersion?.user_version ?? 0) < 5 || needsPlanSortRepair) {
    await db.withTransactionAsync(async () => {
      await db.execAsync('DROP INDEX IF EXISTS plans_queue;');
      if (planColumnNames.has('queue_position') && !planColumnNames.has('sort_position')) {
        await db.execAsync('ALTER TABLE plans RENAME COLUMN queue_position TO sort_position;');
      } else if (planColumnNames.has('queue_position')) {
        await db.execAsync('ALTER TABLE plans DROP COLUMN queue_position;');
      } else if (!planColumnNames.has('sort_position')) {
        await db.execAsync(
          'ALTER TABLE plans ADD COLUMN sort_position INTEGER NOT NULL DEFAULT 0;',
        );
      }
      await db.execAsync(`
        UPDATE plans SET sort_position = -1 WHERE active = 1 AND deleted = 0;
        WITH inactive_order AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY sort_position, id) - 1 AS position
          FROM plans
          WHERE deleted = 0 AND active = 0
        )
        UPDATE plans
        SET sort_position = (
          SELECT position FROM inactive_order WHERE inactive_order.id = plans.id
        )
        WHERE id IN (SELECT id FROM inactive_order);
        CREATE INDEX IF NOT EXISTS plans_sort_order
          ON plans (deleted, active DESC, sort_position, id);
        PRAGMA user_version = 5;
      `);
    });
  }

  const currentVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((currentVersion?.user_version ?? 0) < 6) {
    await db.withTransactionAsync(() => db.execAsync(`
      DROP TABLE IF EXISTS plan_locations;
      PRAGMA user_version = 6;
    `));
  }

  const latestVersion = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const latestPlanColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(plans)');
  const hasDeloadWeek = latestPlanColumns.some((column) => column.name === 'deload_week');
  if ((latestVersion?.user_version ?? 0) < 7 || !hasDeloadWeek) {
    await db.withTransactionAsync(async () => {
      if (!hasDeloadWeek) {
        await db.execAsync(
          'ALTER TABLE plans ADD COLUMN deload_week INTEGER CHECK (deload_week BETWEEN 2 AND 52);',
        );
      }
      await db.execAsync('PRAGMA user_version = 7;');
    });
  }
}

export async function getDatabase() {
  await initializeDatabase();
  return database;
}

export async function listWorkouts() {
  const db = await database;
  const rows = await db.getAllAsync<WorkoutRow>(
    `SELECT * FROM workouts
     WHERE deleted = 0
     ORDER BY performed_at DESC`,
  );
  return rows.map(toWorkout);
}

export async function listPendingWorkouts() {
  const db = await database;
  const rows = await db.getAllAsync<WorkoutRow>(
    `SELECT * FROM workouts
     WHERE sync_status = 'pending'
     ORDER BY updated_at ASC`,
  );
  return rows.map(toWorkout);
}

export async function addWorkout(draft: WorkoutDraft) {
  const db = await database;
  const now = new Date().toISOString();
  const workout: Workout = {
    id: crypto.randomUUID(),
    ...draft,
    performedAt: now,
    updatedAt: now,
    deleted: false,
    syncStatus: 'pending',
  };

  await db.runAsync(
    `INSERT INTO workouts
      (id, exercise, sets, reps, weight, performed_at, updated_at, deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
    workout.id,
    workout.exercise,
    workout.sets,
    workout.reps,
    workout.weight,
    workout.performedAt,
    workout.updatedAt,
  );
  return workout;
}

export async function deleteWorkout(id: string) {
  const db = await database;
  await db.runAsync(
    `UPDATE workouts
     SET deleted = 1, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    new Date().toISOString(),
    id,
  );
}

export async function markWorkoutSynced(id: string, expectedUpdatedAt: string) {
  const db = await database;
  await db.runAsync(
    `UPDATE workouts SET sync_status = 'synced'
     WHERE id = ? AND updated_at = ?`,
    id,
    expectedUpdatedAt,
  );
}

export async function mergeRemoteWorkout(workout: Workout) {
  const db = await database;
  const local = await db.getFirstAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE id = ?',
    workout.id,
  );

  if (
    local?.sync_status === 'pending' &&
    local.updated_at >= workout.updatedAt
  ) {
    return;
  }

  await db.runAsync(
    `INSERT INTO workouts
      (id, exercise, sets, reps, weight, performed_at, updated_at, deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET
       exercise = excluded.exercise,
       sets = excluded.sets,
       reps = excluded.reps,
       weight = excluded.weight,
       performed_at = excluded.performed_at,
       updated_at = excluded.updated_at,
       deleted = excluded.deleted,
       sync_status = 'synced'`,
    workout.id,
    workout.exercise,
    workout.sets,
    workout.reps,
    workout.weight,
    workout.performedAt,
    workout.updatedAt,
    workout.deleted ? 1 : 0,
  );
}

export async function getSyncCursor(key = 'workouts_remote_cursor') {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_metadata WHERE key = ?',
    key,
  );
  return row?.value ?? '1970-01-01T00:00:00.000Z';
}

export async function setSyncCursor(cursor: string, key = 'workouts_remote_cursor') {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_metadata (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    cursor,
  );
}
