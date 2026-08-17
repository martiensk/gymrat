import {
  Account,
  AppwriteException,
  Databases,
  ID,
  Permission,
  Query,
  Role,
  createAppwriteServices,
  type AppwriteDocument,
} from './appwrite';

import {
  appwriteConfig,
  canSyncEquipment,
  canSyncExercises,
  canSyncPlans,
  canSyncWorkouts,
  isAppwriteConfigured,
} from '../config/appwrite';
import {
  getSyncCursor,
  initializeDatabase,
  listPendingWorkouts,
  markWorkoutSynced,
  mergeRemoteWorkout,
  setSyncCursor,
} from '../data/database';
import {
  listPendingEquipment,
  markEquipmentSynced,
  mergeRemoteEquipment,
} from '../data/equipment';
import {
  listPendingExercises,
  markExerciseSynced,
  mergeRemoteExercise,
} from '../data/exercises';
import {
  listPendingPlans,
  markPlanSynced,
  mergeRemotePlan,
  reconcilePlans,
} from '../data/plans';
import { followsIncrement, isValidTempo, isValidYouTubeUrl } from '../domain/exerciseValidation';
import { isMuscleId } from '../domain/muscles';
import { assertValidPlan } from '../domain/planValidation';
import { isPlanSplitKey } from '../domain/planSplits';
import type { Equipment, EquipmentMeasurement } from '../types/equipment';
import type { Exercise, ExerciseEquipment } from '../types/exercise';
import type {
  Plan,
  PlanChecklistItem,
  PlanDay,
  PlanDayItem,
  PlanExercise,
  PlanExerciseEquipment,
  PlanExerciseMeasurement,
} from '../types/plan';
import type { Workout } from '../types/workout';

type RemoteWorkout = AppwriteDocument & {
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  performedAt: string;
  updatedAt: string;
  deleted: boolean;
  ownerId: string;
};

type RemoteEquipment = AppwriteDocument & {
  name: string;
  measurements: string;
  thumbnailRemoteFileId?: string | null;
  updatedAt: string;
  deleted: boolean;
  ownerId: string;
};

type RemoteExercise = AppwriteDocument & {
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string;
  youtubeUrl?: string | null;
  repMode: string;
  defaultSets: number;
  defaultTarget: number;
  defaultRestSeconds: number;
  defaultTempo?: string | null;
  equipmentConfig: string;
  thumbnailRemoteFileId?: string | null;
  updatedAt: string;
  deleted: boolean;
  ownerId: string;
};

type RemotePlan = AppwriteDocument & {
  name: unknown;
  sortPosition?: unknown;
  queuePosition?: unknown;
  active: unknown;
  activatedAt?: unknown;
  splitKey: unknown;
  splitLabel: unknown;
  effort: unknown;
  configuration: unknown;
  updatedAt: unknown;
  deleted: unknown;
  ownerId: unknown;
};

type PlanConfiguration = Pick<Plan, 'days' | 'checklist' | 'deloadWeek'> & {
  schemaVersion: 3;
};

let activeSync: Promise<void> | undefined;
let services: { account: Account; databases: Databases } | undefined;
const syncListeners = new Set<() => void>();

function getServices() {
  if (!services) {
    services = createAppwriteServices(appwriteConfig);
  }
  return services;
}

async function getUser(account: Account) {
  try {
    return await account.get();
  } catch (error) {
    if (!(error instanceof AppwriteException) || error.code !== 401) {
      throw error;
    }
    await account.createAnonymousSession();
    return account.get();
  }
}

function toRemoteData(workout: Workout, ownerId: string) {
  return {
    exercise: workout.exercise,
    sets: workout.sets,
    reps: workout.reps,
    weight: workout.weight,
    performedAt: workout.performedAt,
    updatedAt: workout.updatedAt,
    deleted: workout.deleted,
    ownerId,
  };
}

async function pushPending(databases: Databases, ownerId: string) {
  for (const workout of await listPendingWorkouts()) {
    const data = toRemoteData(workout, ownerId);
    try {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.workoutsCollectionId,
        workout.id || ID.unique(),
        data,
        [
          Permission.read(Role.user(ownerId)),
          Permission.update(Role.user(ownerId)),
          Permission.delete(Role.user(ownerId)),
        ],
      );
    } catch (error) {
      if (!(error instanceof AppwriteException) || error.code !== 409) {
        throw error;
      }
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.workoutsCollectionId,
        workout.id,
        data,
      );
    }
    await markWorkoutSynced(workout.id, workout.updatedAt);
  }
}

