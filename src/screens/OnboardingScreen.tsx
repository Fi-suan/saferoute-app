/**
 * OnboardingScreen — Sapa Jol / SafeRoute
 *
 * Design: dark "road safety" aesthetic — strict typographic hierarchy
 * (Swiss-inspired), road-marking dash motifs, one green functional accent.
 * 4 info slides + 1 auth slide with two modes: register (Тіркелу) and
 * login by phone (Кіру) for already-registered accounts.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
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
function isValidPhone(p: string) {
    return KZ_PHONE_RE.test(p.replace(/\s/g, ''));
}

// ── Slide data ────────────────────────────────────────────────────────────────
type IllustType = 'shield' | 'marker' | 'bell' | 'community' | 'profile';

interface Slide {
    illust: IllustType;
    title: string;
    subtitle: string;
    desc: string;
    accent: string;
    isReg?: true;
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
    {
        illust: 'profile',
        title: 'Тіркелу',
        subtitle: '',
        desc: '',
        accent: Colors.brand.primary,
        isReg: true,
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
    {
        illust: 'profile',
        title: 'Регистрация',
        subtitle: '',
        desc: '',
        accent: Colors.brand.primary,
        isReg: true,
    },
];

type Lang = 'kk' | 'ru';
type AuthMode = 'register' | 'login';

const L = {
    kk: {
        nameLabel: 'АТЫ-ЖӨНІ',
        nameErr: 'Мин. 2 таңба',
        namePh: 'Айбек',
        phoneLabel: 'ТЕЛЕФОН',
        phonePh: '+7 700 000 0000',
        phoneErr: 'Формат: +7XXXXXXXXXX',
        passwordLabel: 'ҚҰПИЯСӨЗ',
        passwordPh: 'Мин. 4 таңба',
        passwordErr: 'Мин. 4 таңба',
        roleLabel: 'РӨЛІҢІЗДІ ТАҢДАҢЫЗ',
        roleErr: 'Рөл таңдаңыз',
        driver: 'Жүргізуші',
        driverDesc: 'Жол ескертулерін алады',
        owner: 'Мал иесі',
        ownerDesc: 'Малды тіркеу және қорғау',
        next: 'Келесі',
        back: 'Артқа',
        start: 'Бастау',
        skip: 'Өткізу',
        langToggle: 'RU',
        modeRegister: 'Тіркелу',
        modeLogin: 'Кіру',
        loginHint: 'Бұрын тіркелген телефон номеріңізді енгізіңіз',
        loginNotFound: 'Осы номермен аккаунт табылмады',
        loginWrongPassword: 'Құпиясөз қате',
        loginBtn: 'Кіру',
    },
    ru: {
        nameLabel: 'ИМЯ',
        nameErr: 'Мин. 2 символа',
        namePh: 'Айбек',
        phoneLabel: 'ТЕЛЕФОН',
        phonePh: '+7 700 000 0000',
        phoneErr: 'Формат: +7XXXXXXXXXX',
        passwordLabel: 'ПАРОЛЬ',
        passwordPh: 'Мин. 4 символа',
        passwordErr: 'Мин. 4 символа',
        roleLabel: 'ВЫБЕРИТЕ РОЛЬ',
        roleErr: 'Выберите роль',
        driver: 'Водитель',
        driverDesc: 'Получает дорожные предупреждения',
        owner: 'Владелец скота',
        ownerDesc: 'Регистрация и защита скота',
        next: 'Далее',
        back: 'Назад',
        start: 'Начать',
        skip: 'Пропустить',
        langToggle: 'ҚАЗ',
        modeRegister: 'Регистрация',
        modeLogin: 'Вход',
        loginHint: 'Введите номер, указанный при регистрации',
        loginNotFound: 'Аккаунт с этим номером не найден',
        loginWrongPassword: 'Неверный пароль',
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
    const [slideIdx, setSlideIdx] = useState(0);
    const [authMode, setAuthMode] = useState<AuthMode>('register');
    const [loading, setLoading] = useState(false);

    // Registration fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole | null>(null);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const scrollRef = useRef<ScrollView>(null);
    const dotAnims = useRef(SLIDES_KK.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

    const slides = lang === 'kk' ? SLIDES_KK : SLIDES_RU;
    const ui = L[lang];

    const animateDots = (idx: number) => {
        dotAnims.forEach((a, i) =>
            Animated.timing(a, {
                toValue: i === idx ? 1 : 0,
                duration: 250,
                useNativeDriver: false,
            }).start(),
        );
    };

    const goToSlide = (idx: number) => {
        scrollRef.current?.scrollTo({ x: idx * width, animated: true });
        animateDots(idx);
        setSlideIdx(idx);
        setErrors({});
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // Handle manual swipe
    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const newIdx = Math.round(e.nativeEvent.contentOffset.x / width);
        if (newIdx !== slideIdx && newIdx >= 0 && newIdx < slides.length) {
            animateDots(newIdx);
            setSlideIdx(newIdx);
            setErrors({});
        }
    };

    // ── Validate registration ────────────────────────────────
    const validateReg = (): boolean => {
        const e: Record<string, string> = {};
        if (name.trim().length < 2) e.name = ui.nameErr;
        if (!isValidPhone(phone)) e.phone = ui.phoneErr;
        if (password.length < 4) e.password = ui.passwordErr;
        if (!role) e.role = ui.roleErr;
        setErrors(e);
        if (Object.keys(e).length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return Object.keys(e).length === 0;
    };

    // ── Register a new account ────────────────────────────────
    const handleRegister = useCallback(async () => {
        if (!validateReg()) return;
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const profile = {
                name: name.trim(),
                phone: phone.trim(),
                role: role!,
            };
            const deviceId = await getDeviceId();
            await registerDevice({
                device_id: deviceId,
                role: role === 'livestock_owner' ? 'owner' : 'driver',
                name: profile.name,
                phone_number: profile.phone,
                password_hash: await hashPassword(profile.phone, password),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onFinish(profile);
        } catch (err: any) {
            setErrors({ submit: err?.message ?? 'Error' });
        } finally {
            setLoading(false);
        }
    }, [name, phone, password, role, lang, onFinish]);

    // ── Sign in to an existing account ─────────────────────────
    const handleLogin = useCallback(async () => {
        const e: Record<string, string> = {};
        if (!isValidPhone(phone)) e.phone = ui.phoneErr;
        if (password.length < 4) e.password = ui.passwordErr;
        setErrors(e);
        if (Object.keys(e).length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const account = await loginWithPhone(phone, password);
            if (!account) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setErrors({ login: ui.loginWrongPassword });
                return;
            }
            // Keep this device in sync with the account role
            const deviceId = await getDeviceId();
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
        } catch (err: any) {
            setErrors({ submit: err?.message ?? 'Error' });
        } finally {
            setLoading(false);
        }
    }, [phone, password, lang, onFinish]);

    const handleNext = () => {
        if (slideIdx < slides.length - 1) goToSlide(slideIdx + 1);
        else if (authMode === 'login') handleLogin();
        else handleRegister();
    };

    const currentSlide = slides[slideIdx];

    return (
        <SafeAreaView style={styles.root}>
            {/* Road-marking motif top */}
            <RoadDashes />

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

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled
                    onMomentumScrollEnd={handleScroll}
                    style={{ flex: 1 }}
                >
                    {slides.map((s, i) => (
                        <View key={i} style={[styles.slide, { width }]}>
                            {s.isReg ? (
                                <AuthForm
                                    ui={ui}
                                    mode={authMode}
                                    setMode={(m) => {
                                        Haptics.selectionAsync();
                                        setAuthMode(m);
                                        setErrors({});
                                    }}
                                    name={name}
                                    setName={setName}
                                    phone={phone}
                                    setPhone={setPhone}
                                    password={password}
                                    setPassword={setPassword}
                                    role={role}
                                    setRole={setRole}
                                    errors={errors}
                                    setErrors={setErrors}
                                    accent={s.accent}
                                    loading={loading}
                                />
                            ) : (
                                <InfoSlide slide={s} index={i} total={slides.length} />
                            )}
                        </View>
                    ))}
                </ScrollView>

                {/* Dots */}
                <View style={styles.dots}>
                    {slides.map((s, i) => {
                        const w = dotAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [6, 24],
                        });
                        const op = dotAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.25, 1],
                        });
                        return (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.dot,
                                    { width: w, opacity: op, backgroundColor: s.accent },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Nav buttons */}
                <View style={styles.navRow}>
                    {slideIdx > 0 && (
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => goToSlide(slideIdx - 1)}
                        >
                            <Ionicons name="chevron-back" size={18} color={Colors.text.secondary} />
                            <Text style={styles.backBtnText}>{ui.back}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[
                            styles.nextBtn,
                            { backgroundColor: currentSlide.accent },
                            slideIdx > 0 && { flex: 1 },
                            slideIdx === 0 && { width: '100%' },
                            loading && { opacity: 0.6 },
                        ]}
                        onPress={handleNext}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={Colors.bg.primary} />
                        ) : (
                            <>
                                <Text style={styles.nextBtnText}>
                                    {slideIdx === slides.length - 1
                                        ? authMode === 'login'
                                            ? ui.loginBtn
                                            : ui.start
                                        : ui.next}
                                </Text>
                                {slideIdx < slides.length - 1 && (
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={Colors.bg.primary}
                                    />
                                )}
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Skip to auth */}
                {slideIdx < slides.length - 1 && (
                    <TouchableOpacity
                        style={styles.skipBtn}
                        onPress={() => goToSlide(slides.length - 1)}
                    >
                        <Text style={styles.skipText}>{ui.skip}</Text>
                    </TouchableOpacity>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Road-marking motif: centered row of dashes (decorative, subtle) */
function RoadDashes() {
    return (
        <View style={styles.roadDashes} pointerEvents="none">
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.roadDash, i === 2 && { opacity: 0.5 }]} />
            ))}
        </View>
    );
}

