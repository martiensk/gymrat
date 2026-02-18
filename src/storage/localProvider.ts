import { Preferences } from "@capacitor/preferences";
import type { WorkoutData } from "../state/types";
import type { StorageProvider } from "./types";

const KEY = "gymrat_data_v1";

export const localProvider: StorageProvider = {
  async load(): Promise<WorkoutData | null> {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as WorkoutData;
    } catch {
      return null;
    }
  },

  async save(data: WorkoutData): Promise<void> {
    await Preferences.set({
      key: KEY,
      value: JSON.stringify(data),
    });
  },
};