async function pullRemote(databases: Databases, ownerId: string) {
  const cursor = await getSyncCursor();
  let latestCursor = cursor;
  let pageCursor: string | undefined;

  while (true) {
    const queries = [
      Query.equal('ownerId', ownerId),
      Query.greaterThan('$updatedAt', cursor),
      Query.orderAsc('$updatedAt'),
      Query.limit(100),
    ];
    if (pageCursor) queries.push(Query.cursorAfter(pageCursor));

    const result = await databases.listDocuments<RemoteWorkout>(
      appwriteConfig.databaseId,
      appwriteConfig.workoutsCollectionId,
      queries,
    );

    if (result.documents.length === 0) break;

    for (const document of result.documents) {
      await mergeRemoteWorkout({
        id: document.$id,
        exercise: document.exercise,
        sets: document.sets,
        reps: document.reps,
        weight: document.weight,
        performedAt: document.performedAt,
        updatedAt: document.updatedAt,
        deleted: document.deleted,
        syncStatus: 'synced',
      });
      latestCursor = document.$updatedAt;
    }

    if (result.documents.length < 100) break;
    pageCursor = result.documents.at(-1)?.$id;
  }

  if (latestCursor !== cursor) await setSyncCursor(latestCursor);
}

function toRemoteEquipment(equipment: Equipment, ownerId: string) {
  return {
    name: equipment.name,
    measurements: JSON.stringify(
      equipment.measurements.map(({ id, label, unit, increment, defaultValue, position }) => ({
        id,
        label,
        unit,
        increment,
        defaultValue,
        position,
      })),
    ),
    thumbnailRemoteFileId: equipment.thumbnailRemoteFileId,
    updatedAt: equipment.updatedAt,
    deleted: equipment.deleted,
    ownerId,
  };
}

async function pushPendingEquipment(databases: Databases, ownerId: string) {
  for (const equipment of await listPendingEquipment()) {
    const data = toRemoteEquipment(equipment, ownerId);
    try {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.equipmentCollectionId,
        equipment.id,
        data,
        [
          Permission.read(Role.user(ownerId)),
          Permission.update(Role.user(ownerId)),
          Permission.delete(Role.user(ownerId)),
        ],
      );
    } catch (error) {
      if (!(error instanceof AppwriteException) || error.code !== 409) throw error;
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.equipmentCollectionId,
        equipment.id,
        data,
      );
    }
    await markEquipmentSynced(equipment.id, equipment.updatedAt);
  }
}

function parseMeasurements(value: string, equipmentId: string): EquipmentMeasurement[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const measurements: EquipmentMeasurement[] = [];
  for (const [index, item] of parsed.entries()) {
    if (!item || typeof item !== 'object') return null;
    const value = item as Record<string, unknown>;
    if (
      typeof value.id !== 'string' ||
      typeof value.label !== 'string' ||
      typeof value.unit !== 'string' ||
      typeof value.increment !== 'number' ||
      value.increment <= 0
    ) {
      return null;
    }
    measurements.push({
      id: value.id,
      equipmentId,
      label: value.label,
      unit: value.unit,
      increment: value.increment,
      defaultValue: typeof value.defaultValue === 'number' ? value.defaultValue : null,
      position: typeof value.position === 'number' ? value.position : index,
    });
  }
  return measurements;
}

function toRemoteExercise(exercise: Exercise, ownerId: string) {
  return {
    name: exercise.name,
    primaryMuscle: exercise.primaryMuscle,
    secondaryMuscles: JSON.stringify(exercise.secondaryMuscles),
    youtubeUrl: exercise.youtubeUrl,
    repMode: exercise.repMode,
    defaultSets: exercise.defaultSets,
    defaultTarget: exercise.defaultTarget,
    defaultRestSeconds: exercise.defaultRestSeconds,
    defaultTempo: exercise.defaultTempo,
    equipmentConfig: JSON.stringify(exercise.equipment.map((equipment) => ({
      id: equipment.id,
      equipmentId: equipment.equipmentId,
      equipmentName: equipment.equipmentName,
      position: equipment.position,
      measurements: equipment.measurements.map((measurement) => ({
        id: measurement.id,
        measurementId: measurement.measurementId,
        label: measurement.label,
        unit: measurement.unit,
        increment: measurement.increment,
        defaultValue: measurement.defaultValue,
      })),
    }))),
    thumbnailRemoteFileId: exercise.thumbnailRemoteFileId,
    updatedAt: exercise.updatedAt,
    deleted: exercise.deleted,
    ownerId,
  };
}