function InfoSlide({ slide, index, total }: { slide: Slide; index: number; total: number }) {
    return (
        <View style={styles.infoSlide}>
            {/* Slide index — Swiss-style metadata */}
            <Text style={styles.slideIndex}>
                {String(index + 1).padStart(2, '0')}
                <Text style={styles.slideIndexTotal}> / {String(total).padStart(2, '0')}</Text>
            </Text>

            <View style={[styles.illustTile, { shadowColor: slide.accent }]}>
                <OnboardingIllustration type={slide.illust} size={110} color={slide.accent} />
            </View>

            <Text style={[styles.slideTitle, { color: slide.accent }]}>{slide.title}</Text>
            <Text style={[styles.slideSubtitle, { color: Colors.text.primary }]}>
                {slide.subtitle.toUpperCase()}
            </Text>

            {/* Road-marking divider under the subtitle */}
            <View style={styles.roadDashes}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <View
                        key={i}
                        style={[styles.roadDash, { backgroundColor: slide.accent, opacity: 0.35 }]}
                    />
                ))}
            </View>

            <Text style={styles.slideDesc}>{slide.desc}</Text>
        </View>
    );
}

interface AuthFormProps {
    ui: (typeof L)['kk'];
    mode: AuthMode;
    setMode: (m: AuthMode) => void;
    name: string;
    setName: (v: string) => void;
    phone: string;
    setPhone: (v: string) => void;
    password: string;
    setPassword: (v: string) => void;
    role: UserRole | null;
    setRole: (r: UserRole) => void;
    errors: Record<string, string>;
    setErrors: (e: Record<string, string>) => void;
    accent: string;
    loading: boolean;
}

