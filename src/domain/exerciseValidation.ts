import type { ExerciseDraft } from '../types/exercise';

export function isValidTempo(value: string) {
  return value === '' || /^[0-9X]{4}$/i.test(value);
}

export function isValidYouTubeUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'www.youtube-nocookie.com',
    ].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function followsIncrement(value: number, increment: number) {
  if (!Number.isFinite(value) || !Number.isFinite(increment) || increment <= 0) return false;
  return Math.abs(value / increment - Math.round(value / increment)) < 1e-8;
}

export function validateExerciseDraft(draft: ExerciseDraft) {
  const invalidMeasurementIds = draft.equipment.flatMap((equipment) => (
    equipment.measurements
      .filter((measurement) => (
        measurement.defaultValue !== null &&
        !followsIncrement(measurement.defaultValue, measurement.increment)
      ))
      .map((measurement) => measurement.id)
  ));

  return {
    name: !draft.name.trim(),
    primaryMuscle: !draft.primaryMuscle,
    sets: !Number.isInteger(draft.defaultSets) || draft.defaultSets <= 0,
    target: !Number.isInteger(draft.defaultTarget) || draft.defaultTarget <= 0,
    rest: !Number.isInteger(draft.defaultRestSeconds) || draft.defaultRestSeconds < 0,
    tempo: !isValidTempo(draft.defaultTempo ?? ''),
    youtube: !isValidYouTubeUrl(draft.youtubeUrl ?? ''),
    invalidMeasurementIds,
  };
}