async function pushPendingExercises(databases: Databases, ownerId: string) {
  for (const exercise of await listPendingExercises()) {
    const data = toRemoteExercise(exercise, ownerId);
    try {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.exercisesCollectionId,
        exercise.id,
        data,
        [
          Permission.read(Role.user(ownerId)),
          Permission.update(Role.user(ownerId)),
          Permission.delete(Role.user(ownerId)),
        ],
      );
    } catch (error) {
      if (!(error instanceof AppwriteException) || error.code !== 409) throw error;
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.exercisesCollectionId,
        exercise.id,
        data,
      );
    }
    await markExerciseSynced(exercise.id, exercise.updatedAt);
  }
}

function parseExerciseEquipment(value: string): ExerciseEquipment[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const equipment: ExerciseEquipment[] = [];
  for (const [position, item] of parsed.entries()) {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      typeof row.equipmentId !== 'string' ||
      typeof row.equipmentName !== 'string' ||
      !Array.isArray(row.measurements)
    ) return null;
    const measurements = [];
    for (const measurement of row.measurements) {
      if (!measurement || typeof measurement !== 'object') return null;
      const axis = measurement as Record<string, unknown>;
      if (
        typeof axis.id !== 'string' ||
        typeof axis.measurementId !== 'string' ||
        typeof axis.label !== 'string' ||
        typeof axis.unit !== 'string' ||
        typeof axis.increment !== 'number' ||
        axis.increment <= 0 ||
        (axis.defaultValue !== null && axis.defaultValue !== undefined &&
          (typeof axis.defaultValue !== 'number' ||
            !followsIncrement(axis.defaultValue, axis.increment)))
      ) return null;
      measurements.push({
        id: axis.id,
        measurementId: axis.measurementId,
        label: axis.label,
        unit: axis.unit,
        increment: axis.increment,
        defaultValue: typeof axis.defaultValue === 'number' ? axis.defaultValue : null,
        unavailable: false,
      });
    }
    equipment.push({
      id: row.id,
      equipmentId: row.equipmentId,
      equipmentName: row.equipmentName,
      unavailable: false,
      position: typeof row.position === 'number' ? row.position : position,
      measurements,
    });
  }
  return equipment;
}

function parseRemoteExercise(document: RemoteExercise): Exercise | null {
  let secondary: unknown;
  try {
    secondary = JSON.parse(document.secondaryMuscles);
  } catch {
    return null;
  }
  const equipment = parseExerciseEquipment(document.equipmentConfig);
  if (
    !isMuscleId(document.primaryMuscle) ||
    !Array.isArray(secondary) ||
    !secondary.every(isMuscleId) ||
    secondary.includes(document.primaryMuscle) ||
    (document.repMode !== 'count' && document.repMode !== 'time') ||
    !Number.isInteger(document.defaultSets) ||
    document.defaultSets <= 0 ||
    !Number.isInteger(document.defaultTarget) ||
    document.defaultTarget <= 0 ||
    !Number.isInteger(document.defaultRestSeconds) ||
    document.defaultRestSeconds < 0 ||
    !isValidTempo(document.defaultTempo || '') ||
    !isValidYouTubeUrl(document.youtubeUrl || '') ||
    !document.name.trim() ||
    !equipment
  ) return null;
  return {
    id: document.$id,
    name: document.name,
    thumbnailDataUri: null,
    thumbnailRemoteFileId: document.thumbnailRemoteFileId || null,
    primaryMuscle: document.primaryMuscle,
    secondaryMuscles: secondary,
    youtubeUrl: document.youtubeUrl || null,
    repMode: document.repMode,
    defaultSets: document.defaultSets,
    defaultTarget: document.defaultTarget,
    defaultRestSeconds: document.defaultRestSeconds,
    defaultTempo: document.defaultTempo || null,
    equipment,
    updatedAt: document.updatedAt,
    deleted: document.deleted,
    syncStatus: 'synced',
  };
}

