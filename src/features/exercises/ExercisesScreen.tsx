import { useMemo, useState } from "react";
import { IonButton, IonInput, IonModal } from "@ionic/react";
import type { Equipment, Exercise } from "../../state/types";
import { formatIntensity, parseIntensity } from "../../utils/workout";

type ExercisesScreenProps = {
  equipment: Equipment[];
  exercises: Exercise[];
  onAdd(payload: Omit<Exercise, "id">): void;
  onUpdate(id: string, updates: Partial<Exercise>): void;
  onDelete(id: string): void;
};

type ExerciseDraft = Omit<Exercise, "id" | "intensity" | "equipmentIds"> & {
  intensityText: string;
  equipmentText: string;
};

const defaultDraft: ExerciseDraft = {
  name: "",
  goalSets: "",
  goalReps: "",
  currentSets: "",
  currentReps: "",
  intensityText: "",
  tempo: "",
  rest: "",
  videoUrl: "",
  equipmentText: "",
};

export const ExercisesScreen = ({ equipment, exercises, onAdd, onUpdate, onDelete }: ExercisesScreenProps) => {
  const [draft, setDraft] = useState<ExerciseDraft>(defaultDraft);
  const [addOpen, setAddOpen] = useState<boolean>(false);

  const equipmentLookup = useMemo(() => {
    const byName = new Map<string, string>();
    equipment.forEach((item) => {
      byName.set(item.name.toLowerCase(), item.id);
      item.aliases.forEach((alias) => {
        byName.set(alias.toLowerCase(), item.id);
      });
    });
    return byName;
  }, [equipment]);

  const mapTextToEquipmentIds = (text: string): string[] => {
    const ids: string[] = [];
    text
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => {
        const id = equipmentLookup.get(name.toLowerCase());
        if (id) {
          ids.push(id);
        }
      });
    return Array.from(new Set(ids));
  };

  const mapIdsToNames = (ids: string[]): string => {
    return ids
      .map((id) => equipment.find((item) => item.id === id)?.name)
      .filter((value): value is string => Boolean(value))
      .join(", ");
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Exercises</h2>
        <p>Default values live here. Day entries can override them per program/day.</p>
      </div>

      <div className="panel-actions">
        <IonButton onClick={() => setAddOpen(true)}>Add Exercise</IonButton>
      </div>

      <IonModal className="create-modal" isOpen={addOpen} onDidDismiss={() => setAddOpen(false)}>
        <div className="create-modal-content">
          <div className="modal-intro">
            <h3>Add Exercise</h3>
            <p>Set default progression targets and optional form reference details.</p>
          </div>
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAdd({
                name: draft.name,
                goalSets: draft.goalSets,
                goalReps: draft.goalReps,
                currentSets: draft.currentSets || draft.goalSets,
                currentReps: draft.currentReps || draft.goalReps,
                intensity: parseIntensity(draft.intensityText),
                tempo: draft.tempo,
                rest: draft.rest,
                videoUrl: draft.videoUrl,
                equipmentIds: mapTextToEquipmentIds(draft.equipmentText),
              });
              setDraft(defaultDraft);
              setAddOpen(false);
            }}
          >
            <div className="modal-card">
              <h4>Core Details</h4>
              <div className="modal-form-grid">
                <label className="modal-field">
                  <span>Exercise Name</span>
                  <IonInput
                    fill="outline"
                    required
                    value={draft.name}
                    placeholder="e.g. Ring Dip"
                    onIonInput={(e) => setDraft((prev) => ({ ...prev, name: String(e.detail.value ?? "") }))}
                  />
                </label>
                <label className="modal-field">
                  <span>Equipment</span>
                  <IonInput
                    fill="outline"
                    value={draft.equipmentText}
                    placeholder="comma separated names"
                    onIonInput={(e) =>
                      setDraft((prev) => ({ ...prev, equipmentText: String(e.detail.value ?? "") }))
                    }
                  />
                </label>
              </div>
            </div>

            <div className="modal-card">
              <h4>Progression Defaults</h4>
              <div className="modal-form-grid">
                <label className="modal-field">
                  <span>Goal Sets</span>
                  <IonInput
                    fill="outline"
                    value={draft.goalSets}
                    placeholder="e.g. 4"
                    onIonInput={(e) => setDraft((prev) => ({ ...prev, goalSets: String(e.detail.value ?? "") }))}
                  />
                </label>
                <label className="modal-field">
                  <span>Goal Reps</span>
                  <IonInput
                    fill="outline"
                    value={draft.goalReps}
                    placeholder="e.g. 6/8"
                    onIonInput={(e) => setDraft((prev) => ({ ...prev, goalReps: String(e.detail.value ?? "") }))}
                  />
                </label>
                <label className="modal-field">
                  <span>Current Sets</span>
                  <IonInput
                    fill="outline"
                    value={draft.currentSets}
                    placeholder="e.g. 4"
                    onIonInput={(e) =>
                      setDraft((prev) => ({ ...prev, currentSets: String(e.detail.value ?? "") }))
                    }
                  />
                </label>
                <label className="modal-field">
                  <span>Current Reps</span>
                  <IonInput
                    fill="outline"
                    value={draft.currentReps}
                    placeholder="e.g. 6"
                    onIonInput={(e) =>
                      setDraft((prev) => ({ ...prev, currentReps: String(e.detail.value ?? "") }))
                    }
                  />
                </label>
              </div>
            </div>

            <div className="modal-card">
              <h4>Execution</h4>
              <div className="modal-form-grid">
                <label className="modal-field">
                  <span>Intensity Fields</span>
                  <IonInput
                    fill="outline"
                    value={draft.intensityText}
                    placeholder="label:value | label:value"
                    onIonInput={(e) =>
                      setDraft((prev) => ({ ...prev, intensityText: String(e.detail.value ?? "") }))
                    }
                  />
                </label>
                <label className="modal-field">
                  <span>Tempo</span>
                  <IonInput
                    fill="outline"
                    value={draft.tempo}
                    placeholder="30X1"
                    onIonInput={(e) => setDraft((prev) => ({ ...prev, tempo: String(e.detail.value ?? "") }))}
                  />
                </label>
                <label className="modal-field">
                  <span>Rest</span>
                  <IonInput
                    fill="outline"
                    value={draft.rest}
                    placeholder="1:30"
                    onIonInput={(e) => setDraft((prev) => ({ ...prev, rest: String(e.detail.value ?? "") }))}
                  />
                </label>
                <label className="modal-field">
                  <span>Video URL</span>
                  <IonInput
                    fill="outline"
                    value={draft.videoUrl}
                    placeholder="https://..."
                    onIonInput={(e) =>
                      setDraft((prev) => ({ ...prev, videoUrl: String(e.detail.value ?? "") }))
                    }
                  />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <IonButton type="submit">Add Exercise</IonButton>
              <IonButton type="button" fill="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </IonButton>
            </div>
          </form>
        </div>
      </IonModal>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Equipment</th>
              <th>Goal Sets</th>
              <th>Goal Reps</th>
              <th>Current Sets</th>
              <th>Current Reps</th>
              <th>Intensity</th>
              <th>Tempo</th>
              <th>Rest</th>
              <th>Video</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {exercises.length === 0 && (
              <tr>
                <td colSpan={11}>
                  <p className="empty">No exercises yet.</p>
                </td>
              </tr>
            )}
            {exercises.map((exercise) => (
              <tr key={exercise.id}>
                <td>
                  <input defaultValue={exercise.name} onBlur={(event) => onUpdate(exercise.id, { name: event.target.value })} />
                </td>
                <td>
                  <input
                    defaultValue={mapIdsToNames(exercise.equipmentIds)}
                    onBlur={(event) => onUpdate(exercise.id, { equipmentIds: mapTextToEquipmentIds(event.target.value) })}
                  />
                </td>
                <td>
                  <input defaultValue={exercise.goalSets} onBlur={(event) => onUpdate(exercise.id, { goalSets: event.target.value })} />
                </td>
                <td>
                  <input defaultValue={exercise.goalReps} onBlur={(event) => onUpdate(exercise.id, { goalReps: event.target.value })} />
                </td>
                <td>
                  <input defaultValue={exercise.currentSets} onBlur={(event) => onUpdate(exercise.id, { currentSets: event.target.value })} />
                </td>
                <td>
                  <input defaultValue={exercise.currentReps} onBlur={(event) => onUpdate(exercise.id, { currentReps: event.target.value })} />
                </td>
                <td>
                  <input
                    defaultValue={formatIntensity(exercise.intensity)}
                    onBlur={(event) => onUpdate(exercise.id, { intensity: parseIntensity(event.target.value) })}
                  />
                </td>
                <td>
                  <input defaultValue={exercise.tempo} onBlur={(event) => onUpdate(exercise.id, { tempo: event.target.value })} />
                </td>
                <td>
                  <input defaultValue={exercise.rest} onBlur={(event) => onUpdate(exercise.id, { rest: event.target.value })} />
                </td>
                <td>
                  <input defaultValue={exercise.videoUrl} onBlur={(event) => onUpdate(exercise.id, { videoUrl: event.target.value })} />
                </td>
                <td>
                  <button className="danger-text" type="button" onClick={() => onDelete(exercise.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
