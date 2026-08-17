import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../theme/tokens';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Ionicons color={colors.outline} name="construct-outline" size={32} />
        <Text style={styles.eyebrow}>GYMRAT</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>This area is ready for its product slice.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  eyebrow: { color: colors.lime, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 2, marginTop: 16 },
  title: { color: colors.text, fontFamily: fonts.extraBold, fontSize: 32, letterSpacing: -1, marginTop: 8 },
  copy: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, marginTop: 12 },
});
