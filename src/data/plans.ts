import { assertValidPlan } from '../domain/planValidation';
import { getPlanSplit, isPlanSplitKey } from '../domain/planSplits';
import type {
  Plan,
  PlanChecklistItem,
  PlanDay,
  PlanDayItem,
  PlanDayOrdinal,
  PlanDraft,
  PlanExercise,
  PlanExerciseEquipment,
  PlanExerciseMeasurement,
  PlanSummary,
} from '../types/plan';
import { getDatabase } from './database';

type Database = Awaited<ReturnType<typeof getDatabase>>;
type PlanRow = {
  id: string;
  name: string;
  sort_position: number;
  active: number;
  activated_at: string | null;
  split_key: string;
  split_label: string;
  effort: Plan['effort'];
  deload_week: number | null;
  updated_at: string;
  deleted: number;
  sync_status: Plan['syncStatus'];
};
type DayRow = { id: string; plan_id: string; ordinal: number };
type ChecklistRow = {
  id: string;
  plan_id: string;
  kind: PlanChecklistItem['kind'];
  label: string;
  position: number;
};
type DayItemRow = {
  id: string;
  plan_day_id: string;
  kind: PlanDayItem['kind'];
  position: number;
};
type PlanExerciseRow = {
  id: string;
  plan_day_item_id: string;
  source_exercise_id: string;
  name_snapshot: string;
  rep_mode_snapshot: PlanExercise['repMode'];
  sets: number;
  target: number;
  rest_seconds: number;
  tempo: string | null;
  position: number;
};
type PlanEquipmentRow = {
  id: string;
  plan_exercise_id: string;
  source_equipment_id: string;
  name_snapshot: string;
  position: number;
};
type PlanMeasurementRow = {
  id: string;
  plan_exercise_equipment_id: string;
  source_measurement_id: string;
  label_snapshot: string;
  unit_snapshot: string;
  increment_snapshot: number;
  target: number | null;
  position: number;
};

export type PlanSaveDraft = Omit<PlanDraft, 'sortPosition' | 'active' | 'activatedAt'> &
  Partial<Pick<PlanDraft, 'sortPosition' | 'active' | 'activatedAt'>>;

function placeholders(length: number) {
  return Array.from({ length }, () => '?').join(',');
}

function groupBy<T>(values: readonly T[], key: (value: T) => string) {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const groupKey = key(value);
    const group = groups.get(groupKey) ?? [];
    group.push(value);
    groups.set(groupKey, group);
  }
  return groups;
}

