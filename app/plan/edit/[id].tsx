import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Sortable, SortableItem, type SortableRenderItemProps } from 'react-native-reanimated-dnd';

import { MoveButtons } from '../../../src/components/plans/MoveButtons';
import { PlanExerciseSummary } from '../../../src/components/plans/PlanExerciseSummary';
import { listExercises } from '../../../src/data/exercises';
import { createDefaultPlanDraft, getPlan, savePlan } from '../../../src/data/plans';
import { resizePlanDays, seedPlanExercise, setSupersetSets } from '../../../src/domain/planPrescriptions';
import { PLAN_SPLITS } from '../../../src/domain/planSplits';
import { validatePlan } from '../../../src/domain/planValidation';
import { syncAll } from '../../../src/sync/sync';
import { colors, fonts, layout } from '../../../src/theme/tokens';
import type { Exercise } from '../../../src/types/exercise';
import type {
  PlanChecklistKind,
  PlanDay,
  PlanDayItem,
  PlanDraft,
  PlanExercise,
} from '../../../src/types/plan';

function normalizeItems(items: PlanDayItem[]) {
  return items.map((item, position) => ({
    ...item,
    position,
    exercises: item.exercises.map((exercise, exercisePosition) => ({ ...exercise, position: exercisePosition })),
  }));
}

function moveEntry<T>(values: T[], index: number, offset: -1 | 1) {
  const next = [...values];
  const target = index + offset;
  if (target < 0 || target >= next.length) return values;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function dayItemHeight(item: PlanDayItem) {
  // Includes controls, summary, member move rows, borders, and the inter-item gap.
  return item.kind === 'standalone' ? 79 : 50 + item.exercises.length * 109;
}

type DaySortableProps = {
  day: PlanDay;
  selected: string[];
  onToggleSelected: (itemId: string) => void;
  onUnlink: (itemId: string) => void;
  onMoveItem: (index: number, offset: -1 | 1) => void;
  onPressExercise: (itemId: string, exercise: PlanExercise) => void;
  onMoveMember: (itemId: string, index: number, offset: -1 | 1) => void;
  onDropItems: (positions: Record<string, number>) => void;
};

function DaySortable({
  day,
  selected,
  onToggleSelected,
  onUnlink,
  onMoveItem,
  onPressExercise,
  onMoveMember,
  onDropItems,
}: DaySortableProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const height = day.items.reduce((total, item) => total + dayItemHeight(item), 0);
  const structureKey = day.items.map((item) => `${item.id}:${item.kind}:${item.exercises.length}`).join('|');

  const renderItem = useCallback((props: SortableRenderItemProps<PlanDayItem>) => {
    const { item, id, index, ...sortableProps } = props;
    const dragging = draggingId === id;
    return (
      <SortableItem
        {...sortableProps}
        data={item}
        id={id}
        key={id}
        onDragStart={() => setDraggingId(id)}
        onDrop={(_itemId, _position, positions) => {
          setDraggingId(null);
          if (positions) onDropItems(positions);
        }}
        style={[styles.itemBlock, dragging && styles.draggingItem]}
      >
        <View style={styles.itemRow}>
          {item.kind === 'standalone' ? (
            <Pressable
              accessibilityLabel={`Select ${item.exercises[0]?.name} for superset`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.includes(item.id) }}
              onPress={() => onToggleSelected(item.id)}
              style={styles.selectBox}
            >
              <Ionicons
                color={selected.includes(item.id) ? colors.lime : colors.outline}
                name={selected.includes(item.id) ? 'checkbox' : 'square-outline'}
                size={20}
              />
            </Pressable>
          ) : (
            <Pressable accessibilityLabel="Unlink superset" onPress={() => onUnlink(item.id)} style={styles.unlink}>
              <Ionicons color={colors.lime} name="unlink" size={17} />
            </Pressable>
          )}
          <PlanExerciseSummary
            item={item}
            onPressExercise={(exercise) => onPressExercise(item.id, exercise)}
            style={styles.editExerciseSummary}
          />
          <SortableItem.Handle style={[styles.dayDragHandle, dragging && styles.activeDayDragHandle]}>
            <View
              accessibilityActions={[
                { name: 'decrement', label: 'Move up' },
                { name: 'increment', label: 'Move down' },
              ]}
              accessibilityLabel={`Reorder ${item.exercises.map((value) => value.name).join(' superset ')}`}
              accessibilityRole="button"
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'decrement' && index > 0) onMoveItem(index, -1);
                if (event.nativeEvent.actionName === 'increment' && index < day.items.length - 1) onMoveItem(index, 1);
              }}
              style={styles.dragHandleContent}
            >
              <Ionicons color={dragging ? colors.onLime : colors.outline} name="reorder-three" size={23} />
            </View>
          </SortableItem.Handle>
        </View>
        {item.kind === 'superset' && item.exercises.length > 1 ? (
          <View style={styles.memberMoves}>
            {item.exercises.map((exercise, memberIndex) => (
              <View key={exercise.id} style={styles.memberMove}>
                <Text numberOfLines={1} style={styles.memberName}>{exercise.name}</Text>
                <MoveButtons
                  count={item.exercises.length}
                  index={memberIndex}
                  label={`${exercise.name} in superset`}
                  onMove={(offset) => onMoveMember(item.id, memberIndex, offset)}
                />
              </View>
            ))}
          </View>
        ) : null}
      </SortableItem>
    );
  }, [day.items.length, draggingId, onDropItems, onMoveItem, onMoveMember, onPressExercise, onToggleSelected, onUnlink, selected]);

  return (
    <Sortable
      contentContainerStyle={styles.daySortableContent}
      data={day.items}
      enableDynamicHeights
      estimatedItemHeight={79}
      itemHeight={dayItemHeight}
      key={structureKey}
      renderItem={renderItem}
      style={[styles.daySortable, { height }]}
      useFlatList={false}
    />
  );
}

