import { useEffect, useMemo, useState } from "react";
import { IonButton } from "@ionic/react";
import type { Exercise, Program, ProgramDay, WorkoutLog } from "../../state/types";
import {
  formatIntensity,
  groupEntriesBySuperset,
  resolveEntryField,
  resolveEntryIntensity,
} from "../../utils/workout";

type WorkoutScreenProps = {
  programs: Program[];
  exercises: Exercise[];
  logs: WorkoutLog[];
  onLog(input: {
    programId: string;
    dayId: string;
    entryId: string;
    sets: string;
    reps: string;
    intensityText: string;
    notes: string;
  }): void;
};

type WorkoutDraft = {
  sets: string;
  reps: string;
  intensityText: string;
  notes: string;
};

export const WorkoutScreen = ({ programs, exercises, logs, onLog }: WorkoutScreenProps) => {
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programs[0]?.id ?? "");
  const [selectedDayId, setSelectedDayId] = useState<string>(programs[0]?.days[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, WorkoutDraft>>({});

  useEffect(() => {
    if (programs.length === 0) {
      setSelectedProgramId("");
      setSelectedDayId("");
      return;
    }

    const selectedProgram = programs.find((program) => program.id === selectedProgramId);
    if (!selectedProgram) {
      setSelectedProgramId(programs[0].id);
      setSelectedDayId(programs[0].days[0]?.id ?? "");
      return;
    }

    const hasSelectedDay = selectedProgram.days.some((day) => day.id === selectedDayId);
    if (!hasSelectedDay) {
      setSelectedDayId(selectedProgram.days[0]?.id ?? "");
    }
  }, [programs, selectedDayId, selectedProgramId]);

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? null,
    [programs, selectedProgramId]
  );

  const selectedDay = useMemo(
    () => selectedProgram?.days.find((day) => day.id === selectedDayId) ?? null,
    [selectedDayId, selectedProgram]
  );

  const dayGroups = useMemo(() => {
    if (!selectedDay) {
      return [];
    }
    return groupEntriesBySuperset(selectedDay.entries);
  }, [selectedDay]);

  const buildDraft = (entryId: string, sets: string, reps: string, intensityText: string): WorkoutDraft => {
    const existing = drafts[entryId];
    if (existing) {
      return existing;
    }
    return {
      sets,
      reps,
      intensityText,
      notes: "",
    };
  };

  const updateDraft = (entryId: string, updates: Partial<WorkoutDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] ?? {
          sets: "",
          reps: "",
          intensityText: "",
          notes: "",
        }),
        ...updates,
      },
    }));
  };

  const recentLogs = (entryId: string): WorkoutLog[] => logs.filter((log) => log.entryId === entryId).slice(0, 3);

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString();
  };

  return (
    <section className="panel workout-panel">
      <div className="panel-header">
        <h2>Workout</h2>
        <p>Simple session view for mobile and in-gym usage.</p>
      </div>

      {programs.length === 0 && <p className="empty">Create a program first.</p>}

      {programs.length > 0 && selectedProgram && (
        <>
          <div className="workout-toolbar">
            <label>
              Program
              <select
                value={selectedProgramId}
                onChange={(event) => {
                  setSelectedProgramId(event.target.value);
                  const nextProgram = programs.find((program) => program.id === event.target.value);
                  setSelectedDayId(nextProgram?.days[0]?.id ?? "");
                }}
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Day
              <select value={selectedDayId} onChange={(event) => setSelectedDayId(event.target.value)}>
                {selectedProgram.days.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <WorkoutGroups
            selectedDay={selectedDay}
            groups={dayGroups}
            exercises={exercises}
            recentLogs={recentLogs}
            formatDate={formatDate}
            buildDraft={buildDraft}
            updateDraft={updateDraft}
            onLog={(entryId, draft) => {
              if (!selectedProgram || !selectedDay) {
                return;
              }
              onLog({
                programId: selectedProgram.id,
                dayId: selectedDay.id,
                entryId,
                sets: draft.sets,
                reps: draft.reps,
                intensityText: draft.intensityText,
                notes: draft.notes,
              });
              updateDraft(entryId, { notes: "" });
            }}
          />
        </>
      )}
    </section>
  );
};

