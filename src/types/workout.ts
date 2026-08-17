export type SyncStatus = 'pending' | 'synced';

export type Workout = {
  id: string;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  performedAt: string;
  updatedAt: string;
  deleted: boolean;
  syncStatus: SyncStatus;
};

export type WorkoutDraft = Pick<Workout, 'exercise' | 'sets' | 'reps' | 'weight'>;
