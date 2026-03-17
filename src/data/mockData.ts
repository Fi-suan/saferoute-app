/**
 * Реальные данные трассы Астана — Павлодар (A-17)
 *
 * Координаты проверены по картам. Трасса идёт с запада на восток:
 * Нур-Султан (51.18°N, 71.45°E) → Павлодар (52.29°N, 76.97°E)
 *
 * Реальные проблемные участки на этой трассе:
 * - Перегоны скота (жылқы, сиыр) на всём протяжении
 * - Слепящий туман/снег (нет освещения 95% трассы)
 * - Шұңқырлар (выбоины) после зимы
 * - Регулярные ДТП с участием грузовиков (трасса A-17 очень загружена)
 */

export interface MockIncident {
    id: number;
    incident_type: 'animal' | 'crash' | 'hazard';
    description: string;
    severity: number;
    latitude: number;
    longitude: number;
    is_active: boolean;
    ai_verified: boolean;
    ai_confidence: number;
    ai_analysis: string;
    confirmations_count: number;
    created_at: string;
    resolved_at: string | null;
}

export interface EcoPoint {
    id: number;
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    type: 'trash' | 'recycle' | 'hazardous';
}

// ── Инциденты на трассе Астана — Павлодар ─────────────────────────────
export const MOCK_INCIDENTS: MockIncident[] = [
    // === ВЫЕЗД ИЗ НУР-СУЛТАНА (71-72°E) ===
    {
        id: 1,
        incident_type: 'animal',
        description: 'Жылқы үйірі — трасса кеседі, шамамен 20 бас. Оң жақ жиек, жылдамдықты азайтыңыз!',
        severity: 5,
        latitude: 51.2850,
        longitude: 71.7200,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.97,
        ai_analysis: 'AI: Жылқы үйірі анықталды, ~20 бас. Жол бойында 300м аймақта. Тоқтамасаңыз, соқтығысу қаупі жоғары.',
        confirmations_count: 1,
        created_at: new Date(Date.now() - 8 * 60000).toISOString(),
        resolved_at: null,
    },
    {
        id: 2,
        incident_type: 'hazard',
        description: 'Үлкен шұңқыр — оң жол жолағы, км 47. Диаметрі ~1.2м, тереңдігі 20см',
        severity: 3,
        latitude: 51.3200,
        longitude: 71.9500,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.93,
        ai_analysis: 'AI: Жол зақымдануы расталды. Шұңқыр асфальт бетінде, қысқы мұздан пайда болды.',
        confirmations_count: 2,
        created_at: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
        resolved_at: null,
    },

    // === ЩУЧИНСК - СТЕПНОЙ (72-73°E) ===
    {
        id: 3,
        incident_type: 'animal',
        description: 'Сиырлар жол кеседі — 5 бас, баяу қозғалады. Жасыл шлагбаум жанында',
        severity: 4,
        latitude: 51.3900,
        longitude: 72.4800,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.94,
        ai_analysis: 'AI: Ірі қара мал анықталды. Кем дегенде 3 бас жолда тұр.',
        confirmations_count: 0,
        created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        resolved_at: null,
    },
    {
        id: 4,
        incident_type: 'crash',
        description: 'ЖКО — жүк автокөлік пен жеңіл авто. Сол жолаққа шыққан, абай болыңыз!',
        severity: 5,
        latitude: 51.4500,
        longitude: 72.8200,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.99,
        ai_analysis: 'AI: Ауыр жол-көлік оқиғасы. Жол бөлігі жабық болуы мүмкін. Полиция шақырылды.',
        confirmations_count: 3,
        created_at: new Date(Date.now() - 25 * 60000).toISOString(),
        resolved_at: null,
    },

    // === ОРТА БӨЛІК — ТАРАЗ - ЕКІБАСТҰЗ АЙМАҒЫ (73-75°E) ===
    {
        id: 5,
        incident_type: 'hazard',
        description: 'Жол жабылды — боран, көріну 50м-ден аз. Жол полициясы тоқтатты',
        severity: 5,
        latitude: 51.5800,
        longitude: 73.4500,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.98,
        ai_analysis: 'AI: Ауа-райы апаты. Метеорология қызметі: боран 4-6 сағатқа созылады.',
        confirmations_count: 5,
        created_at: new Date(Date.now() - 45 * 60000).toISOString(),
        resolved_at: null,
    },
    {
        id: 6,
        incident_type: 'animal',
        description: 'Түйе үйірі — 3 бас, жол ортасында. Кешке дейін сол жақта жайылым',
        severity: 4,
        latitude: 51.6400,
        longitude: 73.9200,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.95,
        ai_analysis: 'AI: Түйелер анықталды. Ірі жануарлар — баяу жылжиды, кенет бұрылуы мүмкін.',
        confirmations_count: 1,
        created_at: new Date(Date.now() - 6 * 60000).toISOString(),
        resolved_at: null,
    },
    {
        id: 7,
        incident_type: 'hazard',
        description: 'Мұзды жол — км 201-210 аралығы, жедел жылдамдықты азайтыңыз',
        severity: 4,
        latitude: 51.7200,
        longitude: 74.5500,
        is_active: true,
        ai_verified: false,
        ai_confidence: 0.0,
        ai_analysis: '',
        confirmations_count: 4,
        created_at: new Date(Date.now() - 90 * 60000).toISOString(),
        resolved_at: null,
    },

    // === ЕКІБАСТҰЗ АЙМАҒЫ (75-76°E) ===
    {
        id: 8,
        incident_type: 'animal',
        description: 'Киіктер тобы — трассаның сол жағы, 30-40 бас. A-17, км 265',
        severity: 5,
        latitude: 51.7800,
        longitude: 75.4000,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.96,
        ai_analysis: 'AI: Бонитет Сайга антилопасы тобы анықталды. Мигр. маршруты — күзде және көктемде белсенді. Жылдамдығы: 15-20 км/сағ, бағыты: батыс.',
        confirmations_count: 2,
        created_at: new Date(Date.now() - 3 * 60000).toISOString(),
        resolved_at: null,
    },
    {
        id: 9,
        incident_type: 'crash',
        description: 'Шешілді: екі жеңіл авто соқтығысуы, км 289. Жол тазарды',
        severity: 3,
        latitude: 51.8500,
        longitude: 75.9000,
        is_active: false,
        ai_verified: true,
        ai_confidence: 0.91,
        ai_analysis: 'AI: ЖКО расталды. 3 растаудан кейін белгі өшірілді.',
        confirmations_count: 3,
        created_at: new Date(Date.now() - 4 * 60 * 60000).toISOString(),
        resolved_at: new Date(Date.now() - 120 * 60000).toISOString(),
    },

    // === ЖАҚЫНДАМ ПАВЛОДАРҒА (76°E+) ===
    {
        id: 10,
        incident_type: 'hazard',
        description: 'Жол жөндеу жұмыстары — км 318-325, тек бір жолақ. Баяулатыңыз!',
        severity: 3,
        latitude: 52.0500,
        longitude: 76.3500,
        is_active: true,
        ai_verified: false,
        ai_confidence: 0.0,
        ai_analysis: '',
        confirmations_count: 6,
        created_at: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
        resolved_at: null,
    },
    {
        id: 11,
        incident_type: 'animal',
        description: 'Жылқылар — Ертіс алқабы, км 340. Жолда 2 бас, иесі шақырылды',
        severity: 3,
        latitude: 52.1800,
        longitude: 76.6800,
        is_active: true,
        ai_verified: true,
        ai_confidence: 0.88,
        ai_analysis: 'AI: Жылқылар анықталды. Иесі хабарлама алды. Алаңдамаңыз, баяу өтіңіз.',
        confirmations_count: 1,
        created_at: new Date(Date.now() - 22 * 60000).toISOString(),
        resolved_at: null,
    },
];

