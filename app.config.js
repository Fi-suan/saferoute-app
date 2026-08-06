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
      // Права, которые Expo кладёт в шаблон «на всякий случай». Приложение ими
      // не пользуется, а в карточке Play они видны пользователю: «Показ поверх
      // других приложений» и запись во внешнее хранилище. READ_EXTERNAL_STORAGE
      // оставлен намеренно — без него не открыть галерею на Android 12 и ниже.
      blockedPermissions: [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
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
          // Только foreground: фонового отслеживания в коде нет (см. docs/permissions.md).
          locationWhenInUsePermission:
            'Sapa Jol геолокацияңызды жол бойындағы жануарлар туралы ескертулер үшін пайдаланады.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Оқиға туралы хабарламаға фото қосу үшін қажет.',
          cameraPermission: 'Оқиғаларды хабарлау үшін фото түсіру қажет.',
          // Плагин по умолчанию просит RECORD_AUDIO ради записи видео.
          // Приложение берёт только фото (mediaTypes: 'images'), микрофон не нужен.
          microphonePermission: false,
        },
      ],
      'expo-secure-store',
    ],
  },
};
