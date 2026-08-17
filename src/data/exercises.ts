import { getDatabase } from './database';
import { isMuscleId, type MuscleId } from '../domain/muscles';
import type {
  Exercise,
  ExerciseEquipment,
  ExerciseMeasurementDefault,
} from '../types/exercise';

type ExerciseRow = {
  id: string;
  name: string;
  thumbnail_data_uri: string | null;
  thumbnail_remote_file_id: string | null;
  primary_muscle: string;
  youtube_url: string | null;
  rep_mode: Exercise['repMode'];
  default_sets: number;
  default_target: number;
  default_rest_seconds: number;
  default_tempo: string | null;
  updated_at: string;
  deleted: number;
  sync_status: Exercise['syncStatus'];
};

type SecondaryMuscleRow = {
  exercise_id: string;
  muscle: string;
  position: number;
};

type ExerciseEquipmentRow = {
  id: string;
  exercise_id: string;
  equipment_id: string;
  equipment_name: string;
  equipment_deleted: number | null;
  position: number;
};

type MeasurementDefaultRow = {
  id: string;
  exercise_equipment_id: string;
  measurement_id: string;
  label: string;
  unit: string;
  increment: number;
  default_value: number | null;
  measurement_missing: number;
  retired: number | null;
  position: number;
};

function placeholders(length: number) {
  return Array.from({ length }, () => '?').join(',');
}

async function hydrate(rows: ExerciseRow[]) {
  if (!rows.length) return [];
  const db = await getDatabase();
  const ids = rows.map((row) => row.id);
  const values = placeholders(ids.length);
  const [secondaryRows, equipmentRows] = await Promise.all([
    db.getAllAsync<SecondaryMuscleRow>(
      `SELECT * FROM exercise_secondary_muscles
       WHERE exercise_id IN (${values}) ORDER BY position`,
      ...ids,
    ),
    db.getAllAsync<ExerciseEquipmentRow>(
      `SELECT ee.id, ee.exercise_id, ee.equipment_id,
         COALESCE(e.name, ee.equipment_name_snapshot) AS equipment_name,
         e.deleted AS equipment_deleted, ee.position
       FROM exercise_equipment ee
       LEFT JOIN equipment e ON e.id = ee.equipment_id
       WHERE ee.exercise_id IN (${values}) ORDER BY ee.position`,
      ...ids,
    ),
  ]);
  const associationIds = equipmentRows.map((row) => row.id);
  const measurementRows = associationIds.length
    ? await db.getAllAsync<MeasurementDefaultRow>(
      `SELECT emd.id, emd.exercise_equipment_id, emd.measurement_id,
         COALESCE(m.label, emd.label_snapshot) AS label,
         COALESCE(m.unit, emd.unit_snapshot) AS unit,
         COALESCE(m.increment, emd.increment_snapshot) AS increment,
         emd.default_value, CASE WHEN m.id IS NULL THEN 1 ELSE 0 END AS measurement_missing,
         m.retired, emd.position
       FROM exercise_measurement_defaults emd
       LEFT JOIN equipment_measurements m ON m.id = emd.measurement_id
       WHERE emd.exercise_equipment_id IN (${placeholders(associationIds.length)})
       ORDER BY emd.position`,
      ...associationIds,
    )
    : [];

  const secondaryByExercise = new Map<string, MuscleId[]>();
  for (const row of secondaryRows) {
    if (!isMuscleId(row.muscle)) continue;
    const muscles = secondaryByExercise.get(row.exercise_id) ?? [];
    muscles.push(row.muscle);
    secondaryByExercise.set(row.exercise_id, muscles);
  }
  const measurementsByAssociation = new Map<string, ExerciseMeasurementDefault[]>();
  for (const row of measurementRows) {
    const measurements = measurementsByAssociation.get(row.exercise_equipment_id) ?? [];
    measurements.push({
      id: row.id,
      measurementId: row.measurement_id,
      label: row.label,
      unit: row.unit,
      increment: row.increment,
      defaultValue: row.default_value,
      unavailable: Boolean(row.measurement_missing || row.retired),
    });
    measurementsByAssociation.set(row.exercise_equipment_id, measurements);
  }
  const equipmentByExercise = new Map<string, ExerciseEquipment[]>();
  for (const row of equipmentRows) {
    const equipment = equipmentByExercise.get(row.exercise_id) ?? [];
    equipment.push({
      id: row.id,
      equipmentId: row.equipment_id,
      equipmentName: row.equipment_name,
      unavailable: row.equipment_deleted === null || Boolean(row.equipment_deleted),
      position: row.position,
      measurements: measurementsByAssociation.get(row.id) ?? [],
    });
    equipmentByExercise.set(row.exercise_id, equipment);
  }

  return rows.flatMap((row): Exercise[] => {
    if (!isMuscleId(row.primary_muscle)) return [];
    return [{
      id: row.id,
      name: row.name,
      thumbnailDataUri: row.thumbnail_data_uri,
      thumbnailRemoteFileId: row.thumbnail_remote_file_id,
      primaryMuscle: row.primary_muscle,
      secondaryMuscles: secondaryByExercise.get(row.id) ?? [],
      youtubeUrl: row.youtube_url,
      repMode: row.rep_mode,
      defaultSets: row.default_sets,
      defaultTarget: row.default_target,
      defaultRestSeconds: row.default_rest_seconds,
      defaultTempo: row.default_tempo,
      equipment: equipmentByExercise.get(row.id) ?? [],
      updatedAt: row.updated_at,
      deleted: Boolean(row.deleted),
      syncStatus: row.sync_status,
    }];
  });
}

