/**
 * Shared incident type definitions and icon mappings.
 * Единый источник — вместо дублирования в MapScreen и AlertsScreen.
 */
import { Colors } from './colors';
import { useSettingsStore } from '../hooks/useSettings';

export type IncidentType = 'animal' | 'crash' | 'hazard' | 'other';

export interface IncidentMeta {
    icon: string;
    color: string;
    label: string;       // Казахский
    labelRu: string;     // Русский (fallback)
}

export const INCIDENT_META: Record<IncidentType, IncidentMeta> = {
    animal: {
        icon: 'paw',
        color: Colors.incident.animal,
        label: 'Жануарлар жолда',
        labelRu: 'Животные на дороге',
    },
    crash: {
        icon: 'car',
        color: Colors.incident.crash,
        label: 'ЖКО',
        labelRu: 'ДТП',
    },
    hazard: {
        icon: 'alert-circle',
        color: Colors.incident.hazard,
        label: 'Қауіпті аймақ',
        labelRu: 'Опасный участок',
    },
    other: {
        icon: 'help-circle',
        color: Colors.text.muted,
        label: 'Басқа',
        labelRu: 'Другое',
    },
};

export const INCIDENT_TYPES_LIST: { key: IncidentType; label: string; icon: string }[] = [
    { key: 'crash', label: 'ЖКО', icon: 'car' },
    { key: 'animal', label: 'Жануарлар', icon: 'paw' },
    { key: 'hazard', label: 'Шұңқыр', icon: 'alert-circle' },
    { key: 'other', label: 'Басқа', icon: 'help-circle' },
];

/**
 * Возвращает meta для типа инцидента, с fallback на 'other'.
 * label выбирается по текущему языку приложения (глобальный zustand-стор
 * настроек читается и вне React) — раньше русский labelRu был мёртвым кодом
 * и ru-пользователь видел казахские названия типов во всём UI.
 */
export function getIncidentMeta(type: string): IncidentMeta {
    const meta = INCIDENT_META[type as IncidentType] ?? INCIDENT_META.other;
    const lang = useSettingsStore.getState().settings.language;
    return lang === 'ru' ? { ...meta, label: meta.labelRu } : meta;
}

/**
 * Интерфейс инцидента (полный, с сервера)
 */
export interface Incident {
    id: number;
    incident_type: IncidentType;
    description: string | null;
    severity: number;          // 1–5
    latitude: number;
    longitude: number;
    is_active: boolean;
    route_id?: string | null; // маршрут, на котором поставлена метка ('a17' | 'a1' | ...)
    reporter_device_id?: string | null;
    ai_verified: boolean;
    ai_analysis: string | null;
    ai_confidence?: number;
    ai_severity_suggestion?: number;
    confirmations_count: number;
    created_at: string;        // ISO string
    resolved_at: string | null;
    photo_uri?: string;        // локальное фото (оптимистичный инцидент)
    photo_url?: string;        // фото с сервера
}
