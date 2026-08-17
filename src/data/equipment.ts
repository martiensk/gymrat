import { getDatabase } from './database';
import type {
  Equipment,
  EquipmentDraft,
  EquipmentMeasurement,
} from '../types/equipment';

type EquipmentRow = {
  id: string;
  name: string;
  thumbnail_data_uri: string | null;
  thumbnail_remote_file_id: string | null;
  updated_at: string;
  deleted: number;
  sync_status: Equipment['syncStatus'];
};

type MeasurementRow = {
  id: string;
  equipment_id: string;
  label: string;
  unit: string;
  increment: number;
  default_value: number | null;
  position: number;
  retired: number;
};

export class EquipmentMeasurementInUseError extends Error {
  constructor(public readonly labels: string[]) {
    super('Measurements used by exercises cannot be removed.');
  }
}

function toMeasurement(row: MeasurementRow): EquipmentMeasurement {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    label: row.label,
    unit: row.unit,
    increment: row.increment,
    defaultValue: row.default_value,
    position: row.position,
  };
}

function toEquipment(
  row: EquipmentRow,
  measurements: EquipmentMeasurement[],
): Equipment {
  return {
    id: row.id,
    name: row.name,
    thumbnailDataUri: row.thumbnail_data_uri,
    thumbnailRemoteFileId: row.thumbnail_remote_file_id,
    measurements,
    updatedAt: row.updated_at,
    deleted: Boolean(row.deleted),
    syncStatus: row.sync_status,
  };
}

async function hydrate(rows: EquipmentRow[]) {
  if (rows.length === 0) return [];
  const db = await getDatabase();
  const placeholders = rows.map(() => '?').join(',');
  const measurementRows = await db.getAllAsync<MeasurementRow>(
    `SELECT * FROM equipment_measurements
     WHERE equipment_id IN (${placeholders})
       AND retired = 0
     ORDER BY position ASC`,
    ...rows.map((row) => row.id),
  );
  const byEquipment = new Map<string, EquipmentMeasurement[]>();
  for (const row of measurementRows) {
    const measurements = byEquipment.get(row.equipment_id) ?? [];
    measurements.push(toMeasurement(row));
    byEquipment.set(row.equipment_id, measurements);
  }
  return rows.map((row) => toEquipment(row, byEquipment.get(row.id) ?? []));
}

export async function listEquipment(search = '') {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;
  const rows = await db.getAllAsync<EquipmentRow>(
    `SELECT DISTINCT e.* FROM equipment e
     LEFT JOIN equipment_measurements m ON m.equipment_id = e.id AND m.retired = 0
     WHERE e.deleted = 0
       AND (? = '%%' OR e.name LIKE ? COLLATE NOCASE
         OR m.label LIKE ? COLLATE NOCASE OR m.unit LIKE ? COLLATE NOCASE)
     ORDER BY e.name COLLATE NOCASE ASC`,
    term,
    term,
    term,
    term,
  );
  return hydrate(rows);
}

export async function getEquipment(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<EquipmentRow>(
    'SELECT * FROM equipment WHERE id = ? AND deleted = 0',
    id,
  );
  if (!row) return null;
  return (await hydrate([row]))[0];
}

