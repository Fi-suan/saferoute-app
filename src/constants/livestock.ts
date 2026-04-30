/**
 * livestock.ts — константы и типы для системы отслеживания скота
 *
 * ИНТЕГРАЦИЯ С ТРЕКЕРАМИ (предложения):
 *
 * Опция A (Лучшая): Партнёрство с Tort Tulik Mobile
 *   - Связаться с командой, предложить API-соглашение
 *   - Они получают: видимость + безопасность их клиентов
 *   - Мы получаем: real-time GPS данные скота
 *   - Реализация: REST endpoint от Tort Tulik -> наш сервер -> приложение (polling)
 *   - Статус: БУДУЩЕЕ
 *
 * Опция B (Технически реализуема сейчас): Generic MQTT
 *   - Многие GPS-ошейники (Concox, Teltonika) публикуют по MQTT
 *   - Наш backend подписывается на MQTT-брокер
 *   - Владелец настраивает трекер один раз → данные идут к нам
 *   - Работает с большинством GSM-трекеров в РК
 *   - Статус: ТРЕБУЕТ BACKEND + договорённость с производителями
 *
 * Опция C (Текущая реализация): Ручной режим
 *   - Владелец открывает приложение рядом со стадом
 *   - Нажимает "Я с табуном" → его телефон = маяк стада
 *   - Позиция обновляется пока приложение активно
 *   - Плюс: работает СЕЙЧАС, не требует трекеров
 *   - Минус: требует телефон у пастуха
 *
 * Опция D (Временная для демо): Web scraping Tort Tulik
 *   - НЕ РЕКОМЕНДУЕТСЯ: нарушает ToS, нестабильно
 *   - Только для демонстрации инвесторам
 */

export type LivestockType = 'horse' | 'cow' | 'camel' | 'sheep' | 'goat';

export interface Livestock {
    id: string;
    ownerId: string;
    ownerName: string;
    ownerPhone: string;
    type: LivestockType;
    count: number;
    name: string;          // название стада / кличка
    chipId?: string;       // ID физического чипа/трекера
    latitude: number;
    longitude: number;
    lastUpdated: string;   // ISO
    isNearRoad: boolean;   // < 300м от трассы
    distanceToRoadM: number;
    routeId?: string;      // рядом с какой трассой
    trackingMode: 'chip' | 'manual' | 'phone';  // источник данных
}

export const LIVESTOCK_META: Record<LivestockType, {
    label: string;
    labelKk: string;
    icon: string;
    color: string;
    emoji: string;
}> = {
    horse: { label: 'Жылқы', labelKk: 'Жылқы үйірі', icon: 'paw', color: '#E67E22', emoji: '🐴' },
    cow: { label: 'Сиыр', labelKk: 'Сиыр табыны', icon: 'nutrition', color: '#27AE60', emoji: '🐄' },
    camel: { label: 'Түйе', labelKk: 'Түйе үйірі', icon: 'partly-sunny', color: '#F39C12', emoji: '🐪' },
    sheep: { label: 'Қой', labelKk: 'Қой отары', icon: 'cloud', color: '#95A5A6', emoji: '🐑' },
    goat: { label: 'Ешкі', labelKk: 'Ешкі табыны', icon: 'leaf', color: '#2ECC71', emoji: '🐐' },
};

/** Дистанция от дороги которая считается ОПАСНОЙ */
export const LIVESTOCK_DANGER_DISTANCE_M = 300;

/** Дистанция от дороги для предупреждения водителей */
export const LIVESTOCK_WARN_DISTANCE_M = 1000;

export type UserRole = 'driver' | 'livestock_owner';

export interface UserProfile {
    name: string;
    phone: string;
    role: UserRole;
    joinedAt: string;
    totalReports: number;
    avatarInitials: string;  // первые 2 буквы имени
}

export const ROUTES = [
    {
        id: 'a17',
        name: 'Астана — Павлодар',
        shortCode: 'A-17',
        from: 'Астана',
        to: 'Павлодар',
        lengthKm: 494,
        bounds: { latMin: 51.0, latMax: 52.5, lonMin: 71.3, lonMax: 77.2 },
    },
    {
        id: 'a1',
        name: 'Астана — Алматы',
        shortCode: 'A-1',
        from: 'Астана',
        to: 'Алматы',
        lengthKm: 1256,
        bounds: { latMin: 43.0, latMax: 51.3, lonMin: 71.3, lonMax: 77.2 },
    },
    {
        id: 'a21',
        name: 'Екібастұз — Семей',
        shortCode: 'A-21',
        from: 'Екібастұз',
        to: 'Семей',
        lengthKm: 330,
        bounds: { latMin: 51.4, latMax: 52.5, lonMin: 75.0, lonMax: 80.5 },
    },
    {
        id: 'e40',
        name: 'Шымкент — Тараз',
        shortCode: 'E-40',
        from: 'Шымкент',
        to: 'Тараз',
        lengthKm: 185,
        bounds: { latMin: 42.2, latMax: 42.9, lonMin: 68.0, lonMax: 71.5 },
    },
] as const;

export type RouteId = typeof ROUTES[number]['id'];
