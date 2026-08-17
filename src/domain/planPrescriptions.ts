import type { Exercise } from '../types/exercise';
import type { PlanDay, PlanDayOrdinal, PlanExercise } from '../types/plan';

export function seedPlanExercise(exercise: Exercise): PlanExercise {
  return {
    id: crypto.randomUUID(),
    sourceExerciseId: exercise.id,
    name: exercise.name,
    repMode: exercise.repMode,
    sets: exercise.defaultSets,
    target: exercise.defaultTarget,
    restSeconds: exercise.defaultRestSeconds,
    tempo: exercise.defaultTempo,
    position: 0,
    equipment: exercise.equipment.map((equipment, position) => ({
      id: crypto.randomUUID(),
      sourceEquipmentId: equipment.equipmentId,
      name: equipment.equipmentName,
      position,
      measurements: equipment.measurements.map((measurement, measurementPosition) => ({
        id: crypto.randomUUID(),
        sourceMeasurementId: measurement.measurementId,
        label: measurement.label,
        unit: measurement.unit,
        increment: measurement.increment,
        target: measurement.defaultValue,
        position: measurementPosition,
      })),
    })),
  };
}

export function getSupersetRestSeconds(exercises: readonly PlanExercise[]) {
  return exercises.reduce((rest, exercise) => Math.max(rest, exercise.restSeconds), 0);
}

export function setSupersetSets(exercises: readonly PlanExercise[], sets: number) {
  return exercises.map((exercise) => ({ ...exercise, sets }));
}

export function resizePlanDays(days: readonly PlanDay[], count: number): PlanDay[] {
  const size = Math.max(1, Math.min(7, Math.trunc(count)));
  return Array.from({ length: size }, (_, index) => {
    const ordinal = (index + 1) as PlanDayOrdinal;
    return days[index]
      ? { ...days[index], ordinal }
      : { id: crypto.randomUUID(), ordinal, items: [] };
  });
}
