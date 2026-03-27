import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    ScrollView,
    Image,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../constants/colors';
import type { UserRole } from '../constants/livestock';

const ROAD_ILLUSTRATION = require('../../road_illustration.webp');
const { width } = Dimensions.get('window');

export interface OnboardingResult {
    name: string;
    phone: string;
    role: UserRole;
}

// Phone validator: +7XXXXXXXXXX or 8XXXXXXXXXX (11 digits after strip)
const KZ_PHONE_RE = /^(\+7|8)\d{10}$/;
function isValidPhone(phone: string): boolean {
    return KZ_PHONE_RE.test(phone.replace(/\s/g, ''));
}

const SLIDES_KK = [
    { icon: 'shield-checkmark', title: 'Sapa Jol', subtitle: 'Жол қауіпсіздігі жүйесі', desc: 'Қазақстан жолдарындағы жануарлар мен жүргізушілерді қорғауға арналған интеллектуалды жүйе.', accent: Colors.brand.primary },
    { icon: 'location',         title: 'Белгі қою',        subtitle: 'нақты уақыттағы карта',  desc: 'Жүргізушілер жолдағы киіктерді, малдарды немесе шұңқырларды картаға белгілейді. AI әр фотоны тексереді.', accent: Colors.alert.medium },
    { icon: 'notifications',    title: 'Ақылды ескерту',   subtitle: '2 км радиуста',           desc: 'Қауіпті аймаққа жақындасаңыз — қосымша алдын ала ескертеді.', accent: Colors.alert.high },
    { icon: 'people',           title: 'Ұжымдық мониторинг', subtitle: 'бірге қауіпсіз',       desc: 'Белгінің жанынан өттіңіз бе? Шешілуін растаңыз. 3 растаудан кейін белгі жойылады.', accent: Colors.alert.info },
    { icon: 'person-add',       title: 'Тіркелу',          subtitle: 'Деректеріңізді енгізіңіз', desc: '', accent: Colors.brand.primary, isRoleSlide: true },
] as const;

const SLIDES_RU = [
    { icon: 'shield-checkmark', title: 'Sapa Jol', subtitle: 'Система безопасности дорог', desc: 'Интеллектуальная система защиты животных и водителей на дорогах Казахстана.', accent: Colors.brand.primary },
    { icon: 'location',         title: 'Метки',             subtitle: 'карта в реальном времени', desc: 'Водители отмечают животных, скот или ямы. AI проверяет каждое фото.', accent: Colors.alert.medium },
    { icon: 'notifications',    title: 'Умные оповещения',  subtitle: 'в радиусе 2 км',          desc: 'При приближении к опасной зоне — приложение предупредит заранее.', accent: Colors.alert.high },
    { icon: 'people',           title: 'Коллективный мониторинг', subtitle: 'вместе безопаснее', desc: 'Проехали мимо метки? Подтвердите. После 3 подтверждений метка удаляется.', accent: Colors.alert.info },
    { icon: 'person-add',       title: 'Регистрация',       subtitle: 'Введите ваши данные',      desc: '', accent: Colors.brand.primary, isRoleSlide: true },
] as const;

type Lang = 'kk' | 'ru';

