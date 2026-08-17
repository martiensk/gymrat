import type { MuscleId } from '../domain/muscles';
import type { SyncStatus } from './workout';

export type ExerciseRepMode = 'count' | 'time';

export type ExerciseMeasurementDefault = {
  id: string;
  measurementId: string;
  label: string;
  unit: string;
  increment: number;
  defaultValue: number | null;
  unavailable: boolean;
};

export type ExerciseEquipment = {
  id: string;
  equipmentId: string;
  equipmentName: string;
  unavailable: boolean;
  position: number;
  measurements: ExerciseMeasurementDefault[];
};

export type Exercise = {
  id: string;
  name: string;
  thumbnailDataUri: string | null;
  thumbnailRemoteFileId: string | null;
  primaryMuscle: MuscleId;
  secondaryMuscles: MuscleId[];
  youtubeUrl: string | null;
  repMode: ExerciseRepMode;
  defaultSets: number;
  defaultTarget: number;
  defaultRestSeconds: number;
  defaultTempo: string | null;
  equipment: ExerciseEquipment[];
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
};

export type ExerciseDraft = Omit<
  Exercise,
  'id' | 'updatedAt' | 'deleted' | 'syncStatus'
>;
