/**
 * MapScreen constants — отдельный модуль для статических данных.
 * Полилинии маршрутов, стиль карты, отображаемые имена.
 */
import { LivestockType } from '../../constants/livestock';

/** Nothing Phone dark map — readability-tuned. */
export const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#0A0A0A' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
    {
        featureType: 'administrative.locality',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#BBBBBB' }],
    },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3A3A3A' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#222222' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#A0A0A0' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4A4A4A' }] },
    {
        featureType: 'road.highway',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#2ECC7155' }],
    },
    {
        featureType: 'road.highway',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#2ECC71' }],
    },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#3F3F3F' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050505' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2A2A2A' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#111111' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0A0A0A' }] },
    { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0A0A0A' }] },
];

/** Отображаемые названия маршрутов */
export const ROUTE_NAMES: Record<string, string> = {
    a17: 'A-17',
    a1: 'A-1',
    a21: 'A-21',
    e40: 'E-40',
};

/** Конечные точки маршрутов (для запроса в Directions API) */
export const ROUTE_ENDPOINTS: Record<string, { latitude: number; longitude: number }> = {
    a17: { latitude: 52.287, longitude: 76.967 }, // Павлодар
    a1: { latitude: 43.24, longitude: 76.91 }, // Алматы
    a21: { latitude: 50.42, longitude: 80.25 }, // Семей
    e40: { latitude: 42.9, longitude: 71.35 }, // Тараз
};

/** Маршруты с промежуточными точками (fallback когда Directions недоступен) */
export const ROUTE_WAYPOINTS: Record<string, { latitude: number; longitude: number }[]> = {
    a17: [
        // Астана → Павлодар (A-17, ~494 км)
        { latitude: 51.165, longitude: 71.427 },
        { latitude: 51.195, longitude: 71.54 },
        { latitude: 51.225, longitude: 71.68 },
        { latitude: 51.268, longitude: 71.88 },
        { latitude: 51.31, longitude: 72.08 },
        { latitude: 51.355, longitude: 72.32 },
        { latitude: 51.4, longitude: 72.56 },
        { latitude: 51.448, longitude: 72.82 },
        { latitude: 51.505, longitude: 73.1 },
        { latitude: 51.565, longitude: 73.42 },
        { latitude: 51.625, longitude: 73.76 },
        { latitude: 51.685, longitude: 74.1 },
        { latitude: 51.74, longitude: 74.44 },
        { latitude: 51.79, longitude: 74.79 },
        { latitude: 51.85, longitude: 75.18 },
        { latitude: 51.92, longitude: 75.58 },
        { latitude: 52.0, longitude: 75.93 },
        { latitude: 52.08, longitude: 76.23 },
        { latitude: 52.17, longitude: 76.56 },
        { latitude: 52.287, longitude: 76.967 },
    ],
    a1: [
        // Астана → Караганда → Балхаш → Алматы (A-1, ~1256 км)
        { latitude: 51.165, longitude: 71.427 },
        { latitude: 50.95, longitude: 71.7 },
        { latitude: 50.63, longitude: 72.96 }, // Теміртау
        { latitude: 49.8, longitude: 73.1 }, // Қарағанды
        { latitude: 49.1, longitude: 73.2 },
        { latitude: 48.3, longitude: 73.5 },
        { latitude: 47.6, longitude: 74.0 },
        { latitude: 46.85, longitude: 75.0 }, // Балхаш
        { latitude: 45.7, longitude: 75.3 },
        { latitude: 44.85, longitude: 76.0 },
        { latitude: 44.2, longitude: 76.5 },
        { latitude: 43.6, longitude: 76.8 },
        { latitude: 43.24, longitude: 76.91 }, // Алматы
    ],
    a21: [
        // Екібастұз → Семей (A-21, ~330 км)
        { latitude: 51.72, longitude: 75.32 },
        { latitude: 51.6, longitude: 75.98 },
        { latitude: 51.45, longitude: 76.72 },
        { latitude: 51.25, longitude: 77.45 },
        { latitude: 51.0, longitude: 78.2 },
        { latitude: 50.78, longitude: 79.0 },
        { latitude: 50.58, longitude: 79.7 },
        { latitude: 50.42, longitude: 80.25 },
    ],
    e40: [
        // Шымкент → Тараз (E-40, ~185 км)
        { latitude: 42.32, longitude: 69.6 },
        { latitude: 42.4, longitude: 69.98 },
        { latitude: 42.52, longitude: 70.42 },
        { latitude: 42.65, longitude: 70.82 },
        { latitude: 42.76, longitude: 71.1 },
        { latitude: 42.9, longitude: 71.35 },
    ],
};

export const ROAD_STATUS_COLOR = {
    open: '#2ECC71',
    caution: '#E67E22',
    closed: '#E74C3C',
} as const;

export const LIVESTOCK_TYPES: LivestockType[] = ['horse', 'cow', 'camel', 'sheep', 'goat'];

/** Фильтр карты: все / только инциденты / только скот */
export type FilterType = 'all' | 'incidents' | 'livestock';
