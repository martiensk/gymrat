import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { deleteExercise, getExercise } from '../../src/data/exercises';
import { muscleLabel } from '../../src/domain/muscles';
import { subscribeToSync, syncAll } from '../../src/sync/sync';
import { colors, fonts, layout } from '../../src/theme/tokens';
import type { Exercise } from '../../src/types/exercise';

function formatRest(seconds: number) {
  if (seconds === 0) return 'No rest';
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} min`;
}

export default function ExerciseDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        void getExercise(id).then((item) => {
          if (!active) return;
          setExercise(item);
          setLoading(false);
        });
      };
      refresh();
      const unsubscribe = subscribeToSync(refresh);
      return () => {
        active = false;
        unsubscribe();
      };
    }, [id]),
  );

  function confirmDelete() {
    Alert.alert(
      'Delete exercise?',
      'It will be removed from the Library and synced to your other devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteExercise(id).then(() => {
              void syncAll().catch(() => undefined);
              router.back();
            });
          },
        },
      ],
    );
  }

  if (loading) return <SafeAreaView style={styles.safeArea} />;

  if (!exercise) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missing}>
          <Ionicons color={colors.outline} name="body-outline" size={42} />
          <Text style={styles.missingTitle}>EXERCISE NOT FOUND</Text>
          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>GO BACK</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="arrow-back" size={24} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>EXERCISE</Text>
        <Pressable
          accessibilityLabel={`Edit ${exercise.name}`}
          onPress={() => router.push({ pathname: '/exercise/edit/[id]', params: { id } })}
          style={styles.iconButton}
        >
          <Ionicons color={colors.lime} name="create-outline" size={23} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          {exercise.thumbnailDataUri ? (
            <Image source={{ uri: exercise.thumbnailDataUri }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Ionicons color={colors.outline} name="body-outline" size={54} />
            </View>
          )}
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>LIBRARY EXERCISE</Text>
            <Text style={styles.title}>{exercise.name}</Text>
            <Text style={styles.muscles}>
              {muscleLabel(exercise.primaryMuscle)}
              {exercise.secondaryMuscles.length
                ? ` · ${exercise.secondaryMuscles.map(muscleLabel).join(' · ')}`
                : ''}
            </Text>
            {exercise.syncStatus === 'pending' ? (
              <View style={styles.pendingBadge}>
                <View style={styles.pendingDot} />
                <Text style={styles.pendingText}>PENDING SYNC</Text>
              </View>
            ) : null}
          </View>
        </View>

        {exercise.youtubeUrl ? (
          <Pressable
            accessibilityLabel={`Watch ${exercise.name} on YouTube`}
            onPress={() => void Linking.openURL(exercise.youtubeUrl!).catch(() => {
              Alert.alert('Could not open video', 'Check the YouTube URL and try again.');
            })}
            style={styles.youtubeButton}
          >
            <Ionicons color={colors.onLime} name="logo-youtube" size={21} />
            <Text style={styles.youtubeText}>WATCH TECHNIQUE</Text>
          </Pressable>
        ) : null}

        <Text style={styles.sectionLabel}>DEFAULT PRESCRIPTION</Text>
        <View style={styles.metricGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>SETS</Text>
            <Text style={styles.metricValue}>{exercise.defaultSets}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>{exercise.repMode === 'count' ? 'REPS' : 'SECONDS'}</Text>
            <Text style={styles.metricValue}>{exercise.defaultTarget}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>REST</Text>
            <Text style={styles.metricSmallValue}>{formatRest(exercise.defaultRestSeconds)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>TEMPO</Text>
            <Text style={styles.metricSmallValue}>{exercise.defaultTempo ?? 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionLabel}>EQUIPMENT</Text>
          <Text style={styles.sectionCount}>{exercise.equipment.length.toString().padStart(2, '0')}</Text>
        </View>
        {exercise.equipment.length ? exercise.equipment.map((entry) => (
          <View key={entry.id} style={[styles.equipmentCard, entry.unavailable && styles.unavailableCard]}>
            <View style={styles.equipmentHeading}>
              <Text style={styles.equipmentName}>{entry.equipmentName}</Text>
              {entry.unavailable ? (
                <View style={styles.warningBadge}>
                  <Ionicons color={colors.error} name="warning-outline" size={14} />
                  <Text style={styles.warningText}>UNAVAILABLE</Text>
                </View>
              ) : null}
            </View>
            {entry.measurements.length ? entry.measurements.map((measurement) => (
              <View key={measurement.id} style={styles.measurementRow}>
                <View style={styles.measurementCopy}>
                  <Text style={styles.measurementLabel}>{measurement.label}</Text>
                  <Text style={styles.measurementIncrement}>
                    INCREMENT {measurement.increment}{measurement.unit ? ` ${measurement.unit}` : ''}
                    {measurement.unavailable ? ' · UNAVAILABLE' : ''}
                  </Text>
                </View>
                <Text style={styles.measurementValue}>
                  {measurement.defaultValue === null
                    ? 'NO DEFAULT'
                    : `${measurement.defaultValue}${measurement.unit ? ` ${measurement.unit}` : ''}`}
                </Text>
              </View>
            )) : <Text style={styles.emptyInline}>No measurement defaults.</Text>}
          </View>
        )) : (
          <View style={styles.emptyCard}>
            <Ionicons color={colors.outline} name="barbell-outline" size={26} />
            <Text style={styles.emptyInline}>No equipment selected.</Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>PERFORMANCE & HISTORY</Text>
        <View style={styles.historyCard}>
          <Ionicons color={colors.outline} name="analytics-outline" size={30} />
          <Text style={styles.historyTitle}>NO PERFORMANCE YET</Text>
          <Text style={styles.historyCopy}>
            Completed workout history will appear here when workout tracking is available.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/exercise/edit/[id]', params: { id } })}
          style={styles.editButton}
        >
          <Text style={styles.editButtonText}>EDIT EXERCISE</Text>
        </Pressable>
        <Pressable onPress={confirmDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>DELETE EXERCISE</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.outlineMuted, paddingHorizontal: 8 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, textAlign: 'center' },
  content: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.mobileMargin, paddingBottom: 48 },
  hero: { flexDirection: 'row', gap: 18, alignItems: 'center', marginTop: 8 },
  heroImage: { width: 112, height: 112, borderRadius: layout.largeRadius, backgroundColor: colors.surfaceHigh },
  heroFallback: { width: 112, height: 112, alignItems: 'center', justifyContent: 'center', borderRadius: layout.largeRadius, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest },
  heroCopy: { flex: 1 },
  eyebrow: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 27, lineHeight: 31, letterSpacing: -0.8, marginTop: 5 },
  muscles: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, marginTop: 7 },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  pendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.limeDim },
  pendingText: { color: colors.outline, fontFamily: fonts.data, fontSize: 9 },
  youtubeButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.lime, borderRadius: layout.radius, marginTop: 22 },
  youtubeText: { color: colors.onLime, fontFamily: fonts.extraBold, fontSize: 11, letterSpacing: 1.1 },
  sectionLabel: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginTop: 30, marginBottom: 10 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 92, justifyContent: 'space-between', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 14 },
  metricLabel: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1 },
  metricValue: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 31 },
  metricSmallValue: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 17 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionCount: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 18 },
  equipmentCard: { backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 16, marginBottom: 10 },
  unavailableCard: { borderColor: colors.errorContainer },
  equipmentHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 7 },
  equipmentName: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  warningBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  warningText: { color: colors.error, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.8 },
  measurementRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.surfaceHighest, marginTop: 8, paddingTop: 8 },
  measurementCopy: { flex: 1 },
  measurementLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  measurementIncrement: { color: colors.outline, fontFamily: fonts.data, fontSize: 9, marginTop: 3 },
  measurementValue: { color: colors.text, fontFamily: fonts.dataBold, fontSize: 12, textAlign: 'right' },
  emptyCard: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, borderRadius: layout.largeRadius },
  emptyInline: { color: colors.outline, fontFamily: fonts.regular, fontSize: 13 },
  historyCard: { minHeight: 170, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, borderRadius: layout.largeRadius, padding: 26 },
  historyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginTop: 14 },
  historyCopy: { maxWidth: 360, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  editButton: { minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: layout.radius, marginTop: 32 },
  editButtonText: { color: colors.onLime, fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1.2 },
  deleteButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorContainer, borderRadius: layout.radius, marginTop: 12 },
  deleteButtonText: { color: colors.error, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.2, marginTop: 16 },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, marginTop: 20, paddingHorizontal: 28 },
  secondaryButtonText: { color: colors.text, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
});
