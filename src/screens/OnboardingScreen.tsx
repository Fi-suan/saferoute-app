/**
 * OnboardingScreen — SafeRoute / Sapa Jol
 *
 * Modes:
 *  'choice'   — Welcome screen: "Войти" / "Зарегистрироваться"
 *  'login'    — Firebase email + password sign-in
 *  'slides'   — Feature walkthrough (4 info slides + registration form)
 *
 * Design: Nothing Phone dark frosted glass aesthetic
 * Icons: custom SVG via OnboardingIllustration
 */
import React, { useRef, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, Dimensions, TouchableOpacity,
    Animated, ScrollView, TextInput, KeyboardAvoidingView,
    Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, Radius, Shadow } from '../constants/colors';
import type { UserRole } from '../constants/livestock';
import OnboardingIllustration from '../components/OnboardingIllustration';
import { firebaseLogin, firebaseRegister, isFirebaseConfigured } from '../services/firebase';

const { width, height } = Dimensions.get('window');

export interface OnboardingResult {
    name: string;
    phone: string;
    role: UserRole;
    email?: string;
}

const KZ_PHONE_RE = /^(\+7|8)\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidPhone(p: string) { return KZ_PHONE_RE.test(p.replace(/\s/g, '')); }
function isValidEmail(e: string) { return EMAIL_RE.test(e.trim()); }

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
    { illust: 'shield',    title: 'Sapa Jol',             subtitle: 'Жол қауіпсіздігі жүйесі',       desc: 'Қазақстан жолдарындағы жануарлар мен жүргізушілерді қорғайды.', accent: Colors.brand.primary },
    { illust: 'marker',    title: 'Белгі қою',             subtitle: 'нақты уақыттағы карта',          desc: 'Жүргізушілер жолдағы киіктерді, малдарды, шұңқырларды белгілейді. AI фотоны тексереді.', accent: Colors.alert.medium },
    { illust: 'bell',      title: 'Ақылды ескерту',        subtitle: '2 км радиуста',                  desc: 'Қауіпті аймаққа жақындасаңыз — қосымша алдын ала ескертеді.', accent: Colors.alert.high },
    { illust: 'community', title: 'Ұжымдық мониторинг',   subtitle: 'бірге қауіпсіз',                 desc: 'Белгіні растаңыз. 3 растаудан кейін белгі автоматты жойылады.', accent: Colors.alert.info },
    { illust: 'profile',   title: 'Тіркелу',               subtitle: 'Деректеріңізді енгізіңіз',       desc: '', accent: Colors.brand.primary, isReg: true },
];
const SLIDES_RU: Slide[] = [
    { illust: 'shield',    title: 'Sapa Jol',             subtitle: 'Система безопасности дорог',     desc: 'Защищает животных и водителей на дорогах Казахстана.', accent: Colors.brand.primary },
    { illust: 'marker',    title: 'Метки',                 subtitle: 'карта в реальном времени',       desc: 'Водители отмечают животных, скот, ямы. AI проверяет каждое фото.', accent: Colors.alert.medium },
    { illust: 'bell',      title: 'Умные оповещения',      subtitle: 'в радиусе 2 км',                 desc: 'При приближении к опасной зоне — приложение предупредит заранее.', accent: Colors.alert.high },
    { illust: 'community', title: 'Коллективный мониторинг', subtitle: 'вместе безопаснее',           desc: 'Подтвердите метку. После 3 подтверждений метка автоматически удаляется.', accent: Colors.alert.info },
    { illust: 'profile',   title: 'Регистрация',           subtitle: 'Введите ваши данные',            desc: '', accent: Colors.brand.primary, isReg: true },
];

