import React, { useRef, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, Dimensions, TouchableOpacity,
    Animated, ScrollView, TextInput, KeyboardAvoidingView,
    Platform, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, Radius } from '../constants/colors';
import type { UserRole } from '../constants/livestock';
import OnboardingIllustration from '../components/OnboardingIllustration';
import { ensureRegistered } from '../services/registration';

const { width } = Dimensions.get('window');

export interface OnboardingResult {
    name: string;
    phone: string;
    role: UserRole;
}

const KZ_PHONE_RE = /^(\+7|8)\d{10}$/;
function isValidPhone(p: string) { return KZ_PHONE_RE.test(p.replace(/\s/g, '')); }

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
    { illust: 'shield', title: 'Sapa Jol', subtitle: 'Жол қауiпсiздiгi жүйесi', desc: 'Қазақстан жолдарындағы жануарлар мен жүргiзушiлердi қорғайды.', accent: Colors.brand.primary },
    { illust: 'marker', title: 'Белгi қою', subtitle: 'нақты уақыттағы карта', desc: 'Жүргiзушiлер жолдағы малдарды, шұңқырларды белгiлейдi. AI фотоны тексередi.', accent: Colors.alert.medium },
    { illust: 'bell', title: 'Ақылды ескерту', subtitle: '2 км радиуста', desc: 'Қауiптi аймаққа жақындасаңыз — қосымша алдын ала ескертедi.', accent: Colors.alert.high },
    { illust: 'community', title: 'Бiрге қауiпсiз', subtitle: 'ұжымдық монитори', desc: 'Белгiнi растаңыз. 3 растаудан кейiн белгi автоматты жойылады.', accent: Colors.alert.info },
    { illust: 'profile', title: 'Тiркелу', subtitle: '', desc: '', accent: Colors.brand.primary, isReg: true },
];
const SLIDES_RU: Slide[] = [
    { illust: 'shield', title: 'Sapa Jol', subtitle: 'Система безопасности дорог', desc: 'Защищает животных и водителей на дорогах Казахстана.', accent: Colors.brand.primary },
    { illust: 'marker', title: 'Метки', subtitle: 'карта в реальном времени', desc: 'Водители отмечают животных, скот, ямы. AI проверяет каждое фото.', accent: Colors.alert.medium },
    { illust: 'bell', title: 'Оповещения', subtitle: 'в радиусе 2 км', desc: 'При приближении к опасной зоне — приложение предупредит заранее.', accent: Colors.alert.high },
    { illust: 'community', title: 'Вместе безопаснее', subtitle: 'коллективный мониторинг', desc: 'Подтвердите метку. После 3 подтверждений метка удаляется.', accent: Colors.alert.info },
    { illust: 'profile', title: 'Регистрация', subtitle: '', desc: '', accent: Colors.brand.primary, isReg: true },
];

