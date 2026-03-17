import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

import RootNavigator from './src/navigation/RootNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { Colors } from './src/constants/colors';
import { STORAGE } from './src/constants/storage';
import { getDeviceId } from './src/services/deviceId';
import { registerForPushNotifications } from './src/services/notifications';

// Держим splash пока читаем AsyncStorage
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null); // null = ещё не загружено

  useEffect(() => {
    (async () => {
      try {
        // Инициализируем device ID при первом запуске
        await getDeviceId();
        // Читаем статус онбординга
        const done = await AsyncStorage.getItem(STORAGE.ONBOARDING_DONE);
        setOnboardingDone(done === 'true');
        // Запрашиваем push-разрешения в фоне (не блокируем UI)
        registerForPushNotifications().catch(() => { });
      } catch {
        setOnboardingDone(false);
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  const handleOnboardingFinish = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE.ONBOARDING_DONE, 'true');
    setOnboardingDone(true);
  }, []);

  // Пока читаем AsyncStorage — loading state (splash держит экран)
  if (onboardingDone === null) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={Colors.bg.primary} />
        {onboardingDone ? (
          <NavigationContainer
            theme={{
              dark: true,
              fonts: {
                regular: { fontFamily: 'System', fontWeight: '400' },
                medium: { fontFamily: 'System', fontWeight: '500' },
                bold: { fontFamily: 'System', fontWeight: '700' },
                heavy: { fontFamily: 'System', fontWeight: '900' },
              },
              colors: {
                primary: Colors.brand.primary,
                background: Colors.bg.primary,
                card: Colors.bg.secondary,
                text: Colors.text.primary,
                border: Colors.border,
                notification: Colors.alert.high,
              },
            }}
          >
            <RootNavigator />
          </NavigationContainer>
        ) : (
          <OnboardingScreen onFinish={handleOnboardingFinish} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg.primary },
  loadingWrap: { flex: 1, backgroundColor: Colors.bg.primary, alignItems: 'center', justifyContent: 'center' },
});

