import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { listEquipment } from '../../../src/data/equipment';
import { countExercisesNamed, getExercise, saveExercise } from '../../../src/data/exercises';
import { followsIncrement, validateExerciseDraft } from '../../../src/domain/exerciseValidation';
import { MUSCLES, type MuscleId } from '../../../src/domain/muscles';
import { pickLibraryImage } from '../../../src/media/libraryImages';
import { syncAll } from '../../../src/sync/sync';
import { colors, fonts, layout } from '../../../src/theme/tokens';
import type { Equipment } from '../../../src/types/equipment';
import type { Exercise, ExerciseDraft, ExerciseEquipment } from '../../../src/types/exercise';

type MeasurementForm = Omit<ExerciseEquipment['measurements'][number], 'defaultValue'> & {
  defaultValue: string;
};

type EquipmentForm = Omit<ExerciseEquipment, 'measurements'> & {
  measurements: MeasurementForm[];
};

function toEquipmentForm(entry: ExerciseEquipment, available: Equipment[]): EquipmentForm {
  const current = available.find((item) => item.id === entry.equipmentId);
  if (!current) {
    return {
      ...entry,
      measurements: entry.measurements.map((measurement) => ({
        ...measurement,
        defaultValue: measurement.defaultValue === null ? '' : String(measurement.defaultValue),
      })),
    };
  }

  const liveIds = new Set(current.measurements.map((measurement) => measurement.id));
  const measurements = current.measurements.map((measurement) => {
    const existing = entry.measurements.find((item) => item.measurementId === measurement.id);
    return {
      id: existing?.id ?? crypto.randomUUID(),
      measurementId: measurement.id,
      label: measurement.label,
      unit: measurement.unit,
      increment: measurement.increment,
      defaultValue: existing?.defaultValue === null || existing?.defaultValue === undefined
        ? ''
        : String(existing.defaultValue),
      unavailable: false,
    };
  });
  for (const measurement of entry.measurements) {
    if (liveIds.has(measurement.measurementId)) continue;
    measurements.push({
      ...measurement,
      defaultValue: measurement.defaultValue === null ? '' : String(measurement.defaultValue),
    });
  }
  return {
    ...entry,
    equipmentName: current.name,
    unavailable: false,
    measurements,
  };
}

function newEquipmentForm(equipment: Equipment, position: number): EquipmentForm {
  return {
    id: crypto.randomUUID(),
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    unavailable: false,
    position,
    measurements: equipment.measurements.map((measurement) => ({
      id: crypto.randomUUID(),
      measurementId: measurement.id,
      label: measurement.label,
      unit: measurement.unit,
      increment: measurement.increment,
      defaultValue: measurement.defaultValue === null ? '' : String(measurement.defaultValue),
      unavailable: false,
    })),
  };
}

function positiveInteger(value: string) {
  return /^\d+$/.test(value.trim()) && Number(value) > 0;
}