function AuthForm({
    ui,
    mode,
    setMode,
    name,
    setName,
    phone,
    setPhone,
    password,
    setPassword,
    role,
    setRole,
    errors,
    setErrors,
    accent,
}: AuthFormProps) {
    const clear = (k: string) => setErrors({ ...errors, [k]: '' });
    return (
        <ScrollView
            contentContainerStyle={styles.regContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            <Text style={[styles.authTitle]}>
                {mode === 'login' ? ui.modeLogin : ui.modeRegister}
            </Text>

            {/* Mode switcher */}
            <View style={styles.segRow}>
                <TouchableOpacity
                    style={[styles.segBtn, mode === 'register' && styles.segBtnActive]}
                    onPress={() => setMode('register')}
                    activeOpacity={0.8}
                >
                    <Text
                        style={[styles.segBtnText, mode === 'register' && styles.segBtnTextActive]}
                    >
                        {ui.modeRegister}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segBtn, mode === 'login' && styles.segBtnActive]}
                    onPress={() => setMode('login')}
                    activeOpacity={0.8}
                >
                    <Text style={[styles.segBtnText, mode === 'login' && styles.segBtnTextActive]}>
                        {ui.modeLogin}
                    </Text>
                </TouchableOpacity>
            </View>

            {mode === 'login' ? (
                <>
                    <Text style={styles.loginHint}>{ui.loginHint}</Text>
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
                            setPassword(v);
                            clear('password');
                        }}
                        placeholder={ui.passwordPh}
                        error={errors.password}
                        secureTextEntry
                        icon="lock-closed-outline"
                    />
                    {!!errors.login && <Text style={styles.formError}>{errors.login}</Text>}
                </>
            ) : (
                <>
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
                            setPassword(v);
                            clear('password');
                        }}
                        placeholder={ui.passwordPh}
                        error={errors.password}
                        secureTextEntry
                        icon="lock-closed-outline"
                    />

                    {/* Role */}
                    <Text
                        style={[
                            styles.fieldLabel,
                            errors.role ? { color: Colors.alert.critical } : null,
                        ]}
                    >
                        {ui.roleLabel}
                    </Text>
                    {errors.role && <Text style={styles.fieldError}>{errors.role}</Text>}
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

            {!!errors.submit && <Text style={styles.formError}>{errors.submit}</Text>}
        </ScrollView>
    );
}

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