async function pullRemoteExercises(databases: Databases, ownerId: string) {
  const cursorKey = 'exercises_remote_cursor';
  const cursor = await getSyncCursor(cursorKey);
  let latestCursor = cursor;
  let pageCursor: string | undefined;
  while (true) {
    const queries = [
      Query.equal('ownerId', ownerId),
      Query.greaterThan('$updatedAt', cursor),
      Query.orderAsc('$updatedAt'),
      Query.limit(100),
    ];
    if (pageCursor) queries.push(Query.cursorAfter(pageCursor));
    const result = await databases.listDocuments<RemoteExercise>(
      appwriteConfig.databaseId,
      appwriteConfig.exercisesCollectionId,
      queries,
    );
    if (!result.documents.length) break;
    for (const document of result.documents) {
      const exercise = parseRemoteExercise(document);
      if (exercise) await mergeRemoteExercise(exercise);
      else console.warn(`Ignored malformed exercise document ${document.$id}.`);
      latestCursor = document.$updatedAt;
    }
    if (result.documents.length < 100) break;
    pageCursor = result.documents.at(-1)?.$id;
  }
  if (latestCursor !== cursor) await setSyncCursor(latestCursor, cursorKey);
}

async function pullRemoteEquipment(databases: Databases, ownerId: string) {
  const cursorKey = 'equipment_remote_cursor';
  const cursor = await getSyncCursor(cursorKey);
  let latestCursor = cursor;
  let pageCursor: string | undefined;

  while (true) {
    const queries = [
      Query.equal('ownerId', ownerId),
      Query.greaterThan('$updatedAt', cursor),
      Query.orderAsc('$updatedAt'),
      Query.limit(100),
    ];
    if (pageCursor) queries.push(Query.cursorAfter(pageCursor));
    const result = await databases.listDocuments<RemoteEquipment>(
      appwriteConfig.databaseId,
      appwriteConfig.equipmentCollectionId,
      queries,
    );
    if (result.documents.length === 0) break;

    for (const document of result.documents) {
      const measurements = parseMeasurements(document.measurements, document.$id);
      if (!measurements) {
        console.warn(`Ignored malformed equipment document ${document.$id}.`);
        latestCursor = document.$updatedAt;
        continue;
      }
      await mergeRemoteEquipment({
        id: document.$id,
        name: document.name,
        thumbnailDataUri: null,
        thumbnailRemoteFileId: document.thumbnailRemoteFileId || null,
        measurements,
        updatedAt: document.updatedAt,
        deleted: document.deleted,
        syncStatus: 'synced',
      });
      latestCursor = document.$updatedAt;
    }
    if (result.documents.length < 100) break;
    pageCursor = result.documents.at(-1)?.$id;
  }
  if (latestCursor !== cursor) await setSyncCursor(latestCursor, cursorKey);
}

function toRemotePlan(plan: Plan, ownerId: string) {
  const configuration: PlanConfiguration = {
    schemaVersion: 3,
    deloadWeek: plan.deloadWeek,
    days: plan.days.map((day) => ({
      id: day.id,
      ordinal: day.ordinal,
      items: day.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        position: item.position,
        exercises: item.exercises.map((exercise) => ({
          id: exercise.id,
          sourceExerciseId: exercise.sourceExerciseId,
          name: exercise.name,
          repMode: exercise.repMode,
          sets: exercise.sets,
          target: exercise.target,
          restSeconds: exercise.restSeconds,
          tempo: exercise.tempo,
          position: exercise.position,
          equipment: exercise.equipment.map((equipment) => ({
            id: equipment.id,
            sourceEquipmentId: equipment.sourceEquipmentId,
            name: equipment.name,
            position: equipment.position,
            measurements: equipment.measurements.map((measurement) => ({
              id: measurement.id,
              sourceMeasurementId: measurement.sourceMeasurementId,
              label: measurement.label,
              unit: measurement.unit,
              increment: measurement.increment,
              target: measurement.target,
              position: measurement.position,
            })),
          })),
        })),
      })),
    })),
    checklist: plan.checklist.map((item) => ({
      id: item.id,
      kind: item.kind,
      label: item.label,
      position: item.position,
    })),
  };
  return {
    name: plan.name,
    sortPosition: plan.sortPosition,
    active: plan.active,
    activatedAt: plan.activatedAt,
    splitKey: plan.split.key,
    splitLabel: plan.split.label,
    effort: plan.effort,
    configuration: JSON.stringify(configuration),
    updatedAt: plan.updatedAt,
    deleted: plan.deleted,
    ownerId,
  };
}

