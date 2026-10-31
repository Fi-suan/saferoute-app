/**
 * OnboardingScreen — Sapa Jol / SafeRoute
 *
 * Two phases:
 *  1) INTRO — horizontal paging carousel (4 info slides, original circle
 *     illustration design) with dots + next/skip.
 *  2) AUTH  — full-screen register/login page with a pinned bottom action
 *     bar. Never embedded in the horizontal carousel: that's what squeezed
 *     the form and pushed the action button off screen.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../constants/colors';
import type { UserRole } from '../constants/livestock';
import OnboardingIllustration from '../components/OnboardingIllustration';
import { registerDevice, loginWithPhone, hashPassword } from '../services/api';
import { getDeviceId } from '../services/deviceId';

const { width } = Dimensions.get('window');

export interface OnboardingResult {
    name: string;
    phone: string;
    role: UserRole;
}

const KZ_PHONE_RE = /^(\+7|8)\d{10}$/;
const isValidPhone = (p: string) => KZ_PHONE_RE.test(p.replace(/\s/g, ''));

/** Канонический формат +7XXXXXXXXXX — единая «соль» пароля при регистрации
 *  и входе. Раньше телефон солился «как введено»: пробелы/формат ломали вход. */
export function normalizePhone(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    const tail = digits.length >= 10 ? digits.slice(-10) : digits;
    return `+7${tail}`;
}

type Lang = 'kk' | 'ru';
type AuthMode = 'register' | 'login';

// ── Intro slides ───────────────────────────────────────────────────────────────
type IllustType = 'shield' | 'marker' | 'bell' | 'community';

interface Slide {
    illust: IllustType;
    title: string;
    subtitle: string;
    desc: string;
    accent: string;
}

const SLIDES_KK: Slide[] = [
    {
        illust: 'shield',
        title: 'Sapa Jol',
        subtitle: 'Жол қауіпсіздігі жүйесі',
        desc: 'Қазақстан жолдарындағы жануарлар мен жүргізушілерді қорғайды.',
        accent: Colors.brand.primary,
    },
    {
        illust: 'marker',
        title: 'Белгі қою',
        subtitle: 'Нақты уақыттағы карта',
        desc: 'Жүргізушілер жолдағы малдарды, шұңқырларды белгілейді. AI фотоны тексереді.',
        accent: Colors.alert.medium,
    },
    {
        illust: 'bell',
        title: 'Ақылды ескерту',
        subtitle: '2 км радиуста',
        desc: 'Қауіпті аймаққа жақындасаңыз — қосымша алдын ала ескертеді.',
        accent: Colors.alert.high,
    },
    {
        illust: 'community',
        title: 'Бірге қауіпсіз',
        subtitle: 'Ұжымдық мониторинг',
        desc: 'Белгіні растаңыз. 3 растаудан кейін белгі автоматты жойылады.',
        accent: Colors.alert.info,
    },
];
const SLIDES_RU: Slide[] = [
    {
        illust: 'shield',
        title: 'Sapa Jol',
        subtitle: 'Система безопасности дорог',
        desc: 'Защищает животных и водителей на дорогах Казахстана.',
        accent: Colors.brand.primary,
    },
    {
        illust: 'marker',
        title: 'Метки',
        subtitle: 'Карта в реальном времени',
        desc: 'Водители отмечают животных, скот, ямы. AI проверяет каждое фото.',
        accent: Colors.alert.medium,
    },
    {
        illust: 'bell',
        title: 'Оповещения',
        subtitle: 'В радиусе 2 км',
        desc: 'При приближении к опасной зоне приложение предупредит заранее.',
        accent: Colors.alert.high,
    },
    {
        illust: 'community',
        title: 'Вместе безопаснее',
        subtitle: 'Коллективный мониторинг',
        desc: 'Подтвердите метку. После 3 подтверждений метка удаляется.',
        accent: Colors.alert.info,
    },
];

