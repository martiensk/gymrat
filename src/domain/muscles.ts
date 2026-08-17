export const MUSCLES = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Forearms' },
  { id: 'quadriceps', label: 'Quadriceps' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'calves', label: 'Calves' },
  { id: 'core', label: 'Core' },
  { id: 'full-body', label: 'Full Body' },
  { id: 'other', label: 'Other' },
] as const;

export type MuscleId = (typeof MUSCLES)[number]['id'];

export function muscleLabel(id: string) {
  return MUSCLES.find((muscle) => muscle.id === id)?.label ?? id;
}

export function isMuscleId(value: unknown): value is MuscleId {
  return typeof value === 'string' && MUSCLES.some((muscle) => muscle.id === value);
}
