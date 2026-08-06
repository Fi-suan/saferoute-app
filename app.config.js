require('dotenv').config();

const VERSION_CODE = parseInt(process.env.VERSION_CODE || '1', 10);

// EAS project ID — выдаётся один раз командой `eas init` и кладётся в .env
// как EAS_PROJECT_ID. Без него OTA-обновления просто выключены: сборка и
// запуск работают как раньше, приложение молча не ходит за апдейтами.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '';

module.exports = {
  expo: {
    name: 'Sapa Jol',
    slug: 'saferoute-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/image.png',
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/image.png',
      resizeMode: 'contain',
      backgroundColor: '#0A0F1C',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'kz.saferoute.app',
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Sapa Jol геолокацияңызды жол бойындағы жануарлар туралы ескертулер үшін пайдаланады.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Sapa Jol қосымша жабық кезде де ескертулер алу үшін фондық геолокацияны пайдаланады.',
        NSCameraUsageDescription: 'Оқиғаларды хабарлау үшін фото түсіру қажет.',
        NSPhotoLibraryUsageDescription: 'Оқиға туралы хабарламаға фото қосу үшін қажет.',
      },
    },
    android: {
      package: 'kz.saferoute.app',
      versionCode: VERSION_CODE,
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        monochromeImage: './assets/android-icon-monochrome.png',
        backgroundColor: '#0A0F1C',
      },
      predictiveBackGestureEnabled: false,
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'VIBRATE',
        'POST_NOTIFICATIONS',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      privacyPolicyUrl: 'https://saferoute.kz/privacy.html',
    },
    web: {
      favicon: './assets/image.png',
    },

    // ── OTA-обновления (EAS Update) ──────────────────────────────────────────
    // Без них любая правка JS доезжает до людей только новым релизом в Play,
    // с ревью на несколько дней. Для приложения про безопасность на дороге это
    // слишком долго.
    //
    // Политика fingerprint, а не appVersion: EAS считает хеш нативной части
    // (зависимости, плагины, конфиг) и отдаёт обновление только сборкам с таким
    // же хешем. При appVersion достаточно добавить нативный модуль и забыть
    // поднять version — и OTA уедет в бинарник, где этого модуля нет.
    //
    // fallbackToCacheTimeout: 0 — старт не ждёт сети. Проверка идёт фоном,
    // обновление применяется при следующем запуске, а не посреди поездки.
    ...(EAS_PROJECT_ID
      ? {
          updates: {
            url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
            fallbackToCacheTimeout: 0,
          },
          runtimeVersion: { policy: 'fingerprint' },
        }
      : {}),

    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      sentryDsn: process.env.SENTRY_DSN,
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Sapa Jol жол бойындағы жануарлар туралы ескертулер үшін фондық геолокацияны пайдаланады.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Оқиға туралы хабарламаға фото қосу үшін қажет.',
          cameraPermission: 'Оқиғаларды хабарлау үшін фото түсіру қажет.',
        },
      ],
      'expo-secure-store',
    ],
  },
};