interface FieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    error?: string;
    keyboardType?: any;
    secureTextEntry?: boolean;
    autoCapitalize?: 'none' | 'words' | 'sentences';
    icon?: string;
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
}: FieldProps) {
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

    roadDashes: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    roadDash: {
        width: 16,
        height: 2,
        borderRadius: 1,
        backgroundColor: Colors.text.muted,
        opacity: 0.5,
    },

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

    // ── Slides ──
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    infoSlide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    slideIndex: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.text.muted,
        letterSpacing: 3,
        marginBottom: Spacing.lg,
    },
    slideIndexTotal: { color: Colors.text.muted, opacity: 0.5 },
    illustTile: {
        width: 176,
        height: 176,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
        backgroundColor: Colors.bg.glass,
        borderWidth: 1,
        borderColor: Colors.border,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 6,
    },
    slideTitle: {
        fontSize: 34,
        fontWeight: '900',
        letterSpacing: -1,
        textAlign: 'center',
        marginBottom: 8,
    },
    slideSubtitle: {
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 2.5,
        marginBottom: Spacing.md,
    },
    slideDesc: {
        fontSize: 15,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 23,
        maxWidth: 310,
        marginTop: Spacing.md,
    },

    // ── Auth form ──
    regContainer: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.xl },
    authTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: Colors.text.primary,
        letterSpacing: -0.5,
        marginBottom: Spacing.md,
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
    inputIconBox: {
        width: 40,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
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
    roleIconBoxActive: {
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderColor: 'rgba(0,0,0,0.2)',
    },
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

    // ── Bottom nav ──
    dots: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingBottom: Spacing.sm,
    },
    dot: { height: 6, borderRadius: Radius.full },
    navRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 14,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.bg.glass,
    },
    backBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: Radius.lg,
        minWidth: 140,
    },
    nextBtnText: { color: Colors.bg.primary, fontWeight: '900', fontSize: 16 },
    skipBtn: { alignItems: 'center', paddingBottom: Spacing.md },
    skipText: { color: Colors.text.muted, fontSize: 13 },
});