export async function listExercises(search = '') {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT DISTINCT e.* FROM exercises e
     LEFT JOIN exercise_secondary_muscles sm ON sm.exercise_id = e.id
     LEFT JOIN exercise_equipment ee ON ee.exercise_id = e.id
     LEFT JOIN equipment eq ON eq.id = ee.equipment_id
     WHERE e.deleted = 0 AND (
       ? = '%%' OR e.name LIKE ? COLLATE NOCASE
       OR e.primary_muscle LIKE ? COLLATE NOCASE
       OR sm.muscle LIKE ? COLLATE NOCASE
       OR eq.name LIKE ? COLLATE NOCASE
     )
     ORDER BY e.name COLLATE NOCASE`,
    term,
    term,
    term,
    term,
    term,
  );
  return hydrate(rows);
}

export async function getExercise(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExerciseRow>(
    'SELECT * FROM exercises WHERE id = ? AND deleted = 0',
    id,
  );
  return row ? (await hydrate([row]))[0] ?? null : null;
}

export async function countExercisesNamed(name: string, excludingId?: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM exercises
     WHERE deleted = 0 AND name = ? COLLATE NOCASE AND (? IS NULL OR id != ?)`,
    name.trim(),
    excludingId ?? null,
    excludingId ?? null,
  );
  return row?.count ?? 0;
}

export async function saveExercise(
  draft: Omit<Exercise, 'id' | 'updatedAt' | 'deleted' | 'syncStatus'>,
  id: string = crypto.randomUUID(),
) {
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO exercises
        (id, name, thumbnail_data_uri, thumbnail_remote_file_id, primary_muscle,
         youtube_url, rep_mode, default_sets, default_target, default_rest_seconds,
         default_tempo, updated_at, deleted, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, thumbnail_data_uri = excluded.thumbnail_data_uri,
         thumbnail_remote_file_id = excluded.thumbnail_remote_file_id,
         primary_muscle = excluded.primary_muscle, youtube_url = excluded.youtube_url,
         rep_mode = excluded.rep_mode, default_sets = excluded.default_sets,
         default_target = excluded.default_target,
         default_rest_seconds = excluded.default_rest_seconds,
         default_tempo = excluded.default_tempo, updated_at = excluded.updated_at,
         deleted = 0, sync_status = 'pending'`,
      id,
      draft.name.trim(),
      draft.thumbnailDataUri,
      draft.thumbnailRemoteFileId,
      draft.primaryMuscle,
      draft.youtubeUrl,
      draft.repMode,
      draft.defaultSets,
      draft.defaultTarget,
      draft.defaultRestSeconds,
      draft.defaultTempo,
      updatedAt,
    );
    await db.runAsync('DELETE FROM exercise_secondary_muscles WHERE exercise_id = ?', id);
    await db.runAsync('DELETE FROM exercise_equipment WHERE exercise_id = ?', id);
    for (const [position, muscle] of draft.secondaryMuscles.entries()) {
      await db.runAsync(
        `INSERT INTO exercise_secondary_muscles (exercise_id, muscle, position)
         VALUES (?, ?, ?)`,
        id,
        muscle,
        position,
      );
    }
    for (const [position, equipment] of draft.equipment.entries()) {
      await db.runAsync(
        `INSERT INTO exercise_equipment
          (id, exercise_id, equipment_id, equipment_name_snapshot, position)
         VALUES (?, ?, ?, ?, ?)`,
        equipment.id,
        id,
        equipment.equipmentId,
        equipment.equipmentName,
        position,
      );
      for (const [measurementPosition, measurement] of equipment.measurements.entries()) {
        await db.runAsync(
          `INSERT INTO exercise_measurement_defaults
            (id, exercise_equipment_id, measurement_id, label_snapshot, unit_snapshot,
             increment_snapshot, default_value, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          measurement.id,
          equipment.id,
          measurement.measurementId,
          measurement.label,
          measurement.unit,
          measurement.increment,
          measurement.defaultValue,
          measurementPosition,
        );
      }
    }
  });
  return id;
}

export async function deleteExercise(id: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE exercises
     SET deleted = 1, thumbnail_data_uri = NULL, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    new Date().toISOString(),
    id,
  );
}

export async function listPendingExercises() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT * FROM exercises WHERE sync_status = 'pending' ORDER BY updated_at`,
  );
  return hydrate(rows);
}

export async function markExerciseSynced(id: string, expectedUpdatedAt: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE exercises SET sync_status = 'synced'
     WHERE id = ? AND updated_at = ?`,
    id,
    expectedUpdatedAt,
  );
}

export async function mergeRemoteExercise(exercise: Exercise) {
  const db = await getDatabase();
  const local = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', exercise.id);
  if (local?.sync_status === 'pending' && local.updated_at >= exercise.updatedAt) return;

  const existingThumbnail = exercise.deleted ? null : local?.thumbnail_data_uri ?? null;
  await saveExercise({ ...exercise, thumbnailDataUri: existingThumbnail }, exercise.id);
  await db.runAsync(
    `UPDATE exercises SET updated_at = ?, deleted = ?, sync_status = 'synced'
     WHERE id = ?`,
    exercise.updatedAt,
    exercise.deleted ? 1 : 0,
    exercise.id,
  );
}