// ── Эко-нүктелер вдоль трасы Астана-Павлодар ─────────────────────────
export const ECO_POINTS: EcoPoint[] = [
    {
        id: 101,
        name: 'Демалыс алаңы №1 — км 52',
        description: 'Қоқыс контейнерлері, дәретхана, бензин бекеті жанында',
        latitude: 51.3050,
        longitude: 71.8900,
        type: 'trash',
    },
    {
        id: 102,
        name: 'Демалыс алаңы №2 — км 118',
        description: 'Қайта өңдеу пункті, пластик/шыны/қағаз',
        latitude: 51.4200,
        longitude: 72.6500,
        type: 'recycle',
    },
    {
        id: 103,
        name: 'Демалыс алаңы №3 — км 195',
        description: 'Отбасылық демалыс алаңы, ас үйі, дәретхана',
        latitude: 51.6000,
        longitude: 73.7000,
        type: 'trash',
    },
    {
        id: 104,
        name: 'Эко-нүкте Екібастұз — км 258',
        description: 'Қайта өңдеу орталығы, ірі бекет',
        latitude: 51.7500,
        longitude: 75.3200,
        type: 'recycle',
    },
    {
        id: 105,
        name: 'Демалыс алаңы №5 — км 310',
        description: 'Ауыл маңы, қоқыс шұңқыры, кафе жапсарлас',
        latitude: 52.0000,
        longitude: 76.2000,
        type: 'trash',
    },
];