function ChecklistEditor({
  draft,
  kind,
  open,
  onToggle,
  onChange,
}: {
  draft: PlanDraft;
  kind: PlanChecklistKind;
  open: boolean;
  onToggle: () => void;
  onChange: (draft: PlanDraft) => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const items = draft.checklist.filter((item) => item.kind === kind);
  const replace = (nextItems: typeof items) => onChange({
    ...draft,
    checklist: [
      ...draft.checklist.filter((item) => item.kind !== kind),
      ...nextItems.map((item, position) => ({ ...item, position })),
    ],
  });
  return (
    <View style={styles.checklistEditor}>
      <Pressable accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.collapseHeading}>
        <Text style={styles.collapseTitle}>{kind.toUpperCase()}</Text>
        <Text style={styles.collapseCount}>{String(items.length).padStart(2, '0')}</Text>
        <Ionicons color={colors.outline} name={open ? 'chevron-up' : 'chevron-down'} size={19} />
      </Pressable>
      {open ? <View style={styles.collapseBody}>
        {items.map((item, index) => (
          <View key={item.id} style={styles.checkEditRow}>
            <Ionicons color={colors.outline} name="reorder-three" size={20} />
            <TextInput
              accessibilityLabel={`${kind} item ${index + 1}`}
              onChangeText={(label) => replace(items.map((value) => value.id === item.id ? { ...value, label } : value))}
              style={styles.checkInput}
              value={item.label}
            />
            <MoveButtons count={items.length} index={index} label={item.label || kind} onMove={(offset) => replace(moveEntry(items, index, offset))} />
            <Pressable accessibilityLabel={`Remove ${item.label}`} onPress={() => replace(items.filter((value) => value.id !== item.id))} style={styles.smallIcon}><Ionicons color={colors.error} name="trash-outline" size={17} /></Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput onChangeText={setNewLabel} placeholder={`Add ${kind} step`} placeholderTextColor={colors.outline} style={[styles.input, styles.addInput]} value={newLabel} />
          <Pressable accessibilityLabel={`Add ${kind} step`} onPress={() => {
            if (!newLabel.trim()) return;
            replace([...items, { id: crypto.randomUUID(), kind, label: newLabel.trim(), position: items.length }]);
            setNewLabel('');
          }} style={styles.squareAdd}><Ionicons color={colors.onLime} name="add" size={23} /></Pressable>
        </View>
      </View> : null}
    </View>
  );
}

export default function PlanEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const editing = id !== 'new';
  const [draft, setDraft] = useState<PlanDraft>(() => createDefaultPlanDraft());
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [openChecklist, setOpenChecklist] = useState<PlanChecklistKind | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [editingExercise, setEditingExercise] = useState<{ dayId: string; itemId: string; exercise: PlanExercise } | null>(null);
  const [sets, setSets] = useState('');
  const [target, setTarget] = useState('');
  const [rest, setRest] = useState('');
  const [tempo, setTempo] = useState('');
  const [measurements, setMeasurements] = useState<Record<string, string>>({});
  const [showPrescriptionErrors, setShowPrescriptionErrors] = useState(false);

  useEffect(() => {
    if (!editing) return;
    let mounted = true;
    void getPlan(id).then((plan) => {
      if (!mounted) return;
      if (!plan) { Alert.alert('Plan not found'); router.back(); return; }
      const { id: _id, updatedAt: _updatedAt, deleted: _deleted, syncStatus: _syncStatus, ...planDraft } = plan;
      setDraft(planDraft);
      setExpandedDay(plan.days[0]?.id ?? null);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [editing, id, router]);

  useEffect(() => {
    if (!pickerDayId) return;
    let mounted = true;
    void listExercises(deferredSearch).then((items) => { if (mounted) setExercises(items); });
    return () => { mounted = false; };
  }, [deferredSearch, pickerDayId]);

  const errors = validatePlan(draft);

  function updateDay(dayId: string, update: (day: PlanDay) => PlanDay) {
    setDraft((current) => ({ ...current, days: current.days.map((day) => day.id === dayId ? update(day) : day) }));
  }

  function changeFrequency(count: number) {
    const removed = draft.days.slice(count).some((day) => day.items.length > 0);
    const apply = () => {
      setDraft((current) => ({ ...current, days: resizePlanDays(current.days, count) }));
      setExpandedDay((current) => draft.days.slice(0, count).some((day) => day.id === current) ? current : draft.days[0]?.id ?? null);
      setSelected([]);
    };
    if (count < draft.days.length && removed) {
      Alert.alert('Remove populated days?', `Exercises in Day ${count + 1} through Day ${draft.days.length} will be removed.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove days', style: 'destructive', onPress: apply },
      ]);
    } else apply();
  }

  function addExercise(dayId: string, exercise: Exercise) {
    const day = draft.days.find((value) => value.id === dayId);
    const duplicate = day?.items.some((item) => item.exercises.some((value) => value.sourceExerciseId === exercise.id));
    const apply = () => {
      updateDay(dayId, (value) => ({ ...value, items: normalizeItems([...value.items, {
        id: crypto.randomUUID(), kind: 'standalone', position: value.items.length, exercises: [seedPlanExercise(exercise)],
      }]) }));
      setPickerDayId(null);
      setSearch('');
    };
    if (duplicate) Alert.alert('Exercise already in this day', `${exercise.name} can be added again with an independent prescription.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Add duplicate', onPress: apply },
    ]); else apply();
  }

  function openPrescription(dayId: string, itemId: string, exercise: PlanExercise) {
    setEditingExercise({ dayId, itemId, exercise });
    setSets(String(exercise.sets));
    setTarget(String(exercise.target));
    setRest(String(exercise.restSeconds / 60));
    setTempo(exercise.tempo ?? '');
    setMeasurements(Object.fromEntries(exercise.equipment.flatMap((entry) => entry.measurements.map((measurement) => [measurement.id, measurement.target === null ? '' : String(measurement.target)]))));
    setShowPrescriptionErrors(false);
  }

  function savePrescription() {
    if (!editingExercise) return;
    setShowPrescriptionErrors(true);
    const parsedSets = Number(sets);
    const parsedTarget = Number(target);
    const parsedRest = Number(rest) * 60;
    const invalid = !Number.isInteger(parsedSets) || parsedSets <= 0 || !Number.isInteger(parsedTarget) || parsedTarget <= 0 || !Number.isInteger(parsedRest) || parsedRest < 0 ||
      !/^([0-9Xx]{4})?$/.test(tempo.trim()) || editingExercise.exercise.equipment.some((entry) => entry.measurements.some((measurement) => {
        const value = measurements[measurement.id] ?? '';
        return value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 || Math.abs(Number(value) / measurement.increment - Math.round(Number(value) / measurement.increment)) > 1e-8);
      }));
    if (invalid) { Alert.alert('Check highlighted fields', 'Use positive whole values and valid equipment increments.'); return; }
    const apply = () => {
      updateDay(editingExercise.dayId, (day) => ({ ...day, items: day.items.map((item) => {
        if (item.id !== editingExercise.itemId) return item;
        const updated = item.exercises.map((exercise) => exercise.id === editingExercise.exercise.id ? {
          ...exercise,
          sets: parsedSets,
          target: parsedTarget,
          restSeconds: parsedRest,
          tempo: tempo.trim() ? tempo.trim().toUpperCase() : null,
          equipment: exercise.equipment.map((entry) => ({ ...entry, measurements: entry.measurements.map((measurement) => ({
            ...measurement,
            target: (measurements[measurement.id] ?? '') === '' ? null : Number(measurements[measurement.id]),
          })) })),
        } : exercise);
        return item.kind === 'superset' ? { ...item, exercises: setSupersetSets(updated, parsedSets) } : { ...item, exercises: updated };
      }) }));
      setEditingExercise(null);
    };
    const item = draft.days.find((day) => day.id === editingExercise.dayId)?.items.find((value) => value.id === editingExercise.itemId);
    if (item?.kind === 'superset' && item.exercises.some((exercise) => exercise.sets !== parsedSets)) {
      Alert.alert('Update superset sets?', `All ${item.exercises.length} members must use ${parsedSets} sets.`, [
        { text: 'Cancel', style: 'cancel' }, { text: 'Update all', onPress: apply },
      ]);
    } else apply();
  }

  function removeExercise(dayId: string, itemId: string, exerciseId: string) {
    updateDay(dayId, (day) => {
      const next = day.items.flatMap((item): PlanDayItem[] => {
        if (item.id !== itemId) return [item];
        const remaining = item.exercises.filter((exercise) => exercise.id !== exerciseId);
        if (!remaining.length) return [];
        if (remaining.length === 1) return [{ ...item, kind: 'standalone', exercises: [{ ...remaining[0], position: 0 }] }];
        return [{ ...item, exercises: remaining }];
      });
      return { ...day, items: normalizeItems(next) };
    });
    setEditingExercise(null);
  }

  function linkSuperset(day: PlanDay) {
    const chosen = day.items.filter((item) => selected.includes(item.id) && item.kind === 'standalone');
    if (chosen.length < 2) { Alert.alert('Select standalone exercises', 'Choose two or more standalone rows in this day.'); return; }
    const firstIndex = Math.min(...chosen.map((item) => item.position));
    const exercisesToLink = chosen.flatMap((item) => item.exercises).map((exercise, position) => ({ ...exercise, position }));
    const setsToUse = exercisesToLink[0].sets;
    const apply = () => updateDay(day.id, (value) => {
      const remaining = value.items.filter((item) => !selected.includes(item.id));
      remaining.splice(firstIndex, 0, { id: crypto.randomUUID(), kind: 'superset', position: firstIndex, exercises: setSupersetSets(exercisesToLink, setsToUse) });
      return { ...value, items: normalizeItems(remaining) };
    });
    if (exercisesToLink.some((exercise) => exercise.sets !== setsToUse)) Alert.alert('Match superset sets?', `All selected exercises will use ${setsToUse} sets.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Link and update', onPress: apply },
    ]); else apply();
    setSelected([]);
  }

  function unlink(dayId: string, itemId: string) {
    updateDay(dayId, (day) => ({ ...day, items: normalizeItems(day.items.flatMap((item): PlanDayItem[] => item.id === itemId
      ? item.exercises.map((exercise) => ({ id: crypto.randomUUID(), kind: 'standalone', position: 0, exercises: [{ ...exercise, position: 0 }] }))
      : [item])) }));
  }

  async function persist() {
    setShowErrors(true);
    const validation = validatePlan(draft);
    if (Object.values(validation).some(Boolean)) { Alert.alert('Check highlighted fields', 'Correct invalid plan fields before saving.'); return; }
    setSaving(true);
    try {
      const plan = await savePlan(draft, editing ? id : undefined);
      void syncAll().catch(() => undefined);
      router.replace({ pathname: '/plan/[id]', params: { id: plan.id } });
    } catch (error) {
      Alert.alert('Could not save plan', error instanceof Error ? error.message : 'Your local changes were not saved.');
      setSaving(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.safeArea} />;

  const setsInvalid = !Number.isInteger(Number(sets)) || Number(sets) <= 0;
  const targetInvalid = !Number.isInteger(Number(target)) || Number(target) <= 0;
  const restInvalid = !Number.isInteger(Number(rest) * 60) || Number(rest) < 0;
  const tempoInvalid = !/^([0-9Xx]{4})?$/.test(tempo.trim());
  const measurementInvalid = (measurementId: string, increment: number) => {
    const value = measurements[measurementId] ?? '';
    return value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0 ||
      Math.abs(Number(value) / increment - Math.round(Number(value) / increment)) > 1e-8);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Close plan editor" onPress={() => router.back()} style={styles.iconButton}><Ionicons color={colors.text} name="close" size={26} /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>{editing ? 'EDIT PLAN' : 'NEW PLAN'}</Text><Text style={styles.headerTitle}>Plan builder</Text></View>
          <View style={styles.iconButton} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.nameHeading}><Text style={styles.label}>PLAN NAME</Text><View style={styles.toggleRow}><Text style={styles.toggleLabel}>ACTIVE</Text><Switch accessibilityLabel="Active plan" onValueChange={(active) => setDraft({ ...draft, active })} thumbColor={draft.active ? colors.lime : colors.outline} trackColor={{ false: colors.surfaceHighest, true: colors.outlineMuted }} value={draft.active} /></View></View>
          <TextInput accessibilityLabel="Plan name" autoFocus={!editing} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="e.g. Strength block" placeholderTextColor={colors.outline} style={[styles.input, showErrors && errors.name && styles.inputError]} value={draft.name} />

          <Text style={styles.sectionLabel}>TRAINING FREQUENCY</Text>
          <View style={styles.frequencyCard}>
            <View><Text style={styles.frequencyValue}>{draft.days.length}</Text><Text style={styles.frequencyUnit}>DAYS / CYCLE</Text></View>
            <View style={styles.frequencyControls}>{[1, 2, 3, 4, 5, 6, 7].map((count) => (
              <Pressable accessibilityLabel={`${count} training days`} accessibilityRole="radio" accessibilityState={{ selected: draft.days.length === count }} key={count} onPress={() => changeFrequency(count)} style={styles.frequencyChoice}>
                <View style={[styles.frequencyDot, count <= draft.days.length && styles.activeDot]} /><Text style={[styles.frequencyNumber, draft.days.length === count && styles.activeFrequencyNumber]}>{count}</Text>
              </Pressable>
            ))}</View>
          </View>

          <Text style={styles.sectionLabel}>TRAINING SPLIT</Text>
          <View style={[styles.splitGrid, showErrors && errors.split && styles.errorBox]}>{PLAN_SPLITS.map((split) => {
            const active = draft.split.key === split.key;
            return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} key={split.key} onPress={() => setDraft({ ...draft, split })} style={[styles.splitButton, active && styles.activeSplit]}><Text style={[styles.splitText, active && styles.activeSplitText]}>{split.label.toUpperCase()}</Text></Pressable>;
          })}</View>

          <Text style={styles.sectionLabel}>DEFAULT EFFORT</Text>
          <View style={styles.segmented}>{([['one_rir', '1 RIR'], ['failure', 'FAILURE']] as const).map(([value, label]) => (
            <Pressable accessibilityRole="radio" accessibilityState={{ selected: draft.effort === value }} key={value} onPress={() => setDraft({ ...draft, effort: value })} style={[styles.segment, draft.effort === value && styles.activeSegment]}><Text style={[styles.segmentText, draft.effort === value && styles.activeSegmentText]}>{label}</Text></Pressable>
          ))}</View>

          <View style={styles.deloadHeading}>
            <View style={styles.deloadCopy}>
              <Text style={styles.sectionLabel}>DELOAD SCHEDULE</Text>
              <Text style={styles.helper}>{draft.deloadWeek === null
                ? 'Optionally repeat a deload after a set number of plan cycles.'
                : `${draft.deloadWeek - 1} normal cycles, then a deload cycle. Repeats every ${draft.deloadWeek} cycles.`}</Text>
            </View>
            <Switch
              accessibilityLabel="Enable deload schedule"
              onValueChange={(enabled) => setDraft({ ...draft, deloadWeek: enabled ? 5 : null })}
              thumbColor={draft.deloadWeek !== null ? colors.lime : colors.outline}
              trackColor={{ false: colors.surfaceHighest, true: colors.outlineMuted }}
              value={draft.deloadWeek !== null}
            />
          </View>
          {draft.deloadWeek !== null ? (
            <View style={[styles.deloadCard, showErrors && errors.deloadWeek && styles.errorBox]}>
              <Pressable
                accessibilityLabel="Move deload one week earlier"
                disabled={draft.deloadWeek <= 2}
                onPress={() => setDraft({ ...draft, deloadWeek: Math.max(2, draft.deloadWeek! - 1) })}
                style={styles.deloadControl}
              >
                <Ionicons color={draft.deloadWeek <= 2 ? colors.surfaceHighest : colors.text} name="remove" size={24} />
              </Pressable>
              <View style={styles.deloadValueCopy}>
                <Text style={styles.deloadValue}>{String(draft.deloadWeek).padStart(2, '0')}</Text>
                <Text style={styles.deloadUnit}>DELOAD WEEK</Text>
              </View>
              <Pressable
                accessibilityLabel="Move deload one week later"
                disabled={draft.deloadWeek >= 52}
                onPress={() => setDraft({ ...draft, deloadWeek: Math.min(52, draft.deloadWeek! + 1) })}
                style={styles.deloadControl}
              >
                <Ionicons color={draft.deloadWeek >= 52 ? colors.surfaceHighest : colors.text} name="add" size={24} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.sectionHeading}><View><Text style={styles.sectionLabel}>WEEKLY SCHEDULE</Text><Text style={styles.helper}>Ordinal training days only. One day expands at a time.</Text></View><Text style={styles.sectionCount}>{String(draft.days.length).padStart(2, '0')}</Text></View>
          {draft.days.map((day) => {
            const open = day.id === expandedDay;
            const exerciseCount = day.items.reduce((count, item) => count + item.exercises.length, 0);
            return <View key={day.id} style={[styles.dayCard, open && styles.openDay, showErrors && (errors.items || errors.prescriptions || errors.measurements) && styles.errorDay]}>
              <Pressable accessibilityState={{ expanded: open }} onPress={() => { setExpandedDay(open ? null : day.id); setSelected([]); }} style={styles.dayHeading}>
                <Text style={styles.dayNumber}>{String(day.ordinal).padStart(2, '0')}</Text><View style={styles.dayCopy}><Text style={styles.dayTitle}>DAY {day.ordinal}</Text><Text style={styles.dayMeta}>{exerciseCount} EXERCISES · {day.items.filter((item) => item.kind === 'superset').length} SUPERSETS</Text></View><Ionicons color={colors.outline} name={open ? 'chevron-up' : 'chevron-down'} size={20} />
              </Pressable>
              {open ? <View style={styles.dayBody}>
                {day.items.length ? (
                  <DaySortable
                    day={day}
                    onDropItems={(positions) => updateDay(day.id, (value) => {
                      const byId = new Map(value.items.map((item) => [item.id, item]));
                      const reordered = Object.entries(positions)
                        .sort((left, right) => left[1] - right[1])
                        .flatMap(([itemId]) => {
                          const item = byId.get(itemId);
                          return item ? [item] : [];
                        });
                      return { ...value, items: normalizeItems(reordered) };
                    })}
                    onMoveItem={(itemIndex, offset) => updateDay(day.id, (value) => ({
                      ...value,
                      items: normalizeItems(moveEntry(value.items, itemIndex, offset)),
                    }))}
                    onMoveMember={(itemId, memberIndex, offset) => updateDay(day.id, (value) => ({
                      ...value,
                      items: value.items.map((entry) => entry.id === itemId
                        ? {
                          ...entry,
                          exercises: moveEntry(entry.exercises, memberIndex, offset)
                            .map((member, position) => ({ ...member, position })),
                        }
                        : entry),
                    }))}
                    onPressExercise={(itemId, exercise) => openPrescription(day.id, itemId, exercise)}
                    onToggleSelected={(itemId) => setSelected((current) => current.includes(itemId)
                      ? current.filter((value) => value !== itemId)
                      : [...current, itemId])}
                    onUnlink={(itemId) => unlink(day.id, itemId)}
                    selected={selected}
                  />
                ) : null}
                {!day.items.length ? <Text style={styles.emptyDay}>No exercises yet. Add a movement from your Library.</Text> : null}
                <View style={styles.dayActions}><Pressable accessibilityLabel={`Add exercise to Day ${day.ordinal}`} onPress={() => setPickerDayId(day.id)} style={styles.addExercise}><Ionicons color={colors.onLime} name="add" size={20} /><Text style={styles.addExerciseText}>ADD EXERCISE</Text></Pressable><Pressable disabled={selected.length < 2} onPress={() => linkSuperset(day)} style={[styles.linkButton, selected.length < 2 && styles.disabled]}><Ionicons color={colors.text} name="link" size={18} /><Text style={styles.linkText}>LINK SUPERSET</Text></Pressable></View>
              </View> : null}
            </View>;
          })}

          <Text style={styles.sectionLabel}>SESSION CHECKLISTS</Text>
          <ChecklistEditor draft={draft} kind="warmup" onChange={setDraft} onToggle={() => setOpenChecklist(openChecklist === 'warmup' ? null : 'warmup')} open={openChecklist === 'warmup'} />
          <ChecklistEditor draft={draft} kind="cooldown" onChange={setDraft} onToggle={() => setOpenChecklist(openChecklist === 'cooldown' ? null : 'cooldown')} open={openChecklist === 'cooldown'} />
          <Pressable disabled={saving} onPress={() => void persist()} style={[styles.saveButton, saving && styles.disabled]}><Text style={styles.saveText}>{saving ? 'SAVING...' : 'SAVE PLAN'}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal animationType="slide" onRequestClose={() => setPickerDayId(null)} presentationStyle="pageSheet" visible={Boolean(pickerDayId)}>
        <SafeAreaView style={styles.modalSafe}><View style={styles.modalHeader}><Pressable accessibilityLabel="Close exercise picker" onPress={() => setPickerDayId(null)} style={styles.iconButton}><Ionicons color={colors.text} name="close" size={25} /></Pressable><Text style={styles.modalTitle}>ADD EXERCISE</Text><View style={styles.iconButton} /></View><View style={styles.modalContent}><View style={styles.searchBox}><Ionicons color={colors.outline} name="search" size={21} /><TextInput autoFocus onChangeText={setSearch} placeholder="Search exercises..." placeholderTextColor={colors.outline} style={styles.searchInput} value={search} /></View><ScrollView keyboardShouldPersistTaps="handled">{exercises.map((exercise) => <Pressable accessibilityLabel={`Add ${exercise.name}`} key={exercise.id} onPress={() => pickerDayId && addExercise(pickerDayId, exercise)} style={styles.pickerRow}><View style={styles.pickerCopy}><Text style={styles.pickerName}>{exercise.name}</Text><Text style={styles.pickerMeta}>{exercise.defaultSets} SETS · {exercise.defaultTarget} {exercise.repMode === 'count' ? 'REPS' : 'SEC'} · {exercise.equipment.map((entry) => entry.equipmentName).join(', ') || 'NO EQUIPMENT'}</Text></View><Ionicons color={colors.lime} name="add-circle-outline" size={24} /></Pressable>)}{!exercises.length ? <Text style={styles.emptyDay}>No Library exercises match.</Text> : null}</ScrollView></View></SafeAreaView>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setEditingExercise(null)} presentationStyle="pageSheet" visible={Boolean(editingExercise)}>
        <SafeAreaView style={styles.modalSafe}><View style={styles.modalHeader}><Pressable accessibilityLabel="Close prescription editor" onPress={() => setEditingExercise(null)} style={styles.iconButton}><Ionicons color={colors.text} name="close" size={25} /></Pressable><Text numberOfLines={1} style={styles.modalTitle}>{editingExercise?.exercise.name.toUpperCase()}</Text><View style={styles.iconButton} /></View><ScrollView contentContainerStyle={styles.prescriptionContent} keyboardShouldPersistTaps="handled"><Text style={styles.helper}>Values here are an independent snapshot for this plan.</Text><View style={styles.fieldRow}><View style={styles.field}><Text style={styles.fieldLabel}>SETS</Text><TextInput inputMode="numeric" onChangeText={setSets} style={[styles.dataInput, showPrescriptionErrors && setsInvalid && styles.inputError]} value={sets} /></View><View style={styles.field}><Text style={styles.fieldLabel}>{editingExercise?.exercise.repMode === 'count' ? 'REPS' : 'SECONDS'}</Text><TextInput inputMode="numeric" onChangeText={setTarget} style={[styles.dataInput, showPrescriptionErrors && targetInvalid && styles.inputError]} value={target} /></View></View><View style={styles.fieldRow}><View style={styles.field}><Text style={styles.fieldLabel}>REST · MINUTES</Text><TextInput inputMode="decimal" onChangeText={setRest} style={[styles.dataInput, showPrescriptionErrors && restInvalid && styles.inputError]} value={rest} /></View><View style={styles.field}><Text style={styles.fieldLabel}>TEMPO · OPTIONAL</Text><TextInput autoCapitalize="characters" maxLength={4} onChangeText={setTempo} placeholder="30X1" placeholderTextColor={colors.outline} style={[styles.dataInput, showPrescriptionErrors && tempoInvalid && styles.inputError]} value={tempo} /></View></View><Text style={styles.sectionLabel}>EQUIPMENT TARGETS</Text>{editingExercise?.exercise.equipment.map((entry) => <View key={entry.id} style={styles.equipmentCard}><Text style={styles.equipmentTitle}>{entry.name}</Text>{entry.measurements.map((measurement) => <View key={measurement.id} style={styles.measurementRow}><View style={styles.measurementCopy}><Text style={styles.measurementLabel}>{measurement.label}{measurement.unit ? ` · ${measurement.unit}` : ''}</Text><Text style={styles.measurementStep}>STEP {measurement.increment}</Text></View><TextInput accessibilityLabel={`${entry.name} ${measurement.label} target`} inputMode="decimal" onChangeText={(value) => setMeasurements((current) => ({ ...current, [measurement.id]: value }))} placeholder="No target" placeholderTextColor={colors.outline} style={[styles.measurementInput, showPrescriptionErrors && measurementInvalid(measurement.id, measurement.increment) && styles.inputError]} value={measurements[measurement.id] ?? ''} /></View>)}</View>)}{!editingExercise?.exercise.equipment.length ? <Text style={styles.emptyDay}>No equipment targets.</Text> : null}<Text style={styles.sectionLabel}>PLAN EFFORT</Text><View style={styles.readOnlyEffort}><Text style={styles.readOnlyLabel}>DEFAULT FOR ALL EXERCISES</Text><Text style={styles.readOnlyValue}>{draft.effort === 'one_rir' ? '1 RIR' : 'FAILURE'}</Text></View><Pressable onPress={savePrescription} style={styles.saveButton}><Text style={styles.saveText}>UPDATE PRESCRIPTION</Text></Pressable><Pressable onPress={() => editingExercise && removeExercise(editingExercise.dayId, editingExercise.itemId, editingExercise.exercise.id)} style={styles.removeButton}><Text style={styles.removeText}>REMOVE EXERCISE</Text></Pressable></ScrollView></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.background }, modalSafe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.outlineMuted, paddingHorizontal: 12 }, iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1, alignItems: 'center' }, eyebrow: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.4 }, headerTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 20, marginTop: 3 },
  content: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.mobileMargin, paddingTop: 24, paddingBottom: 48 }, label: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginBottom: 8 }, sectionLabel: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, marginTop: 28, marginBottom: 9 }, helper: { color: colors.outline, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  nameHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -8 }, toggleLabel: { color: colors.lime, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 }, input: { minHeight: 56, color: colors.text, fontFamily: fonts.medium, fontSize: 15, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, paddingHorizontal: 14 }, inputError: { borderColor: colors.error }, errorBox: { borderWidth: 1, borderColor: colors.error }, errorText: { color: colors.error, fontFamily: fonts.regular, fontSize: 11, marginTop: 6 },
  frequencyCard: { backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 18 }, frequencyValue: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 68, lineHeight: 72 }, frequencyUnit: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1 }, frequencyControls: { flexDirection: 'row', marginTop: 18 }, frequencyChoice: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' }, frequencyDot: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.surfaceHighest, borderWidth: 2, borderColor: colors.outlineMuted }, activeDot: { backgroundColor: colors.lime, borderColor: colors.lime }, frequencyNumber: { color: colors.outline, fontFamily: fonts.data, fontSize: 10, marginTop: 8 }, activeFrequencyNumber: { color: colors.lime },
  splitGrid: { flexDirection: 'row', flexWrap: 'wrap', borderLeftWidth: 1, borderTopWidth: 1, borderColor: colors.outlineMuted }, splitButton: { width: '50%', minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.outlineMuted, padding: 6 }, activeSplit: { backgroundColor: colors.lime }, splitText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.5, textAlign: 'center' }, activeSplitText: { color: colors.onLime },
  smallIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, addRow: { flexDirection: 'row', gap: 8, marginTop: 9 }, addInput: { flex: 1 }, squareAdd: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: layout.radius },
  segmented: { minHeight: 56, flexDirection: 'row', backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, padding: 3 }, segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: layout.radius }, activeSegment: { backgroundColor: colors.lime }, segmentText: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8 }, activeSegmentText: { color: colors.onLime },
  deloadHeading: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 }, deloadCopy: { flex: 1 }, deloadCard: { minHeight: 96, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, marginTop: 12 }, deloadControl: { width: 64, minHeight: 94, alignItems: 'center', justifyContent: 'center' }, deloadValueCopy: { flex: 1, alignItems: 'center' }, deloadValue: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 38, lineHeight: 42 }, deloadUnit: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }, sectionCount: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 20 }, dayCard: { overflow: 'hidden', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, marginBottom: 10 }, openDay: { borderColor: colors.lime }, errorDay: { borderColor: colors.errorContainer }, dayHeading: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14 }, dayNumber: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 18 }, dayCopy: { flex: 1 }, dayTitle: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 16 }, dayMeta: { color: colors.outline, fontFamily: fonts.data, fontSize: 8, marginTop: 5 }, dayBody: { borderTopWidth: 1, borderTopColor: colors.surfaceHighest, padding: 10 }, emptyDay: { color: colors.outline, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'center', padding: 24 },
  daySortable: { backgroundColor: colors.surfaceLow }, daySortableContent: { padding: 0, backgroundColor: colors.surfaceLow }, itemBlock: { marginBottom: 10, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: 'transparent', borderRadius: layout.radius }, draggingItem: { backgroundColor: colors.surface, borderColor: colors.lime }, itemRow: { flexDirection: 'row', alignItems: 'center' }, selectBox: { width: 40, minHeight: 67, alignItems: 'center', justifyContent: 'center' }, unlink: { width: 40, minHeight: 67, alignItems: 'center', justifyContent: 'center' }, editExerciseSummary: { flex: 1, marginTop: 0 }, dayDragHandle: { width: 42, minHeight: 67, alignItems: 'center', justifyContent: 'center', borderRadius: layout.radius }, dragHandleContent: { width: 42, minHeight: 67, alignItems: 'center', justifyContent: 'center' }, activeDayDragHandle: { backgroundColor: colors.lime }, memberMoves: { borderWidth: 1, borderTopWidth: 0, borderColor: colors.surfaceHighest, paddingHorizontal: 8 }, memberMove: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceHighest }, memberName: { flex: 1, color: colors.outline, fontFamily: fonts.medium, fontSize: 10 }, dayActions: { flexDirection: 'row', gap: 8, marginTop: 10 }, addExercise: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.lime, borderRadius: layout.radius }, addExerciseText: { color: colors.onLime, fontFamily: fonts.extraBold, fontSize: 9, letterSpacing: 0.8 }, linkButton: { minHeight: 52, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius }, linkText: { color: colors.text, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.7 }, disabled: { opacity: 0.4 },
  checklistEditor: { backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, marginBottom: 10 }, collapseHeading: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, collapseTitle: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 }, collapseCount: { color: colors.lime, fontFamily: fonts.data, fontSize: 11, marginRight: 12 }, collapseBody: { borderTopWidth: 1, borderTopColor: colors.surfaceHighest, padding: 10 }, checkEditRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceHighest }, checkInput: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 13, paddingHorizontal: 7, paddingVertical: 12 },
  saveButton: { minHeight: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: layout.radius, marginTop: 30 }, saveText: { color: colors.onLime, fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 1.2 },
  modalHeader: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.outlineMuted, paddingHorizontal: 8 }, modalTitle: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.1, textAlign: 'center' }, modalContent: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.mobileMargin }, searchBox: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, paddingHorizontal: 14, marginBottom: 12 }, searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15 }, pickerRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.surfaceHighest, paddingVertical: 9 }, pickerCopy: { flex: 1 }, pickerName: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 }, pickerMeta: { color: colors.textMuted, fontFamily: fonts.data, fontSize: 9, marginTop: 6 },
  prescriptionContent: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', padding: layout.mobileMargin, paddingBottom: 44 }, fieldRow: { flexDirection: 'row', gap: 10, marginTop: 20 }, field: { flex: 1 }, fieldLabel: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1, marginBottom: 7 }, dataInput: { minHeight: 56, color: colors.text, fontFamily: fonts.dataBold, fontSize: 18, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, paddingHorizontal: 13 }, equipmentCard: { backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.largeRadius, padding: 14, marginBottom: 9 }, equipmentTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, marginBottom: 7 }, measurementRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceHighest }, measurementCopy: { flex: 1 }, measurementLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12 }, measurementStep: { color: colors.outline, fontFamily: fonts.data, fontSize: 8, marginTop: 3 }, measurementInput: { width: 112, minHeight: 45, color: colors.text, fontFamily: fonts.data, textAlign: 'right', backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.outlineMuted, borderRadius: layout.radius, paddingHorizontal: 10 }, readOnlyEffort: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.radius, paddingHorizontal: 14 }, readOnlyLabel: { color: colors.outline, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8 }, readOnlyValue: { color: colors.lime, fontFamily: fonts.dataBold, fontSize: 15 }, removeButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorContainer, borderRadius: layout.radius, marginTop: 10 }, removeText: { color: colors.error, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 1 },
});
