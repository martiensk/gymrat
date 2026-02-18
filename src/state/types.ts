export type IntensityField = {
  id: string;
  label: string;
  value: string;
  equipmentId?: string;
};

export type Equipment = {
  id: string;
  name: string;
  aliases: string[];
  imageBase64?: string;
};

export type Exercise = {
  id: string;
  name: string;
  equipmentIds: string[];
  goalSets: string;
  goalReps: string;
  currentSets: string;
  currentReps: string;
  intensity: IntensityField[];
  tempo: string;
  rest: string;
  videoUrl: string;
};

export type ExerciseOverrides = {
  goalSets?: string;
  goalReps?: string;
  currentSets?: string;
  currentReps?: string;
  intensity?: IntensityField[];
  tempo?: string;
  rest?: string;
  videoUrl?: string;
};

export type ProgramEntry = {
  id: string;
  letter: string;
  supersetTag: string;
  exerciseId: string;
  overrides: ExerciseOverrides;
};

export type ProgramDay = {
  id: string;
  name: string;
  entries: ProgramEntry[];
};

export type Program = {
  id: string;
  name: string;
  daysPerWeek: number;
  deloadEveryWeeks: number;
  days: ProgramDay[];
};

export type WorkoutLog = {
  id: string;
  loggedAtISO: string;
  programId: string;
  dayId: string;
  entryId: string;
  exerciseId: string;
  sets: string;
  reps: string;
  intensity: IntensityField[];
  notes: string;
};

export type WorkoutData = {
  version: 1;
  equipment: Equipment[];
  exercises: Exercise[];
  programs: Program[];
  logs: WorkoutLog[];
};

export type SyncProvider = "local" | "appwrite" | "google-sheets";