type Lang = 'kk' | 'ru';
const L = {
    kk: {
        welcome: 'Sapa Jol', tagline: 'Жол қауіпсіздігі', login: 'Кіру', register: 'Тіркелу',
        nameLabel: 'АТЫ-ЖӨНІ', namePh: 'Асқар Жанасов', nameErr: 'Мин. 2 таңба',
        phoneLabel: 'ТЕЛЕФОН', phonePh: '+7 700 000 0000', phoneErr: 'Дұрыс формат: +7XXXXXXXXXX',
        emailLabel: 'EMAIL', emailPh: 'example@email.com', emailErr: 'Жарамды email енгізіңіз',
        passLabel: 'ҚҰПИЯ СӨЗ', passPh: '••••••••', passErr: 'Мин. 6 таңба',
        roleLabel: 'РӨЛІҢІЗДІ ТАҢДАҢЫЗ', roleErr: 'Рөл таңдаңыз',
        driver: 'Жүргізуші', driverDesc: 'Жол ескертулерін алады',
        owner: 'Мал иесі', ownerDesc: 'Малды тіркеу және қорғау',
        next: 'Келесі', back: 'Артқа', start: 'Бастау', skip: 'Өткізу',
        loginBtn: 'Кіру', loginEmail: 'EMAIL', loginPass: 'ҚҰПИЯ СӨЗ',
        loginErr: 'Email немесе пароль қате', loginNotConfig: 'Firebase баптанбаған',
        toRegister: 'Аккаунт жоқ па? → Тіркелу',
        langToggle: 'RU',
        emailRequired: isFirebaseConfigured() ? '' : '(Firebase баптанбаған — міндетті емес)',
    },
    ru: {
        welcome: 'Sapa Jol', tagline: 'Безопасность на дороге', login: 'Войти', register: 'Регистрация',
        nameLabel: 'ИМЯ', namePh: 'Алексей Иванов', nameErr: 'Мин. 2 символа',
        phoneLabel: 'ТЕЛЕФОН', phonePh: '+7 700 000 0000', phoneErr: 'Формат: +7XXXXXXXXXX',
        emailLabel: 'EMAIL', emailPh: 'example@email.com', emailErr: 'Введите корректный email',
        passLabel: 'ПАРОЛЬ', passPh: '••••••••', passErr: 'Мин. 6 символов',
        roleLabel: 'ВЫБЕРИТЕ РОЛЬ', roleErr: 'Выберите роль',
        driver: 'Водитель', driverDesc: 'Получает дорожные предупреждения',
        owner: 'Владелец скота', ownerDesc: 'Регистрация и защита скота',
        next: 'Далее', back: 'Назад', start: 'Начать', skip: 'Пропустить',
        loginBtn: 'Войти', loginEmail: 'EMAIL', loginPass: 'ПАРОЛЬ',
        loginErr: 'Неверный email или пароль', loginNotConfig: 'Firebase не настроен',
        toRegister: 'Нет аккаунта? → Регистрация',
        langToggle: 'ҚАЗ',
        emailRequired: isFirebaseConfigured() ? '' : '(Firebase не настроен — необязательно)',
    },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onFinish }: { onFinish: (d: OnboardingResult) => void }) {
    const [lang, setLang] = useState<Lang>('kk');
    const [mode, setMode] = useState<'choice' | 'login' | 'slides'>('choice');
    const [slideIdx, setSlideIdx] = useState(0);
    const [loading, setLoading] = useState(false);

    // Registration fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<UserRole | null>(null);

    // Login fields
    const [lEmail, setLEmail] = useState('');
    const [lPass, setLPass] = useState('');

    const [errors, setErrors] = useState<Record<string, string>>({});
    const scrollRef = useRef<ScrollView>(null);
    const dotAnims = useRef(SLIDES_KK.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

    const slides = lang === 'kk' ? SLIDES_KK : SLIDES_RU;
    const ui = L[lang];
    const fbEnabled = isFirebaseConfigured();

    const goToSlide = (idx: number) => {
        scrollRef.current?.scrollTo({ x: idx * width, animated: true });
        dotAnims.forEach((a, i) =>
            Animated.timing(a, { toValue: i === idx ? 1 : 0, duration: 250, useNativeDriver: false }).start(),
        );
        setSlideIdx(idx);
        setErrors({});
    };

    // ── Validate registration ────────────────────────────────────────
    const validateReg = (): boolean => {
        const e: Record<string, string> = {};
        if (name.trim().length < 2) e.name = ui.nameErr;
        if (!isValidPhone(phone)) e.phone = ui.phoneErr;
        if (fbEnabled && !isValidEmail(email)) e.email = ui.emailErr;
        if (fbEnabled && password.length < 6) e.pass = ui.passErr;
        if (!role) e.role = ui.roleErr;
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Handle final submit ──────────────────────────────────────────
    const handleFinish = useCallback(async () => {
        if (!validateReg()) return;
        setLoading(true);
        try {
            const profile = {
                name: name.trim(),
                phone: phone.trim(),
                role: role!,
                joinedAt: new Date().toISOString(),
                totalReports: 0,
                avatarInitials: name.trim().split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'АА',
            };
            if (fbEnabled && email && password) {
                await firebaseRegister(email.trim().toLowerCase(), password, profile);
            }
            onFinish({ name: profile.name, phone: profile.phone, role: role!, email: email || undefined });
        } catch (err: any) {
            setErrors({ submit: err?.message ?? 'Қате' });
        } finally {
            setLoading(false);
        }
    }, [name, phone, email, password, role, fbEnabled, onFinish]);

    // ── Handle login ─────────────────────────────────────────────────
    const handleLogin = useCallback(async () => {
        if (!fbEnabled) { setErrors({ login: ui.loginNotConfig }); return; }
        const e: Record<string, string> = {};
        if (!isValidEmail(lEmail)) e.lemail = ui.emailErr;
        if (lPass.length < 6) e.lpass = ui.passErr;
        setErrors(e);
        if (Object.keys(e).length) return;
        setLoading(true);
        try {
            const profile = await firebaseLogin(lEmail.trim().toLowerCase(), lPass);
            onFinish({ name: profile.name, phone: profile.phone, role: profile.role });
        } catch {
            setErrors({ login: ui.loginErr });
        } finally {
            setLoading(false);
        }
    }, [lEmail, lPass, fbEnabled, onFinish, ui]);

    const handleNext = () => {
        if (slideIdx < slides.length - 1) goToSlide(slideIdx + 1);
        else handleFinish();
    };

    const currentSlide = slides[slideIdx];

    // ── CHOICE SCREEN ────────────────────────────────────────────────────────
    if (mode === 'choice') {
        return (
            <SafeAreaView style={styles.root}>
                <LangBtn lang={lang} toggle={() => setLang(l => l === 'kk' ? 'ru' : 'kk')} label={ui.langToggle} />
                <View style={styles.choiceContainer}>
                    {/* Logo mark */}
                    <View style={styles.logoWrap}>
                        <OnboardingIllustration type="shield" size={96} color={Colors.brand.primary} />
                    </View>
                    <Text style={styles.choiceTitle}>{ui.welcome}</Text>
                    <Text style={styles.choiceTagline}>{ui.tagline}</Text>

                    {/* Dot matrix decoration */}
                    <DotMatrix />

                    <View style={styles.choiceBtns}>
                        <TouchableOpacity style={styles.loginBtn} onPress={() => setMode('login')}>
                            <Text style={styles.loginBtnText}>{ui.login}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.registerBtn} onPress={() => setMode('slides')}>
                            <Text style={styles.registerBtnText}>{ui.register}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // ── LOGIN SCREEN ─────────────────────────────────────────────────────────
    if (mode === 'login') {
        return (
            <SafeAreaView style={styles.root}>
                <LangBtn lang={lang} toggle={() => setLang(l => l === 'kk' ? 'ru' : 'kk')} label={ui.langToggle} />
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <ScrollView contentContainerStyle={styles.loginContainer} keyboardShouldPersistTaps="handled">
                        <TouchableOpacity style={styles.backRow} onPress={() => setMode('choice')}>
                            <Text style={styles.backArrow}>←</Text>
                            <Text style={styles.backLabel}>{ui.back}</Text>
                        </TouchableOpacity>

                        <OnboardingIllustration type="profile" size={72} color={Colors.brand.primary} />
                        <Text style={styles.loginTitle}>{ui.loginBtn}</Text>

                        <Field
                            label={ui.loginEmail} value={lEmail} onChange={v => { setLEmail(v); setErrors({} ); }}
                            placeholder={ui.emailPh} keyboardType="email-address" error={errors.lemail}
                            autoCapitalize="none"
                        />
                        <Field
                            label={ui.loginPass} value={lPass} onChange={v => { setLPass(v); setErrors({}); }}
                            placeholder={ui.passPh} secureTextEntry error={errors.lpass}
                        />

                        {errors.login && <Text style={styles.formError}>{errors.login}</Text>}

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: Colors.brand.primary }, loading && { opacity: 0.6 }]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading
                                ? <ActivityIndicator color={Colors.bg.primary} />
                                : <Text style={styles.primaryBtnText}>{ui.loginBtn}</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => { setMode('slides'); setErrors({}); }} style={styles.switchLink}>
                            <Text style={styles.switchLinkText}>{ui.toRegister}</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // ── SLIDES / REGISTRATION ────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.root}>
            <LangBtn lang={lang} toggle={() => setLang(l => l === 'kk' ? 'ru' : 'kk')} label={ui.langToggle} />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    ref={scrollRef}
                    horizontal pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={false}
                    style={{ flex: 1 }}
                >
                    {slides.map((s, i) => (
                        <View key={i} style={[styles.slide, { width }]}>
                            {s.isReg ? (
                                <RegForm
                                    ui={ui} fbEnabled={fbEnabled}
                                    name={name} setName={setName}
                                    phone={phone} setPhone={setPhone}
                                    email={email} setEmail={setEmail}
                                    password={password} setPassword={setPassword}
                                    role={role} setRole={setRole}
                                    errors={errors} setErrors={setErrors}
                                    accent={s.accent}
                                    loading={loading}
                                />
                            ) : (
                                <InfoSlide slide={s} />
                            )}
                        </View>
                    ))}
                </ScrollView>

                {/* Dots */}
                <View style={styles.dots}>
                    {slides.map((s, i) => {
                        const w = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 20] });
                        const op = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
                        return <Animated.View key={i} style={[styles.dot, { width: w, opacity: op, backgroundColor: s.accent }]} />;
                    })}
                </View>

                {/* Nav buttons */}
                <View style={styles.navRow}>
                    {slideIdx > 0 && (
                        <TouchableOpacity style={styles.backBtn} onPress={() => {
                            if (slideIdx === 0) setMode('choice');
                            else goToSlide(slideIdx - 1);
                        }}>
                            <Text style={styles.backBtnText}>{ui.back}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.nextBtn, { backgroundColor: currentSlide.accent, flex: slideIdx > 0 ? 1 : 0 }, loading && { opacity: 0.6 }]}
                        onPress={handleNext}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color={Colors.bg.primary} />
                            : <Text style={styles.nextBtnText}>{slideIdx === slides.length - 1 ? ui.start : ui.next}</Text>}
                    </TouchableOpacity>
                </View>
                {slideIdx < slides.length - 1 && (
                    <TouchableOpacity style={styles.skipBtn} onPress={() => goToSlide(slides.length - 1)}>
                        <Text style={styles.skipText}>{ui.skip}</Text>
                    </TouchableOpacity>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LangBtn({ lang, toggle, label }: { lang: Lang; toggle: () => void; label: string }) {
    return (
        <TouchableOpacity style={styles.langBtn} onPress={toggle}>
            <Text style={styles.langBtnText}>{label}</Text>
        </TouchableOpacity>
    );
}

function DotMatrix() {
    const dots = Array.from({ length: 24 });
    return (
        <View style={styles.dotMatrix}>
            {dots.map((_, i) => (
                <View key={i} style={[styles.matrixDot, { opacity: 0.05 + (i % 5) * 0.04 }]} />
            ))}
        </View>
    );
}

function InfoSlide({ slide }: { slide: Slide }) {
    return (
        <View style={styles.infoSlide}>
            <View style={[styles.illustWrap, { borderColor: slide.accent + '30' }]}>
                <OnboardingIllustration type={slide.illust} size={100} color={slide.accent} />
            </View>
            <Text style={[styles.slideTitle, { color: slide.accent }]}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
            <Text style={styles.slideDesc}>{slide.desc}</Text>
        </View>
    );
}

interface RegFormProps {
    ui: typeof L['kk']; fbEnabled: boolean;
    name: string; setName: (v: string) => void;
    phone: string; setPhone: (v: string) => void;
    email: string; setEmail: (v: string) => void;
    password: string; setPassword: (v: string) => void;
    role: UserRole | null; setRole: (r: UserRole) => void;
    errors: Record<string, string>; setErrors: (e: Record<string, string>) => void;
    accent: string; loading: boolean;
}

function RegForm({ ui, fbEnabled, name, setName, phone, setPhone, email, setEmail, password, setPassword, role, setRole, errors, setErrors, accent, loading }: RegFormProps) {
    const clear = (k: string) => setErrors({ ...errors, [k]: '' });
    return (
        <ScrollView contentContainerStyle={styles.regContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.slideTitle, { color: accent }]}>{ui.register}</Text>

            <Field label={ui.nameLabel} value={name} onChange={v => { setName(v); clear('name'); }}
                placeholder={ui.namePh} error={errors.name} autoCapitalize="words" />
            <Field label={ui.phoneLabel} value={phone} onChange={v => { setPhone(v); clear('phone'); }}
                placeholder={ui.phonePh} keyboardType="phone-pad" error={errors.phone} />

            {/* Email + password — only shown when Firebase is configured */}
            {fbEnabled && (
                <>
                    <Field label={ui.emailLabel} value={email} onChange={v => { setEmail(v); clear('email'); }}
                        placeholder={ui.emailPh} keyboardType="email-address" error={errors.email} autoCapitalize="none" />
                    <Field label={ui.passLabel} value={password} onChange={v => { setPassword(v); clear('pass'); }}
                        placeholder={ui.passPh} secureTextEntry error={errors.pass} />
                </>
            )}

            {/* Role */}
            <Text style={[styles.fieldLabel, errors.role ? { color: Colors.alert.critical } : null]}>{ui.roleLabel}</Text>
            {errors.role && <Text style={styles.fieldError}>{errors.role}</Text>}
            <RoleCard
                icon="🚗" title={ui.driver} desc={ui.driverDesc}
                selected={role === 'driver'} onPress={() => setRole('driver')}
            />
            <RoleCard
                icon="🐄" title={ui.owner} desc={ui.ownerDesc}
                selected={role === 'livestock_owner'} onPress={() => setRole('livestock_owner')}
            />
            {errors.submit && <Text style={styles.formError}>{errors.submit}</Text>}
        </ScrollView>
    );
}

function RoleCard({ icon, title, desc, selected, onPress }: { icon: string; title: string; desc: string; selected: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            style={[styles.roleCard, selected && styles.roleCardActive]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={styles.roleIcon}>{icon}</Text>
            <View style={{ flex: 1 }}>
                <Text style={[styles.roleTitle, selected && { color: Colors.bg.primary }]}>{title}</Text>
                <Text style={[styles.roleDesc, selected && { color: Colors.bg.tertiary }]}>{desc}</Text>
            </View>
            {selected && <Text style={styles.roleTick}>✓</Text>}
        </TouchableOpacity>
    );
}

interface FieldProps {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; error?: string; keyboardType?: any;
    secureTextEntry?: boolean; autoCapitalize?: 'none' | 'words' | 'sentences';
}
function Field({ label, value, onChange, placeholder, error, keyboardType, secureTextEntry, autoCapitalize }: FieldProps) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                style={[styles.input, error && styles.inputError]}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={Colors.text.muted}
                keyboardType={keyboardType}
                secureTextEntry={secureTextEntry}
                autoCapitalize={autoCapitalize ?? 'none'}
                autoCorrect={false}
            />
            {!!error && <Text style={styles.fieldError}>{error}</Text>}
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.bg.primary },

    langBtn: {
        position: 'absolute', top: 52, right: Spacing.lg, zIndex: 20,
        paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
        backgroundColor: Colors.bg.glass,
    },
    langBtnText: { color: Colors.text.secondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

    // ── Choice ──
    choiceContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    logoWrap: { marginBottom: Spacing.lg },
    choiceTitle: {
        fontSize: 48, fontWeight: '900', color: Colors.text.primary,
        letterSpacing: -2, textAlign: 'center',
    },
    choiceTagline: {
        fontSize: 14, color: Colors.text.secondary, textAlign: 'center',
        letterSpacing: 2, textTransform: 'uppercase', marginBottom: Spacing.xl,
    },
    dotMatrix: {
        flexDirection: 'row', flexWrap: 'wrap',
        width: 160, justifyContent: 'center', gap: 10,
        marginBottom: Spacing.xl,
    },
    matrixDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.brand.primary },
    choiceBtns: { width: '100%', gap: Spacing.sm },
    loginBtn: {
        borderWidth: 1, borderColor: Colors.borderStrong,
        borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center',
        backgroundColor: Colors.bg.glass,
    },
    loginBtnText: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
    registerBtn: {
        borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center',
        backgroundColor: Colors.brand.primary,
    },
    registerBtnText: { color: Colors.bg.primary, fontSize: 16, fontWeight: '800' },

    // ── Login ──
    loginContainer: { flexGrow: 1, alignItems: 'center', padding: Spacing.xl, paddingTop: 80 },
    backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: Spacing.xl },
    backArrow: { color: Colors.text.secondary, fontSize: 20 },
    backLabel: { color: Colors.text.secondary, fontSize: 14 },
    loginTitle: { fontSize: 32, fontWeight: '900', color: Colors.text.primary, marginTop: Spacing.md, marginBottom: Spacing.xl, letterSpacing: -1 },
    switchLink: { marginTop: Spacing.lg, padding: Spacing.sm },
    switchLinkText: { color: Colors.brand.primary, fontSize: 13, textAlign: 'center' },
    formError: { color: Colors.alert.critical, fontSize: 12, textAlign: 'center', marginVertical: 8 },

    primaryBtn: {
        width: '100%', borderRadius: Radius.lg,
        paddingVertical: 16, alignItems: 'center', marginTop: Spacing.md,
    },
    primaryBtnText: { color: Colors.bg.primary, fontSize: 16, fontWeight: '800' },

    // ── Slides ──
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    infoSlide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    illustWrap: {
        width: 140, height: 140, borderRadius: Radius.xxl,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginBottom: Spacing.xl,
        backgroundColor: Colors.bg.glass,
    },
    slideTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1, textAlign: 'center', marginBottom: 6 },
    slideSubtitle: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: Spacing.md },
    slideDesc: { fontSize: 15, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 },

    // ── Reg form ──
    regContainer: { paddingHorizontal: Spacing.lg, paddingTop: 80, paddingBottom: Spacing.xl },
    fieldGroup: { marginBottom: Spacing.md },
    fieldLabel: { fontSize: 10, fontWeight: '800', color: Colors.text.muted, letterSpacing: 1.5, marginBottom: 7, textTransform: 'uppercase' },
    input: {
        backgroundColor: Colors.bg.tertiary, borderRadius: Radius.md,
        paddingHorizontal: Spacing.md, paddingVertical: 14,
        color: Colors.text.primary, fontSize: 15,
        borderWidth: 1, borderColor: Colors.border,
    },
    inputError: { borderColor: Colors.alert.critical },
    fieldError: { color: Colors.alert.critical, fontSize: 11, marginTop: 4 },
    roleCard: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, marginTop: 8,
    },
    roleCardActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    roleIcon: { fontSize: 28 },
    roleTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
    roleDesc: { fontSize: 12, color: Colors.text.secondary },
    roleTick: { fontSize: 18, color: Colors.bg.primary, fontWeight: '800' },

    // ── Bottom nav ──
    dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: Spacing.sm },
    dot: { height: 6, borderRadius: Radius.full },
    navRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
    backBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 14, paddingHorizontal: Spacing.md,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
        backgroundColor: Colors.bg.glass,
    },
    backBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },
    nextBtn: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, paddingHorizontal: 32,
        borderRadius: Radius.lg, minWidth: 140,
    },
    nextBtnText: { color: Colors.bg.primary, fontWeight: '900', fontSize: 16 },
    skipBtn: { alignItems: 'center', paddingBottom: Spacing.md },
    skipText: { color: Colors.text.muted, fontSize: 12 },
});
