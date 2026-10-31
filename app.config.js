require('dotenv').config();

const VERSION_CODE = parseInt(process.env.VERSION_CODE || '1', 10);

module.exports = {
  expo: {
    name: 'Sapa Jol',
    slug: 'saferoute-app',
    version: '1.3.0',
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
      // react-native-maps удалён (Google SDK без биллинга = чёрная карта);
      // ключ Google Maps больше не нужен — карты MapLibre/OpenFreeMap.
      privacyPolicyUrl: 'https://github.com/Fi-suan/saferoute-app/blob/master/privacy.html',
    },
    web: {
      favicon: './assets/image.png',
    },
    extra: {
      sentryDsn: process.env.SENTRY_DSN,
      eas: {
        projectId: 'a70c8ef6-0258-4fff-9c1f-682d7a28b833',
      },
    },
    plugins: [
      // SDK 58 включает R8-минификацию в release по умолчанию; при поиске
      // крашей на старте (rn-maps#6044) она была отключена. Пока держим off —
      // стабильность важнее размера APK для тестеров.
      [
        'expo-build-properties',
        {
          android: {
            enableMinifyInReleaseBuilds: false,
            enableShrinkResourcesInReleaseBuilds: false,
            // NOTE: newArchEnabled:false в SDK 58 НЕ работает — старая архитектура
            // удалена в RN 0.82+. Приложение всегда работает на Fabric.
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
      // Карты: MapLibre (new-arch native), тайлы OpenFreeMap — Google SDK и
      // ключи не нужны (react-native-maps на Android без Google-ключа мёртв).
      '@maplibre/maplibre-react-native',
    ],
  },
};