export async function saveEquipment(draft: EquipmentDraft, id = crypto.randomUUID()) {
  const db = await getDatabase();
  const updatedAt = new Date().toISOString();
  const retainedIds = new Set(draft.measurements.map((measurement) => measurement.id));
  const existing = await db.getAllAsync<MeasurementRow>(
    'SELECT * FROM equipment_measurements WHERE equipment_id = ? AND retired = 0',
    id,
  );
  const removed = existing.filter((measurement) => !retainedIds.has(measurement.id));
  const usedLabels: string[] = [];
  for (const measurement of removed) {
    const usage = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM exercise_measurement_defaults
       WHERE measurement_id = ?`,
      measurement.id,
    );
    if (usage?.count) usedLabels.push(measurement.label);
  }
  if (usedLabels.length) throw new EquipmentMeasurementInUseError(usedLabels);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO equipment
        (id, name, thumbnail_data_uri, thumbnail_remote_file_id, updated_at, deleted, sync_status)
       VALUES (?, ?, ?, NULL, ?, 0, 'pending')
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         thumbnail_data_uri = excluded.thumbnail_data_uri,
         updated_at = excluded.updated_at,
         deleted = 0,
         sync_status = 'pending'`,
      id,
      draft.name.trim(),
      draft.thumbnailDataUri,
      updatedAt,
    );
    for (const [position, measurement] of draft.measurements.entries()) {
      await db.runAsync(
        `INSERT INTO equipment_measurements
          (id, equipment_id, label, unit, increment, default_value, position, retired)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label,
           unit = excluded.unit,
           increment = excluded.increment,
           default_value = excluded.default_value,
           position = excluded.position,
           retired = 0`,
        measurement.id || crypto.randomUUID(),
        id,
        measurement.label.trim(),
        measurement.unit.trim(),
        measurement.increment,
        measurement.defaultValue,
        position,
      );
    }
    for (const measurement of removed) {
      await db.runAsync('DELETE FROM equipment_measurements WHERE id = ?', measurement.id);
    }
  });
  return id;
}

export async function deleteEquipment(id: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE equipment
     SET deleted = 1, thumbnail_data_uri = NULL, updated_at = ?, sync_status = 'pending'
     WHERE id = ?`,
    new Date().toISOString(),
    id,
  );
}

export async function countExercisesUsingEquipment(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT ee.exercise_id) AS count
     FROM exercise_equipment ee
     JOIN exercises e ON e.id = ee.exercise_id
     WHERE ee.equipment_id = ? AND e.deleted = 0`,
    id,
  );
  return row?.count ?? 0;
}

export async function listPendingEquipment() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EquipmentRow>(
    `SELECT * FROM equipment
     WHERE sync_status = 'pending'
     ORDER BY updated_at ASC`,
  );
  return hydrate(rows);
}

export async function markEquipmentSynced(id: string, expectedUpdatedAt: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE equipment SET sync_status = 'synced'
     WHERE id = ? AND updated_at = ?`,
    id,
    expectedUpdatedAt,
  );
}

export async function mergeRemoteEquipment(equipment: Equipment) {
  const db = await getDatabase();
  const local = await db.getFirstAsync<EquipmentRow>(
    'SELECT * FROM equipment WHERE id = ?',
    equipment.id,
  );
  if (local?.sync_status === 'pending' && local.updated_at >= equipment.updatedAt) return;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO equipment
        (id, name, thumbnail_data_uri, thumbnail_remote_file_id, updated_at, deleted, sync_status)
       VALUES (?, ?, NULL, ?, ?, ?, 'synced')
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         thumbnail_remote_file_id = excluded.thumbnail_remote_file_id,
         updated_at = excluded.updated_at,
         deleted = excluded.deleted,
         sync_status = 'synced'`,
      equipment.id,
      equipment.name,
      equipment.thumbnailRemoteFileId,
      equipment.updatedAt,
      equipment.deleted ? 1 : 0,
    );
    const incomingIds = new Set(equipment.measurements.map((measurement) => measurement.id));
    const existing = await db.getAllAsync<MeasurementRow>(
      'SELECT * FROM equipment_measurements WHERE equipment_id = ?',
      equipment.id,
    );
    for (const measurement of equipment.measurements) {
      await db.runAsync(
        `INSERT INTO equipment_measurements
          (id, equipment_id, label, unit, increment, default_value, position, retired)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label,
           unit = excluded.unit,
           increment = excluded.increment,
           default_value = excluded.default_value,
           position = excluded.position,
           retired = 0`,
        measurement.id,
        equipment.id,
        measurement.label,
        measurement.unit,
        measurement.increment,
        measurement.defaultValue,
        measurement.position,
      );
    }
    for (const measurement of existing) {
      if (incomingIds.has(measurement.id)) continue;
      const usage = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM exercise_measurement_defaults WHERE measurement_id = ?',
        measurement.id,
      );
      if (usage?.count) {
        await db.runAsync(
          'UPDATE equipment_measurements SET retired = 1 WHERE id = ?',
          measurement.id,
        );
      } else {
        await db.runAsync('DELETE FROM equipment_measurements WHERE id = ?', measurement.id);
      }
    }
  });
}