async function pushPendingPlans(databases: Databases, ownerId: string) {
  for (const plan of await listPendingPlans()) {
    const data = toRemotePlan(plan, ownerId);
    try {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.plansCollectionId,
        plan.id,
        data,
        [
          Permission.read(Role.user(ownerId)),
          Permission.update(Role.user(ownerId)),
          Permission.delete(Role.user(ownerId)),
        ],
      );
    } catch (error) {
      if (!(error instanceof AppwriteException) || error.code !== 409) throw error;
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.plansCollectionId,
        plan.id,
        data,
      );
    }
    await markPlanSynced(plan.id, plan.updatedAt);
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object.');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Expected an array.');
  return value;
}

function asNonemptyString(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Expected a nonempty string.');
  return value;
}

function asString(value: unknown) {
  if (typeof value !== 'string') throw new Error('Expected a string.');
  return value;
}

function asInteger(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new Error('Expected an integer in range.');
  }
  return value as number;
}

function asFiniteNumber(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Expected a finite number.');
  }
  return value;
}

function asBoolean(value: unknown) {
  if (typeof value !== 'boolean') throw new Error('Expected a boolean.');
  return value;
}

function asDateTime(value: unknown) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) throw new Error('Expected a datetime.');
  return value;
}

function asNullableDateTime(value: unknown) {
  return value === null || value === undefined ? null : asDateTime(value);
}

function parsePlanMeasurement(value: unknown): PlanExerciseMeasurement {
  const row = asRecord(value);
  const target = row.target === null ? null : asFiniteNumber(row.target);
  return {
    id: asNonemptyString(row.id),
    sourceMeasurementId: asNonemptyString(row.sourceMeasurementId),
    label: asNonemptyString(row.label),
    unit: asString(row.unit),
    increment: asFiniteNumber(row.increment),
    target,
    position: asInteger(row.position, 0),
  };
}

function parsePlanEquipment(value: unknown): PlanExerciseEquipment {
  const row = asRecord(value);
  return {
    id: asNonemptyString(row.id),
    sourceEquipmentId: asNonemptyString(row.sourceEquipmentId),
    name: asNonemptyString(row.name),
    position: asInteger(row.position, 0),
    measurements: asArray(row.measurements).map(parsePlanMeasurement),
  };
}

function parsePlanExercise(value: unknown): PlanExercise {
  const row = asRecord(value);
  const repMode = row.repMode;
  if (repMode !== 'count' && repMode !== 'time') throw new Error('Invalid rep mode.');
  const tempo = row.tempo === null ? null : asString(row.tempo);
  if (!isValidTempo(tempo ?? '')) throw new Error('Invalid tempo.');
  return {
    id: asNonemptyString(row.id),
    sourceExerciseId: asNonemptyString(row.sourceExerciseId),
    name: asNonemptyString(row.name),
    repMode,
    sets: asInteger(row.sets, 1),
    target: asInteger(row.target, 1),
    restSeconds: asInteger(row.restSeconds, 0),
    tempo,
    position: asInteger(row.position, 0),
    equipment: asArray(row.equipment).map(parsePlanEquipment),
  };
}

function parsePlanDayItem(value: unknown): PlanDayItem {
  const row = asRecord(value);
  const kind = row.kind;
  if (kind !== 'standalone' && kind !== 'superset') throw new Error('Invalid plan item kind.');
  return {
    id: asNonemptyString(row.id),
    kind,
    position: asInteger(row.position, 0),
    exercises: asArray(row.exercises).map(parsePlanExercise),
  };
}

function parsePlanDay(value: unknown): PlanDay {
  const row = asRecord(value);
  const ordinal = asInteger(row.ordinal, 1, 7) as PlanDay['ordinal'];
  return {
    id: asNonemptyString(row.id),
    ordinal,
    items: asArray(row.items).map(parsePlanDayItem),
  };
}

function parsePlanChecklistItem(value: unknown): PlanChecklistItem {
  const row = asRecord(value);
  const kind = row.kind;
  if (kind !== 'warmup' && kind !== 'cooldown') throw new Error('Invalid checklist kind.');
  return {
    id: asNonemptyString(row.id),
    kind,
    label: asNonemptyString(row.label),
    position: asInteger(row.position, 0),
  };
}

