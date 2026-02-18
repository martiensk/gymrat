import type { WorkoutData } from "../state/types";

export interface StorageProvider {
  load(): Promise<WorkoutData | null>;
  save(data: WorkoutData): Promise<void>;
}
