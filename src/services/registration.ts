/**
 * registration.ts — регистрация устройства на бэкенде и получение JWT.
 *
 * Единая точка входа для онбординга, старта приложения и push-регистрации:
 * роль маппится одинаково, а недоступный бэкенд не блокирует пользователя.
 *
 * Зачем ретраи: бэкенд крутится на Render free plan — сервис засыпает после
 * ~15 минут простоя, и холодный старт занимает до минуты. Без фоновых повторов
 * первый пользователь после простоя остался бы без токена, а значит без
 * возможности отправлять и подтверждать инциденты.
 */
import { registerDevice } from './api';
import { backendLogout, getAuthToken, storeAuthToken } from './auth';
import { getDeviceId } from './deviceId';
import type { UserRole } from '../constants/livestock';

/**
 * Бэкенд знает только 'driver' | 'owner' (app.models.Role).
 * Фронтовое 'livestock_owner' он молча трактует как driver — маппим явно.
 */
export function toBackendRole(role: UserRole | string | undefined): 'driver' | 'owner' {
    return role === 'livestock_owner' || role === 'owner' ? 'owner' : 'driver';
}

export interface RegistrationInput {
    role: UserRole | string;
    phone?: string;
    fcmToken?: string;
}

/**
 * Одна попытка регистрации. Бросает при сетевой ошибке.
 * @returns true — токен получен и сохранён в SecureStore.
 */
export async function registerNow(input: RegistrationInput): Promise<boolean> {
    const deviceId = await getDeviceId();
    const res = await registerDevice({
        device_id: deviceId,
        role: toBackendRole(input.role),
        phone_number: input.phone || undefined,
        fcm_token: input.fcmToken,
    });
    if (!res?.token) return false;
    await storeAuthToken(res.token);
    return true;
}

/** Задержки между повторами (мс). Последняя повторяется до успеха. */
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 300_000];

let _retryTimer: ReturnType<typeof setTimeout> | null = null;
let _retryRunning = false;
/**
 * Номер текущей серии повторов. Снятия таймера мало: попытка могла уже уйти
 * в сеть и ждать ответа, а логаут за это время сделал бы её результат чужим.
 * Сравнение номера до и после запроса отличает «нашу» попытку от устаревшей.
 */
let _retryGeneration = 0;

/** Останавливает фоновые повторы (вызывается при успехе и при логауте). */
export function stopRegistrationRetry(): void {
    if (_retryTimer) clearTimeout(_retryTimer);
    _retryTimer = null;
    _retryRunning = false;
    _retryGeneration += 1;
}

function scheduleRetry(input: RegistrationInput, attempt: number): void {
    const generation = _retryGeneration;
    const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
    _retryTimer = setTimeout(async () => {
        if (generation !== _retryGeneration) return;
        let registered = false;
        try {
            registered = await registerNow(input);
        } catch {
            /* бэкенд ещё не поднялся */
        }
        if (generation !== _retryGeneration) {
            // Логаут случился, пока запрос был в полёте. registerNow уже
            // сохранил токен — он относится к прошлой сессии, убираем.
            if (registered) await backendLogout();
            return;
        }
        if (registered) {
            stopRegistrationRetry();
            return;
        }
        scheduleRetry(input, attempt + 1);
    }, delay);
}

/**
 * Гарантирует наличие токена у устройства.
 *
 * Если токен уже есть — ничего не делает. Если бэкенд недоступен — уходит
 * в фоновые повторы и возвращает false, НЕ блокируя UI: репорты в это время
 * копятся в офлайн-очереди и уедут после успешной регистрации.
 */
export async function ensureRegistered(input: RegistrationInput): Promise<boolean> {
    const existing = await getAuthToken();
    if (existing) return true;

    try {
        if (await registerNow(input)) return true;
    } catch {
        /* бэкенд недоступен — уходим в ретраи */
    }

    if (!_retryRunning) {
        _retryRunning = true;
        scheduleRetry(input, 0);
    }
    return false;
}
