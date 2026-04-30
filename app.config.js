require('dotenv').config();

const VERSION_CODE = parseInt(process.env.VERSION_CODE || '1', 10);

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
        foregroundImage: './assets/image.png',
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
    extra: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
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