function parseRemotePlan(document: RemotePlan, ownerId: string): Plan | null {
  try {
    if (document.ownerId !== ownerId) throw new Error('Invalid owner.');
    const configurationValue = asString(document.configuration);
    const configuration = asRecord(JSON.parse(configurationValue) as unknown);
    const schemaVersion = asInteger(configuration.schemaVersion, 1, 3);
    const deloadWeek = schemaVersion === 3
      ? configuration.deloadWeek === null
        ? null
        : asInteger(configuration.deloadWeek, 2, 52)
      : null;
    const active = asBoolean(document.active);
    const activatedAt = asNullableDateTime(document.activatedAt);
    const deleted = asBoolean(document.deleted);
    if (active !== Boolean(activatedAt) || (active && deleted)) {
      throw new Error('Invalid activation state.');
    }
    const splitKey = asNonemptyString(document.splitKey);
    if (!isPlanSplitKey(splitKey)) throw new Error('Invalid split.');
    const effort = document.effort;
    if (effort !== 'one_rir' && effort !== 'failure') throw new Error('Invalid effort.');
    const legacyPosition = document.sortPosition === undefined;
    const remotePosition = legacyPosition ? document.queuePosition : document.sortPosition;
    const parsedPosition = asInteger(remotePosition, active || deleted ? -1 : 0);
    if (!legacyPosition && active && parsedPosition !== -1) {
      throw new Error('Invalid active plan position.');
    }
    if (!active && !deleted && parsedPosition < 0) {
      throw new Error('Invalid inactive plan position.');
    }
    const plan: Plan = {
      id: asNonemptyString(document.$id),
      name: asNonemptyString(document.name),
      sortPosition: active ? -1 : parsedPosition,
      active,
      activatedAt,
      split: { key: splitKey, label: asNonemptyString(document.splitLabel) },
      effort,
      deloadWeek,
      days: asArray(configuration.days).map(parsePlanDay),
      checklist: asArray(configuration.checklist).map(parsePlanChecklistItem),
      updatedAt: asDateTime(document.updatedAt),
      deleted,
      syncStatus: 'synced',
    };
    assertValidPlan(plan);
    return plan;
  } catch {
    return null;
  }
}

async function pullRemotePlans(databases: Databases, ownerId: string) {
  const cursorKey = 'plans_remote_cursor';
  const cursor = await getSyncCursor(cursorKey);
  let latestCursor = cursor;
  let pageCursor: string | undefined;
  while (true) {
    const queries = [
      Query.equal('ownerId', ownerId),
      Query.greaterThan('$updatedAt', cursor),
      Query.orderAsc('$updatedAt'),
      Query.limit(100),
    ];
    if (pageCursor) queries.push(Query.cursorAfter(pageCursor));
    const result = await databases.listDocuments<RemotePlan>(
      appwriteConfig.databaseId,
      appwriteConfig.plansCollectionId,
      queries,
    );
    if (!result.documents.length) break;
    for (const document of result.documents) {
      const plan = parseRemotePlan(document, ownerId);
      if (plan) await mergeRemotePlan(plan);
      else console.warn(`Ignored malformed plan document ${document.$id}.`);
      latestCursor = document.$updatedAt;
    }
    if (result.documents.length < 100) break;
    pageCursor = result.documents.at(-1)?.$id;
  }
  if (latestCursor !== cursor) await setSyncCursor(latestCursor, cursorKey);
}

async function runSync() {
  if (
    !isAppwriteConfigured ||
    (!canSyncWorkouts && !canSyncEquipment && !canSyncExercises && !canSyncPlans)
  ) return;
  await initializeDatabase();
  const { account, databases } = getServices();
  const user = await getUser(account);
  if (canSyncEquipment) {
    await pullRemoteEquipment(databases, user.$id);
    await pushPendingEquipment(databases, user.$id);
  }
  if (canSyncExercises) {
    await pullRemoteExercises(databases, user.$id);
    await pushPendingExercises(databases, user.$id);
  }
  if (canSyncPlans) {
    await pullRemotePlans(databases, user.$id);
    await reconcilePlans();
    await pushPendingPlans(databases, user.$id);
  }
  if (canSyncWorkouts) {
    await pullRemote(databases, user.$id);
    await pushPending(databases, user.$id);
  }
}

export function syncAll() {
  if (!activeSync) {
    activeSync = runSync()
      .then(() => {
        syncListeners.forEach((listener) => listener());
      })
      .finally(() => {
        activeSync = undefined;
      });
  }
  return activeSync;
}

export function subscribeToSync(listener: () => void) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}