type WorkoutGroupsProps = {
  selectedDay: ProgramDay | null;
  groups: Array<{ key: string; entries: ProgramDay["entries"] }>;
  exercises: Exercise[];
  recentLogs(entryId: string): WorkoutLog[];
  formatDate(iso: string): string;
  buildDraft(entryId: string, sets: string, reps: string, intensityText: string): WorkoutDraft;
  updateDraft(entryId: string, updates: Partial<WorkoutDraft>): void;
  onLog(entryId: string, draft: WorkoutDraft): void;
};

const WorkoutGroups = ({
  selectedDay,
  groups,
  exercises,
  recentLogs,
  formatDate,
  buildDraft,
  updateDraft,
  onLog,
}: WorkoutGroupsProps) => {
  if (!selectedDay) {
    return <p className="empty">Select a day.</p>;
  }

  if (selectedDay.entries.length === 0) {
    return <p className="empty">No exercises in this day.</p>;
  }

  return (
    <div className="workout-groups">
      {groups.map((group, index) => (
        <article key={`${group.key || "single"}_${index}`} className="workout-group">
          {group.key && <h3>Superset {group.key}</h3>}
          {group.entries.map((entry) => {
            const exercise = exercises.find((item) => item.id === entry.exerciseId);
            if (!exercise) {
              return (
                <div className="workout-card" key={entry.id}>
                  Missing exercise. Re-link this entry in Programs.
                </div>
              );
            }

            const goalSets = resolveEntryField(entry, exercise, "goalSets");
            const goalReps = resolveEntryField(entry, exercise, "goalReps");
            const currentSets = resolveEntryField(entry, exercise, "currentSets");
            const currentReps = resolveEntryField(entry, exercise, "currentReps");
            const tempo = resolveEntryField(entry, exercise, "tempo");
            const rest = resolveEntryField(entry, exercise, "rest");
            const video = resolveEntryField(entry, exercise, "videoUrl");
            const intensityText = formatIntensity(resolveEntryIntensity(entry, exercise));
            const draft = buildDraft(entry.id, currentSets, currentReps, intensityText);
            const logs = recentLogs(entry.id);

            return (
              <div className="workout-card" key={entry.id}>
                <div className="workout-card-head">
                  <div>
                    <strong>{exercise.name}</strong>
                    <div className="muted-text">
                      {entry.letter || "-"} {entry.supersetTag ? `| Superset ${entry.supersetTag}` : ""}
                    </div>
                  </div>
                  {video && (
                    <a href={video} target="_blank" rel="noreferrer">
                      Video
                    </a>
                  )}
                </div>

                <div className="workout-values">
                  <span>
                    <b>Goal:</b> {goalSets || "-"} x {goalReps || "-"}
                  </span>
                  <span>
                    <b>Current:</b> {currentSets || "-"} x {currentReps || "-"}
                  </span>
                  <span>
                    <b>Intensity:</b> {intensityText || "-"}
                  </span>
                  <span>
                    <b>Tempo:</b> {tempo || "-"}
                  </span>
                  <span>
                    <b>Rest:</b> {rest || "-"}
                  </span>
                </div>

                <div className="log-form">
                  <input
                    placeholder="Sets"
                    value={draft.sets}
                    onChange={(event) => updateDraft(entry.id, { sets: event.target.value })}
                  />
                  <input
                    placeholder="Reps"
                    value={draft.reps}
                    onChange={(event) => updateDraft(entry.id, { reps: event.target.value })}
                  />
                  <input
                    placeholder="Intensity"
                    value={draft.intensityText}
                    onChange={(event) => updateDraft(entry.id, { intensityText: event.target.value })}
                  />
                  <input
                    placeholder="Notes"
                    value={draft.notes}
                    onChange={(event) => updateDraft(entry.id, { notes: event.target.value })}
                  />
                  <IonButton onClick={() => onLog(entry.id, draft)}>Log</IonButton>
                </div>

                <div className="log-history">
                  {logs.length === 0 && <span>No recent logs.</span>}
                  {logs.length > 0 && (
                    <ul>
                      {logs.map((log) => (
                        <li key={log.id}>
                          {formatDate(log.loggedAtISO)}: {log.sets || "-"} x {log.reps || "-"} ({formatIntensity(log.intensity) || "no intensity"})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </article>
      ))}
    </div>
  );
};
