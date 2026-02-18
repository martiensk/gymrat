import { useEffect, useRef, useState, type ChangeEventHandler } from "react";
import { Preferences } from "@capacitor/preferences";
import {
  IonApp,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { settingsOutline } from "ionicons/icons";
import { EquipmentScreen } from "./features/equipment/EquipmentScreen";
import { ExercisesScreen } from "./features/exercises/ExercisesScreen";
import { ProgramsScreen } from "./features/programs/ProgramsScreen";
import { WorkoutScreen } from "./features/workout/WorkoutScreen";
import { useAppData } from "./state/AppDataContext";
import type { SyncProvider } from "./state/types";
import { useIsMobile } from "./utils/useIsMobile";

type TabKey = "equipment" | "exercises" | "programs" | "workout";
type ThemeMode = "system" | "light" | "dark";

const THEME_MODE_KEY = "gymrat_theme_mode";
const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "system" || value === "light" || value === "dark";

const applyThemeMode = (mode: ThemeMode) => {
  const prefersDark = window.matchMedia(THEME_MEDIA_QUERY).matches;
  const shouldUseDark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("ion-palette-dark", shouldUseDark);
  document.body.classList.toggle("ion-palette-dark", shouldUseDark);
};

export default function App() {
  const { data, loading, error, provider, setProvider, resetToSeed, exportJSON, importJSON, actions } = useAppData();
  const [tab, setTab] = useState<TabKey>("programs");
  const [importMessage, setImportMessage] = useState<string>("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [preferencesOpen, setPreferencesOpen] = useState<boolean>(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile && preferencesOpen) {
      setPreferencesOpen(false);
    }
  }, [isMobile, preferencesOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadThemeMode = async () => {
      try {
        const { value } = await Preferences.get({ key: THEME_MODE_KEY });
        if (cancelled) {
          return;
        }
        if (isThemeMode(value)) {
          setThemeMode(value);
          return;
        }
        applyThemeMode("system");
      } catch {
        applyThemeMode("system");
      }
    };

    void loadThemeMode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyThemeMode(themeMode);
    void Preferences.set({ key: THEME_MODE_KEY, value: themeMode }).catch(() => {
      // Theme still applies in memory even if persistence fails.
    });

    if (themeMode !== "system") {
      return;
    }

    const media = window.matchMedia(THEME_MEDIA_QUERY);
    const onChange = () => applyThemeMode("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [themeMode]);

  const exportData = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gymrat-native-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => {
    importRef.current?.click();
  };

  const handleImportFile: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = importJSON(String(reader.result ?? ""));
      setImportMessage(result.message);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const renderTab = () => {
    switch (tab) {
      case "equipment":
        return (
          <EquipmentScreen
            equipment={data.equipment}
            onAdd={actions.addEquipment}
            onUpdate={actions.updateEquipment}
            onDelete={actions.removeEquipment}
          />
        );
      case "exercises":
        return (
          <ExercisesScreen
            equipment={data.equipment}
            exercises={data.exercises}
            onAdd={actions.addExercise}
            onUpdate={actions.updateExercise}
            onDelete={actions.removeExercise}
          />
        );
      case "programs":
        return (
          <ProgramsScreen
            programs={data.programs}
            exercises={data.exercises}
            onAddProgram={actions.addProgram}
            onUpdateProgram={actions.updateProgram}
            onRemoveProgram={actions.removeProgram}
            onRenameDay={actions.renameDay}
            onAddEntry={(programId, dayId, exerciseId) => {
              if (!dayId || !exerciseId) {
                return;
              }
              actions.addEntry(programId, dayId, exerciseId);
            }}
            onUpdateEntry={actions.updateEntry}
            onRemoveEntry={actions.removeEntry}
          />
        );
      case "workout":
      default:
        return <WorkoutScreen programs={data.programs} exercises={data.exercises} logs={data.logs} onLog={actions.logWorkout} />;
    }
  };

  return (
    <IonApp>
      <IonHeader>
        <IonToolbar>
          {!isMobile && (
            <IonButtons slot="start">
              <IonButton aria-label="Open preferences" onClick={() => setPreferencesOpen(true)}>
                <IonIcon icon={settingsOutline} />
              </IonButton>
            </IonButtons>
          )}
          <IonTitle>GymRat Native</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={resetToSeed}>Load Demo</IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <div className="toolbar-grid">
            <IonSegment value={tab} onIonChange={(event) => setTab(event.detail.value as TabKey)}>
              <IonSegmentButton value="equipment">
                <IonLabel>Equipment</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="exercises">
                <IonLabel>Exercises</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="programs">
                <IonLabel>Programs</IonLabel>
              </IonSegmentButton>
              <IonSegmentButton value="workout">
                <IonLabel>Workout</IonLabel>
              </IonSegmentButton>
            </IonSegment>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonModal className="preferences-modal" isOpen={preferencesOpen} onDidDismiss={() => setPreferencesOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Preferences</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setPreferencesOpen(false)}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <div className="preferences-modal-body">
            <div className="preferences-content">
              <div className="modal-intro">
                <h3>App Preferences</h3>
                <p>Configure sync and appearance, then manage imports/exports.</p>
              </div>

              <div className="modal-card">
                <h4>Settings</h4>
                <div className="toolbar-controls">
                  <label className="modal-field">
                    <span>Sync Provider</span>
                    <IonSelect
                      fill="outline"
                      value={provider}
                      onIonChange={(event) => setProvider(event.detail.value as SyncProvider)}
                    >
                      <IonSelectOption value="local">Local (Capacitor Preferences)</IonSelectOption>
                      <IonSelectOption value="appwrite" disabled>
                        Appwrite (coming next)
                      </IonSelectOption>
                      <IonSelectOption value="google-sheets" disabled>
                        Google Sheets (coming next)
                      </IonSelectOption>
                    </IonSelect>
                  </label>

                  <label className="modal-field">
                    <span>Theme</span>
                    <IonSelect
                      fill="outline"
                      value={themeMode}
                      onIonChange={(event) => setThemeMode(event.detail.value as ThemeMode)}
                    >
                      <IonSelectOption value="system">System</IonSelectOption>
                      <IonSelectOption value="light">Light</IonSelectOption>
                      <IonSelectOption value="dark">Dark</IonSelectOption>
                    </IonSelect>
                  </label>
                </div>
              </div>

              <div className="modal-card">
                <h4>Data Management</h4>
                <p className="modal-help">Import a backup file or export your current data snapshot.</p>
                <div className="preferences-actions">
                  <IonButton onClick={triggerImport}>Import Data</IonButton>
                  <IonButton onClick={exportData}>Export Data</IonButton>
                </div>
              </div>
            </div>
          </div>
        </IonModal>

        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden-input"
          onChange={handleImportFile}
        />

        {loading && (
          <div className="status-row">
            <IonSpinner />
            <span>Loading data...</span>
          </div>
        )}

        {!loading && (
          <div className="screen-wrap">
            {error && <p className="error-banner">{error}</p>}
            {importMessage && <p className="info-banner">{importMessage}</p>}
            {renderTab()}
          </div>
        )}
      </IonContent>
    </IonApp>
  );
}
