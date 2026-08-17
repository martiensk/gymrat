import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { colors, fonts } from '../../src/theme/tokens';

const icons = {
  home: ['home-outline', 'home'] as const,
  plans: ['clipboard-outline', 'clipboard'] as const,
  library: ['barbell-outline', 'barbell'] as const,
};

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="library"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveBackgroundColor: colors.lime,
        tabBarActiveTintColor: colors.onLime,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 4,
          marginVertical: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bold,
          fontSize: 10,
          letterSpacing: 0.8,
          paddingBottom: 4,
        },
        tabBarStyle: {
          height: 72,
          backgroundColor: colors.surfaceLowest,
          borderTopColor: colors.outlineMuted,
          borderTopWidth: 1,
          paddingHorizontal: 8,
        },
        tabBarIcon: ({ color, focused, size }) => {
          const pair = icons[route.name as keyof typeof icons] ?? icons.home;
          return <Ionicons color={color} name={focused ? pair[1] : pair[0]} size={size} />;
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'HOME' }} />
      <Tabs.Screen name="plans" options={{ title: 'PLANS' }} />
      <Tabs.Screen name="library" options={{ title: 'LIBRARY' }} />
    </Tabs>
  );
}