const UI: Record<Lang, {
    nameLabel: string; namePlaceholder: string;
    phoneLabel: string; phonePlaceholder: string;
    roleLabel: string;
    nameError: string; phoneError: string; phoneInvalid: string; roleError: string;
    nextBtn: string; backBtn: string; startBtn: string; skipBtn: string;
    driver: string; driverDesc: string; owner: string; ownerDesc: string;
    langToggle: string;
}> = {
    kk: {
        nameLabel: 'АТЫ-ЖӨНІ', namePlaceholder: 'Мысалы: Асқар Жанасов',
        phoneLabel: 'ТЕЛЕФОН', phonePlaceholder: '+7 700 000 0000',
        roleLabel: 'РӨЛІҢІЗДІ ТАҢДАҢЫЗ',
        nameError: 'Аты-жөнін енгізіңіз (мин. 2 таңба)',
        phoneError: 'Телефон нөмірін енгізіңіз',
        phoneInvalid: 'Формат: +7XXXXXXXXXX немесе 8XXXXXXXXXX',
        roleError: 'Рөлді таңдаңыз',
        nextBtn: 'Келесі', backBtn: 'Артқа', startBtn: 'Бастау', skipBtn: 'Өткізу',
        driver: 'Жүргізуші', driverDesc: 'Жол ескертулерін алады',
        owner: 'Мал иесі', ownerDesc: 'Малды тіркеу және қорғау',
        langToggle: 'RU',
    },
    ru: {
        nameLabel: 'ИМЯ', namePlaceholder: 'Например: Алексей Иванов',
        phoneLabel: 'ТЕЛЕФОН', phonePlaceholder: '+7 700 000 0000',
        roleLabel: 'ВЫБЕРИТЕ РОЛЬ',
        nameError: 'Введите имя (мин. 2 символа)',
        phoneError: 'Введите номер телефона',
        phoneInvalid: 'Формат: +7XXXXXXXXXX или 8XXXXXXXXXX',
        roleError: 'Выберите роль',
        nextBtn: 'Далее', backBtn: 'Назад', startBtn: 'Начать', skipBtn: 'Пропустить',
        driver: 'Водитель', driverDesc: 'Получает дорожные предупреждения',
        owner: 'Владелец скота', ownerDesc: 'Регистрация и защита скота',
        langToggle: 'ҚАЗ',
    },
};

