import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useEffectEvent, useState } from 'react';
import { AppState, View } from 'react-native';

import { initializeDatabase } from '../src/data/database';
import { syncAll } from '../src/sync/sync';
import { colors } from '../src/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [interLoaded, interError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });
  const [databaseReady, setDatabaseReady] = useState(false);

  async function sync() {
    try {
      await syncAll();
    } catch (error) {
      console.warn('Sync failed; local changes remain pending.', error);
    }
  }

  const syncEvent = useEffectEvent(sync);

  useEffect(() => {
    initializeDatabase()
      .then(() => setDatabaseReady(true))
      .catch((error) => console.error('Database initialization failed.', error));

    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void syncEvent();
    });
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncEvent();
    });
    return () => {
      unsubscribeNetwork();
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if ((interLoaded || interError) && databaseReady) void SplashScreen.hideAsync();
  }, [databaseReady, interError, interLoaded]);

  if ((!interLoaded && !interError) || !databaseReady) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="equipment/[id]"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen name="exercise/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="exercise/edit/[id]"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen name="plan/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="plan/edit/[id]"
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
