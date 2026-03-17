/**
 * mockLivestock.ts — Реалистичные данные скота вблизи дорог Казахстана
 *
 * Координаты привязаны к реальным трассам:
 * A-17: Астана (51.18, 71.44) → Павлодар (52.29, 76.97)
 * A-1:  Астана (51.18, 71.44) → Алматы (43.24, 76.89) через Кызылорду
 * A-21: Екібастұз (51.73, 75.32) → Семей (50.41, 80.25)
 *
 * Записи с isNearRoad: true — АКТУАЛЬНЫЕ УГРОЗЫ для водителей
 */
import { Livestock } from '../constants/livestock';

export const MOCK_LIVESTOCK: Livestock[] = [
    // ========== ТРАССА A-17 Астана → Павлодар ==========
    {
        id: 'ls-001',
        ownerId: 'owner-1',
        ownerName: 'Бекзат Омаров',
        ownerPhone: '+7 701 234 5678',
        type: 'horse',
        count: 23,
        name: 'Омаров үйірі',
        chipId: 'TT-2024-A17-001',
        latitude: 51.4201,
        longitude: 72.0800,
        lastUpdated: new Date(Date.now() - 8 * 60000).toISOString(),
        isNearRoad: true,
        distanceToRoadM: 180,   // ОПАСНО — 180м от A-17
        routeId: 'a17',
        trackingMode: 'chip',
    },
    {
        id: 'ls-002',
        ownerId: 'owner-2',
        ownerName: 'Ерлан Жақсыбеков',
        ownerPhone: '+7 702 345 6789',
        type: 'cow',
        count: 31,
        name: 'Жақсыбеков табыны',
        latitude: 51.7840,
        longitude: 73.5120,
        lastUpdated: new Date(Date.now() - 15 * 60000).toISOString(),
        isNearRoad: false,
        distanceToRoadM: 2400,
        routeId: 'a17',
        trackingMode: 'phone',
    },
    {
        id: 'ls-003',
        ownerId: 'owner-3',
        ownerName: 'Айгүл Нұрланова',
        ownerPhone: '+7 707 456 7890',
        type: 'sheep',
        count: 87,
        name: 'Нұрланова отары',
        chipId: 'TT-2024-A17-003',
        latitude: 52.0340,
        longitude: 75.1890,
        lastUpdated: new Date(Date.now() - 3 * 60000).toISOString(),
        isNearRoad: true,
        distanceToRoadM: 95,    // КРИТИЧНО — 95м от A-17 (ПАВЛОДАР АЙМАҒЫ)
        routeId: 'a17',
        trackingMode: 'chip',
    },
    {
        id: 'ls-004',
        ownerId: 'owner-1',
        ownerName: 'Бекзат Омаров',
        ownerPhone: '+7 701 234 5678',
        type: 'camel',
        count: 12,
        name: 'Омаров түйелері',
        latitude: 51.9200,
        longitude: 74.6700,
        lastUpdated: new Date(Date.now() - 45 * 60000).toISOString(),
        isNearRoad: false,
        distanceToRoadM: 3100,
        routeId: 'a17',
        trackingMode: 'chip',
    },

    // ========== ТРАССА A-1 Астана → Алматы ==========
    {
        id: 'ls-005',
        ownerId: 'owner-4',
        ownerName: 'Серік Байменов',
        ownerPhone: '+7 705 567 8901',
        type: 'horse',
        count: 45,
        name: 'Байменов жылқысы',
        chipId: 'TT-2024-A1-001',
        latitude: 49.8500,
        longitude: 73.1000,
        lastUpdated: new Date(Date.now() - 20 * 60000).toISOString(),
        isNearRoad: true,
        distanceToRoadM: 240,   // Ескерту — 240м от A-1 (Қарағанды аймағы)
        routeId: 'a1',
        trackingMode: 'chip',
    },
    {
        id: 'ls-006',
        ownerId: 'owner-5',
        ownerName: 'Тасболат Сейтқали',
        ownerPhone: '+7 708 678 9012',
        type: 'goat',
        count: 130,
        name: 'Сейтқали отары',
        latitude: 47.2000,
        longitude: 72.5000,
        lastUpdated: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
        isNearRoad: false,
        distanceToRoadM: 5000,
        routeId: 'a1',
        trackingMode: 'manual',
    },

    // ========== ТРАССА A-21 Екібастұз → Семей ==========
    {
        id: 'ls-007',
        ownerId: 'owner-6',
        ownerName: 'Дамир Есенов',
        ownerPhone: '+7 706 789 0123',
        type: 'cow',
        count: 19,
        name: 'Есенов табыны',
        chipId: 'TT-2024-A21-001',
        latitude: 51.9800,
        longitude: 77.8500,
        lastUpdated: new Date(Date.now() - 5 * 60000).toISOString(),
        isNearRoad: true,
        distanceToRoadM: 150,   // ОПАСНО — 150м от A-21
        routeId: 'a21',
        trackingMode: 'chip',
    },
];

/** Только скот который находится в опасной близости к дороге */
export const LIVESTOCK_NEAR_ROAD = MOCK_LIVESTOCK.filter(l => l.isNearRoad);
