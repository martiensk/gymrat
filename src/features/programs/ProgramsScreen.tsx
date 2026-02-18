import { useEffect, useMemo, useState } from "react";
import { IonButton, IonInput, IonModal } from "@ionic/react";
import type { Exercise, Program, ProgramDay, ProgramEntry } from "../../state/types";
import { formatIntensity, parseIntensity } from "../../utils/workout";

type ProgramsScreenProps = {
  programs: Program[];
  exercises: Exercise[];
  onAddProgram(payload: { name: string; daysPerWeek: number; deloadEveryWeeks: number }): void;
  onUpdateProgram(id: string, updates: Partial<Program>): void;
  onRemoveProgram(id: string): void;
  onRenameDay(programId: string, dayId: string, name: string): void;
  onAddEntry(programId: string, dayId: string, exerciseId: string): void;
  onUpdateEntry(
    programId: string,
    dayId: string,
    entryId: string,
    updates: Partial<ProgramEntry> & { overrides?: Partial<ProgramEntry["overrides"]> }
  ): void;
  onRemoveEntry(programId: string, dayId: string, entryId: string): void;
};

type ProgramDraft = {
  name: string;
  daysPerWeek: string;
  deloadEveryWeeks: string;
};

const defaultDraft = (): ProgramDraft => ({
  name: "",
  daysPerWeek: "4",
  deloadEveryWeeks: "4",
});

export const ProgramsScreen = ({
  programs,
  exercises,
  onAddProgram,
  onUpdateProgram,
  onRemoveProgram,
  onRenameDay,
  onAddEntry,
  onUpdateEntry,
  onRemoveEntry,
}: ProgramsScreenProps) => {
  const [draft, setDraft] = useState<ProgramDraft>(defaultDraft());
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string>(programs[0]?.id ?? "");
  const [selectedDayId, setSelectedDayId] = useState<string>(programs[0]?.days[0]?.id ?? "");

  useEffect(() => {
    if (programs.length === 0) {
      setSelectedProgramId("");
      setSelectedDayId("");
      return;
    }

    const stillExists = programs.some((program) => program.id === selectedProgramId);
    if (!stillExists) {
      setSelectedProgramId(programs[0].id);
      setSelectedDayId(programs[0].days[0]?.id ?? "");
      return;
    }

    const selectedProgram = programs.find((program) => program.id === selectedProgramId);
    if (!selectedProgram) {
      return;
    }

    const dayExists = selectedProgram.days.some((day) => day.id === selectedDayId);
    if (!dayExists) {
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

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Programs</h2>
        <p>Create weekly plans, supersets, and day-level overrides.</p>
      </div>

      <div className="panel-actions">
        <IonButton onClick={() => setAddOpen(true)}>Add Program</IonButton>
      </div>

      <IonModal className="create-modal" isOpen={addOpen} onDidDismiss={() => setAddOpen(false)}>
        <div className="create-modal-content">
          <div className="modal-intro">
            <h3>Add Program</h3>
            <p>Create a weekly structure with deload timing.</p>
          </div>
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              const daysPerWeek = Number.parseInt(draft.daysPerWeek, 10) || 4;
              const deloadEveryWeeks = Number.parseInt(draft.deloadEveryWeeks, 10) || 4;
              onAddProgram({
                name: draft.name,
                daysPerWeek,
                deloadEveryWeeks,
              });
              setDraft(defaultDraft());
              setAddOpen(false);
            }}
          >
            <div className="modal-card">
              <h4>Program Setup</h4>
              <div className="modal-form-grid">
                <label className="modal-field">
                  <span>Program Name</span>
                  <IonInput
                    fill="outline"
                    required
                    value={draft.name}
                    placeholder="e.g. Home Strength"
                    onIonInput={(e) => setDraft((prev) => ({ ...prev, name: String(e.detail.value ?? "") }))}
                  />
                </label>
                <label className="modal-field">
                  <span>Days Per Week</span>
                  <IonInput
                    fill="outline"
                    value={draft.daysPerWeek}
                    type="number"
                    min="1"
                    max="14"
                    placeholder="4"
                    onIonInput={(e) =>
                      setDraft((prev) => ({ ...prev, daysPerWeek: String(e.detail.value ?? "") }))
                    }
                  />
                </label>
                <label className="modal-field">
                  <span>Deload Every (weeks)</span>
                  <IonInput
                    fill="outline"
                    value={draft.deloadEveryWeeks}
                    type="number"
                    min="0"
                    max="12"
                    placeholder="4"
                    onIonInput={(e) =>
                      setDraft((prev) => ({ ...prev, deloadEveryWeeks: String(e.detail.value ?? "") }))
                    }
                  />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <IonButton type="submit">Add Program</IonButton>
              <IonButton type="button" fill="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </IonButton>
            </div>
          </form>
        </div>
      </IonModal>

      <div className="program-layout">
        <aside className="program-sidebar">
          {programs.length === 0 && <p className="empty">No programs yet.</p>}
          {programs.map((program) => (
            <button
              key={program.id}
              type="button"
              className={program.id === selectedProgramId ? "program-pill active" : "program-pill"}
              onClick={() => {
                setSelectedProgramId(program.id);
                setSelectedDayId(program.days[0]?.id ?? "");
              }}
            >
              <strong>{program.name}</strong>
              <span>
                {program.daysPerWeek} days/wk, deload every {program.deloadEveryWeeks} weeks
              </span>
            </button>
          ))}
        </aside>

        <section className="program-editor">
          {!selectedProgram && <p className="empty">Select a program to edit.</p>}

          {selectedProgram && (
            <>
              <div className="program-meta-grid">
                <label>
                  Name
                  <input
                    value={selectedProgram.name}
                    onChange={(event) => onUpdateProgram(selectedProgram.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  Days / Week
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={selectedProgram.daysPerWeek}
                    onChange={(event) =>
                      onUpdateProgram(selectedProgram.id, {
                        daysPerWeek: Number.parseInt(event.target.value, 10) || selectedProgram.daysPerWeek,
                      })
                    }
                  />
                </label>
                <label>
                  Deload Every (weeks)
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={selectedProgram.deloadEveryWeeks}
                    onChange={(event) =>
                      onUpdateProgram(selectedProgram.id, {
                        deloadEveryWeeks: Number.parseInt(event.target.value, 10) || 0,
                      })
                    }
                  />
                </label>
                <IonButton color="danger" onClick={() => onRemoveProgram(selectedProgram.id)}>
                  Delete Program
                </IonButton>
              </div>

              <div className="day-toolbar">
                <select
                  value={selectedDayId}
                  onChange={(event) => {
                    setSelectedDayId(event.target.value);
                  }}
                >
                  {selectedProgram.days.map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.name}
                    </option>
                  ))}
                </select>

                {selectedDay && (
                  <input
                    value={selectedDay.name}
                    onChange={(event) => onRenameDay(selectedProgram.id, selectedDay.id, event.target.value)}
                    placeholder="Day name"
                  />
                )}

                <button
                  type="button"
                  onClick={() => onAddEntry(selectedProgram.id, selectedDay?.id ?? "", exercises[0]?.id ?? "")}
                  disabled={!selectedDay || exercises.length === 0}
                >
                  Add Exercise To Day
                </button>
              </div>

              <ProgramEntriesTable
                exercises={exercises}
                day={selectedDay}
                programId={selectedProgram.id}
                onUpdateEntry={onUpdateEntry}
                onRemoveEntry={onRemoveEntry}
              />
            </>
          )}
        </section>
      </div>
    </section>
  );
};

