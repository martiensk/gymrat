import type { WorkoutData } from "../state/types";
import type { StorageProvider } from "./types";

export const googleSheetsProvider: StorageProvider = {
  async load(): Promise<WorkoutData | null> {
    throw new Error("Google Sheets provider is not wired yet.");
  },

  async save(_data: WorkoutData): Promise<void> {
    throw new Error("Google Sheets provider is not wired yet.");
  },
};
