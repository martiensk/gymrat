import type { Exercise, IntensityField, ProgramEntry } from "../state/types";
import { makeId } from "./id";

export const parseIntensity = (value: string): IntensityField[] => {
  const text = value.trim();
  if (!text) {
    return [];
  }

  return text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((token) => {
      const [rawLabel, ...rawValue] = token.split(":");
      if (rawValue.length === 0) {
        return {
          id: makeId("if"),
          label: "value",
          value: rawLabel.trim(),
        };
      }

      return {
        id: makeId("if"),
        label: rawLabel.trim() || "value",
        value: rawValue.join(":").trim(),
      };
    })
    .filter((field) => field.value.length > 0);
};

export const formatIntensity = (fields: IntensityField[] | undefined): string => {
  if (!fields || fields.length === 0) {
    return "";
  }

  return fields.map((field) => `${field.label}:${field.value}`).join(" | ");
};

export const resolveEntryField = (
  entry: ProgramEntry,
  exercise: Exercise,
  field: keyof Pick<Exercise, "goalSets" | "goalReps" | "currentSets" | "currentReps" | "tempo" | "rest" | "videoUrl">
): string => {
  const overrideValue = entry.overrides[field];
  if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
    return overrideValue;
  }
  return exercise[field];
};

export const resolveEntryIntensity = (entry: ProgramEntry, exercise: Exercise): IntensityField[] => {
  if (entry.overrides.intensity && entry.overrides.intensity.length > 0) {
    return entry.overrides.intensity;
  }
  return exercise.intensity;
};

export const groupEntriesBySuperset = (entries: ProgramEntry[]) => {
  const groups: Array<{ key: string; entries: ProgramEntry[] }> = [];
  const map = new Map<string, { key: string; entries: ProgramEntry[] }>();

  entries.forEach((entry) => {
    const key = entry.supersetTag.trim();
    if (!key) {
      groups.push({ key: "", entries: [entry] });
      return;
    }

    const existing = map.get(key);
    if (existing) {
      existing.entries.push(entry);
      return;
    }

    const created = { key, entries: [entry] };
    map.set(key, created);
    groups.push(created);
  });

  return groups;
};
