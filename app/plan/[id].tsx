import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlanExerciseSummary } from '../../src/components/plans/PlanExerciseSummary';
import { activatePlan, deletePlan, getPlan } from '../../src/data/plans';
import { subscribeToSync, syncAll } from '../../src/sync/sync';
import { colors, fonts, layout } from '../../src/theme/tokens';
import type { Plan } from '../../src/types/plan';

export default function PlanDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getPlan(id).then((value) => { setPlan(value); setLoading(false); });
  }, [id]);

  useFocusEffect(useCallback(() => {
    refresh();
    return subscribeToSync(refresh);
  }, [refresh]));

  function confirmDelete() {
    if (!plan) return;
    Alert.alert('Delete plan?', `${plan.name} will be removed from your plans.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deletePlan(plan.id).then(() => {
        void syncAll().catch(() => undefined);
        router.replace('/(tabs)/plans');
      }) },
    ]);
  }

  if (loading) return <SafeAreaView style={styles.safeArea} />;
  if (!plan) return (
    <SafeAreaView style={styles.safeArea}><View style={styles.missing}>
      <Text style={styles.missingTitle}>PLAN NOT FOUND</Text>
      <Pressable onPress={() => router.back()} style={styles.secondaryButton}><Text style={styles.secondaryText}>GO BACK</Text></Pressable>
    </View></SafeAreaView>
  );

  const warmup = plan.checklist.filter((item) => item.kind === 'warmup');
  const cooldown = plan.checklist.filter((item) => item.kind === 'cooldown');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><Ionicons color={colors.text} name="arrow-back" size={24} /></Pressable>
        <Text style={styles.headerTitle}>PLAN REFERENCE</Text>
        <Pressable accessibilityLabel={`Edit ${plan.name}`} onPress={() => router.push({ pathname: '/plan/edit/[id]', params: { id } })} style={styles.iconButton}><Ionicons color={colors.lime} name="create-outline" size={23} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}>
          <Text style={[styles.status, plan.active && styles.activeStatus]}>{plan.active ? 'ACTIVE PLAN' : 'INACTIVE PLAN'}</Text>
          {plan.syncStatus === 'pending' ? <Text style={styles.pending}>● PENDING SYNC</Text> : null}
        </View>
        <Text style={styles.title}>{plan.name}</Text>
        <View style={styles.metricGrid}>
          <View style={styles.frequencyCard}><Text style={styles.metricLabel}>DAYS / CYCLE</Text><Text style={styles.frequency}>{plan.days.length}</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>SPLIT</Text><Text style={styles.metricText}>{plan.split.label}</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricLabel}>DEFAULT EFFORT</Text><Text style={styles.metricText}>{plan.effort === 'one_rir' ? '1 RIR' : 'Failure'}</Text></View>
        </View>
        {plan.deloadWeek !== null ? (
          <View style={styles.deloadCallout}>
            <Ionicons color={colors.lime} name="repeat" size={22} />
            <View style={styles.deloadCopy}><Text style={styles.metricLabel}>DELOAD SCHEDULE</Text><Text style={styles.deloadText}>Week {plan.deloadWeek} of every {plan.deloadWeek}-week cycle</Text></View>
          </View>
        ) : null}

        <View style={styles.sectionHeading}><Text style={styles.sectionLabel}>WEEKLY SCHEDULE</Text><Text style={styles.sectionCount}>{String(plan.days.length).padStart(2, '0')}</Text></View>
        {plan.days.map((day) => {
          const open = expanded === day.id;
          const exerciseCount = day.items.reduce((count, item) => count + item.exercises.length, 0);
          return (
            <View key={day.id} style={[styles.dayCard, open && styles.openDay]}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : day.id)} style={styles.dayHeading}>
                <Text style={styles.dayNumber}>{String(day.ordinal).padStart(2, '0')}</Text>
                <View style={styles.dayCopy}><Text style={styles.dayTitle}>DAY {day.ordinal}</Text><Text style={styles.dayMeta}>{exerciseCount} EXERCISES · {day.items.filter((item) => item.kind === 'superset').length} SUPERSETS</Text></View>
                <Ionicons color={colors.outline} name={open ? 'chevron-up' : 'chevron-down'} size={20} />
              </Pressable>
              {open ? <View style={styles.dayBody}>{day.items.length ? day.items.map((item) => <PlanExerciseSummary item={item} key={item.id} />) : <Text style={styles.emptyInline}>No exercises prescribed.</Text>}</View> : null}
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>SESSION CHECKLISTS</Text>
        <View style={styles.checklistGrid}>
          {([['WARMUP', warmup], ['COOLDOWN', cooldown]] as const).map(([label, items]) => (
            <View key={label} style={styles.checklistCard}><Text style={styles.checklistTitle}>{label}</Text>{items.length ? items.map((item) => (
              <View key={item.id} style={styles.checkRow}><Ionicons color={colors.lime} name="square-outline" size={17} /><Text style={styles.checkText}>{item.label}</Text></View>
            )) : <Text style={styles.emptyInline}>None added</Text>}</View>
          ))}
        </View>

        {!plan.active ? <Pressable onPress={() => void activatePlan(plan.id).then(() => { refresh(); void syncAll().catch(() => undefined); })} style={styles.primaryButton}><Text style={styles.primaryText}>ACTIVATE PLAN</Text></Pressable> : null}
        <Pressable onPress={() => router.push({ pathname: '/plan/edit/[id]', params: { id } })} style={styles.secondaryButton}><Text style={styles.secondaryText}>EDIT PLAN</Text></Pressable>
        <Pressable onPress={confirmDelete} style={styles.deleteButton}><Text style={styles.deleteText}>DELETE PLAN</Text></Pressable>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  status: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 5 },
  activeStatus: { color: colors.onLime, backgroundColor: colors.lime, borderColor: colors.lime },
  pending: { color: colors.outline, fontFamily: fonts.data, fontSize: 8 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 39, letterSpacing: -1.2, marginTop: 10, marginBottom: 18 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequencyCard: { width: '100%', minHeight: 124, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 18 },
  metricCard: { width: '48%', flexGrow: 1, minHeight: 88, justifyContent: 'space-between', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 14 },
  metricLabel: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.1 },
  frequency: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 72, lineHeight: 76 },
  metricText: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  deloadCallout: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, paddingHorizontal: 16, marginTop: 8 },
  deloadCopy: { flex: 1, gap: 5 },
  deloadText: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  sectionLabel: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginTop: 28, marginBottom: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionCount: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 18 },
  dayCard: { overflow: 'hidden', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, marginBottom: 10 },
  openDay: { borderColor: colors.lime },
  dayHeading: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14 },
  dayNumber: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 18 },
  dayCopy: { flex: 1 },
  dayTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 },
  dayMeta: { color: colors.outline, fontFamily: fonts.data, fontSize: 8, marginTop: 5 },
  dayBody: { borderTopWidth: 1, borderTopColor: colors.surfaceHighest, padding: 10 },
  emptyInline: { color: colors.outline, fontFamily: fonts.regular, fontSize: 12, paddingVertical: 10 },
  checklistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checklistCard: { width: '48%', flexGrow: 1, minWidth: 230, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 14 },
  checklistTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
  checkRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceHighest, marginTop: 7 },
  checkText: { flex: 1, color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  primaryButton: { minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: layout.radius, marginTop: 30 },
  primaryText: { color: colors.onLime, fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1.2 },
  secondaryButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, marginTop: 12, paddingHorizontal: 24 },
  secondaryText: { color: colors.text, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1 },
  deleteButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorContainer, borderRadius: layout.radius, marginTop: 12 },
  deleteText: { color: colors.error, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.2 },
});