async function hydrate(rows: PlanRow[]): Promise<Plan[]> {
  if (!rows.length) return [];
  const db = await getDatabase();
  const planIds = rows.map((row) => row.id);
  const planValues = placeholders(planIds.length);
  const [dayRows, checklistRows] = await Promise.all([
    db.getAllAsync<DayRow>(
      `SELECT * FROM plan_days WHERE plan_id IN (${planValues}) ORDER BY ordinal`,
      ...planIds,
    ),
    db.getAllAsync<ChecklistRow>(
      `SELECT * FROM plan_checklist_items WHERE plan_id IN (${planValues}) ORDER BY kind, position`,
      ...planIds,
    ),
  ]);
  const dayIds = dayRows.map((row) => row.id);
  const itemRows = dayIds.length
    ? await db.getAllAsync<DayItemRow>(
      `SELECT * FROM plan_day_items WHERE plan_day_id IN (${placeholders(dayIds.length)})
       ORDER BY position`,
      ...dayIds,
    )
    : [];
  const itemIds = itemRows.map((row) => row.id);
  const exerciseRows = itemIds.length
    ? await db.getAllAsync<PlanExerciseRow>(
      `SELECT * FROM plan_exercises WHERE plan_day_item_id IN (${placeholders(itemIds.length)})
       ORDER BY position`,
      ...itemIds,
    )
    : [];
  const exerciseIds = exerciseRows.map((row) => row.id);
  const equipmentRows = exerciseIds.length
    ? await db.getAllAsync<PlanEquipmentRow>(
      `SELECT * FROM plan_exercise_equipment
       WHERE plan_exercise_id IN (${placeholders(exerciseIds.length)}) ORDER BY position`,
      ...exerciseIds,
    )
    : [];
  const equipmentIds = equipmentRows.map((row) => row.id);
  const measurementRows = equipmentIds.length
    ? await db.getAllAsync<PlanMeasurementRow>(
      `SELECT * FROM plan_exercise_measurements
       WHERE plan_exercise_equipment_id IN (${placeholders(equipmentIds.length)}) ORDER BY position`,
      ...equipmentIds,
    )
    : [];

  const measurements = groupBy(measurementRows, (row) => row.plan_exercise_equipment_id);
  const equipment = groupBy(equipmentRows, (row) => row.plan_exercise_id);
  const exercises = groupBy(exerciseRows, (row) => row.plan_day_item_id);
  const items = groupBy(itemRows, (row) => row.plan_day_id);
  const days = groupBy(dayRows, (row) => row.plan_id);
  const checklist = groupBy(checklistRows, (row) => row.plan_id);

  const toMeasurement = (row: PlanMeasurementRow): PlanExerciseMeasurement => ({
    id: row.id,
    sourceMeasurementId: row.source_measurement_id,
    label: row.label_snapshot,
    unit: row.unit_snapshot,
    increment: row.increment_snapshot,
    target: row.target,
    position: row.position,
  });
  const toEquipment = (row: PlanEquipmentRow): PlanExerciseEquipment => ({
    id: row.id,
    sourceEquipmentId: row.source_equipment_id,
    name: row.name_snapshot,
    position: row.position,
    measurements: (measurements.get(row.id) ?? []).map(toMeasurement),
  });
  const toExercise = (row: PlanExerciseRow): PlanExercise => ({
    id: row.id,
    sourceExerciseId: row.source_exercise_id,
    name: row.name_snapshot,
    repMode: row.rep_mode_snapshot,
    sets: row.sets,
    target: row.target,
    restSeconds: row.rest_seconds,
    tempo: row.tempo,
    position: row.position,
    equipment: (equipment.get(row.id) ?? []).map(toEquipment),
  });
  const toItem = (row: DayItemRow): PlanDayItem => ({
    id: row.id,
    kind: row.kind,
    position: row.position,
    exercises: (exercises.get(row.id) ?? []).map(toExercise),
  });
  const toDay = (row: DayRow): PlanDay => ({
    id: row.id,
    ordinal: row.ordinal as PlanDayOrdinal,
    items: (items.get(row.id) ?? []).map(toItem),
  });

  return rows.flatMap((row): Plan[] => {
    if (!isPlanSplitKey(row.split_key)) return [];
    return [{
      id: row.id,
      name: row.name,
      sortPosition: row.sort_position,
      active: Boolean(row.active),
      activatedAt: row.activated_at,
      split: { key: row.split_key, label: row.split_label },
      effort: row.effort,
      deloadWeek: row.deload_week,
      days: (days.get(row.id) ?? []).map(toDay),
      checklist: (checklist.get(row.id) ?? []).map((item) => ({
        id: item.id,
        kind: item.kind,
        label: item.label,
        position: item.position,
      })),
      updatedAt: row.updated_at,
      deleted: Boolean(row.deleted),
      syncStatus: row.sync_status,
    }];
  });
}

function toSummary(plan: Plan): PlanSummary {
  return {
    id: plan.id,
    name: plan.name,
    sortPosition: plan.sortPosition,
    active: plan.active,
    activatedAt: plan.activatedAt,
    split: plan.split,
    effort: plan.effort,
    deloadWeek: plan.deloadWeek,
    updatedAt: plan.updatedAt,
    dayCount: plan.days.length,
  };
}

async function getPlanRows(includeDeleted = false) {
  const db = await getDatabase();
  return db.getAllAsync<PlanRow>(
    `SELECT * FROM plans ${includeDeleted ? '' : 'WHERE deleted = 0'}
     ORDER BY active DESC, sort_position, id`,
  );
}

export function listPlans(): Promise<PlanSummary[]>;
export function listPlans(options: { aggregates: true }): Promise<Plan[]>;
export async function listPlans(options?: { aggregates: true }) {
  const plans = await hydrate(await getPlanRows());
  return options?.aggregates ? plans : plans.map(toSummary);
}

export async function listPlanAggregates() {
  return listPlans({ aggregates: true });
}

export async function getPlan(id: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PlanRow>(
    'SELECT * FROM plans WHERE id = ? AND deleted = 0',
    id,
  );
  return row ? (await hydrate([row]))[0] ?? null : null;
}

