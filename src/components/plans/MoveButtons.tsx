import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/tokens';

type Props = { label: string; index: number; count: number; onMove: (offset: -1 | 1) => void };

export function MoveButtons({ label, index, count, onMove }: Props) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityLabel={`Move ${label} up`} disabled={index === 0} onPress={() => onMove(-1)} style={styles.button}>
        <Ionicons color={index === 0 ? colors.surfaceHighest : colors.textMuted} name="arrow-up" size={17} />
      </Pressable>
      <Pressable accessibilityLabel={`Move ${label} down`} disabled={index === count - 1} onPress={() => onMove(1)} style={styles.button}>
        <Ionicons color={index === count - 1 ? colors.surfaceHighest : colors.textMuted} name="arrow-down" size={17} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  button: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
