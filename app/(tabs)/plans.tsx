import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Sortable, SortableItem, type SortableRenderItemProps } from 'react-native-reanimated-dnd';

import { MoveButtons } from '../../src/components/plans/MoveButtons';
import { listPlanAggregates, reorderInactivePlans } from '../../src/data/plans';
import { subscribeToSync, syncAll } from '../../src/sync/sync';
import { colors, fonts, layout } from '../../src/theme/tokens';
import type { Plan } from '../../src/types/plan';

export default function PlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);

  const refresh = useCallback(() => {
    void listPlanAggregates().then(setPlans).catch(() => {
      Alert.alert('Could not load plans', 'Your local plans are unavailable.');
    });
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
    const unsubscribe = subscribeToSync(refresh);
    void syncAll().catch(() => undefined);
    return unsubscribe;
  }, [refresh]));

  const activePlan = plans.find((plan) => plan.active);
  const inactivePlans = plans.filter((plan) => !plan.active);

  const persistOrder = useCallback((ids: string[]) => {
    setPlans((current) => {
      const active = current.find((plan) => plan.active);
      const byId = new Map(current.filter((plan) => !plan.active).map((plan) => [plan.id, plan]));
      return [...(active ? [active] : []), ...ids.flatMap((id) => {
        const plan = byId.get(id);
        return plan ? [plan] : [];
      })];
    });
    void reorderInactivePlans(ids).then(() => void syncAll().catch(() => undefined)).catch(refresh);
  }, [refresh]);

  const move = useCallback((id: string, offset: -1 | 1) => {
    const inactivePlans = plans.filter((plan) => !plan.active);
    const index = inactivePlans.findIndex((plan) => plan.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= inactivePlans.length) return;
    const ids = inactivePlans.map((plan) => plan.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    persistOrder(ids);
  }, [persistOrder, plans]);

  const openPlan = useCallback((id: string) => {
    router.push({ pathname: '/plan/[id]', params: { id } });
  }, [router]);

  const renderInactivePlan = useCallback((props: SortableRenderItemProps<Plan>) => {
    const { item, id, index, ...sortableProps } = props;
    return (
      <SortableItem
        {...sortableProps}
        data={item}
        id={id}
        key={id}
        onDrop={(_itemId, _position, positions) => {
          if (!positions) return;
          persistOrder(Object.entries(positions).sort((a, b) => a[1] - b[1]).map(([planId]) => planId));
        }}
      >
        <Pressable
          accessibilityLabel={`Open ${item.name}`}
          onPress={() => openPlan(item.id)}
          style={styles.card}
        >
          <View style={styles.cardTop}>
            <View style={styles.cardCopy}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.planName}>{item.name}</Text>
                {item.syncStatus === 'pending' ? <View accessibilityLabel="Pending sync" style={styles.pendingDot} /> : null}
              </View>
              <Text numberOfLines={1} style={styles.planMeta}>
                {item.days.length} DAYS · {item.split.label.toUpperCase()} · {item.effort === 'one_rir' ? '1 RIR' : 'FAILURE'}
              </Text>
            </View>
            <SortableItem.Handle style={styles.dragHandle}>
              <Ionicons color={colors.outline} name="reorder-three" size={25} />
            </SortableItem.Handle>
          </View>
          <View style={styles.cardActions}>
            <Pressable accessibilityLabel={`View details for ${item.name}`} onPress={() => openPlan(item.id)} style={styles.actionButton}>
              <Ionicons color={colors.lime} name="document-text-outline" size={17} /><Text style={styles.actionText}>DETAILS</Text>
            </Pressable>
            <View style={styles.actionSpacer} />
            <MoveButtons count={inactivePlans.length} index={index} label={item.name} onMove={(offset) => move(item.id, offset)} />
            <Pressable accessibilityLabel={`Edit ${item.name}`} onPress={() => router.push({ pathname: '/plan/edit/[id]', params: { id: item.id } })} style={styles.editIcon}>
              <Ionicons color={colors.textMuted} name="create-outline" size={18} />
            </Pressable>
          </View>
        </Pressable>
      </SortableItem>
    );
  }, [inactivePlans.length, move, openPlan, persistOrder, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.brandBar}>
          <View style={styles.brand}><Ionicons color={colors.text} name="barbell" size={23} /><Text style={styles.brandText}>GYMRAT</Text></View>
          <Ionicons color={colors.textMuted} name="cloud-done-outline" size={22} />
        </View>
        <View style={styles.heading}>
          <View><Text style={styles.eyebrow}>TRAINING SYSTEM</Text><Text style={styles.title}>Plans</Text></View>
          <Text style={styles.count}>{String(plans.length).padStart(2, '0')} PLANS</Text>
        </View>
        <Text style={styles.helper}>Keep one plan active and organize the rest.</Text>
        {plans.length ? (
          <View style={styles.plansContent}>
            <Text style={styles.sectionLabel}>ACTIVE PLAN</Text>
            {activePlan ? (
              <Pressable accessibilityLabel={`Open ${activePlan.name}`} onPress={() => openPlan(activePlan.id)} style={[styles.card, styles.activeCard]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardCopy}>
                    <View style={styles.nameRow}>
                      <Text numberOfLines={1} style={styles.planName}>{activePlan.name}</Text>
                      <Text style={styles.activeBadge}>ACTIVE</Text>
                      {activePlan.syncStatus === 'pending' ? <View accessibilityLabel="Pending sync" style={styles.pendingDot} /> : null}
                    </View>
                    <Text numberOfLines={1} style={styles.planMeta}>
                      {activePlan.days.length} DAYS · {activePlan.split.label.toUpperCase()} · {activePlan.effort === 'one_rir' ? '1 RIR' : 'FAILURE'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <Pressable accessibilityLabel={`View details for ${activePlan.name}`} onPress={() => openPlan(activePlan.id)} style={styles.actionButton}>
                    <Ionicons color={colors.lime} name="document-text-outline" size={17} /><Text style={styles.actionText}>DETAILS</Text>
                  </Pressable>
                  <View style={styles.actionSpacer} />
                  <Pressable accessibilityLabel={`Edit ${activePlan.name}`} onPress={() => router.push({ pathname: '/plan/edit/[id]', params: { id: activePlan.id } })} style={styles.editIcon}>
                    <Ionicons color={colors.textMuted} name="create-outline" size={18} />
                  </Pressable>
                </View>
              </Pressable>
            ) : (
              <View style={styles.statusCallout}>
                <Ionicons color={colors.outline} name="flash-outline" size={20} />
                <View style={styles.calloutCopy}><Text style={styles.calloutTitle}>NO ACTIVE PLAN</Text><Text style={styles.calloutText}>Activate a plan below when you are ready to train.</Text></View>
              </View>
            )}
            <Text style={styles.sectionLabel}>OTHER PLANS</Text>
            {inactivePlans.length ? (
              <Sortable
                contentContainerStyle={styles.listContent}
                data={inactivePlans}
                itemHeight={184}
                renderItem={renderInactivePlan}
                style={styles.list}
              />
            ) : (
              <View style={styles.noOtherPlans}><Text style={styles.calloutTitle}>NO OTHER PLANS</Text><Text style={styles.calloutText}>Add another plan whenever you want an alternative.</Text></View>
            )}
          </View>
        ) : (
          <Pressable onPress={() => router.push({ pathname: '/plan/edit/[id]', params: { id: 'new' } })} style={styles.empty}>
            <Ionicons color={colors.lime} name="clipboard-outline" size={38} />
            <Text style={styles.emptyTitle}>BUILD YOUR FIRST PLAN</Text>
            <Text style={styles.emptyCopy}>Set your split, training days, and exercise prescriptions.</Text>
          </Pressable>
        )}
        <Pressable accessibilityLabel="Add plan" onPress={() => router.push({ pathname: '/plan/edit/[id]', params: { id: 'new' } })} style={styles.fab}>
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
  heading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 24 },
  eyebrow: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 32, letterSpacing: -1.2, marginTop: 3 },
  count: { color: colors.outline, fontFamily: fonts.data, fontSize: 10 },
  helper: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 7, marginBottom: 14 },
  plansContent: { flex: 1, backgroundColor: colors.background },
  sectionLabel: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.2, marginBottom: 9 },
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { flexGrow: 1, backgroundColor: colors.background },
  card: { height: 172, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, marginBottom: 12, padding: 14 },
  activeCard: { borderColor: colors.lime },
  cardTop: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardCopy: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { flexShrink: 1, color: colors.text, fontFamily: fonts.extraBold, fontSize: 19, letterSpacing: -0.4 },
  activeBadge: { color: colors.onLime, backgroundColor: colors.lime, fontFamily: fonts.bold, fontSize: 8, letterSpacing: 0.8, borderRadius: 2, paddingHorizontal: 7, paddingVertical: 4 },
  pendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.limeDim },
  planMeta: { color: colors.textMuted, fontFamily: fonts.data, fontSize: 9, marginTop: 9 },
  dragHandle: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  cardActions: { height: 42, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.surfaceHighest, paddingTop: 5 },
  actionSpacer: { flex: 1 },
  actionButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8 },
  actionText: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8 },
  editIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  statusCallout: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.largeRadius, padding: 16, marginBottom: 18 },
  noOtherPlans: { minHeight: 110, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, borderRadius: layout.largeRadius, padding: 20 },
  calloutCopy: { flex: 1 },
  calloutTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1.1 },
  calloutText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, marginTop: 5 },
  empty: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outlineMuted, borderRadius: layout.largeRadius, marginBottom: 24, padding: 30 },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, marginTop: 18 },
  emptyCopy: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  fab: { position: 'absolute', right: 4, bottom: 18, width: 58, height: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: 14 },
});
