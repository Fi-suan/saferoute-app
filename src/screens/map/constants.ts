/**
 * MapScreen constants — отдельный модуль для статических данных.
 * Полилинии маршрутов, стиль карты, отображаемые имена.
 */
import { LivestockType } from '../../constants/livestock';

/** Nothing Phone dark map — readability-tuned. */
export const DARK_MAP_STYLE = [
    { elementType: 'geometry',                                                   stylers: [{ color: '#0A0A0A' }] },
    { elementType: 'labels.text.stroke',                                         stylers: [{ color: '#000000' }] },
    { elementType: 'labels.text.fill',                                           stylers: [{ color: '#888888' }] },
    { featureType: 'administrative.locality',  elementType: 'labels.text.fill', stylers: [{ color: '#BBBBBB' }] },
    { featureType: 'road',                     elementType: 'geometry',         stylers: [{ color: '#3A3A3A' }] },
    { featureType: 'road',                     elementType: 'geometry.stroke',  stylers: [{ color: '#222222' }] },
    { featureType: 'road',                     elementType: 'labels.text.fill', stylers: [{ color: '#A0A0A0' }] },
    { featureType: 'road.highway',             elementType: 'geometry',         stylers: [{ color: '#4A4A4A' }] },
    { featureType: 'road.highway',             elementType: 'geometry.stroke',  stylers: [{ color: '#2ECC7155' }] },
    { featureType: 'road.highway',             elementType: 'labels.text.fill', stylers: [{ color: '#2ECC71' }] },
    { featureType: 'road.arterial',            elementType: 'geometry',         stylers: [{ color: '#3F3F3F' }] },
    { featureType: 'transit',                  elementType: 'geometry',         stylers: [{ color: '#1A1A1A' }] },
    { featureType: 'water',                    elementType: 'geometry',         stylers: [{ color: '#050505' }] },
    { featureType: 'water',                    elementType: 'labels.text.fill', stylers: [{ color: '#2A2A2A' }] },
    { featureType: 'poi',                      elementType: 'geometry',         stylers: [{ color: '#111111' }] },
    { featureType: 'poi',                      elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
    { featureType: 'poi.park',                 elementType: 'geometry',         stylers: [{ color: '#0A0A0A' }] },
    { featureType: 'landscape',                elementType: 'geometry',         stylers: [{ color: '#0A0A0A' }] },
];

/** Отображаемые названия маршрутов */
export const ROUTE_NAMES: Record<string, string> = {
    a17: 'A-17', a1: 'A-1', a21: 'A-21', e40: 'E-40',
};

/** Конечные точки маршрутов (для запроса в Directions API) */
export const ROUTE_ENDPOINTS: Record<string, { latitude: number; longitude: number }> = {
    a17: { latitude: 52.287, longitude: 76.967 }, // Павлодар
    a1:  { latitude: 43.240, longitude: 76.910 }, // Алматы
    a21: { latitude: 50.420, longitude: 80.250 }, // Семей
    e40: { latitude: 42.900, longitude: 71.350 }, // Тараз
};

/** Маршруты с промежуточными точками (fallback когда Directions недоступен) */
export const ROUTE_WAYPOINTS: Record<string, { latitude: number; longitude: number }[]> = {
    a17: [
        // Астана → Павлодар (A-17, ~494 км)
        { latitude: 51.165, longitude: 71.427 },
        { latitude: 51.195, longitude: 71.540 },
        { latitude: 51.225, longitude: 71.680 },
        { latitude: 51.268, longitude: 71.880 },
        { latitude: 51.310, longitude: 72.080 },
        { latitude: 51.355, longitude: 72.320 },
        { latitude: 51.400, longitude: 72.560 },
        { latitude: 51.448, longitude: 72.820 },
        { latitude: 51.505, longitude: 73.100 },
        { latitude: 51.565, longitude: 73.420 },
        { latitude: 51.625, longitude: 73.760 },
        { latitude: 51.685, longitude: 74.100 },
        { latitude: 51.740, longitude: 74.440 },
        { latitude: 51.790, longitude: 74.790 },
        { latitude: 51.850, longitude: 75.180 },
        { latitude: 51.920, longitude: 75.580 },
        { latitude: 52.000, longitude: 75.930 },
        { latitude: 52.080, longitude: 76.230 },
        { latitude: 52.170, longitude: 76.560 },
        { latitude: 52.287, longitude: 76.967 },
    ],
    a1: [
        // Астана → Караганда → Балхаш → Алматы (A-1, ~1256 км)
        { latitude: 51.165, longitude: 71.427 },
        { latitude: 50.950, longitude: 71.700 },
        { latitude: 50.630, longitude: 72.960 },  // Теміртау
        { latitude: 49.800, longitude: 73.100 },  // Қарағанды
        { latitude: 49.100, longitude: 73.200 },
        { latitude: 48.300, longitude: 73.500 },
        { latitude: 47.600, longitude: 74.000 },
        { latitude: 46.850, longitude: 75.000 },  // Балхаш
        { latitude: 45.700, longitude: 75.300 },
        { latitude: 44.850, longitude: 76.000 },
        { latitude: 44.200, longitude: 76.500 },
        { latitude: 43.600, longitude: 76.800 },
        { latitude: 43.240, longitude: 76.910 },  // Алматы
    ],
    a21: [
        // Екібастұз → Семей (A-21, ~330 км)
        { latitude: 51.720, longitude: 75.320 },
        { latitude: 51.600, longitude: 75.980 },
        { latitude: 51.450, longitude: 76.720 },
        { latitude: 51.250, longitude: 77.450 },
        { latitude: 51.000, longitude: 78.200 },
        { latitude: 50.780, longitude: 79.000 },
        { latitude: 50.580, longitude: 79.700 },
        { latitude: 50.420, longitude: 80.250 },
    ],
    e40: [
        // Шымкент → Тараз (E-40, ~185 км)
        { latitude: 42.320, longitude: 69.600 },
        { latitude: 42.400, longitude: 69.980 },
        { latitude: 42.520, longitude: 70.420 },
        { latitude: 42.650, longitude: 70.820 },
        { latitude: 42.760, longitude: 71.100 },
        { latitude: 42.900, longitude: 71.350 },
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