export async function getActivePlan() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PlanRow>(
    'SELECT * FROM plans WHERE active = 1 AND deleted = 0',
  );
  return row ? (await hydrate([row]))[0] ?? null : null;
}

export function createDefaultPlanDraft(name = 'My Plan'): PlanDraft {
  return {
    name,
    sortPosition: 0,
    active: false,
    activatedAt: null,
    split: getPlanSplit('ppl'),
    effort: 'one_rir',
    deloadWeek: null,
    days: Array.from({ length: 4 }, (_, index) => ({
      id: crypto.randomUUID(),
      ordinal: (index + 1) as PlanDayOrdinal,
      items: [],
    })),
    checklist: [],
  };
}

async function replaceChildren(db: Database, plan: Plan) {
  await db.runAsync('DELETE FROM plan_days WHERE plan_id = ?', plan.id);
  await db.runAsync('DELETE FROM plan_checklist_items WHERE plan_id = ?', plan.id);
  for (const day of plan.days) {
    await db.runAsync(
      'INSERT INTO plan_days (id, plan_id, ordinal) VALUES (?, ?, ?)',
      day.id,
      plan.id,
      day.ordinal,
    );
    for (const item of day.items) {
      await db.runAsync(
        'INSERT INTO plan_day_items (id, plan_day_id, kind, position) VALUES (?, ?, ?, ?)',
        item.id,
        day.id,
        item.kind,
        item.position,
      );
      for (const exercise of item.exercises) {
        await db.runAsync(
          `INSERT INTO plan_exercises
            (id, plan_day_item_id, source_exercise_id, name_snapshot, rep_mode_snapshot,
             sets, target, rest_seconds, tempo, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exercise.id,
          item.id,
          exercise.sourceExerciseId,
          exercise.name.trim(),
          exercise.repMode,
          exercise.sets,
          exercise.target,
          exercise.restSeconds,
          exercise.tempo || null,
          exercise.position,
        );
        for (const equipment of exercise.equipment) {
          await db.runAsync(
            `INSERT INTO plan_exercise_equipment
              (id, plan_exercise_id, source_equipment_id, name_snapshot, position)
             VALUES (?, ?, ?, ?, ?)`,
            equipment.id,
            exercise.id,
            equipment.sourceEquipmentId,
            equipment.name.trim(),
            equipment.position,
          );
          for (const measurement of equipment.measurements) {
            await db.runAsync(
              `INSERT INTO plan_exercise_measurements
                (id, plan_exercise_equipment_id, source_measurement_id, label_snapshot,
                 unit_snapshot, increment_snapshot, target, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              measurement.id,
              equipment.id,
              measurement.sourceMeasurementId,
              measurement.label.trim(),
              measurement.unit.trim(),
              measurement.increment,
              measurement.target,
              measurement.position,
            );
          }
        }
      }
    }
  }
  for (const item of plan.checklist) {
    await db.runAsync(
      `INSERT INTO plan_checklist_items (id, plan_id, kind, label, position)
       VALUES (?, ?, ?, ?, ?)`,
      item.id,
      plan.id,
      item.kind,
      item.label.trim(),
      item.position,
    );
  }
}

async function writeAggregate(db: Database, plan: Plan) {
  await db.runAsync(
    `INSERT INTO plans
      (id, name, sort_position, active, activated_at, split_key, split_label, effort,
       deload_week, updated_at, deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, sort_position = excluded.sort_position,
       active = excluded.active, activated_at = excluded.activated_at,
       split_key = excluded.split_key, split_label = excluded.split_label,
       effort = excluded.effort, deload_week = excluded.deload_week,
       updated_at = excluded.updated_at,
       deleted = excluded.deleted, sync_status = excluded.sync_status`,
    plan.id,
    plan.name.trim(),
    plan.sortPosition,
    plan.active && !plan.deleted ? 1 : 0,
    plan.active && !plan.deleted ? plan.activatedAt : null,
    plan.split.key,
    plan.split.label.trim(),
    plan.effort,
    plan.deloadWeek,
    plan.updatedAt,
    plan.deleted ? 1 : 0,
    plan.syncStatus,
  );
  await replaceChildren(db, plan);
}

async function orderedInactiveRows(db: Database, excludedId?: string) {
  return db.getAllAsync<PlanRow>(
    `SELECT * FROM plans
     WHERE deleted = 0 AND active = 0 ${excludedId ? 'AND id != ?' : ''}
     ORDER BY sort_position, id`,
    ...(excludedId ? [excludedId] : []),
  );
}

