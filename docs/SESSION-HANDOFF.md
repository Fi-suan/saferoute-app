# Sapa Zhol (SafeRoute) — бриф для новой сессии

> Скопируй этот файл в чат новой сессии (например на Linux-машине) — агент
> продолжит с полным контекстом. Репозиторий: github.com/Fi-suan/saferoute-app.

## Что это
Expo (SDK 58, RN 0.88, new arch/Fabric) приложение «Sapa Zhol»: безопасность дорог
Казахстана. Водители ставят метки (ДТП, животные, опасный участок) с фото; AI (Pixtral)
проверяет фото и назначает severity; другие водители в радиусе 2 км получают
предупреждение; 3 подтверждения = метка решена. Владельцы скота видят табуны.
Языки интерфейса: kk/ru (`src/i18n/translations.ts`), общение — русский.

⚠️ Имя бренда **Sapa Zhol**. НЕ трогать: package `kz.saferoute.app`, slug `saferoute-app`,
префикс хэша пароля `saferoute:` (иначе все пароли сломаются), storage-ключи
`saferoute:*`, имя файла `sapa-jol.apk` на QR-портале.

## Стек
- Карта: **@maplibre/maplibre-react-native 11.5** + стиль OpenFreeMap dark
  (`OPENFREEMAP_DARK_STYLE` в `src/screens/map/constants.ts`). react-native-maps УДАЛЁН:
  на Android он = Google Maps SDK, без биллинга давал только чёрный экран.
  MapLibre: `Map`/`Camera`(ref easeTo/flyTo)/`Marker`(lngLat, дети)/`GeoJSONSource`+`Layer`.
- Бэкенд: Supabase, project ref `iqgawigwaempfnwtqovy`, URL+anon key в `src/config.ts`.
  Postgres напрямую: `postgresql://postgres:<pw>@db.iqgawigwaempfnwtqovy.supabase.co:5432/postgres`
  (pw спроси у владельца; `npm i --no-save pg`). Миграции 001–013 применены.
- EAS: аккаунт zhantorekulenbai@gmail.com, проект `@fisuan/saferoute-app`
  (projectId в app.config.js). Сборка: `npx eas build --platform android --profile preview --non-interactive --no-wait`.
- Edge-функции задеплоены: `verify-photo` (пишет ai_verified/ai_confidence/ai_analysis/
  ai_severity_suggestion И **severity** метки; авто-скрытие при reject conf≥0.6),
  `push-nearby`. Триггеры в БД. MISTRAL_API_KEY — в секретах Supabase.
- R8 минификация в release ОТКЛЮЧЕНА (expo-build-properties) — стабильность важнее размера.

## Ключевые правила продукта (не ломать)
- Тревога 2 км (баннер, TTL 24 ч), подтверждение 500 м (диалог, TTL 5 мин),
  3 подтверждения = решено. Rate-limit confirm: 10/5 мин на устройство.
- Road status: closed (красная линия) = 1×sev5 ИЛИ 3×sev4 активных; caution = 2×sev4 или ДТП sev4.
- Приватность: devices читается только через SECURITY DEFINER RPC; в метках нет
  персональных данных автора (только reporter_device_id); login = телефон+пароль,
  хэш = SHA256(`saferoute:${phone}:${password}`), login_device принимает кандидат-хэши.
- Offline-очередь: фото в очереди — только photo_uri СЖАТОГО файла; base64 не хранить.

## Демо-данные и тесты
- `SUPABASE_DB_URL=... node scripts/mega-seed.js` — wipe ВСЕХ инцидентов (только через
  postgres! anon DELETE молча no-op из-за RLS) + 12 аккаунтов (mega-user-01..12,
  +77015500001..12 / pass01..12) + 15 меток ВДОЛЬ OSRM-дорог с фото (пары фото↔описание
  в PAIRS не перемешивать — Pixtral сверяет их).
- `node scripts/mega-test.js` — E2E (логин, приватность, подтверждения, rate-limit, геометрия). 0 багов.
- `SUPABASE_DB_URL=... node scripts/ultra-test.js` — 100 пользователей, 9 фаз, 0 багов (самоочистка в конце).
- Аккаунт на телефоне владельца: перерегистрируется сам; не трогай его пароль вручную.

## Проверки перед пушем
`npx tsc --noEmit` чист. После смены кода карты — EAS build + `adb install` +
скриншот-проверка (adb путь на винде: platform-tools; на Linux — свой). Свежий APK:
https://expo.dev/artifacts/eas/U3QEhVNsrvGTNbiA2fZl-iYhM4CJeLfVlXx2-ncMf00.apk (v1.3.0, но после
переименования в Sapa Zhol будет новая сборка с новым именем).

## Известные компромиссы (не баги)
- ai_analysis и оптимистичные строки в БД на казахском (продукт для KZ).
- Один слот nearbyAlert (вторая метка в 2 км перезапишет баннер).
- «N мин назад» на экране деталей обновляется только при realtime-событиях.
