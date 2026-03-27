import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

import RootNavigator from './src/navigation/RootNavigator';
import OnboardingScreen, { OnboardingResult } from './src/screens/OnboardingScreen';
import { Colors } from './src/constants/colors';
import { STORAGE } from './src/constants/storage';
import { getDeviceId } from './src/services/deviceId';
import { registerForPushNotifications } from './src/services/notifications';
import { AppResetEvent } from './src/services/appReset';
import type { UserProfile } from './src/constants/livestock';

// Держим splash пока читаем AsyncStorage
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  // Слушаем logout из ProfileScreen
  useEffect(() => {
    AppResetEvent.subscribe(() => setOnboardingDone(false));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await getDeviceId();
        const done = await AsyncStorage.getItem(STORAGE.ONBOARDING_DONE);
        const profileRaw = await AsyncStorage.getItem(STORAGE.USER_PROFILE);
        setOnboardingDone(done === 'true' && !!profileRaw);
        if (profileRaw) {
          try {
            const profile: UserProfile = JSON.parse(profileRaw);
            registerForPushNotifications(profile.role).catch(() => { });
          } catch { /* ignore */ }
        }
      } catch {
        setOnboardingDone(false);
      } finally {
        await SplashScreen.hideAsync();
      }
    })();
  }, []);

  const handleOnboardingFinish = useCallback(async (data: OnboardingResult) => {
    // Формируем инициалы из имени
    const initials = data.name
      .trim()
      .split(' ')
      .map(w => w[0])
      .filter(Boolean)
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'АА';

    const profile: UserProfile = {
      name: data.name || 'Пайдаланушы',
      phone: data.phone,
      role: data.role,
      joinedAt: new Date().toISOString(),
      totalReports: 0,
      avatarInitials: initials,
    };

    await AsyncStorage.setItem(STORAGE.USER_PROFILE, JSON.stringify(profile));
    await AsyncStorage.setItem(STORAGE.ONBOARDING_DONE, 'true');
    setOnboardingDone(true);
    registerForPushNotifications(data.role).catch(() => { });
  }, []);

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
