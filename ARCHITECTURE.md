# Архитектура Sapa Jol — карта проекта

Короткий путеводитель: где что лежит и что за что отвечает.
Всё приложение — React Native (Expo), бэкенд — Supabase (Postgres + Realtime + RPC).

## Поток данных одним абзацем

`Экраны` → `хуки` (данные + логика) → `services/api.ts` (Supabase) → облако.
Realtime-обновления приходят в `store/incidentStore.ts` (Zustand), и все экраны
перерисовываются сами. Ничего другого в проекте нет — FastAPI удалён.

## src/ — 5 папок, каждая по одному делу

| Папка | Что внутри | Когда трогать |
|---|---|---|
| `screens/` | 5 экранов: Map, Alerts, Profile, IncidentDetail, Onboarding. Подпапка `map/` — только UI-куски карты (топ-бар, фильтры, маркеры, диалоги) | Поменять интерфейс |
| `hooks/` | Вся логика: `useIncidents` (загрузка/отправка/очередь), `useLocation` (GPS + тревоги 2 км/500 м), `useRoute` (маршруты), `useLivestock` (стада), `useSettings`/`useUserProfile` (настройки) | Поменять поведение |
| `services/` | `api.ts` — ВСЁ общение с Supabase (единственная точка); `supabase.ts` — клиент; `notifications`, `directions`, `deviceId`, `sentry` | Интеграции |
| `components/` | Переиспользуемые куски UI: ReportModal, IncidentCard, тосты, диалоги | UI |
| `constants/` + `config.ts` | Тексты (`i18n/`), цвета, типы инцидентов, `config.ts` — все числа (радиус 2 км, пороги, интервалы) | Настройки |

**Порядок чтения новичку:** `config.ts` → `services/api.ts` → `hooks/useIncidents.ts` → `screens/MapScreen.tsx`.

## Корень

- `App.tsx`, `index.ts` — вход (навигация, сплэш, проверка онбординга)
- `app.config.js` — сборка Expo: пакет, разрешения, ключи из `.env`
- `supabase/migrations/` — схема БД и RPC (001–006), применяется через psql
- `scripts/` — утилиты: `confirm-runner.js` (второй пользователь для тестов),
  `db-inspect.js` (смотреть базу), `make-docx.py` + `annotate-shots.py` (конкурсный документ)
- `docs/` — протокол тестов, результаты, DESIGN.md (дизайн-система)
- `index.html` + `privacy.html` — QR-портал скачивания APK
- `shots/` — скриншоты и их аннотированные версии

## Ключевые числа (всё в src/config.ts)

Радиус тревоги 2 км · подтверждение 500 м · 3 подтверждения = решено ·
GPS каждые 5 с / 50 м · опрос сервера 4 с (Realtime закрывает остальное).

## Что улучшить перед «настоящим» использованием

Сделано (миграции 006–009, см. git log):
- ✅ **Доступ к devices закрыт**: только SECURITY DEFINER RPC. Хэши паролей и
  телефоны не читаемы; сверка пароля на сервере, вход устойчив к формату номера.
- ✅ **Легаси-аккаунты** (до миграции 003): пароль, введённый при первом входе,
  становится паролем аккаунта (миграция 009), `has_password` в ответе.
- ✅ **Рейт-лимитинг** confirm_incident: 10 подтверждений / 5 мин на устройство.
- ✅ **Фото инцидентов**: Supabase Storage, публичное чтение, загрузка из
  приложения и из офлайн-очереди.
- ✅ **Хардкод строк** вычищен из UI (кроме onboarding — свой словарь by design).
- ✅ **Фоновые push (скаффолд)**: `supabase/functions/push-nearby` — готов к
  деплою (см. шапку файла); токены уже пишутся в devices.fcm_token.
- ✅ **Сид демо-данных**: `scripts/seed-demo.js` (идемпотентный).

Осталось (по убыванию важности):
1. **Деплой push-nearby**: `npx supabase functions deploy push-nearby
   --project-ref iqgawigwaempfnwtqovy` + Webhook в Dashboard (INSERT
   incident_reports). Работает только в EAS-сборке (не Expo Go).
2. **Полноценная аутентификация**: demo-модель «device_id = личность» живёт —
   мигрировать на Supabase Auth, тогда исчезнут RPC-костыли.
3. **Модерация фото**: фото публичны — добавить отчёт «спам/неподходящее».
4. **Пересборка APK**: последние фиксы только в Metro; перед выдачей APK —
   `npm run build:android` (hermesc OOM риск на 8 ГБ).
