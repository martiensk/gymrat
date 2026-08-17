import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { listEquipment } from '../../src/data/equipment';
import { listExercises } from '../../src/data/exercises';
import { muscleLabel } from '../../src/domain/muscles';
import { subscribeToSync, syncAll } from '../../src/sync/sync';
import { colors, fonts, layout } from '../../src/theme/tokens';
import type { Equipment } from '../../src/types/equipment';
import type { Exercise } from '../../src/types/exercise';

type LibraryTab = 'exercises' | 'equipment';

function measurementSummary(equipment: Equipment) {
  return equipment.measurements
    .map((measurement) => {
      const amount = measurement.unit
        ? `${measurement.increment} ${measurement.unit}`
        : String(measurement.increment);
      const base = `${measurement.label} · ${amount}`;
      return measurement.defaultValue === null
        ? base
        : `${base} · default ${measurement.defaultValue}`;
    })
    .join('   /   ');
}

export default function LibraryScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<LibraryTab>('exercises');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const deferredExerciseSearch = useDeferredValue(exerciseSearch);
  const deferredEquipmentSearch = useDeferredValue(equipmentSearch);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        void Promise.all([
          listExercises(deferredExerciseSearch),
          listEquipment(deferredEquipmentSearch),
        ]).then(([exerciseItems, equipmentItems]) => {
          if (!active) return;
          setExercises(exerciseItems);
          setEquipment(equipmentItems);
        });
      };
      refresh();
      const unsubscribe = subscribeToSync(refresh);
      void syncAll().catch(() => undefined);
      return () => {
        active = false;
        unsubscribe();
      };
    }, [deferredEquipmentSearch, deferredExerciseSearch]),
  );

  function openEquipment(id: string) {
    router.push({ pathname: '/equipment/[id]', params: { id } });
  }

  function openExercise(id: string) {
    if (id === 'new') {
      router.push({ pathname: '/exercise/edit/[id]', params: { id } });
      return;
    }
    router.push({ pathname: '/exercise/[id]', params: { id } });
  }

  const showingExercises = tab === 'exercises';
  const search = showingExercises ? exerciseSearch : equipmentSearch;
  const setSearch = showingExercises ? setExerciseSearch : setEquipmentSearch;
  const items = showingExercises ? exercises : equipment;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.brandBar}>
          <View style={styles.brand}>
            <Ionicons color={colors.text} name="barbell" size={23} />
            <Text style={styles.brandText}>GYMRAT</Text>
          </View>
          <View style={styles.brandActions}>
            <Ionicons color={colors.textMuted} name="cloud-done-outline" size={22} />
            <Ionicons color={colors.text} name="person-circle-outline" size={26} />
          </View>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['exercises', 'equipment'] as const).map((item) => {
            const active = item === tab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                key={item}
                onPress={() => setTab(item)}
                style={[styles.tab, active && styles.activeTab]}
              >
                <Text style={[styles.tabText, active && styles.activeTabText]}>
                  {item.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchBox}>
          <Ionicons color={colors.textMuted} name="search" size={22} />
          <TextInput
            accessibilityLabel={`Search ${tab}`}
            onChangeText={setSearch}
            placeholder={`Search ${tab}...`}
            placeholderTextColor={colors.outline}
            style={styles.searchInput}
            value={search}
          />
          {search ? (
            <Pressable accessibilityLabel="Clear search" onPress={() => setSearch('')}>
              <Ionicons color={colors.textMuted} name="close-circle" size={20} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.listHeading}>
          <Text style={styles.sectionTitle}>
            {showingExercises ? 'YOUR EXERCISES' : 'YOUR EQUIPMENT'}
          </Text>
          <Text style={styles.count}>{items.length} ITEMS</Text>
        </View>

        {showingExercises ? (
          <FlatList
            contentContainerStyle={exercises.length === 0 && styles.emptyList}
            data={exercises}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Pressable onPress={() => openExercise('new')} style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons color={colors.lime} name="add" size={30} />
                </View>
                <Text style={styles.emptyTitle}>
                  {exerciseSearch ? 'NO MATCHES' : 'BUILD YOUR EXERCISE LIBRARY'}
                </Text>
                <Text style={styles.emptyCopy}>
                  {exerciseSearch
                    ? 'Try a different exercise, muscle, or equipment name.'
                    : 'Add the movements you train and their default prescriptions.'}
                </Text>
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel={`Open ${item.name}`}
                onPress={() => openExercise(item.id)}
                style={styles.row}
              >
                {item.thumbnailDataUri ? (
                  <Image source={{ uri: item.thumbnailDataUri }} style={styles.thumbnail} />
                ) : (
                  <View style={styles.thumbnailPlaceholder}>
                    <Ionicons color={colors.outline} name="body-outline" size={25} />
                  </View>
                )}
                <View style={styles.rowContent}>
                  <Text numberOfLines={1} style={styles.equipmentName}>{item.name}</Text>
                  <Text numberOfLines={1} style={styles.exerciseMeta}>
                    {[item.primaryMuscle, ...item.secondaryMuscles].map(muscleLabel).join(' · ')}
                  </Text>
                  <Text numberOfLines={1} style={styles.measurements}>
                    {item.defaultSets} SETS · {item.defaultTarget} {item.repMode === 'count' ? 'REPS' : 'SEC'} · {item.equipment.length ? item.equipment.map((entry) => entry.equipmentName).join(', ') : 'NO EQUIPMENT'}
                  </Text>
                </View>
                {item.syncStatus === 'pending' ? <View style={styles.pendingDot} /> : null}
                <Ionicons color={colors.outline} name="chevron-forward" size={20} />
              </Pressable>
            )}
          />
        ) : (
            <FlatList
              contentContainerStyle={equipment.length === 0 && styles.emptyList}
              data={equipment}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Pressable onPress={() => openEquipment('new')} style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons color={colors.lime} name="add" size={30} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {equipmentSearch ? 'NO MATCHES' : 'BUILD YOUR EQUIPMENT LIST'}
                  </Text>
                  <Text style={styles.emptyCopy}>
                    {equipmentSearch
                      ? 'Try a different name, measurement, or unit.'
                      : 'Add dumbbells, rings, machines, or anything else you train with.'}
                  </Text>
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable onPress={() => openEquipment(item.id)} style={styles.row}>
                  {item.thumbnailDataUri ? (
                    <Image source={{ uri: item.thumbnailDataUri }} style={styles.thumbnail} />
                  ) : (
                    <View style={styles.thumbnailPlaceholder}>
                      <Ionicons color={colors.outline} name="barbell-outline" size={25} />
                    </View>
                  )}
                  <View style={styles.rowContent}>
                    <Text numberOfLines={1} style={styles.equipmentName}>{item.name}</Text>
                    <Text numberOfLines={2} style={styles.measurements}>
                      {measurementSummary(item)}
                    </Text>
                  </View>
                  {item.syncStatus === 'pending' ? <View style={styles.pendingDot} /> : null}
                  <Ionicons color={colors.outline} name="chevron-forward" size={20} />
                </Pressable>
              )}
            />
        )}
        <Pressable
          accessibilityLabel={showingExercises ? 'Add exercise' : 'Add equipment'}
          onPress={() => showingExercises ? openExercise('new') : openEquipment('new')}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <Ionicons color={colors.onLime} name="add" size={30} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: layout.mobileMargin },
  brandBar: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.outlineMuted },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandText: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 22, letterSpacing: -0.6 },
  brandActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tabs: { height: 72, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.outlineMuted },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.lime },
  tabText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2 },
  activeTabText: { color: colors.text },
  searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, marginTop: 24, paddingHorizontal: 16 },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 16, paddingVertical: 14 },
  listHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 28, marginBottom: 8 },
  sectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2 },
  count: { color: colors.outline, fontFamily: fonts.data, fontSize: 11 },
  row: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: colors.surfaceHighest, paddingVertical: 9 },
  thumbnail: { width: 64, height: 64, borderRadius: layout.radius, backgroundColor: colors.surfaceHigh },
  thumbnailPlaceholder: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: layout.radius, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest },
  rowContent: { flex: 1, justifyContent: 'center' },
  equipmentName: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.2 },
  measurements: { color: colors.textMuted, fontFamily: fonts.data, fontSize: 11, lineHeight: 17, marginTop: 5, textTransform: 'uppercase' },
  exerciseMeta: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, marginTop: 3 },
  pendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.limeDim },
  emptyList: { flexGrow: 1 },
  emptyState: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, borderRadius: layout.largeRadius, marginTop: 16, paddingHorizontal: 34 },
  emptyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderRadius: 18, marginBottom: 20 },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.4, textAlign: 'center', marginTop: 16 },
  emptyCopy: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9 },
  fab: { position: 'absolute', right: 4, bottom: 18, width: 58, height: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: 14 },
  pressed: { opacity: 0.72 },
});
