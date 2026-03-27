/**
 * i18n hook — SafeRoute / Sapa Jol
 *
 * Usage:
 *   const t = useT();
 *   <Text>{t('road_open')}</Text>
 */
import { useSettings } from '../hooks/useSettings';
import translations, { Lang, TranslationKey } from './translations';

export function useT(): (key: TranslationKey) => string {
    const { settings } = useSettings();
    const lang: Lang = settings.language ?? 'kk';
    return (key: TranslationKey): string => {
        const dict = translations[lang] as Record<string, string>;
        return dict[key] ?? (translations.kk as Record<string, string>)[key] ?? key;
    };
}
