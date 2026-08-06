/**
 * photoQueue.ts — хранение фото неотправленных репортов.
 *
 * Раньше base64 фото лежал прямо в очереди в AsyncStorage. Бэкенд принимает до
 * ~2 000 000 символов base64 на репорт, то есть несколько застрявших репортов
 * давали в AsyncStorage мегабайты. Плохо это тем, что AsyncStorage на Android —
 * одна SQLite-таблица с ограничением на размер: очередь целиком читается и
 * пишется как один JSON на каждое обращение, а при переполнении теряется вся,
 * вместе с репортами без фото.
 *
 * Теперь base64 пишется в отдельный файл, а в очереди остаётся только имя.
 *
 * Имя, а не полный URI: на iOS путь к каталогу приложения меняется между
 * установками и обновлениями, поэтому сохранённый абсолютный путь протухает.
 * Каталог вычисляется заново при каждом обращении.
 */
import { Directory, File, Paths } from 'expo-file-system';

/** Не cache: оттуда система вправе всё удалить, а очередь должна пережить это. */
const QUEUE_DIR_NAME = 'report-queue';

function queueDir(): Directory {
    const dir = new Directory(Paths.document, QUEUE_DIR_NAME);
    if (!dir.exists) {
        dir.create({ intermediates: true });
    }
    return dir;
}

function fileFor(name: string): File {
    return new File(queueDir(), name);
}

/**
 * Сохраняет base64 в файл очереди.
 * @returns имя файла или null, если записать не удалось (тогда вызывающий код
 *          оставляет base64 в очереди, как раньше — репорт важнее экономии).
 */
export async function savePhoto(localId: number, base64: string): Promise<string | null> {
    try {
        const name = `${Math.abs(localId)}.b64`;
        fileFor(name).write(base64);
        return name;
    } catch (e) {
        console.warn('[photoQueue] не удалось сохранить фото:', e);
        return null;
    }
}

/** Читает base64 обратно. null, если файла нет — репорт уйдёт без фото. */
export async function readPhoto(name: string): Promise<string | null> {
    try {
        const file = fileFor(name);
        if (!file.exists) return null;
        return await file.text();
    } catch (e) {
        console.warn('[photoQueue] не удалось прочитать фото:', e);
        return null;
    }
}

/**
 * Удаляет файлы, на которые больше никто не ссылается.
 *
 * Нужно потому, что очередь и файлы — два разных хранилища: сбой между записью
 * файла и сохранением очереди оставил бы файл висеть навсегда.
 */
export function cleanupOrphans(keepNames: string[]): void {
    try {
        const keep = new Set(keepNames);
        for (const entry of queueDir().list()) {
            if (entry instanceof File && !keep.has(entry.name)) {
                entry.delete();
            }
        }
    } catch (e) {
        console.warn('[photoQueue] не удалось убрать осиротевшие фото:', e);
    }
}
