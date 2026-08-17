import { followsIncrement, isValidTempo } from './exerciseValidation';
import { isPlanSplitKey } from './planSplits';
import type { Plan, PlanDraft } from '../types/plan';

export type PlanValidation = {
  name: boolean;
  split: boolean;
  effort: boolean;
  deloadWeek: boolean;
  days: boolean;
  positions: boolean;
  items: boolean;
  prescriptions: boolean;
  measurements: boolean;
  ids: boolean;
};

function contiguous(values: readonly number[]) {
  return values.every((value, index) => Number.isInteger(value) && value === index);
}

export function validatePlan(plan: Plan | PlanDraft): PlanValidation {
  const ids = new Set<string>();
  let duplicateId = false;
  const register = (id: string) => {
    if (!id || ids.has(id)) duplicateId = true;
    ids.add(id);
  };
  if ('id' in plan) register(plan.id);

  let invalidPositions = false;
  let invalidItems = false;
  let invalidPrescriptions = false;
  let invalidMeasurements = false;
  for (const checklist of plan.checklist) register(checklist.id);
  invalidItems ||= plan.checklist.some((item) => (
    !['warmup', 'cooldown'].includes(item.kind) || !item.label.trim()
  ));
  for (const kind of ['warmup', 'cooldown'] as const) {
    invalidPositions ||= !contiguous(
      plan.checklist.filter((item) => item.kind === kind).map((item) => item.position),
    );
  }
  for (const day of plan.days) {
    register(day.id);
    invalidPositions ||= !contiguous(day.items.map((item) => item.position));
    for (const item of day.items) {
      register(item.id);
      invalidItems ||= item.kind === 'standalone'
        ? item.exercises.length !== 1
        : item.kind !== 'superset' || item.exercises.length < 2;
      invalidPositions ||= !contiguous(item.exercises.map((exercise) => exercise.position));
      const sets = item.exercises[0]?.sets;
      if (item.kind === 'superset') {
        invalidItems ||= item.exercises.some((exercise) => exercise.sets !== sets);
      }
      for (const exercise of item.exercises) {
        register(exercise.id);
        invalidPrescriptions ||= !exercise.sourceExerciseId || !exercise.name.trim();
        invalidPrescriptions ||= !['count', 'time'].includes(exercise.repMode);
        invalidPrescriptions ||= !Number.isInteger(exercise.sets) || exercise.sets <= 0;
        invalidPrescriptions ||= !Number.isInteger(exercise.target) || exercise.target <= 0;
        invalidPrescriptions ||= !Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0;
        invalidPrescriptions ||= !isValidTempo(exercise.tempo ?? '');
        invalidPositions ||= !contiguous(exercise.equipment.map((equipment) => equipment.position));
        for (const equipment of exercise.equipment) {
          register(equipment.id);
          invalidPrescriptions ||= !equipment.sourceEquipmentId || !equipment.name.trim();
          invalidPositions ||= !contiguous(equipment.measurements.map((measurement) => measurement.position));
          for (const measurement of equipment.measurements) {
            register(measurement.id);
            invalidMeasurements ||= !measurement.sourceMeasurementId || !measurement.label.trim();
            invalidMeasurements ||= !Number.isFinite(measurement.increment) || measurement.increment <= 0;
            invalidMeasurements ||= measurement.target !== null && (
              measurement.target < 0 || !followsIncrement(measurement.target, measurement.increment)
            );
          }
        }
      }
    }
  }

  return {
    name: !plan.name.trim(),
    split: !isPlanSplitKey(plan.split.key) || !plan.split.label.trim(),
    effort: plan.effort !== 'one_rir' && plan.effort !== 'failure',
    deloadWeek: plan.deloadWeek !== null && (
      !Number.isInteger(plan.deloadWeek) || plan.deloadWeek < 2 || plan.deloadWeek > 52
    ),
    days: plan.days.length < 1 || plan.days.length > 7 || plan.days.some(
      (day, index) => day.ordinal !== index + 1,
    ),
    positions: invalidPositions,
    items: invalidItems,
    prescriptions: invalidPrescriptions,
    measurements: invalidMeasurements,
    ids: duplicateId,
  };
}

export function assertValidPlan(plan: Plan | PlanDraft) {
  const validation = validatePlan(plan);
  const fields = Object.entries(validation).filter(([, invalid]) => invalid).map(([field]) => field);
  if (fields.length) throw new Error(`Invalid plan: ${fields.join(', ')}`);
}
