import type { Exercise, ExerciseRepMode } from './exercise';
import type { SyncStatus } from './workout';

export type PlanSplitKey =
  | 'ppl'
  | 'upper_lower'
  | 'full_body'
  | 'push_pull'
  | 'body_part'
  | 'custom';

export type PlanSplit = {
  key: PlanSplitKey;
  label: string;
};

export type PlanEffort = 'one_rir' | 'failure';
export type PlanDayOrdinal = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PlanDayItemKind = 'standalone' | 'superset';
export type PlanChecklistKind = 'warmup' | 'cooldown';

export type PlanExerciseMeasurement = {
  id: string;
  sourceMeasurementId: string;
  label: string;
  unit: string;
  increment: number;
  target: number | null;
  position: number;
};

export type PlanExerciseEquipment = {
  id: string;
  sourceEquipmentId: string;
  name: string;
  position: number;
  measurements: PlanExerciseMeasurement[];
};

export type PlanExercise = {
  id: string;
  sourceExerciseId: string;
  name: string;
  repMode: ExerciseRepMode;
  sets: number;
  target: number;
  restSeconds: number;
  tempo: string | null;
  position: number;
  equipment: PlanExerciseEquipment[];
};

export type PlanDayItem = {
  id: string;
  kind: PlanDayItemKind;
  position: number;
  exercises: PlanExercise[];
};

export type PlanDay = {
  id: string;
  ordinal: PlanDayOrdinal;
  items: PlanDayItem[];
};

export type PlanChecklistItem = {
  id: string;
  kind: PlanChecklistKind;
  label: string;
  position: number;
};

export type Plan = {
  id: string;
  name: string;
  sortPosition: number;
  active: boolean;
  activatedAt: string | null;
  split: PlanSplit;
  effort: PlanEffort;
  deloadWeek: number | null;
  days: PlanDay[];
  checklist: PlanChecklistItem[];
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
};

export type PlanDraft = Omit<Plan, 'id' | 'updatedAt' | 'deleted' | 'syncStatus'>;
export type PlanSummary = Pick<
  Plan,
  'id' | 'name' | 'sortPosition' | 'active' | 'activatedAt' | 'split' | 'effort' | 'deloadWeek' | 'updatedAt'
> & {
  dayCount: number;
};

export type PlanExerciseSource = Exercise;
