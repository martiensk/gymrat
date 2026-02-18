import { useMemo, useState } from "react";
import { IonAlert, IonButton, IonIcon, IonInput, IonModal } from "@ionic/react";
import { barbellOutline, createOutline, trashOutline } from "ionicons/icons";
import type { Equipment } from "../../state/types";

type EquipmentScreenProps = {
  equipment: Equipment[];
  onAdd(payload: { name: string; aliases?: string[]; imageBase64?: string }): void;
  onUpdate(id: string, updates: Partial<Equipment>): void;
  onDelete(id: string): void;
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });

export const EquipmentScreen = ({ equipment, onAdd, onUpdate, onDelete }: EquipmentScreenProps) => {
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);

  const [selectedId, setSelectedId] = useState<string>("");

  const [addName, setAddName] = useState<string>("");
  const [addImageBase64, setAddImageBase64] = useState<string>("");

  const [editName, setEditName] = useState<string>("");
  const [editImageBase64, setEditImageBase64] = useState<string>("");
  const [editAliases, setEditAliases] = useState<string[]>([]);
  const [editAliasInput, setEditAliasInput] = useState<string>("");

  const selectedEquipment = useMemo(
    () => equipment.find((item) => item.id === selectedId) ?? null,
    [equipment, selectedId]
  );

  const resetAddState = () => {
    setAddName("");
    setAddImageBase64("");
  };

  const openEditModal = (item: Equipment) => {
    setSelectedId(item.id);
    setEditName(item.name);
    setEditImageBase64(item.imageBase64 ?? "");
    setEditAliases(item.aliases ?? []);
    setEditAliasInput("");
    setEditOpen(true);
  };

  const handleImageSelection = async (
    files: FileList | null,
    setImage: (value: string) => void
  ): Promise<void> => {
    const file = files?.[0];
    if (!file) {
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      setImage(base64);
    } catch {
      // Keep silent for now; form remains editable.
    }
  };

  const addAliasChip = () => {
    const next = editAliasInput.trim();
    if (!next) {
      return;
    }
    const exists = editAliases.some((alias) => alias.toLowerCase() === next.toLowerCase());
    if (exists) {
      setEditAliasInput("");
      return;
    }
    setEditAliases((prev) => [...prev, next]);
    setEditAliasInput("");
  };

  const removeAliasChip = (aliasToRemove: string) => {
    setEditAliases((prev) => prev.filter((alias) => alias !== aliasToRemove));
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Equipment</h2>
        <p>
          Manage the equipment catalog used across workouts. Exercises can reference equipment by primary name or alias.
        </p>
      </div>

      <div className="panel-actions">
        <IonButton onClick={() => setAddOpen(true)}>Add Equipment</IonButton>
      </div>

      <IonModal className="create-modal" isOpen={addOpen} onDidDismiss={() => setAddOpen(false)}>
        <div className="create-modal-content">
          <div className="modal-intro">
            <h3>Add Equipment</h3>
            <p>Create an equipment item with optional aliases and image.</p>
          </div>
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAdd({
                name: addName,
                imageBase64: addImageBase64 || undefined,
              });
              resetAddState();
              setAddOpen(false);
            }}
          >
            <div className="modal-card">
              <h4>Equipment Details</h4>
              <div className="modal-form-grid">
                <label className="modal-field">
                  <span>Equipment Name</span>
                  <IonInput
                    fill="outline"
                    required
                    value={addName}
                    placeholder="e.g. Rings"
                    onIonInput={(event) => setAddName(String(event.detail.value ?? ""))}
                  />
                </label>
                <label className="modal-field modal-file-field">
                  <span>Image (optional)</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleImageSelection(event.target.files, setAddImageBase64)}
                  />
                </label>
              </div>
              {addImageBase64 && (
                <div className="equipment-image-preview">
                  <img src={addImageBase64} alt="Equipment preview" />
                  <IonButton type="button" fill="outline" size="small" onClick={() => setAddImageBase64("")}>
                    Remove image
                  </IonButton>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <IonButton type="submit">Add Equipment</IonButton>
              <IonButton
                type="button"
                fill="outline"
                onClick={() => {
                  setAddOpen(false);
                  resetAddState();
                }}
              >
                Cancel
              </IonButton>
            </div>
          </form>
        </div>
      </IonModal>

      <IonModal className="create-modal" isOpen={editOpen} onDidDismiss={() => setEditOpen(false)}>
        <div className="create-modal-content">
          <div className="modal-intro">
            <h3>Edit Equipment</h3>
            <p>Update the primary name and image for this equipment item.</p>
          </div>
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!selectedEquipment) {
                return;
              }
              onUpdate(selectedEquipment.id, {
                name: editName.trim() || selectedEquipment.name,
                imageBase64: editImageBase64 || undefined,
                aliases: editAliases,
              });
              setEditOpen(false);
            }}
          >
            <div className="modal-card">
              <h4>Editable Fields</h4>
              <div className="modal-form-grid">
                <label className="modal-field">
                  <span>Equipment Name</span>
                  <IonInput
                    fill="outline"
                    required
                    value={editName}
                    onIonInput={(event) => setEditName(String(event.detail.value ?? ""))}
                  />
                </label>
                <label className="modal-field modal-file-field">
                  <span>Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleImageSelection(event.target.files, setEditImageBase64)}
                  />
                </label>
              </div>

              <div className="modal-field">
                <span>Aliases</span>
                <div className="alias-row">
                  <IonInput
                    fill="outline"
                    value={editAliasInput}
                    placeholder="e.g. DB"
                    onIonInput={(event) => setEditAliasInput(String(event.detail.value ?? ""))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addAliasChip();
                      }
                    }}
                  />
                  <IonButton type="button" fill="outline" onClick={addAliasChip}>
                    Add Alias
                  </IonButton>
                </div>
                <div className="alias-chip-list">
                  {editAliases.length === 0 && <span className="alias-empty">No aliases configured.</span>}
                  {editAliases.map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      className="alias-chip"
                      onClick={() => removeAliasChip(alias)}
                      aria-label={`Remove alias ${alias}`}
                    >
                      {alias} <span>x</span>
                    </button>
                  ))}
                </div>
              </div>

              {editImageBase64 && (
                <div className="equipment-image-preview">
                  <img src={editImageBase64} alt="Equipment preview" />
                  <IonButton type="button" fill="outline" size="small" onClick={() => setEditImageBase64("")}>
                    Remove image
                  </IonButton>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <IonButton type="submit">Save Changes</IonButton>
              <IonButton type="button" fill="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </IonButton>
            </div>
          </form>
        </div>
      </IonModal>

      <IonAlert
        isOpen={Boolean(deleteTarget)}
        header="Delete Equipment?"
        message={
          deleteTarget
            ? `This will remove "${deleteTarget.name}" from your equipment list and unlink it from associated exercises.`
            : ""
        }
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => setDeleteTarget(null),
          },
          {
            text: "Delete",
            role: "destructive",
            handler: () => {
              if (deleteTarget) {
                onDelete(deleteTarget.id);
              }
              setDeleteTarget(null);
            },
          },
        ]}
        onDidDismiss={() => setDeleteTarget(null)}
      />

      <div className="equipment-grid">
        {equipment.length === 0 && <p className="empty">No equipment added yet.</p>}
        {equipment.map((item) => (
          <article className="equipment-media-card" key={item.id}>
            <div className="equipment-media">
              {item.imageBase64 ? (
                <img src={item.imageBase64} alt={`${item.name} thumbnail`} />
              ) : (
                <div className="equipment-placeholder" aria-label="No equipment image">
                  <IonIcon icon={barbellOutline} />
                </div>
              )}

              <div className="equipment-media-actions">
                <IonButton
                  fill="clear"
                  size="small"
                  className="icon-action-btn"
                  onClick={() => openEditModal(item)}
                  aria-label={`Edit ${item.name}`}
                >
                  <IonIcon icon={createOutline} />
                </IonButton>
                <IonButton
                  fill="clear"
                  size="small"
                  color="danger"
                  className="icon-action-btn"
                  onClick={() => setDeleteTarget(item)}
                  aria-label={`Delete ${item.name}`}
                >
                  <IonIcon icon={trashOutline} />
                </IonButton>
              </div>
            </div>
            <div className="equipment-media-name">
              <h4>{item.name}</h4>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
