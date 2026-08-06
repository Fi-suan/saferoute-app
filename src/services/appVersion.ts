/**
 * appVersion.ts — какая именно сборка сейчас запущена.
 *
 * С включёнными OTA-обновлениями номера версии из app.config.js уже мало:
 * поверх одного и того же бинарника из Play может лежать любой из
 * опубликованных JS-бандлов. Без идентификатора обновления по жалобе
 * пользователя невозможно понять, что у него на самом деле установлено.
 *
 * expo-updates импортируется лениво: в Expo Go нативного модуля нет, и
 * обращение к нему на верхнем уровне уронило бы запуск.
 */
import { Config } from '../config';

interface UpdatesModule {
    updateId: string | null;
    channel: string | null;
    isEmbeddedLaunch: boolean;
}

function getUpdates(): UpdatesModule | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('expo-updates') as UpdatesModule;
    } catch {
        return null;
    }
}

/** Короткий идентификатор JS-бандла или null, если запущен встроенный. */
export function getUpdateId(): string | null {
    const Updates = getUpdates();
    if (!Updates || Updates.isEmbeddedLaunch || !Updates.updateId) return null;
    return Updates.updateId.slice(0, 8);
}

/** Канал доставки обновлений: production / preview. */
export function getUpdateChannel(): string | null {
    return getUpdates()?.channel ?? null;
}

/**
 * Строка для экрана профиля и обращений в поддержку.
 * Примеры: "1.0.0", "1.0.0 · production · a1b2c3d4".
 */
export function getBuildLabel(): string {
    const parts = [Config.VERSION];
    const channel = getUpdateChannel();
    if (channel) parts.push(channel);
    const updateId = getUpdateId();
    if (updateId) parts.push(updateId);
    return parts.join(' · ');
}
