# Разрешения приложения

Каждое право видно пользователю в карточке Google Play и разбирается на ревью.
Лишние — это и отказ в публикации, и просто отпугнутые установки. Здесь
зафиксировано, что запрашивается и почему.

## Что запрашивается

| Право | Зачем |
|---|---|
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | позиция водителя, чтобы предупредить о ближайших инцидентах |
| `CAMERA` | фото инцидента для AI-проверки |
| `READ_MEDIA_IMAGES` | выбор фото из галереи, Android 13+ |
| `READ_EXTERNAL_STORAGE` | то же для Android 12 и ниже |
| `POST_NOTIFICATIONS` | локальные уведомления о приближении к опасности |
| `VIBRATE` | тактильный отклик на предупреждения |
| `INTERNET` | обмен с API |

## Что убрано и почему

### ACCESS_BACKGROUND_LOCATION

Заявлялось в манифесте, но **в коде не использовалось ни строки**: ни
`TaskManager`, ни `startLocationUpdatesAsync`, ни `requestBackgroundPermissionsAsync`.
`useLocation` работает только через `requestForegroundPermissionsAsync` и
`watchPositionAsync`, то есть пока приложение открыто.

Google Play требует для фоновой геолокации отдельную декларацию, видео с
демонстрацией сценария и обоснование, почему функция без неё не работает.
Заявлять право, которым не пользуешься, — гарантированный отказ.

Удаление ничего не ломает: поведение приложения было и остаётся foreground-only.

Вместе с ним убраны iOS-строка `NSLocationAlwaysAndWhenInUseUsageDescription`
и параметр `locationAlwaysAndWhenInUsePermission` у плагина `expo-location` —
они описывали ровно тот же несуществующий сценарий.

### RECORD_AUDIO

Плагин `expo-image-picker` добавляет микрофон по умолчанию, потому что умеет
записывать видео. Приложение берёт только фото (`mediaTypes: 'images'`).
Отключено штатным флагом `microphonePermission: false`.

В карточке Play это отображалось как «Микрофон» — для приложения про дороги
выглядит подозрительно и бьёт по конверсии.

### SYSTEM_ALERT_WINDOW и WRITE_EXTERNAL_STORAGE

Приезжали из базового шаблона Expo, где над ними стоит комментарий
«OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED». Приложение ими не
пользуется. Убраны через `android.blockedPermissions`.

`SYSTEM_ALERT_WINDOW` показывается как «Показ поверх других приложений» —
одно из самых настораживающих прав в списке.

`READ_EXTERNAL_STORAGE` намеренно оставлено: без него не открыть галерею на
Android 12 и ниже, а `minSdkVersion` у SDK 54 — 24.

## Как проверить

`blockedPermissions` не вычёркивает строку из исходного манифеста, а помечает
её `tools:node="remove"` — удаление делает Android-мержер при сборке, заодно
вычищая право из манифестов подключённых библиотек. Поэтому в
`android/app/src/main/AndroidManifest.xml` право видно, но с этим атрибутом:

```bash
npx expo prebuild --platform android --no-install --clean
grep uses-permission android/app/src/main/AndroidManifest.xml
```

Права без `tools:node="remove"` — то, что реально уедет в APK.
Папка `android/` под `.gitignore`, после проверки её можно удалить.

## Если понадобится фоновое отслеживание

Реальный сценарий, которому оно нужно, — режим «Я с табуном»: сейчас телефон
пастуха перестаёт быть маяком, как только приложение уходит в фон, хотя весь
смысл режима в обратном.

Правильный путь — **не** возвращать `ACCESS_BACKGROUND_LOCATION`, а поднять
foreground service: `expo-location` умеет это через `startLocationUpdatesAsync`
с опцией `foregroundService` (плагин, флаг `isAndroidForegroundServiceEnabled`).
Android разрешает такому сервису доступ к геолокации без фонового права, если
он запущен пока приложение на экране. Пользователь видит постоянное
уведомление — что для режима маяка честно и понятно.

Это отдельная задача: нужен прогон на живом устройстве, оценка расхода батареи
и решение, как режим завершать. Формально фоновая геолокация в Play всё равно
потребует внимания на ревью, но foreground service с явным уведомлением
проходит его несопоставимо проще, чем немотивированный
`ACCESS_BACKGROUND_LOCATION`.
