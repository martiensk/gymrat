import type { WorkoutData } from "../state/types";
import type { StorageProvider } from "./types";

export const appwriteProvider: StorageProvider = {
  async load(): Promise<WorkoutData | null> {
    throw new Error("Appwrite provider is not wired yet.");
  },

  async save(_data: WorkoutData): Promise<void> {
    throw new Error("Appwrite provider is not wired yet.");
  },
};