export default function ExerciseEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const editing = id !== 'new';
  const narrow = useWindowDimensions().width < 560;
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [name, setName] = useState('');
  const [thumbnailDataUri, setThumbnailDataUri] = useState<string | null>(null);
  const [thumbnailRemoteFileId, setThumbnailRemoteFileId] = useState<string | null>(null);
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleId>('chest');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleId[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [repMode, setRepMode] = useState<Exercise['repMode']>('count');
  const [sets, setSets] = useState('3');
  const [target, setTarget] = useState('10');
  const [restMinutes, setRestMinutes] = useState('2');
  const [tempo, setTempo] = useState('');
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentForm[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([listEquipment(), editing ? getExercise(id) : Promise.resolve(null)])
      .then(([equipment, exercise]) => {
        if (!active) return;
        setAvailableEquipment(equipment);
        if (editing && !exercise) {
          Alert.alert('Exercise not found');
          router.back();
          return;
        }
        if (exercise) {
          setName(exercise.name);
          setThumbnailDataUri(exercise.thumbnailDataUri);
          setThumbnailRemoteFileId(exercise.thumbnailRemoteFileId);
          setPrimaryMuscle(exercise.primaryMuscle);
          setSecondaryMuscles(exercise.secondaryMuscles);
          setYoutubeUrl(exercise.youtubeUrl ?? '');
          setRepMode(exercise.repMode);
          setSets(String(exercise.defaultSets));
          setTarget(String(exercise.defaultTarget));
          setRestMinutes(String(exercise.defaultRestSeconds / 60));
          setTempo(exercise.defaultTempo ?? '');
          setSelectedEquipment(exercise.equipment.map((entry) => toEquipmentForm(entry, equipment)));
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) Alert.alert('Could not load exercise', 'Try opening the editor again.');
      });
    return () => { active = false; };
  }, [editing, id, router]);

  async function chooseImage() {
    try {
      const image = await pickLibraryImage();
      if (image) setThumbnailDataUri(image);
    } catch (error) {
      Alert.alert('Could not use image', error instanceof Error ? error.message : 'Choose another image.');
    }
  }

  function selectPrimary(muscle: MuscleId) {
    setPrimaryMuscle(muscle);
    setSecondaryMuscles((current) => current.filter((item) => item !== muscle));
  }

  function toggleSecondary(muscle: MuscleId) {
    setSecondaryMuscles((current) => current.includes(muscle)
      ? current.filter((item) => item !== muscle)
      : [...current, muscle]);
  }

  function toggleEquipment(equipment: Equipment) {
    setSelectedEquipment((current) => {
      const selected = current.some((item) => item.equipmentId === equipment.id);
      return selected
        ? current.filter((item) => item.equipmentId !== equipment.id)
        : [...current, newEquipmentForm(equipment, current.length)];
    });
  }

  function updateMeasurement(equipmentId: string, measurementId: string, value: string) {
    setSelectedEquipment((current) => current.map((equipment) => (
      equipment.id === equipmentId
        ? {
          ...equipment,
          measurements: equipment.measurements.map((measurement) => (
            measurement.id === measurementId ? { ...measurement, defaultValue: value } : measurement
          )),
        }
        : equipment
    )));
  }

  function buildDraft(): ExerciseDraft {
    const minutes = Number(restMinutes);
    return {
      name: name.trim(),
      thumbnailDataUri,
      thumbnailRemoteFileId,
      primaryMuscle,
      secondaryMuscles,
      youtubeUrl: youtubeUrl.trim() || null,
      repMode,
      defaultSets: Number(sets),
      defaultTarget: Number(target),
      defaultRestSeconds: minutes * 60,
      defaultTempo: tempo.trim() ? tempo.trim().toUpperCase() : null,
      equipment: selectedEquipment.map((equipment, position) => ({
        ...equipment,
        position,
        measurements: equipment.measurements.map((measurement) => ({
          ...measurement,
          defaultValue: measurement.defaultValue.trim() === ''
            ? null
            : Number(measurement.defaultValue),
        })),
      })),
    };
  }

  async function persist(draft: ExerciseDraft) {
    setSaving(true);
    try {
      const savedId = await saveExercise(draft, editing ? id : undefined);
      void syncAll().catch(() => undefined);
      router.replace({ pathname: '/exercise/[id]', params: { id: savedId } });
    } catch {
      Alert.alert('Could not save exercise', 'Your local changes were not saved.');
      setSaving(false);
    }
  }

  async function save() {
    setShowErrors(true);
    const draft = buildDraft();
    const errors = validateExerciseDraft(draft);
    const parsingInvalid = !positiveInteger(sets) || !positiveInteger(target) ||
      !Number.isFinite(Number(restMinutes)) || Number(restMinutes) < 0 ||
      !Number.isInteger(Number(restMinutes) * 60);
    if (errors.name || errors.primaryMuscle || errors.sets || errors.target || errors.rest ||
      errors.tempo || errors.youtube || errors.invalidMeasurementIds.length || parsingInvalid) {
      Alert.alert('Check highlighted fields', 'Correct the invalid values before saving.');
      return;
    }

    const duplicateCount = await countExercisesNamed(draft.name, editing ? id : undefined);
    if (duplicateCount) {
      Alert.alert(
        'Exercise name already exists',
        `${duplicateCount} other exercise${duplicateCount === 1 ? '' : 's'} use this name. Save anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => void persist(draft) },
        ],
      );
      return;
    }
    await persist(draft);
  }

  const restInvalid = !Number.isFinite(Number(restMinutes)) || Number(restMinutes) < 0 ||
    !Number.isInteger(Number(restMinutes) * 60);
  const youtubeInvalid = validateExerciseDraft({ ...buildDraft(), youtubeUrl: youtubeUrl.trim() || null }).youtube;
  const tempoInvalid = validateExerciseDraft({ ...buildDraft(), defaultTempo: tempo.trim() || null }).tempo;

  if (loading) return <SafeAreaView style={styles.safeArea} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Close editor" onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons color={colors.text} name="close" size={26} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{editing ? 'EDIT EXERCISE' : 'NEW EXERCISE'}</Text>
            <Text style={styles.headerTitle}>{editing ? 'Exercise details' : 'Add exercise'}</Text>
          </View>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>EXERCISE NAME</Text>
          <TextInput
            accessibilityLabel="Exercise name"
            autoFocus={!editing}
            onChangeText={setName}
            placeholder="e.g. Bulgarian split squat"
            placeholderTextColor={colors.outline}
            style={[styles.input, showErrors && !name.trim() && styles.inputError]}
            value={name}
          />

          <Text style={styles.sectionLabel}>THUMBNAIL · OPTIONAL</Text>
          <Pressable accessibilityLabel="Choose exercise image" onPress={() => void chooseImage()} style={styles.imagePicker}>
            {thumbnailDataUri ? (
              <Image source={{ uri: thumbnailDataUri }} style={styles.preview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons color={colors.lime} name="image-outline" size={34} />
                <Text style={styles.imageAction}>CHOOSE IMAGE</Text>
                <Text style={styles.helper}>PNG · JPG · JPEG · STORED OFFLINE</Text>
              </View>
            )}
          </Pressable>
          {thumbnailDataUri ? (
            <View style={styles.imageButtons}>
              <Pressable onPress={() => void chooseImage()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>REPLACE</Text>
              </Pressable>
              <Pressable onPress={() => setThumbnailDataUri(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>REMOVE</Text>
              </Pressable>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>PRIMARY MUSCLE</Text>
          <View style={styles.chips}>
            {MUSCLES.map((muscle) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: primaryMuscle === muscle.id }}
                key={muscle.id}
                onPress={() => selectPrimary(muscle.id)}
                style={[styles.chip, primaryMuscle === muscle.id && styles.activeChip]}
              >
                <Text style={[styles.chipText, primaryMuscle === muscle.id && styles.activeChipText]}>{muscle.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>SECONDARY MUSCLES · OPTIONAL</Text>
          <View style={styles.chips}>
            {MUSCLES.filter((muscle) => muscle.id !== primaryMuscle).map((muscle) => {
              const selected = secondaryMuscles.includes(muscle.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={muscle.id}
                  onPress={() => toggleSecondary(muscle.id)}
                  style={[styles.chip, selected && styles.activeChip]}
                >
                  <Text style={[styles.chipText, selected && styles.activeChipText]}>{muscle.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>YOUTUBE URL · OPTIONAL</Text>
          <TextInput
            accessibilityLabel="YouTube URL"
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            onChangeText={setYoutubeUrl}
            placeholder="https://youtu.be/..."
            placeholderTextColor={colors.outline}
            style={[styles.input, showErrors && youtubeInvalid && styles.inputError]}
            value={youtubeUrl}
          />

          <Text style={styles.sectionLabel}>PRESCRIPTION</Text>
          <View accessibilityRole="tablist" style={styles.segmented}>
            {(['count', 'time'] as const).map((mode) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: repMode === mode }}
                key={mode}
                onPress={() => setRepMode(mode)}
                style={[styles.segment, repMode === mode && styles.activeSegment]}
              >
                <Text style={[styles.segmentText, repMode === mode && styles.activeSegmentText]}>
                  {mode === 'count' ? 'COUNTED REPS' : 'TIMED HOLD'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldColumn}>
              <Text style={styles.fieldLabel}>SETS</Text>
              <TextInput
                accessibilityLabel="Default sets"
                inputMode="numeric"
                onChangeText={setSets}
                style={[styles.input, styles.dataInput, showErrors && !positiveInteger(sets) && styles.inputError]}
                value={sets}
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={styles.fieldLabel}>{repMode === 'count' ? 'REPS' : 'SECONDS'}</Text>
              <TextInput
                accessibilityLabel={repMode === 'count' ? 'Default reps' : 'Default seconds'}
                inputMode="numeric"
                onChangeText={setTarget}
                style={[styles.input, styles.dataInput, showErrors && !positiveInteger(target) && styles.inputError]}
                value={target}
              />
            </View>
          </View>
          <View style={styles.fieldRow}>
            <View style={styles.fieldColumn}>
              <Text style={styles.fieldLabel}>REST · MINUTES</Text>
              <TextInput
                accessibilityLabel="Default rest in minutes"
                inputMode="decimal"
                onChangeText={setRestMinutes}
                style={[styles.input, styles.dataInput, showErrors && restInvalid && styles.inputError]}
                value={restMinutes}
              />
            </View>
            <View style={styles.fieldColumn}>
              <View style={styles.tooltipLabel}>
                <Text style={styles.fieldLabel}>TEMPO · OPTIONAL</Text>
                <Pressable
                  accessibilityLabel="Explain exercise tempo"
                  onPress={() => Alert.alert('Tempo: 30X1', '3 seconds lowering, 0 pause, explode up, 1 second at the top. Use four digits or X.')}
                >
                  <Ionicons color={colors.outline} name="help-circle-outline" size={17} />
                </Pressable>
              </View>
              <TextInput
                accessibilityLabel="Default tempo"
                autoCapitalize="characters"
                maxLength={4}
                onChangeText={setTempo}
                placeholder="30X1"
                placeholderTextColor={colors.outline}
                style={[styles.input, styles.dataInput, showErrors && tempoInvalid && styles.inputError]}
                value={tempo}
              />
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionLabel}>EQUIPMENT · OPTIONAL</Text>
              <Text style={styles.helper}>Select any equipment used by this exercise.</Text>
            </View>
            <Text style={styles.count}>{selectedEquipment.length.toString().padStart(2, '0')}</Text>
          </View>
          <View style={styles.chips}>
            {availableEquipment.map((equipment) => {
              const selected = selectedEquipment.some((item) => item.equipmentId === equipment.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={equipment.id}
                  onPress={() => toggleEquipment(equipment)}
                  style={[styles.chip, selected && styles.activeChip]}
                >
                  <Text style={[styles.chipText, selected && styles.activeChipText]}>{equipment.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {!availableEquipment.length ? <Text style={styles.emptyCopy}>No equipment is available in the Library.</Text> : null}

          {selectedEquipment.map((equipment) => (
            <View key={equipment.id} style={[styles.equipmentCard, equipment.unavailable && styles.unavailableCard]}>
              <View style={styles.equipmentHeader}>
                <View style={styles.equipmentTitleRow}>
                  <Text style={styles.equipmentName}>{equipment.equipmentName}</Text>
                  {equipment.unavailable ? <Text style={styles.warning}>UNAVAILABLE</Text> : null}
                </View>
                <Pressable
                  accessibilityLabel={`Remove ${equipment.equipmentName}`}
                  onPress={() => setSelectedEquipment((current) => current.filter((item) => item.id !== equipment.id))}
                >
                  <Ionicons color={colors.error} name="trash-outline" size={20} />
                </Pressable>
              </View>
              {equipment.measurements.length ? (
                <View style={[styles.measurementGrid, narrow && styles.measurementGridNarrow]}>
                  {equipment.measurements.map((measurement) => {
                    const numeric = Number(measurement.defaultValue);
                    const invalid = measurement.defaultValue.trim() !== '' &&
                      !followsIncrement(numeric, measurement.increment);
                    return (
                      <View key={measurement.id} style={[styles.measurementField, narrow && styles.measurementFieldNarrow]}>
                        <View style={styles.measurementHeading}>
                          <Text style={styles.fieldLabel}>{measurement.label}{measurement.unit ? ` · ${measurement.unit}` : ''}</Text>
                          <Text style={styles.increment}>STEP {measurement.increment}</Text>
                        </View>
                        <TextInput
                          accessibilityLabel={`${equipment.equipmentName} ${measurement.label} default`}
                          editable={!measurement.unavailable}
                          inputMode="decimal"
                          onChangeText={(value) => updateMeasurement(equipment.id, measurement.id, value)}
                          placeholder="No default"
                          placeholderTextColor={colors.outline}
                          style={[
                            styles.input,
                            styles.dataInput,
                            measurement.unavailable && styles.disabledInput,
                            showErrors && invalid && styles.inputError,
                          ]}
                          value={measurement.defaultValue}
                        />
                        {measurement.unavailable ? <Text style={styles.warning}>MEASUREMENT UNAVAILABLE</Text> : null}
                      </View>
                    );
                  })}
                </View>
              ) : <Text style={styles.emptyCopy}>This equipment has no measurements.</Text>}
            </View>
          ))}

          <Pressable disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>
            <Text style={styles.saveButtonText}>{saving ? 'SAVING...' : 'SAVE EXERCISE'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.outlineMuted, paddingHorizontal: 12 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center' },
  eyebrow: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4 },
  headerTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20, letterSpacing: -0.5, marginTop: 3 },
  content: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.mobileMargin, paddingTop: 24, paddingBottom: 48 },
  label: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginBottom: 8 },
  sectionLabel: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginTop: 28, marginBottom: 8 },
  fieldLabel: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1, marginBottom: 7 },
  input: { minHeight: 54, color: colors.text, fontFamily: fonts.medium, fontSize: 15, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, paddingHorizontal: 14 },
  inputError: { borderColor: colors.error },
  dataInput: { fontFamily: fonts.data },
  imagePicker: { height: 190, overflow: 'hidden', borderRadius: layout.largeRadius, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, backgroundColor: colors.surfaceLowest },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageAction: { color: colors.text, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, marginTop: 12 },
  imageButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryButton: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius },
  secondaryButtonText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
  helper: { color: colors.outline, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: 99, paddingHorizontal: 14 },
  activeChip: { backgroundColor: colors.lime, borderColor: colors.lime },
  chipText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.5 },
  activeChipText: { color: colors.onLime },
  segmented: { minHeight: 50, flexDirection: 'row', backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, padding: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: layout.radius },
  activeSegment: { backgroundColor: colors.lime },
  segmentText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8 },
  activeSegmentText: { color: colors.onLime },
  fieldRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  fieldColumn: { flex: 1 },
  tooltipLabel: { minHeight: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  count: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 22 },
  emptyCopy: { color: colors.outline, fontFamily: fonts.regular, fontSize: 13, marginTop: 10 },
  equipmentCard: { backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 16, marginTop: 12 },
  unavailableCard: { borderColor: colors.errorContainer },
  equipmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  equipmentTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  equipmentName: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  warning: { color: colors.error, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.8, marginTop: 5 },
  measurementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  measurementGridNarrow: { flexDirection: 'column' },
  measurementField: { width: '48%', flexGrow: 1 },
  measurementFieldNarrow: { width: '100%' },
  measurementHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  increment: { color: colors.outline, fontFamily: fonts.data, fontSize: 8 },
  disabledInput: { opacity: 0.55 },
  saveButton: { minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: layout.radius, marginTop: 34 },
  saveButtonText: { color: colors.onLime, fontFamily: fonts.extraBold, fontSize: 13, letterSpacing: 1.2 },
  disabled: { opacity: 0.55 },
});