async function setInactiveOrder(
  db: Database,
  rows: readonly PlanRow[],
  timestamp: string,
) {
  for (const [position, row] of rows.entries()) {
    if (row.sort_position === position) continue;
    await db.runAsync(
      `UPDATE plans SET sort_position = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      position,
      timestamp,
      row.id,
    );
  }
}

async function normalizePlanOrder(db: Database, timestamp: string) {
  const activeRows = await db.getAllAsync<PlanRow>(
    'SELECT * FROM plans WHERE active = 1 AND deleted = 0',
  );
  for (const row of activeRows) {
    if (row.sort_position === -1) continue;
    await db.runAsync(
      `UPDATE plans SET sort_position = -1, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      timestamp,
      row.id,
    );
  }
  await setInactiveOrder(db, await orderedInactiveRows(db), timestamp);
}

function compareActivation(left: PlanRow, right: PlanRow) {
  return (left.activated_at ?? '').localeCompare(right.activated_at ?? '') ||
    left.updated_at.localeCompare(right.updated_at) || left.id.localeCompare(right.id);
}

export async function reconcilePlans() {
  const db = await getDatabase();
  const timestamp = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const activeRows = await db.getAllAsync<PlanRow>(
      'SELECT * FROM plans WHERE active = 1 AND deleted = 0',
    );
    const winner = activeRows.sort(compareActivation).at(-1);
    for (const row of activeRows) {
      if (row.id === winner?.id) continue;
      await db.runAsync(
        `UPDATE plans SET active = 0, activated_at = NULL, updated_at = ?, sync_status = 'pending'
         WHERE id = ?`,
        timestamp,
        row.id,
      );
    }
    await normalizePlanOrder(db, timestamp);
  });
}

export async function savePlan(draft: PlanSaveDraft, id = crypto.randomUUID()) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  let savedPlan: Plan | undefined;
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<PlanRow>('SELECT * FROM plans WHERE id = ?', id);
    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM plans WHERE deleted = 0',
    );
    const first = !existing && (count?.count ?? 0) === 0;
    const requestedActive = first || (draft.active ?? Boolean(existing?.active));
    const newlyActivated = requestedActive && !existing?.active;
    const inactiveRows = await orderedInactiveRows(db, id);
    const currentActive = await db.getFirstAsync<PlanRow>(
      'SELECT * FROM plans WHERE active = 1 AND deleted = 0 AND id != ?',
      id,
    );

    if (newlyActivated && currentActive) {
      await db.runAsync(
        `UPDATE plans SET active = 0, activated_at = NULL, sort_position = 0,
         updated_at = ?, sync_status = 'pending' WHERE id = ?`,
        now,
        currentActive.id,
      );
    }

    const inactivePosition = existing && !existing.active
      ? existing.sort_position
      : inactiveRows.length;
    const plan: Plan = {
      ...draft,
      id,
      sortPosition: requestedActive ? -1 : inactivePosition,
      active: requestedActive,
      activatedAt: requestedActive
        ? newlyActivated ? now : existing?.activated_at ?? now
        : null,
      updatedAt: now,
      deleted: false,
      syncStatus: 'pending',
    };
    assertValidPlan(plan);
    await writeAggregate(db, plan);
    if (newlyActivated && currentActive) {
      await setInactiveOrder(db, [currentActive, ...inactiveRows], now);
    } else {
      await normalizePlanOrder(db, now);
    }
    savedPlan = plan;
  });
  return (await getPlan(savedPlan!.id))!;
}