const L = {
    kk: {
        next: 'Келесі',
        back: 'Артқа',
        skip: 'Өткізу',
        langToggle: 'RU',
        modeRegister: 'Тіркелу',
        modeLogin: 'Кіру',
        nameLabel: 'АТЫ-ЖӨНІ',
        nameErr: 'Мин. 2 таңба',
        namePh: 'Айбек',
        phoneLabel: 'ТЕЛЕФОН',
        phoneErr: 'Формат: +7XXXXXXXXXX',
        phonePh: '+7 700 000 0000',
        passwordLabel: 'ҚҰПИЯСӨЗ',
        passwordErr: 'Мин. 4 таңба',
        passwordPh: 'Мин. 4 таңба',
        roleLabel: 'РӨЛІҢІЗДІ ТАҢДАҢЫЗ',
        roleErr: 'Рөл таңдаңыз',
        driver: 'Жүргізуші',
        driverDesc: 'Жол ескертулерін алады',
        owner: 'Мал иесі',
        ownerDesc: 'Малды тіркеу және қорғау',
        loginHint: 'Бұрын тіркелген телефон номеріңіз бен құпиясөзіңізді енгізіңіз',
        loginWrong: 'Телефон немесе құпиясөз қате',
        networkErr: 'Интернет байланысын тексеріңіз және қайта байқап көріңіз',
        start: 'Бастау',
        loginBtn: 'Кіру',
    },
    ru: {
        next: 'Далее',
        back: 'Назад',
        skip: 'Пропустить',
        langToggle: 'ҚАЗ',
        modeRegister: 'Регистрация',
        modeLogin: 'Вход',
        nameLabel: 'ИМЯ',
        nameErr: 'Мин. 2 символа',
        namePh: 'Айбек',
        phoneLabel: 'ТЕЛЕФОН',
        phoneErr: 'Формат: +7XXXXXXXXXX',
        phonePh: '+7 700 000 0000',
        passwordLabel: 'ПАРОЛЬ',
        passwordErr: 'Мин. 4 символа',
        passwordPh: 'Мин. 4 символа',
        roleLabel: 'ВЫБЕРИТЕ РОЛЬ',
        roleErr: 'Выберите роль',
        driver: 'Водитель',
        driverDesc: 'Получает дорожные предупреждения',
        owner: 'Владелец скота',
        ownerDesc: 'Регистрация и защита скота',
        loginHint: 'Введите телефон и пароль, указанные при регистрации',
        loginWrong: 'Неверный телефон или пароль',
        networkErr: 'Проверьте интернет и попробуйте ещё раз',
        start: 'Начать',
        loginBtn: 'Войти',
    },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingScreen({
    onFinish,
}: {
    onFinish: (d: OnboardingResult) => void;
}) {
    const [lang, setLang] = useState<Lang>('kk');
    const [phase, setPhase] = useState<'intro' | 'auth'>('intro');
    const [slideIdx, setSlideIdx] = useState(0);

    // Auth state
    const [mode, setMode] = useState<AuthMode>('register');
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const slides = lang === 'kk' ? SLIDES_KK : SLIDES_RU;
    const ui = L[lang];
    // RN 0.88: тип рефа — инстанс компонента, не сам компонент
    const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);

    const clear = (k: string) => setErrors((e) => ({ ...e, [k]: '' }));

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / width);
        if (idx !== slideIdx && idx >= 0 && idx < slides.length) {
            setSlideIdx(idx);
        }
    };

    const goToSlide = (idx: number) => {
        scrollRef.current?.scrollTo({ x: idx * width, animated: true });
        setSlideIdx(idx);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // ── Submit ────────────────────────────────────────────────
    const handleAuth = useCallback(async () => {
        const e: Record<string, string> = {};
        if (!isValidPhone(phone)) e.phone = ui.phoneErr;
        if (password.length < 4) e.password = ui.passwordErr;
        if (mode === 'register') {
            if (name.trim().length < 2) e.name = ui.nameErr;
            if (!role) e.role = ui.roleErr;
        }
        if (Object.keys(e).length > 0) {
            setErrors(e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const deviceId = await getDeviceId();

            if (mode === 'login') {
                const res = await loginWithPhone(phone, password);
                if ('network' in res) {
                    // Сеть/сервер: НЕ «неверный пароль» — честное сообщение
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    setErrors({ submit: ui.networkErr });
                    return;
                }
                if (!('account' in res)) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    setErrors({ login: ui.loginWrong });
                    return;
                }
                const account = res.account;
                await registerDevice({
                    device_id: deviceId,
                    role: account.role === 'livestock_owner' ? 'owner' : 'driver',
                    name: account.name,
                    phone_number: account.phone,
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onFinish({
                    name: account.name,
                    phone: account.phone,
                    role: account.role as UserRole,
                });
                return;
            }

            // Регистрация: телефон нормализуем — соль пароля каноническая.
            // Проверяем результат: при сбое НЕ пускаем внутрь — иначе «аккаунт-призрак»
            // и вечный «неверный пароль» при следующем входе.
            const profile = { name: name.trim(), phone: normalizePhone(phone), role: role! };
            const res = await registerDevice({
                device_id: deviceId,
                role: role === 'livestock_owner' ? 'owner' : 'driver',
                name: profile.name,
                phone_number: profile.phone,
                password_hash: await hashPassword(profile.phone, password),
            });
            if (!res?.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setErrors({ submit: ui.networkErr });
                return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onFinish(profile);
        } catch {
            // Сырой err.message (английский «Error»/текст Supabase) пользователю
            // не показываем — честное сообщение о сети/сервере
            setErrors({ submit: ui.networkErr });
        } finally {
            setLoading(false);
        }
    }, [mode, name, phone, password, role, lang, onFinish]);

    const switchMode = (m: AuthMode) => {
        Haptics.selectionAsync();
        setMode(m);
        setErrors({});
    };

    return (
        <SafeAreaView style={styles.root}>
            {/* Language toggle */}
            <TouchableOpacity
                style={styles.langBtn}
                onPress={() => {
                    Haptics.selectionAsync();
                    setLang((l) => (l === 'kk' ? 'ru' : 'kk'));
                }}
            >
                <Text style={styles.langBtnText}>{ui.langToggle}</Text>
            </TouchableOpacity>

            {phase === 'intro' ? (
                <>
                    <ScrollView
                        ref={scrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onMomentumScrollEnd={handleScroll}
                        style={{ flex: 1 }}
                    >
                        {slides.map((slide, i) => (
                            <View key={i} style={[styles.slide, { width }]}>
                                <View
                                    style={[
                                        styles.illustWrap,
                                        { borderColor: slide.accent + '30' },
                                    ]}
                                >
                                    <OnboardingIllustration
                                        type={slide.illust}
                                        size={100}
                                        color={slide.accent}
                                    />
                                </View>
                                <Text style={[styles.slideTitle, { color: slide.accent }]}>
                                    {slide.title}
                                </Text>
                                <Text style={styles.slideSubtitle}>
                                    {slide.subtitle.toUpperCase()}
                                </Text>
                                <Text style={styles.slideDesc}>{slide.desc}</Text>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Dots */}
                    <View style={styles.dots}>
                        {slides.map((s, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    i === slideIdx && styles.dotActive,
                                    { backgroundColor: i === slideIdx ? s.accent : Colors.border },
                                ]}
                            />
                        ))}
                    </View>
                </>
            ) : (
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.authContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Mode switch */}
                        <View style={styles.segRow}>
                            <TouchableOpacity
                                style={[styles.segBtn, mode === 'register' && styles.segBtnActive]}
                                onPress={() => switchMode('register')}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.segBtnText,
                                        mode === 'register' && styles.segBtnTextActive,
                                    ]}
                                >
                                    {ui.modeRegister}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.segBtn, mode === 'login' && styles.segBtnActive]}
                                onPress={() => switchMode('login')}
                                activeOpacity={0.8}
                            >
                                <Text
                                    style={[
                                        styles.segBtnText,
                                        mode === 'login' && styles.segBtnTextActive,
                                    ]}
                                >
                                    {ui.modeLogin}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {mode === 'login' && <Text style={styles.loginHint}>{ui.loginHint}</Text>}

                        {mode === 'register' && (
                            <Field
                                label={ui.nameLabel}
                                value={name}
                                onChange={(v) => {
                                    setName(v);
                                    clear('name');
                                }}
                                error={errors.name}
                                autoCapitalize="words"
                                placeholder={ui.namePh}
                                icon="person-outline"
                            />
                        )}
                        <Field
                            label={ui.phoneLabel}
                            value={phone}
                            onChange={(v) => {
                                setPhone(v);
                                clear('phone');
                            }}
                            placeholder={ui.phonePh}
                            keyboardType="phone-pad"
                            error={errors.phone}
                            icon="call-outline"
                        />
                        <Field
                            label={ui.passwordLabel}
                            value={password}
                            onChange={(v) => {
                                // обрезаем пробелы на лету — иначе хэш не совпадёт при входе
                                setPassword(v.trim());
                                clear('password');
                            }}
                            placeholder={ui.passwordPh}
                            error={errors.password}
                            secureTextEntry
                            icon="lock-closed-outline"
                        />

                        {mode === 'register' && (
                            <>
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        errors.role ? { color: Colors.alert.critical } : null,
                                    ]}
                                >
                                    {ui.roleLabel}
                                </Text>
                                {errors.role && (
                                    <Text style={styles.fieldError}>{errors.role}</Text>
                                )}
                                <RoleCard
                                    icon="car-sport-outline"
                                    title={ui.driver}
                                    desc={ui.driverDesc}
                                    selected={role === 'driver'}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setRole('driver');
                                        clear('role');
                                    }}
                                />
                                <RoleCard
                                    icon="paw-outline"
                                    title={ui.owner}
                                    desc={ui.ownerDesc}
                                    selected={role === 'livestock_owner'}
                                    onPress={() => {
                                        Haptics.selectionAsync();
                                        setRole('livestock_owner');
                                        clear('role');
                                    }}
                                />
                            </>
                        )}

                        {!!errors.login && <Text style={styles.formError}>{errors.login}</Text>}
                        {!!errors.submit && <Text style={styles.formError}>{errors.submit}</Text>}
                    </ScrollView>

                    {/* Pinned action bar — always on screen, keyboard-safe */}
                    <View style={styles.actionBar}>
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => {
                                setPhase('intro');
                                setErrors({});
                            }}
                        >
                            <Ionicons name="chevron-back" size={18} color={Colors.text.secondary} />
                            <Text style={styles.backBtnText}>{ui.back}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                            onPress={handleAuth}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.bg.primary} />
                            ) : (
                                <Text style={styles.primaryBtnText}>
                                    {mode === 'login' ? ui.loginBtn : ui.start}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}

            {/* Bottom nav for intro phase */}
            {phase === 'intro' && (
                <View style={styles.actionBar}>
                    {slideIdx > 0 ? (
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => goToSlide(slideIdx - 1)}
                        >
                            <Ionicons name="chevron-back" size={18} color={Colors.text.secondary} />
                            <Text style={styles.backBtnText}>{ui.back}</Text>
                        </TouchableOpacity>
                    ) : (
                        <View />
                    )}
                    {slideIdx < slides.length - 1 ? (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => goToSlide(slideIdx + 1)}
                        >
                            <Text style={styles.primaryBtnText}>{ui.next}</Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.bg.primary} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setPhase('auth');
                            }}
                        >
                            <Text style={styles.primaryBtnText}>{ui.modeRegister}</Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.bg.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}
            {phase === 'intro' && (
                <TouchableOpacity style={styles.skipBtn} onPress={() => setPhase('auth')}>
                    <Text style={styles.skipText}>{ui.skip}</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function RoleCard({
    icon,
    title,
    desc,
    selected,
    onPress,
}: {
    icon: string;
    title: string;
    desc: string;
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.roleCard, selected && styles.roleCardActive]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.roleIconBox, selected && styles.roleIconBoxActive]}>
                <Ionicons
                    name={icon as any}
                    size={24}
                    color={selected ? Colors.bg.primary : Colors.brand.primary}
                />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.roleTitle, selected && { color: Colors.bg.primary }]}>
                    {title}
                </Text>
                <Text style={[styles.roleDesc, selected && { color: 'rgba(0,0,0,0.55)' }]}>
                    {desc}
                </Text>
            </View>
            <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                {selected && <View style={styles.radioInner} />}
            </View>
        </TouchableOpacity>
    );
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    error,
    keyboardType,
    secureTextEntry,
    autoCapitalize,
    icon,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    error?: string;
    keyboardType?: any;
    secureTextEntry?: boolean;
    autoCapitalize?: 'none' | 'words' | 'sentences';
    icon?: string;
}) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={[styles.inputRow, error && styles.inputError]}>
                {icon && (
                    <View style={styles.inputIconBox}>
                        <Ionicons name={icon as any} size={18} color={Colors.brand.primary} />
                    </View>
                )}
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.text.muted}
                    keyboardType={keyboardType}
                    secureTextEntry={secureTextEntry}
                    autoCapitalize={autoCapitalize ?? 'none'}
                    autoCorrect={false}
                />
            </View>
            {!!error && <Text style={styles.fieldError}>{error}</Text>}
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.primary },

    langBtn: {
        position: 'absolute',
        top: 52,
        right: Spacing.lg,
        zIndex: 20,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.bg.glass,
    },
    langBtnText: {
        color: Colors.text.secondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },

    // ── Intro slides ──
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    illustWrap: {
        width: 140,
        height: 140,
        borderRadius: 70,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: Spacing.xl,
        backgroundColor: Colors.bg.glass,
    },
    slideTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
        textAlign: 'center',
        marginBottom: 8,
    },
    slideSubtitle: {
        fontSize: 14,
        color: Colors.text.secondary,
        textAlign: 'center',
        letterSpacing: 1.5,
        marginBottom: Spacing.md,
    },
    slideDesc: {
        fontSize: 15,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 300,
    },

    dots: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: Spacing.sm,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    dotActive: { width: 22 },

    // ── Auth (full-screen) ──
    authContent: {
        paddingHorizontal: Spacing.lg,
        paddingTop: 84,
        paddingBottom: Spacing.xl,
    },
    segRow: {
        flexDirection: 'row',
        backgroundColor: Colors.bg.tertiary,
        borderRadius: Radius.lg,
        padding: 4,
        marginBottom: Spacing.lg,
    },
    segBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: Radius.md,
    },
    segBtnActive: { backgroundColor: Colors.brand.primary },
    segBtnText: { color: Colors.text.secondary, fontWeight: '700', fontSize: 14 },
    segBtnTextActive: { color: Colors.bg.primary },
    loginHint: {
        fontSize: 13,
        color: Colors.text.secondary,
        lineHeight: 19,
        marginBottom: Spacing.md,
    },
    fieldGroup: { marginBottom: Spacing.md },
    fieldLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.text.muted,
        letterSpacing: 1.5,
        marginBottom: 7,
        textTransform: 'uppercase',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.bg.tertiary,
        borderRadius: Radius.lg,
        paddingLeft: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    inputIconBox: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
    input: {
        flex: 1,
        paddingVertical: 14,
        paddingRight: Spacing.md,
        color: Colors.text.primary,
        fontSize: 15,
    },
    inputError: { borderColor: Colors.alert.critical },
    fieldError: { color: Colors.alert.critical, fontSize: 11, marginTop: 4 },
    formError: {
        color: Colors.alert.critical,
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: Spacing.sm,
    },

    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        gap: Spacing.md,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: Colors.border,
        marginBottom: Spacing.sm,
        marginTop: 8,
    },
    roleCardActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    roleIconBox: {
        width: 46,
        height: 46,
        borderRadius: Radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.brand.primary + '18',
        borderWidth: 1,
        borderColor: Colors.brand.primary + '40',
    },
    roleIconBoxActive: { backgroundColor: 'rgba(0,0,0,0.15)', borderColor: 'rgba(0,0,0,0.2)' },
    roleTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
    roleDesc: { fontSize: 12, color: Colors.text.secondary },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterActive: { borderColor: Colors.bg.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.bg.primary },

    // ── Pinned action bar ──
    actionBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        paddingTop: Spacing.sm,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 16,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.bg.glass,
    },
    backBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },
    primaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 16,
        borderRadius: Radius.lg,
        backgroundColor: Colors.brand.primary,
    },
    primaryBtnText: { color: Colors.bg.primary, fontWeight: '900', fontSize: 16 },
    skipBtn: { alignItems: 'center', paddingVertical: Spacing.md },
    skipText: { color: Colors.text.muted, fontSize: 13 },
});
