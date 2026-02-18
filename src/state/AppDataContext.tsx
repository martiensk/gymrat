import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { createProvider } from "../storage/createProvider";
import { makeId } from "../utils/id";
import { parseIntensity } from "../utils/workout";
import { createEmptyData, createSeedData } from "./seedData";
import type {
  Equipment,
  Exercise,
  ExerciseOverrides,
  Program,
  ProgramDay,
  ProgramEntry,
  SyncProvider,
  WorkoutData,
} from "./types";

type WorkoutLogInput = {
  programId: string;
  dayId: string;
  entryId: string;
  sets: string;
  reps: string;
  intensityText: string;
  notes: string;
};

type AppActions = {
  addEquipment(payload: { name: string; aliases?: string[]; imageBase64?: string }): void;
  updateEquipment(id: string, updates: Partial<Equipment>): void;
  removeEquipment(id: string): void;
  addExercise(payload: Omit<Exercise, "id">): void;
  updateExercise(id: string, updates: Partial<Exercise>): void;
  removeExercise(id: string): void;
  addProgram(payload: { name: string; daysPerWeek: number; deloadEveryWeeks: number }): void;
  updateProgram(id: string, updates: Partial<Program>): void;
  removeProgram(id: string): void;
  renameDay(programId: string, dayId: string, name: string): void;
  addEntry(programId: string, dayId: string, exerciseId: string): void;
  updateEntry(
    programId: string,
    dayId: string,
    entryId: string,
    updates: Partial<ProgramEntry> & { overrides?: Partial<ExerciseOverrides> }
  ): void;
  removeEntry(programId: string, dayId: string, entryId: string): void;
  logWorkout(input: WorkoutLogInput): void;
};

