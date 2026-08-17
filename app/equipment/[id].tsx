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
  View,
} from 'react-native';

import {
  EquipmentMeasurementInUseError,
  countExercisesUsingEquipment,
  deleteEquipment,
  getEquipment,
  saveEquipment,
} from '../../src/data/equipment';
import { pickLibraryImage } from '../../src/media/libraryImages';
import { syncAll } from '../../src/sync/sync';
import { colors, fonts, layout } from '../../src/theme/tokens';

type MeasurementForm = {
  id: string;
  label: string;
  unit: string;
  increment: string;
  defaultValue: string;
};

function emptyMeasurement(): MeasurementForm {
  return {
    id: crypto.randomUUID(),
    label: '',
    unit: '',
    increment: '1',
    defaultValue: '',
  };
}

export default function EquipmentEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const editing = id !== 'new';
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [name, setName] = useState('');
  const [thumbnailDataUri, setThumbnailDataUri] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementForm[]>([emptyMeasurement()]);

  useEffect(() => {
    if (!editing) return;
    void getEquipment(id).then((equipment) => {
      if (!equipment) {
        Alert.alert('Equipment not found');
        router.back();
        return;
      }
      setName(equipment.name);
      setThumbnailDataUri(equipment.thumbnailDataUri);
      setMeasurements(equipment.measurements.map((measurement) => ({
        id: measurement.id,
        label: measurement.label,
        unit: measurement.unit,
        increment: String(measurement.increment),
        defaultValue: measurement.defaultValue === null ? '' : String(measurement.defaultValue),
      })));
      setLoading(false);
    });
  }, [editing, id, router]);

  function updateMeasurement(index: number, field: keyof MeasurementForm, value: string) {
    setMeasurements((current) => current.map((measurement, itemIndex) => (
      itemIndex === index ? { ...measurement, [field]: value } : measurement
    )));
  }

  async function chooseImage() {
    try {
      const image = await pickLibraryImage();
      if (image) setThumbnailDataUri(image);
    } catch (error) {
      Alert.alert('Could not use image', error instanceof Error ? error.message : 'Choose another image.');
    }
  }

  async function save() {
    setShowErrors(true);
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Name required', 'Enter an equipment name.');
      return;
    }
    if (measurements.length === 0) {
      Alert.alert('Measurement required', 'Add at least one measurement.');
      return;
    }

    const parsed = measurements.map((measurement) => ({
      id: measurement.id,
      label: measurement.label.trim(),
      unit: measurement.unit.trim(),
      increment: Number(measurement.increment),
      defaultValue: measurement.defaultValue.trim() === '' ? null : Number(measurement.defaultValue),
    }));
    const invalid = parsed.some((measurement) => (
      !measurement.label ||
      !Number.isFinite(measurement.increment) ||
      measurement.increment <= 0 ||
      (measurement.defaultValue !== null && !Number.isFinite(measurement.defaultValue))
    ));
    if (invalid) {
      Alert.alert('Check measurements', 'Each measurement needs a type, positive increment, and valid optional default.');
      return;
    }

    setSaving(true);
    try {
      await saveEquipment(
        { name: cleanName, thumbnailDataUri, measurements: parsed },
        editing ? id : undefined,
      );
      void syncAll().catch(() => undefined);
      router.back();
    } catch (error) {
      if (error instanceof EquipmentMeasurementInUseError) {
        Alert.alert(
          'Measurement in use',
          `Remove ${error.labels.join(', ')} from its exercises before deleting it.`,
        );
      } else {
        Alert.alert('Could not save equipment', 'Your local changes were not saved.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const usage = await countExercisesUsingEquipment(id);
    const message = usage
      ? `This equipment is used by ${usage} exercise${usage === 1 ? '' : 's'}. Those exercises will show it as unavailable until you replace or remove it.`
      : 'It will be removed from the Library and synced to your other devices.';
    Alert.alert('Delete equipment?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteEquipment(id).then(() => {
            void syncAll().catch(() => undefined);
            router.back();
          });
        },
      },
    ]);
  }

  if (loading) return <SafeAreaView style={styles.safeArea} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
            <Ionicons color={colors.text} name="close" size={26} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{editing ? 'EDIT LIBRARY ITEM' : 'NEW LIBRARY ITEM'}</Text>
            <Text style={styles.title}>{editing ? 'Equipment details' : 'Add equipment'}</Text>
          </View>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>EQUIPMENT NAME</Text>
          <TextInput
            autoFocus={!editing}
            onChangeText={setName}
            placeholder="e.g. Dumbbells"
            placeholderTextColor={colors.outline}
            style={[styles.input, showErrors && !name.trim() && styles.inputError]}
            value={name}
          />

          <Text style={[styles.label, styles.sectionLabel]}>THUMBNAIL · OPTIONAL</Text>
          <Pressable onPress={() => void chooseImage()} style={styles.imagePicker}>
            {thumbnailDataUri ? (
              <Image source={{ uri: thumbnailDataUri }} style={styles.preview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons color={colors.lime} name="image-outline" size={34} />
                <Text style={styles.imageAction}>CHOOSE IMAGE</Text>
                <Text style={styles.imageFormats}>PNG · JPG · JPEG</Text>
                <Text style={styles.imageHint}>Stored on this device for offline use</Text>
              </View>
            )}
          </Pressable>
          {thumbnailDataUri ? (
            <View style={styles.imageButtons}>
              <Pressable onPress={() => void chooseImage()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>REPLACE IMAGE</Text>
              </Pressable>
              <Pressable onPress={() => setThumbnailDataUri(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>REMOVE</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.measurementHeading}>
            <View>
              <Text style={styles.label}>MEASUREMENTS</Text>
              <Text style={styles.helper}>Define what this equipment can track.</Text>
            </View>
            <Text style={styles.measurementCount}>{measurements.length.toString().padStart(2, '0')}</Text>
          </View>

          {measurements.map((measurement, index) => (
            <View key={measurement.id} style={styles.measurementCard}>
              <View style={styles.measurementHeader}>
                <Text style={styles.cardLabel}>MEASUREMENT {index + 1}</Text>
                {measurements.length > 1 ? (
                  <Pressable
                    accessibilityLabel={`Remove measurement ${index + 1}`}
                    onPress={() => setMeasurements((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <Ionicons color={colors.error} name="trash-outline" size={20} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.fieldLabel}>TYPE</Text>
              <TextInput
                onChangeText={(value) => updateMeasurement(index, 'label', value)}
                placeholder="Weight, strap height..."
                placeholderTextColor={colors.outline}
                style={[
                  styles.cardInput,
                  showErrors && !measurement.label.trim() && styles.inputError,
                ]}
                value={measurement.label}
              />
              <View style={styles.inputRow}>
                <View style={styles.inputColumn}>
                  <Text style={styles.fieldLabel}>UNIT · OPTIONAL</Text>
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={(value) => updateMeasurement(index, 'unit', value)}
                    placeholder="kg"
                    placeholderTextColor={colors.outline}
                    style={styles.cardInput}
                    value={measurement.unit}
                  />
                </View>
                <View style={styles.inputColumn}>
                  <Text style={styles.fieldLabel}>INCREMENT</Text>
                  <TextInput
                    inputMode="decimal"
                    onChangeText={(value) => updateMeasurement(index, 'increment', value)}
                    placeholder="2.5"
                    placeholderTextColor={colors.outline}
                    style={[
                      styles.cardInput,
                      styles.dataInput,
                      showErrors && (
                        !measurement.increment.trim() ||
                        !Number.isFinite(Number(measurement.increment)) ||
                        Number(measurement.increment) <= 0
                      ) && styles.inputError,
                    ]}
                    value={measurement.increment}
                  />
                </View>
                <View style={styles.inputColumn}>
                  <Text style={styles.fieldLabel}>DEFAULT</Text>
                  <TextInput
                    inputMode="decimal"
                    onChangeText={(value) => updateMeasurement(index, 'defaultValue', value)}
                    placeholder="Optional"
                    placeholderTextColor={colors.outline}
                    style={[
                      styles.cardInput,
                      styles.dataInput,
                      showErrors && measurement.defaultValue.trim() !== '' &&
                        !Number.isFinite(Number(measurement.defaultValue)) && styles.inputError,
                    ]}
                    value={measurement.defaultValue}
                  />
                </View>
              </View>
            </View>
          ))}

          <Pressable
            onPress={() => setMeasurements((current) => [...current, emptyMeasurement()])}
            style={styles.addMeasurement}
          >
            <Ionicons color={colors.lime} name="add" size={21} />
            <Text style={styles.addMeasurementText}>ADD MEASUREMENT</Text>
          </Pressable>

          <Pressable disabled={saving} onPress={() => void save()} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{saving ? 'SAVING...' : 'SAVE EQUIPMENT'}</Text>
          </Pressable>
          {editing ? (
            <Pressable onPress={() => void confirmDelete()} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>DELETE EQUIPMENT</Text>
            </Pressable>
          ) : null}
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
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20, letterSpacing: -0.5, marginTop: 3 },
  content: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.mobileMargin, paddingTop: 24, paddingBottom: 48 },
  label: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginBottom: 8 },
  sectionLabel: { marginTop: 28 },
  input: { minHeight: 56, color: colors.text, fontFamily: fonts.bold, fontSize: 17, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, paddingHorizontal: 16 },
  inputError: { borderColor: colors.error },
  imagePicker: { height: 190, overflow: 'hidden', borderRadius: layout.largeRadius, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, backgroundColor: colors.surfaceLowest },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageAction: { color: colors.text, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, marginTop: 12 },
  imageFormats: { color: colors.lime, fontFamily: fonts.data, fontSize: 10, letterSpacing: 0.8, marginTop: 7 },
  imageHint: { color: colors.outline, fontFamily: fonts.regular, fontSize: 12, marginTop: 6 },
  imageButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secondaryButton: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius },
  secondaryButtonText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
  measurementHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 34, marginBottom: 14 },
  helper: { color: colors.outline, fontFamily: fonts.regular, fontSize: 13 },
  measurementCount: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 22 },
  measurementCard: { backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 18, marginBottom: 12 },
  measurementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  cardLabel: { color: colors.lime, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2 },
  fieldLabel: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1, marginBottom: 6 },
  cardInput: { minHeight: 48, color: colors.text, fontFamily: fonts.medium, fontSize: 15, backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.radius, paddingHorizontal: 12 },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  inputColumn: { flex: 1 },
  dataInput: { fontFamily: fonts.data },
  addMeasurement: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, borderRadius: layout.radius },
  addMeasurementText: { color: colors.text, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1 },
  saveButton: { minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: layout.radius, marginTop: 34 },
  saveButtonText: { color: colors.onLime, fontFamily: fonts.extraBold, fontSize: 13, letterSpacing: 1.2 },
  deleteButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorContainer, borderRadius: layout.radius, marginTop: 12 },
  deleteButtonText: { color: colors.error, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1 },
});