export async function activatePlan(id: string) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const target = await db.getFirstAsync<PlanRow>(
      'SELECT * FROM plans WHERE id = ? AND deleted = 0',
      id,
    );
    if (!target) throw new Error('Plan not found.');
    const current = await db.getFirstAsync<PlanRow>(
      'SELECT * FROM plans WHERE active = 1 AND deleted = 0',
    );
    if (current?.id === id) return;
    if (current) {
      await db.runAsync(
        `UPDATE plans SET active = 0, activated_at = NULL, sort_position = 0,
         updated_at = ?, sync_status = 'pending'
         WHERE id = ?`,
        now,
        current.id,
      );
    }
    await db.runAsync(
      `UPDATE plans SET active = 1, activated_at = ?, sort_position = -1,
       updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      now,
      now,
      id,
    );
    const remaining = await orderedInactiveRows(db, current?.id);
    await setInactiveOrder(db, current ? [current, ...remaining] : remaining, now);
  });
  return getActivePlan();
}

export async function reorderInactivePlans(ids: readonly string[]) {
  const db = await getDatabase();
  const rows = await orderedInactiveRows(db);
  const existingIds = rows.map((row) => row.id);
  if (ids.length !== existingIds.length || new Set(ids).size !== ids.length ||
      ids.some((id) => !existingIds.includes(id))) {
    throw new Error('Plan order must contain every nondeleted inactive plan exactly once.');
  }
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const [position, id] of ids.entries()) {
      if (rows.find((row) => row.id === id)?.sort_position === position) continue;
      await db.runAsync(
        `UPDATE plans SET sort_position = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
        position,
        now,
        id,
      );
    }
  });
}

export async function deletePlan(id: string) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const deleted = await db.getFirstAsync<PlanRow>(
      'SELECT * FROM plans WHERE id = ? AND deleted = 0',
      id,
    );
    if (!deleted) return;
    await db.runAsync(
      `UPDATE plans SET deleted = 1, active = 0, activated_at = NULL,
       updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      now,
      id,
    );
    if (deleted.active) {
      const next = (await orderedInactiveRows(db))[0];
      if (next) {
        await db.runAsync(
          `UPDATE plans SET active = 1, activated_at = ?, sort_position = -1,
           updated_at = ?, sync_status = 'pending'
           WHERE id = ?`,
          now,
          now,
          next.id,
        );
      }
    }
    await normalizePlanOrder(db, now);
  });
}

export async function listPendingPlans() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PlanRow>(
    `SELECT * FROM plans WHERE sync_status = 'pending' ORDER BY updated_at, id`,
  );
  return hydrate(rows);
}

export async function markPlanSynced(id: string, expectedUpdatedAt: string) {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE plans SET sync_status = 'synced' WHERE id = ? AND updated_at = ?`,
    id,
    expectedUpdatedAt,
  );
}

export async function mergeRemotePlan(plan: Plan) {
  const db = await getDatabase();
  const local = await db.getFirstAsync<PlanRow>('SELECT * FROM plans WHERE id = ?', plan.id);
  if (local?.sync_status === 'pending' && local.updated_at >= plan.updatedAt) return false;
  if (!plan.deleted) assertValidPlan(plan);

  await db.withTransactionAsync(async () => {
    const now = new Date().toISOString();
    let incoming = { ...plan };
    if (incoming.active && !incoming.deleted) {
      const activeRows = await db.getAllAsync<PlanRow>(
        'SELECT * FROM plans WHERE active = 1 AND deleted = 0 AND id != ?',
        incoming.id,
      );
      if (activeRows.length) {
        const incomingRow: PlanRow = {
          id: incoming.id,
          name: incoming.name,
          sort_position: -1,
          active: 1,
          activated_at: incoming.activatedAt,
          split_key: incoming.split.key,
          split_label: incoming.split.label,
          effort: incoming.effort,
          deload_week: incoming.deloadWeek,
          updated_at: incoming.updatedAt,
          deleted: 0,
          sync_status: incoming.syncStatus,
        };
        const winner = [...activeRows, incomingRow].sort(compareActivation).at(-1);
        if (winner?.id === incoming.id) {
          for (const active of activeRows) {
            await db.runAsync(
              `UPDATE plans SET active = 0, activated_at = NULL,
               updated_at = ?, sync_status = 'pending' WHERE id = ?`,
              now,
              active.id,
            );
          }
        } else {
          incoming = {
            ...incoming,
            sortPosition: 0,
            active: false,
            activatedAt: null,
            updatedAt: now,
            syncStatus: 'pending',
          };
        }
      }
    }
    if (incoming.active) incoming = { ...incoming, sortPosition: -1 };
    await writeAggregate(db, incoming);
    if (incoming.deleted && local?.active) {
      const next = (await orderedInactiveRows(db))[0];
      if (next) {
        await db.runAsync(
          `UPDATE plans SET active = 1, activated_at = ?, sort_position = -1,
           updated_at = ?, sync_status = 'pending'
           WHERE id = ?`,
          now,
          now,
          next.id,
        );
      }
    }
    await normalizePlanOrder(db, now);
  });
  return true;
}