type ProgramEntriesTableProps = {
  day: ProgramDay | null;
  programId: string;
  exercises: Exercise[];
  onUpdateEntry(
    programId: string,
    dayId: string,
    entryId: string,
    updates: Partial<ProgramEntry> & { overrides?: Partial<ProgramEntry["overrides"]> }
  ): void;
  onRemoveEntry(programId: string, dayId: string, entryId: string): void;
};

const ProgramEntriesTable = ({ day, programId, exercises, onUpdateEntry, onRemoveEntry }: ProgramEntriesTableProps) => {
  if (!day) {
    return <p className="empty">Select a day.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Letter</th>
            <th>Superset</th>
            <th>Exercise</th>
            <th>Goal Sets</th>
            <th>Goal Reps</th>
            <th>Current Sets</th>
            <th>Current Reps</th>
            <th>Intensity Override</th>
            <th>Tempo</th>
            <th>Rest</th>
            <th>Video</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          {day.entries.length === 0 && (
            <tr>
              <td colSpan={12}>
                <p className="empty">No entries in this day.</p>
              </td>
            </tr>
          )}

          {day.entries.map((entry) => {
            const exercise = exercises.find((item) => item.id === entry.exerciseId);
            return (
              <tr key={entry.id}>
                <td>
                  <input
                    value={entry.letter}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        letter: event.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={entry.supersetTag}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        supersetTag: event.target.value,
                      })
                    }
                  />
                </td>
                <td>
                  <select
                    value={entry.exerciseId}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        exerciseId: event.target.value,
                      })
                    }
                  >
                    {exercises.map((exerciseOption) => (
                      <option key={exerciseOption.id} value={exerciseOption.id}>
                        {exerciseOption.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={entry.overrides.goalSets ?? ""}
                    placeholder={exercise?.goalSets ?? ""}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { goalSets: event.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={entry.overrides.goalReps ?? ""}
                    placeholder={exercise?.goalReps ?? ""}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { goalReps: event.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={entry.overrides.currentSets ?? ""}
                    placeholder={exercise?.currentSets ?? ""}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { currentSets: event.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={entry.overrides.currentReps ?? ""}
                    placeholder={exercise?.currentReps ?? ""}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { currentReps: event.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={formatIntensity(entry.overrides.intensity)}
                    placeholder={formatIntensity(exercise?.intensity)}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { intensity: parseIntensity(event.target.value) },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={entry.overrides.tempo ?? ""}
                    placeholder={exercise?.tempo ?? ""}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { tempo: event.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={entry.overrides.rest ?? ""}
                    placeholder={exercise?.rest ?? ""}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { rest: event.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    value={entry.overrides.videoUrl ?? ""}
                    placeholder={exercise?.videoUrl ?? ""}
                    onChange={(event) =>
                      onUpdateEntry(programId, day.id, entry.id, {
                        overrides: { videoUrl: event.target.value },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="danger-text"
                    onClick={() => onRemoveEntry(programId, day.id, entry.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
