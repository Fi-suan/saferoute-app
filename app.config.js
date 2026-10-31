require('dotenv').config();

const VERSION_CODE = parseInt(process.env.VERSION_CODE || '1', 10);

module.exports = {
  expo: {
    name: 'Sapa Jol',
    slug: 'saferoute-app',
    version: '1.1.0',
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
      privacyPolicyUrl: 'https://github.com/Fi-suan/saferoute-app/blob/master/privacy.html',
    },
    web: {
      favicon: './assets/image.png',
    },
    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      sentryDsn: process.env.SENTRY_DSN,
      eas: {
        projectId: 'a70c8ef6-0258-4fff-9c1f-682d7a28b833',
      },
    },
    plugins: [
      // SDK 58 включает R8-минификацию в release по умолчанию — она вырезает
      // конструктор WorkDatabase_Impl (WorkManager/Room от react-native-maps),
      // и приложение крашится НА СТАРТЕ до запуска JS (expo/expo#51337,
      // react-native-maps#6044). Отключаем минификацию.
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
            // react-native-maps нестабилен на новой архитектуре (Fabric):
            // краши при загрузке карты/маркеров/тайлов (expo#5378, rn-maps#5807).
            // Нашему стеку новая архитектура ничего не даёт — отключаем.
            newArchEnabled: false,
          },
        },
      ],
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
