import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { getSupersetRestSeconds } from '../../domain/planPrescriptions';
import { colors, fonts, layout } from '../../theme/tokens';
import type { PlanDayItem, PlanExercise } from '../../types/plan';

export function formatPlanRest(seconds: number) {
  if (!seconds) return '0 MIN';
  return seconds % 60 === 0
    ? `${seconds / 60} MIN`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} MIN`;
}

function ExerciseLine({ exercise }: { exercise: PlanExercise }) {
  return (
    <View style={styles.exerciseLine}>
      <View style={styles.exerciseCopy}>
        <Text numberOfLines={1} style={styles.name}>{exercise.name}</Text>
        <Text numberOfLines={1} style={styles.meta}>
          {exercise.sets} SETS · {exercise.target} {exercise.repMode === 'count' ? 'REPS' : 'SEC'} · {formatPlanRest(exercise.restSeconds)}
          {exercise.tempo ? ` · ${exercise.tempo}` : ''}
        </Text>
        {exercise.equipment.length ? (
          <Text numberOfLines={1} style={styles.equipment}>
            {exercise.equipment.map((entry) => entry.name).join(' · ')}
          </Text>
        ) : null}
      </View>
      <Ionicons color={colors.outline} name="chevron-forward" size={16} />
    </View>
  );
}

type Props = {
  item: PlanDayItem;
  onPressExercise?: (exercise: PlanExercise) => void;
  style?: StyleProp<ViewStyle>;
};

export function PlanExerciseSummary({ item, onPressExercise, style }: Props) {
  const superset = item.kind === 'superset';
  return (
    <View style={[styles.card, superset && styles.supersetCard, style]}>
      {superset ? (
        <View style={styles.supersetHeading}>
          <View style={styles.linkBadge}><Ionicons color={colors.onLime} name="link" size={14} /></View>
          <Text style={styles.supersetLabel}>SUPERSET · {item.exercises.length} MOVES</Text>
          <Text style={styles.sharedRest}>REST {formatPlanRest(getSupersetRestSeconds(item.exercises))}</Text>
        </View>
      ) : null}
      {item.exercises.map((exercise) => (
        <Pressable
          accessibilityLabel={`Open ${exercise.name} prescription`}
          disabled={!onPressExercise}
          key={exercise.id}
          onPress={() => onPressExercise?.(exercise)}
        >
          <ExerciseLine exercise={exercise} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.surfaceHighest, borderRadius: layout.radius, marginTop: 8 },
  supersetCard: { borderLeftWidth: 3, borderLeftColor: colors.lime },
  supersetHeading: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceHighest, paddingHorizontal: 10 },
  linkBadge: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime, borderRadius: 12 },
  supersetLabel: { flex: 1, color: colors.text, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.9 },
  sharedRest: { color: colors.lime, fontFamily: fonts.data, fontSize: 8 },
  exerciseLine: { minHeight: 67, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.surfaceHighest },
  exerciseCopy: { flex: 1 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  meta: { color: colors.textMuted, fontFamily: fonts.data, fontSize: 9, marginTop: 5 },
  equipment: { color: colors.outline, fontFamily: fonts.medium, fontSize: 9, marginTop: 3 },
});