export default function OnboardingScreen({ onFinish }: { onFinish: (data: OnboardingResult) => void }) {
    const [lang, setLang] = useState<Lang>('kk');
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [errors, setErrors] = useState<{ name?: string; phone?: string; role?: string }>({});
    const scrollRef = useRef<ScrollView>(null);
    const dotAnims = useRef(SLIDES_KK.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

    const slides = lang === 'kk' ? SLIDES_KK : SLIDES_RU;
    const ui = UI[lang];

    const goTo = (idx: number) => {
        scrollRef.current?.scrollTo({ x: idx * width, animated: true });
        dotAnims.forEach((anim, i) =>
            Animated.timing(anim, { toValue: i === idx ? 1 : 0, duration: 250, useNativeDriver: false }).start(),
        );
        setCurrentIdx(idx);
        setErrors({});
    };

    const validate = (): boolean => {
        const errs: typeof errors = {};
        if (name.trim().length < 2) errs.name = ui.nameError;
        if (!phone.trim()) errs.phone = ui.phoneError;
        else if (!isValidPhone(phone)) errs.phone = ui.phoneInvalid;
        if (!selectedRole) errs.role = ui.roleError;
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleNext = () => {
        if (currentIdx < slides.length - 1) {
            goTo(currentIdx + 1);
        } else {
            if (!validate()) return;
            onFinish({ name: name.trim(), phone: phone.trim(), role: selectedRole! });
        }
    };

    const slide = slides[currentIdx];
    const isRegSlide = 'isRoleSlide' in slide && slide.isRoleSlide;

    return (
        <SafeAreaView style={styles.container}>
            {/* Language toggle */}
            <TouchableOpacity
                style={styles.langBtn}
                onPress={() => setLang(l => (l === 'kk' ? 'ru' : 'kk'))}
            >
                <Text style={styles.langBtnText}>{ui.langToggle}</Text>
            </TouchableOpacity>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={false}
                >
                    {slides.map((s, i) => {
                        const isReg = 'isRoleSlide' in s && s.isRoleSlide;
                        return (
                            <View key={i} style={[styles.slide, { width }]}>
                                {i === 0 ? (
                                    <Image source={ROAD_ILLUSTRATION} style={styles.illustrationImg} resizeMode="cover" />
                                ) : isReg ? null : (
                                    <View style={[styles.iconCircle, { backgroundColor: s.accent + '20', borderColor: s.accent + '40' }]}>
                                        <Ionicons name={s.icon as any} size={56} color={s.accent} />
                                    </View>
                                )}

                                {!isReg && (
                                    <>
                                        <Text style={[styles.slideTitle, { color: s.accent }]}>{s.title}</Text>
                                        <Text style={styles.slideSubtitle}>{s.subtitle}</Text>
                                        <Text style={styles.slideDesc}>{s.desc}</Text>
                                    </>
                                )}

                                {isReg && (
                                    <ScrollView
                                        style={{ width: '100%' }}
                                        contentContainerStyle={styles.regContainer}
                                        showsVerticalScrollIndicator={false}
                                        keyboardShouldPersistTaps="handled"
                                    >
                                        <Text style={[styles.slideTitle, { color: s.accent, marginBottom: 4 }]}>{s.title}</Text>
                                        <Text style={styles.slideSubtitle}>{s.subtitle}</Text>

                                        {/* Name */}
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.inputLabel}>{ui.nameLabel}</Text>
                                            <TextInput
                                                style={[styles.regInput, errors.name && styles.regInputError]}
                                                value={name}
                                                onChangeText={v => { setName(v); setErrors(e => ({ ...e, name: undefined })); }}
                                                placeholder={ui.namePlaceholder}
                                                placeholderTextColor={Colors.text.muted}
                                                maxLength={40}
                                                autoCapitalize="words"
                                            />
                                            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
                                        </View>

                                        {/* Phone — required */}
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.inputLabel}>{ui.phoneLabel}</Text>
                                            <TextInput
                                                style={[styles.regInput, errors.phone && styles.regInputError]}
                                                value={phone}
                                                onChangeText={v => { setPhone(v); setErrors(e => ({ ...e, phone: undefined })); }}
                                                placeholder={ui.phonePlaceholder}
                                                placeholderTextColor={Colors.text.muted}
                                                keyboardType="phone-pad"
                                                maxLength={17}
                                            />
                                            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
                                        </View>

                                        {/* Role */}
                                        <Text style={[styles.inputLabel, errors.role && { color: Colors.alert.critical }]}>
                                            {ui.roleLabel}
                                        </Text>
                                        {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}

                                        <TouchableOpacity
                                            style={[styles.roleCard, selectedRole === 'driver' && styles.roleCardActive]}
                                            onPress={() => { setSelectedRole('driver'); setErrors(e => ({ ...e, role: undefined })); }}
                                        >
                                            <Ionicons name="car" size={32} color={selectedRole === 'driver' ? Colors.bg.primary : Colors.text.primary} />
                                            <View style={styles.roleCardText}>
                                                <Text style={[styles.roleTitle, selectedRole === 'driver' && { color: Colors.bg.primary }]}>{ui.driver}</Text>
                                                <Text style={[styles.roleDesc, selectedRole === 'driver' && { color: Colors.bg.primary }]}>{ui.driverDesc}</Text>
                                            </View>
                                            {selectedRole === 'driver' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg.primary} />}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.roleCard, selectedRole === 'livestock_owner' && styles.roleCardActive]}
                                            onPress={() => { setSelectedRole('livestock_owner'); setErrors(e => ({ ...e, role: undefined })); }}
                                        >
                                            <Ionicons name="paw" size={32} color={selectedRole === 'livestock_owner' ? Colors.bg.primary : Colors.text.primary} />
                                            <View style={styles.roleCardText}>
                                                <Text style={[styles.roleTitle, selectedRole === 'livestock_owner' && { color: Colors.bg.primary }]}>{ui.owner}</Text>
                                                <Text style={[styles.roleDesc, selectedRole === 'livestock_owner' && { color: Colors.bg.primary }]}>{ui.ownerDesc}</Text>
                                            </View>
                                            {selectedRole === 'livestock_owner' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg.primary} />}
                                        </TouchableOpacity>
                                    </ScrollView>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Dots */}
                <View style={styles.dots}>
                    {slides.map((_, i) => {
                        const dotWidth = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [8, 24] });
                        const dotOpacity = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
                        return (
                            <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: slide.accent }]} />
                        );
                    })}
                </View>

                {/* Buttons */}
                <View style={styles.buttons}>
                    {currentIdx > 0 && (
                        <TouchableOpacity style={styles.backBtn} onPress={() => goTo(currentIdx - 1)}>
                            <Ionicons name="arrow-back" size={18} color={Colors.text.secondary} />
                            <Text style={styles.backBtnText}>{ui.backBtn}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.nextBtn, { backgroundColor: slide.accent, flex: currentIdx > 0 ? 1 : undefined }]}
                        onPress={handleNext}
                    >
                        <Text style={styles.nextBtnText}>
                            {currentIdx === slides.length - 1 ? ui.startBtn : ui.nextBtn}
                        </Text>
                        <Ionicons
                            name={currentIdx === slides.length - 1 ? 'rocket' : 'arrow-forward'}
                            size={18}
                            color={Colors.bg.primary}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>
                </View>

                {currentIdx < slides.length - 1 && (
                    <TouchableOpacity onPress={() => goTo(slides.length - 1)} style={styles.skipBtn}>
                        <Text style={styles.skipText}>{ui.skipBtn}</Text>
                    </TouchableOpacity>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    langBtn: {
        position: 'absolute', top: 52, right: Spacing.lg, zIndex: 10,
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    },
    langBtnText: { color: Colors.text.secondary, fontWeight: '700', fontSize: 12 },
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
    iconCircle: {
        width: 120, height: 120, borderRadius: Radius.full,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: Spacing.xl, borderWidth: 2,
    },
    slideTitle: { fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 6, letterSpacing: -0.5 },
    slideSubtitle: { fontSize: 18, fontWeight: '500', color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.lg },
    slideDesc: { fontSize: 16, color: Colors.text.secondary, textAlign: 'center', lineHeight: 24, maxWidth: 320 },
    dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: Spacing.md },
    dot: { height: 8, borderRadius: Radius.full },
    buttons: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.md },
    backBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: Spacing.md,
        borderRadius: Radius.lg, backgroundColor: Colors.bg.secondary,
        borderWidth: 1, borderColor: Colors.border, gap: 4,
    },
    backBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, paddingHorizontal: 32, borderRadius: Radius.lg, minWidth: 160,
    },
    nextBtnText: { color: Colors.bg.primary, fontWeight: '800', fontSize: 16 },
    skipBtn: { alignItems: 'center', paddingBottom: Spacing.md },
    skipText: { color: Colors.text.muted, fontSize: 13 },
    illustrationImg: { width: 240, height: 240, borderRadius: Radius.xl, marginBottom: Spacing.lg },

    // Registration
    regContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.xl, alignItems: 'stretch' },
    inputGroup: { marginBottom: Spacing.md },
    inputLabel: { fontSize: 10, fontWeight: '800', color: Colors.text.muted, letterSpacing: 1.2, marginBottom: 8, marginTop: 4 },
    regInput: {
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.md,
        padding: Spacing.md, color: Colors.text.primary, fontSize: 15,
        borderWidth: 1, borderColor: Colors.border,
    },
    regInputError: { borderColor: Colors.alert.critical },
    errorText: { color: Colors.alert.critical, fontSize: 11, marginTop: 4 },
    roleCard: {
        flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
        backgroundColor: Colors.bg.secondary, borderRadius: Radius.lg,
        borderWidth: 2, borderColor: Colors.border, gap: Spacing.md,
        marginBottom: Spacing.sm, marginTop: 8,
    },
    roleCardActive: { backgroundColor: Colors.brand.primary, borderColor: Colors.brand.primary },
    roleCardText: { flex: 1 },
    roleTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text.primary, marginBottom: 2 },
    roleDesc: { fontSize: 12, color: Colors.text.secondary },
});