type AppDataContextValue = {
  data: WorkoutData;
  loading: boolean;
  error: string | null;
  provider: SyncProvider;
  setProvider(nextProvider: SyncProvider): void;
  resetToSeed(): void;
  exportJSON(): string;
  importJSON(jsonText: string): { ok: boolean; message: string };
  actions: AppActions;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

const createProgramDays = (count: number, startIndex = 0): ProgramDay[] =>
  Array.from({ length: count }, (_, index) => ({
    id: makeId("day"),
    name: `Day ${startIndex + index + 1}`,
    entries: [],
  }));

const createProgram = (payload: {
  name: string;
  daysPerWeek: number;
  deloadEveryWeeks: number;
}): Program => ({
  id: makeId("pg"),
  name: payload.name,
  daysPerWeek: payload.daysPerWeek,
  deloadEveryWeeks: payload.deloadEveryWeeks,
  days: createProgramDays(payload.daysPerWeek),
});

const createEntry = (exerciseId: string): ProgramEntry => ({
  id: makeId("entry"),
  letter: "",
  supersetTag: "",
  exerciseId,
  overrides: {},
});

const clampInt = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const normalizeData = (data: WorkoutData): WorkoutData => ({
  ...data,
  equipment: data.equipment.reduce<Equipment[]>((acc, item) => {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      if (!name) {
        return acc;
      }
      acc.push({
        id: typeof item.id === "string" && item.id ? item.id : makeId("eq"),
        name,
        aliases: Array.isArray(item.aliases)
          ? item.aliases
              .map((alias) => String(alias).trim())
              .filter(Boolean)
              .filter(
                (alias, index, arr) => arr.findIndex((value) => value.toLowerCase() === alias.toLowerCase()) === index
              )
          : [],
        imageBase64:
          typeof item.imageBase64 === "string" && item.imageBase64.trim().length > 0
            ? item.imageBase64
            : undefined,
      });
      return acc;
    }, []),
});

const safeParseWorkoutData = (jsonText: string): WorkoutData | null => {
  try {
    const parsed = JSON.parse(jsonText) as WorkoutData;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (!Array.isArray(parsed.equipment) || !Array.isArray(parsed.exercises) || !Array.isArray(parsed.programs)) {
      return null;
    }
    return normalizeData({
      version: 1,
      equipment: parsed.equipment,
      exercises: parsed.exercises,
      programs: parsed.programs,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    });
  } catch {
    return null;
  }
};

export const AppDataProvider = ({ children }: PropsWithChildren) => {
  const [provider, setProviderState] = useState<SyncProvider>("local");
  const [data, setData] = useState<WorkoutData>(createEmptyData());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const saveTimerRef = useRef<number | null>(null);

  const providerImpl = useMemo(() => createProvider(provider), [provider]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await providerImpl.load();
        if (cancelled) {
          return;
        }
        setData(normalizeData(loaded ?? createSeedData()));
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Failed to load workout data.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [providerImpl]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void providerImpl.save(data).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : "Failed to save workout data.");
      });
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [data, hydrated, providerImpl]);

  const setProvider = useCallback((nextProvider: SyncProvider) => {
    setProviderState(nextProvider);
  }, []);

  const resetToSeed = useCallback(() => {
    setData(normalizeData(createSeedData()));
    setError(null);
  }, []);

  const exportJSON = useCallback(() => JSON.stringify(data, null, 2), [data]);

  const importJSON = useCallback((jsonText: string) => {
    const parsed = safeParseWorkoutData(jsonText);
    if (!parsed) {
      return {
        ok: false,
        message: "Invalid JSON format. File must contain workout data arrays.",
      };
    }

    setData(parsed);
    setError(null);
    return {
      ok: true,
      message: "Data imported.",
    };
  }, []);

  const actions: AppActions = useMemo(
    () => ({
      addEquipment(payload: { name: string; aliases?: string[]; imageBase64?: string }) {
        const trimmed = payload.name.trim();
        if (!trimmed) {
          return;
        }
        const aliases = (payload.aliases ?? [])
          .map((alias) => alias.trim())
          .filter(Boolean)
          .filter((alias, index, arr) => arr.findIndex((value) => value.toLowerCase() === alias.toLowerCase()) === index);
        setData((prev) => ({
          ...prev,
          equipment: [
            ...prev.equipment,
            {
              id: makeId("eq"),
              name: trimmed,
              aliases,
              imageBase64: payload.imageBase64?.trim() || undefined,
            },
          ],
        }));
      },

      updateEquipment(id: string, updates: Partial<Equipment>) {
        setData((prev) => ({
          ...prev,
          equipment: prev.equipment.map((item) => (item.id === id ? { ...item, ...updates } : item)),
        }));
      },

      removeEquipment(id: string) {
        setData((prev) => ({
          ...prev,
          equipment: prev.equipment.filter((item) => item.id !== id),
          exercises: prev.exercises.map((exercise) => ({
            ...exercise,
            equipmentIds: exercise.equipmentIds.filter((equipmentId) => equipmentId !== id),
            intensity: exercise.intensity.map((field) =>
              field.equipmentId === id ? { ...field, equipmentId: undefined } : field
            ),
          })),
        }));
      },

      addExercise(payload: Omit<Exercise, "id">) {
        const name = payload.name.trim();
        if (!name) {
          return;
        }

        setData((prev) => ({
          ...prev,
          exercises: [...prev.exercises, { ...payload, id: makeId("ex"), name }],
        }));
      },

      updateExercise(id: string, updates: Partial<Exercise>) {
        setData((prev) => ({
          ...prev,
          exercises: prev.exercises.map((exercise) => (exercise.id === id ? { ...exercise, ...updates } : exercise)),
        }));
      },

      removeExercise(id: string) {
        setData((prev) => ({
          ...prev,
          exercises: prev.exercises.filter((exercise) => exercise.id !== id),
          programs: prev.programs.map((program) => ({
            ...program,
            days: program.days.map((day) => ({
              ...day,
              entries: day.entries.filter((entry) => entry.exerciseId !== id),
            })),
          })),
          logs: prev.logs.filter((log) => log.exerciseId !== id),
        }));
      },

      addProgram(payload) {
        const name = payload.name.trim();
        if (!name) {
          return;
        }
        const daysPerWeek = clampInt(payload.daysPerWeek, 1, 14);
        const deloadEveryWeeks = clampInt(payload.deloadEveryWeeks, 0, 12);

        setData((prev) => ({
          ...prev,
          programs: [
            ...prev.programs,
            createProgram({
              ...payload,
              name,
              daysPerWeek,
              deloadEveryWeeks,
            }),
          ],
        }));
      },

      updateProgram(id: string, updates: Partial<Program>) {
        setData((prev) => ({
          ...prev,
          programs: prev.programs.map((program) => {
            if (program.id !== id) {
              return program;
            }

            const nextDaysPerWeek = updates.daysPerWeek
              ? clampInt(updates.daysPerWeek, 1, 14)
              : program.daysPerWeek;
            let nextDays = program.days;

            if (nextDaysPerWeek > nextDays.length) {
              const extra = createProgramDays(nextDaysPerWeek - nextDays.length, nextDays.length);
              nextDays = [...nextDays, ...extra];
            } else if (nextDaysPerWeek < nextDays.length) {
              nextDays = nextDays.slice(0, nextDaysPerWeek);
            }

            return {
              ...program,
              ...updates,
              daysPerWeek: nextDaysPerWeek,
              days: nextDays,
            };
          }),
        }));
      },

      removeProgram(id: string) {
        setData((prev) => ({
          ...prev,
          programs: prev.programs.filter((program) => program.id !== id),
          logs: prev.logs.filter((log) => log.programId !== id),
        }));
      },

      renameDay(programId: string, dayId: string, name: string) {
        setData((prev) => ({
          ...prev,
          programs: prev.programs.map((program) => {
            if (program.id !== programId) {
              return program;
            }
            return {
              ...program,
              days: program.days.map((day) => (day.id === dayId ? { ...day, name } : day)),
            };
          }),
        }));
      },

      addEntry(programId: string, dayId: string, exerciseId: string) {
        setData((prev) => ({
          ...prev,
          programs: prev.programs.map((program) => {
            if (program.id !== programId) {
              return program;
            }
            return {
              ...program,
              days: program.days.map((day) => {
                if (day.id !== dayId) {
                  return day;
                }
                return {
                  ...day,
                  entries: [...day.entries, createEntry(exerciseId)],
                };
              }),
            };
          }),
        }));
      },

      updateEntry(programId: string, dayId: string, entryId: string, updates) {
        setData((prev) => ({
          ...prev,
          programs: prev.programs.map((program) => {
            if (program.id !== programId) {
              return program;
            }
            return {
              ...program,
              days: program.days.map((day) => {
                if (day.id !== dayId) {
                  return day;
                }
                return {
                  ...day,
                  entries: day.entries.map((entry) => {
                    if (entry.id !== entryId) {
                      return entry;
                    }
                    return {
                      ...entry,
                      ...updates,
                      overrides: {
                        ...entry.overrides,
                        ...updates.overrides,
                      },
                    };
                  }),
                };
              }),
            };
          }),
        }));
      },

      removeEntry(programId: string, dayId: string, entryId: string) {
        setData((prev) => ({
          ...prev,
          programs: prev.programs.map((program) => {
            if (program.id !== programId) {
              return program;
            }
            return {
              ...program,
              days: program.days.map((day) => {
                if (day.id !== dayId) {
                  return day;
                }
                return {
                  ...day,
                  entries: day.entries.filter((entry) => entry.id !== entryId),
                };
              }),
            };
          }),
          logs: prev.logs.filter((log) => log.entryId !== entryId),
        }));
      },

      logWorkout(input: WorkoutLogInput) {
        setData((prev) => {
          const intensity = parseIntensity(input.intensityText);
          const nextLogs = [
            {
              id: makeId("log"),
              loggedAtISO: new Date().toISOString(),
              programId: input.programId,
              dayId: input.dayId,
              entryId: input.entryId,
              exerciseId: "",
              sets: input.sets,
              reps: input.reps,
              intensity,
              notes: input.notes,
            },
            ...prev.logs,
          ].slice(0, 1000);

          const programs = prev.programs.map((program) => {
            if (program.id !== input.programId) {
              return program;
            }
            return {
              ...program,
              days: program.days.map((day) => {
                if (day.id !== input.dayId) {
                  return day;
                }
                return {
                  ...day,
                  entries: day.entries.map((entry) => {
                    if (entry.id !== input.entryId) {
                      return entry;
                    }
                    return {
                      ...entry,
                      overrides: {
                        ...entry.overrides,
                        currentSets: input.sets || entry.overrides.currentSets,
                        currentReps: input.reps || entry.overrides.currentReps,
                        intensity: intensity.length > 0 ? intensity : entry.overrides.intensity,
                      },
                    };
                  }),
                };
              }),
            };
          });

          const updatedEntry = programs
            .flatMap((program) => program.days)
            .flatMap((day) => day.entries)
            .find((entry) => entry.id === input.entryId);

          const exerciseId = updatedEntry?.exerciseId;
          const exercises = prev.exercises.map((exercise) => {
            if (!exerciseId || exercise.id !== exerciseId) {
              return exercise;
            }
            return {
              ...exercise,
              currentSets: input.sets || exercise.currentSets,
              currentReps: input.reps || exercise.currentReps,
              intensity: intensity.length > 0 ? intensity : exercise.intensity,
            };
          });

          nextLogs[0].exerciseId = exerciseId ?? "";

          return {
            ...prev,
            programs,
            exercises,
            logs: nextLogs,
          };
        });
      },
    }),
    []
  );

  const contextValue = useMemo<AppDataContextValue>(
    () => ({
      data,
      loading,
      error,
      provider,
      setProvider,
      resetToSeed,
      exportJSON,
      importJSON,
      actions,
    }),
    [actions, data, error, exportJSON, importJSON, loading, provider, resetToSeed, setProvider]
  );

  return <AppDataContext.Provider value={contextValue}>{children}</AppDataContext.Provider>;
};

export const useAppData = (): AppDataContextValue => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppDataProvider.");
  }
  return context;
};