type Lang = 'kk' | 'ru';
const L = {
    kk: {
        nameLabel: 'АТЫ-ЖӨНI', nameErr: 'Мин. 2 таңба', namePh: 'Айбек',
        phoneLabel: 'ТЕЛЕФОН', phonePh: '+7 700 000 0000', phoneErr: 'Формат: +7XXXXXXXXXX',
        roleLabel: 'РӨЛIҢIЗДI ТАҢДАҢЫЗ', roleErr: 'Рөл таңдаңыз',
        driver: 'Жүргiзушi', driverDesc: 'Жол ескертулерiн алады',
        owner: 'Мал иесi', ownerDesc: 'Малды тiркеу және қорғау',
        next: 'Келесi', back: 'Артқа', start: 'Бастау', skip: 'Өткiзу',
        langToggle: 'RU',
    },
    ru: {
        nameLabel: 'ИМЯ', nameErr: 'Мин. 2 символа', namePh: 'Айбек',
        phoneLabel: 'ТЕЛЕФОН', phonePh: '+7 700 000 0000', phoneErr: 'Формат: +7XXXXXXXXXX',
        roleLabel: 'ВЫБЕРИТЕ РОЛЬ', roleErr: 'Выберите роль',
        driver: 'Водитель', driverDesc: 'Получает дорожные предупреждения',
        owner: 'Владелец скота', ownerDesc: 'Регистрация и защита скота',
        next: 'Далее', back: 'Назад', start: 'Начать', skip: 'Пропустить',
        langToggle: 'ҚАЗ',
    },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onFinish }: { onFinish: (d: OnboardingResult) => void }) {
    const [lang, setLang] = useState<Lang>('kk');
    const [slideIdx, setSlideIdx] = useState(0);
    const [loading, setLoading] = useState(false);

    // Registration fields
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState<UserRole | null>(null);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const scrollRef = useRef<ScrollView>(null);
    const dotAnims = useRef(SLIDES_KK.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

    const slides = lang === 'kk' ? SLIDES_KK : SLIDES_RU;
    const ui = L[lang];

    const animateDots = (idx: number) => {
        dotAnims.forEach((a, i) =>
            Animated.timing(a, { toValue: i === idx ? 1 : 0, duration: 250, useNativeDriver: false }).start(),
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

    // ── Validate registration ────────────────────────────────────────
    const validateReg = (): boolean => {
        const e: Record<string, string> = {};
        if (name.trim().length < 2) e.name = ui.nameErr;
        if (!isValidPhone(phone)) e.phone = ui.phoneErr;
        if (!role) e.role = ui.roleErr;
        setErrors(e);
        if (Object.keys(e).length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return Object.keys(e).length === 0;
    };

    // ── Handle final submit ──────────────────────────────────────────
    const handleFinish = useCallback(async () => {
        if (!validateReg()) return;
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const profile = {
                name: name.trim(),
                phone: phone.trim(),
                role: role!,
            };
            // Регистрация не должна блокировать вход: бэкенд на Render free plan
            // может просыпаться до минуты. Если токен не получен — ensureRegistered
            // сам уйдёт в фоновые повторы, а репорты до тех пор копятся в очереди.
            await ensureRegistered({ role: profile.role, phone: profile.phone });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onFinish(profile);
        } catch (err: any) {
            setErrors({ submit: err?.message ?? 'Error' });
        } finally {
            setLoading(false);
        }
    }, [name, phone, role, lang, onFinish]);

    const handleNext = () => {
        if (slideIdx < slides.length - 1) goToSlide(slideIdx + 1);
        else handleFinish();
    };

    const currentSlide = slides[slideIdx];

    return (
        <SafeAreaView style={styles.root}>
            {/* Language toggle */}
            <TouchableOpacity
                style={styles.langBtn}
                onPress={() => {
                    Haptics.selectionAsync();
                    setLang(l => l === 'kk' ? 'ru' : 'kk');
                }}
            >
                <Text style={styles.langBtnText}>{ui.langToggle}</Text>
            </TouchableOpacity>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    ref={scrollRef}
                    horizontal pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled
                    onMomentumScrollEnd={handleScroll}
                    style={{ flex: 1 }}
                >
                    {slides.map((s, i) => (
                        <View key={i} style={[styles.slide, { width }]}>
                            {s.isReg ? (
                                <RegForm
                                    ui={ui}
                                    name={name} setName={setName}
                                    phone={phone} setPhone={setPhone}
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
                        <TouchableOpacity style={styles.backBtn} onPress={() => goToSlide(slideIdx - 1)}>
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
                        {loading
                            ? <ActivityIndicator color={Colors.bg.primary} />
                            : <>
                                <Text style={styles.nextBtnText}>
                                    {slideIdx === slides.length - 1 ? ui.start : ui.next}
                                </Text>
                                {slideIdx < slides.length - 1 && (
                                    <Ionicons name="chevron-forward" size={18} color={Colors.bg.primary} />
                                )}
                            </>
                        }
                    </TouchableOpacity>
                </View>

                {/* Skip to registration */}
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
    ui: typeof L['kk'];
    name: string; setName: (v: string) => void;
    phone: string; setPhone: (v: string) => void;
    role: UserRole | null; setRole: (r: UserRole) => void;
    errors: Record<string, string>; setErrors: (e: Record<string, string>) => void;
    accent: string; loading: boolean;
}

function RegForm({ ui, name, setName, phone, setPhone, role, setRole, errors, setErrors, accent }: RegFormProps) {
    const clear = (k: string) => setErrors({ ...errors, [k]: '' });
    return (
        <ScrollView contentContainerStyle={styles.regContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.slideTitle, { color: accent, marginBottom: Spacing.lg }]}>{ui.nameLabel === 'ИМЯ' ? 'Регистрация' : 'Тiркелу'}</Text>

            <Field label={ui.nameLabel} value={name} onChange={v => { setName(v); clear('name'); }}
                error={errors.name} autoCapitalize="words" placeholder={ui.namePh}
                icon="person-outline"
            />
            <Field label={ui.phoneLabel} value={phone} onChange={v => { setPhone(v); clear('phone'); }}
                placeholder={ui.phonePh} keyboardType="phone-pad" error={errors.phone}
                icon="call-outline"
            />

            {/* Role */}
            <Text style={[styles.fieldLabel, errors.role ? { color: Colors.alert.critical } : null]}>{ui.roleLabel}</Text>
            {errors.role && <Text style={styles.fieldError}>{errors.role}</Text>}
            <RoleCard
                icon="car-sport-outline"
                title={ui.driver} desc={ui.driverDesc}
                selected={role === 'driver'}
                onPress={() => { Haptics.selectionAsync(); setRole('driver'); clear('role'); }}
            />
            <RoleCard
                icon="paw-outline"
                title={ui.owner} desc={ui.ownerDesc}
                selected={role === 'livestock_owner'}
                onPress={() => { Haptics.selectionAsync(); setRole('livestock_owner'); clear('role'); }}
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
            <View style={[styles.roleIconBox, selected && styles.roleIconBoxActive]}>
                <Ionicons name={icon as any} size={22} color={selected ? Colors.bg.primary : Colors.brand.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.roleTitle, selected && { color: Colors.bg.primary }]}>{title}</Text>
                <Text style={[styles.roleDesc, selected && { color: Colors.bg.tertiary }]}>{desc}</Text>
            </View>
            {selected && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.bg.primary} />
            )}
        </TouchableOpacity>
    );
}

interface FieldProps {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; error?: string; keyboardType?: any;
    secureTextEntry?: boolean; autoCapitalize?: 'none' | 'words' | 'sentences';
    icon?: string;
}
function Field({ label, value, onChange, placeholder, error, keyboardType, secureTextEntry, autoCapitalize, icon }: FieldProps) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={[styles.inputRow, error && styles.inputError]}>
                {icon && <Ionicons name={icon as any} size={18} color={Colors.text.muted} style={{ marginRight: 10 }} />}
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
        position: 'absolute', top: 52, right: Spacing.lg, zIndex: 20,
        paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
        backgroundColor: Colors.bg.glass,
    },
    langBtnText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },

    // ── Slides ──
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    infoSlide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    illustWrap: {
        width: 140, height: 140, borderRadius: 70,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginBottom: Spacing.xl,
        backgroundColor: Colors.bg.glass,
    },
    slideTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -1, textAlign: 'center', marginBottom: 6 },
    slideSubtitle: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: Spacing.md },
    slideDesc: { fontSize: 15, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 },

    // ── Reg form ──
    regContainer: { paddingHorizontal: Spacing.lg, paddingTop: 60, paddingBottom: Spacing.xl },
    fieldGroup: { marginBottom: Spacing.md },
    fieldLabel: { fontSize: 10, fontWeight: '800', color: Colors.text.muted, letterSpacing: 1.5, marginBottom: 7, textTransform: 'uppercase' },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.bg.tertiary, borderRadius: Radius.md,
        paddingHorizontal: Spacing.md,
        borderWidth: 1, borderColor: Colors.border,
    },
    input: {
        flex: 1, paddingVertical: 14,
        color: Colors.text.primary, fontSize: 15,
    },
    inputError: { borderColor: Colors.alert.critical },
    fieldError: { color: Colors.alert.critical, fontSize: 11, marginTop: 4 },
    formError: { color: Colors.alert.critical, fontSize: 12, textAlign: 'center', marginVertical: 8 },

    roleCard: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        borderWidth: 1.5, borderColor: Colors.border, marginBottom: Spacing.sm, marginTop: 8,
    },
    roleCardActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    roleIconBox: {
        width: 44, height: 44, borderRadius: Radius.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.brand.primary + '18',
        borderWidth: 1, borderColor: Colors.brand.primary + '40',
    },
    roleIconBoxActive: {
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderColor: 'rgba(0,0,0,0.2)',
    },
    roleTitle: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
    roleDesc: { fontSize: 12, color: Colors.text.secondary },

    // ── Bottom nav ──
    dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingBottom: Spacing.sm },
    dot: { height: 6, borderRadius: Radius.full },
    navRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.sm },
    backBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingVertical: 14, paddingHorizontal: Spacing.md,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
        backgroundColor: Colors.bg.glass,
    },
    backBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 16, paddingHorizontal: 32,
        borderRadius: Radius.lg, minWidth: 140,
    },
    nextBtnText: { color: Colors.bg.primary, fontWeight: '900', fontSize: 16 },
    skipBtn: { alignItems: 'center', paddingBottom: Spacing.md },
    skipText: { color: Colors.text.muted, fontSize: 13 },
});
