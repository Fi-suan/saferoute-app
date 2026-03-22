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

// Bundled illustration for first onboarding slide
const ROAD_ILLUSTRATION = require('../../road_illustration.webp');

const { width } = Dimensions.get('window');

export interface OnboardingResult {
    name: string;
    phone: string;
    role: UserRole;
}

const SLIDES = [
    {
        icon: 'shield-checkmark',
        title: 'Sapa Jol',
        subtitle: 'Жол қауіпсіздігі жүйесі',
        desc: 'Қазақстан жолдарындағы жануарлар мен жүргізушілерді қорғауға арналған интеллектуалды жүйе.',
        accent: Colors.brand.primary,
    },
    {
        icon: 'location',
        title: 'Белгі қою',
        subtitle: 'нақты уақыттағы карта',
        desc: 'Жүргізушілер жолдағы киіктерді, малдарды немесе шұңқырларды картаға белгілейді. AI әр фотоны тексереді.',
        accent: Colors.alert.medium,
    },
    {
        icon: 'notifications',
        title: 'Ақылды ескерту',
        subtitle: '2 км радиуста',
        desc: 'Қауіпті аймаққа жақындасаңыз — қосымша алдын ала ескертеді. Интернетсіз SMS арқылы жұмыс істейді.',
        accent: Colors.alert.high,
    },
    {
        icon: 'people',
        title: 'Ұжымдық мониторинг',
        subtitle: 'бірге қауіпсіз',
        desc: 'Белгінің жанынан өттіңіз бе? Шешілуін растаңыз. 3 растаудан кейін белгі жойылады.',
        accent: Colors.alert.info,
    },
    {
        icon: 'person-add',
        title: 'Тіркелу',
        subtitle: 'Деректеріңізді енгізіңіз',
        desc: '',
        accent: Colors.brand.primary,
        isRoleSlide: true,
    },
];

export default function OnboardingScreen({ onFinish }: { onFinish: (data: OnboardingResult) => void }) {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [registrationName, setRegistrationName] = useState('');
    const [registrationPhone, setRegistrationPhone] = useState('');
    const scrollRef = useRef<ScrollView>(null);
    const dotAnims = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

    const goTo = (idx: number) => {
        scrollRef.current?.scrollTo({ x: idx * width, animated: true });
        dotAnims.forEach((anim, i) => {
            Animated.timing(anim, {
                toValue: i === idx ? 1 : 0,
                duration: 250,
                useNativeDriver: false,
            }).start();
        });
        setCurrentIdx(idx);
    };

    const isLastSlideValid = selectedRole !== null && registrationName.trim().length > 0;

    const handleNext = () => {
        if (currentIdx < SLIDES.length - 1) {
            goTo(currentIdx + 1);
        } else {
            if (!isLastSlideValid) return;
            onFinish({
                name: registrationName.trim(),
                phone: registrationPhone.trim(),
                role: selectedRole!,
            });
        }
    };

    const slide = SLIDES[currentIdx];

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={false}
                >
                    {SLIDES.map((s, i) => (
                        <View key={i} style={[styles.slide, { width }]}>
                            {i === 0 ? (
                                /* First slide: show road illustration */
                                <Image
                                    source={ROAD_ILLUSTRATION}
                                    style={styles.illustrationImg}
                                    resizeMode="cover"
                                />
                            ) : s.isRoleSlide ? null : (
                                <View style={[styles.iconCircle, { backgroundColor: s.accent + '20', borderColor: s.accent + '40' }]}>
                                    <Ionicons name={s.icon as any} size={56} color={s.accent} />
                                </View>
                            )}

                            {!s.isRoleSlide && (
                                <>
                                    <Text style={[styles.slideTitle, { color: s.accent }]}>{s.title}</Text>
                                    <Text style={styles.slideSubtitle}>{s.subtitle}</Text>
                                    <Text style={styles.slideDesc}>{s.desc}</Text>
                                </>
                            )}

                            {/* Регистрационная форма (последний слайд) */}
                            {s.isRoleSlide && (
                                <ScrollView
                                    style={{ width: '100%' }}
                                    contentContainerStyle={styles.regContainer}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    <Text style={[styles.slideTitle, { color: s.accent, marginBottom: 4 }]}>{s.title}</Text>
                                    <Text style={styles.slideSubtitle}>{s.subtitle}</Text>

                                    {/* Имя */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>АТЫ-ЖӨНІ</Text>
                                        <TextInput
                                            style={styles.regInput}
                                            value={registrationName}
                                            onChangeText={setRegistrationName}
                                            placeholder="Мысалы: Асқар Жанасов"
                                            placeholderTextColor={Colors.text.muted}
                                            maxLength={40}
                                            autoCapitalize="words"
                                        />
                                    </View>

                                    {/* Телефон — опционально */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>
                                            ТЕЛЕФОН{' '}
                                            <Text style={styles.inputLabelOptional}>(міндетті емес)</Text>
                                        </Text>
                                        <TextInput
                                            style={styles.regInput}
                                            value={registrationPhone}
                                            onChangeText={setRegistrationPhone}
                                            placeholder="+7 700 000 0000"
                                            placeholderTextColor={Colors.text.muted}
                                            keyboardType="phone-pad"
                                            maxLength={17}
                                        />
                                    </View>

                                    {/* Выбор роли */}
                                    <Text style={styles.inputLabel}>РӨЛІҢІЗДІ ТАҢДАҢЫЗ</Text>

                                    <TouchableOpacity
                                        style={[styles.roleCard, selectedRole === 'driver' && styles.roleCardActive]}
                                        onPress={() => setSelectedRole('driver')}
                                    >
                                        <Ionicons name="car" size={32} color={selectedRole === 'driver' ? Colors.bg.primary : Colors.text.primary} />
                                        <View style={styles.roleCardText}>
                                            <Text style={[styles.roleTitle, selectedRole === 'driver' && { color: Colors.bg.primary }]}>
                                                Жүргізуші
                                            </Text>
                                            <Text style={[styles.roleDesc, selectedRole === 'driver' && { color: Colors.bg.primary }]}>
                                                Жол ескертулерін алады
                                            </Text>
                                        </View>
                                        {selectedRole === 'driver' && (
                                            <Ionicons name="checkmark-circle" size={22} color={Colors.bg.primary} />
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.roleCard, selectedRole === 'livestock_owner' && styles.roleCardActive]}
                                        onPress={() => setSelectedRole('livestock_owner')}
                                    >
                                        <Ionicons name="paw" size={32} color={selectedRole === 'livestock_owner' ? Colors.bg.primary : Colors.text.primary} />
                                        <View style={styles.roleCardText}>
                                            <Text style={[styles.roleTitle, selectedRole === 'livestock_owner' && { color: Colors.bg.primary }]}>
                                                Мал иесі
                                            </Text>
                                            <Text style={[styles.roleDesc, selectedRole === 'livestock_owner' && { color: Colors.bg.primary }]}>
                                                Малды тіркеу және қорғау
                                            </Text>
                                        </View>
                                        {selectedRole === 'livestock_owner' && (
                                            <Ionicons name="checkmark-circle" size={22} color={Colors.bg.primary} />
                                        )}
                                    </TouchableOpacity>
                                </ScrollView>
                            )}
                        </View>
                    ))}
                </ScrollView>

                {/* Dots */}
                <View style={styles.dots}>
                    {SLIDES.map((_, i) => {
                        const dotWidth = dotAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [8, 24],
                        });
                        const dotOpacity = dotAnims[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                        });
                        return (
                            <Animated.View
                                key={i}
                                style={[
                                    styles.dot,
                                    { width: dotWidth, opacity: dotOpacity, backgroundColor: slide.accent },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Buttons */}
                <View style={styles.buttons}>
                    {currentIdx > 0 && (
                        <TouchableOpacity style={styles.backBtn} onPress={() => goTo(currentIdx - 1)}>
                            <Ionicons name="arrow-back" size={18} color={Colors.text.secondary} />
                            <Text style={styles.backBtnText}>Артқа</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[
                            styles.nextBtn,
                            { backgroundColor: slide.accent, flex: currentIdx > 0 ? 1 : undefined },
                            (slide.isRoleSlide && !isLastSlideValid) && { opacity: 0.5 },
                        ]}
                        onPress={handleNext}
                        disabled={slide.isRoleSlide && !isLastSlideValid}
                    >
                        <Text style={styles.nextBtnText}>
                            {currentIdx === SLIDES.length - 1 ? 'Бастау' : 'Келесі'}
                        </Text>
                        <Ionicons
                            name={currentIdx === SLIDES.length - 1 ? 'rocket' : 'arrow-forward'}
                            size={18}
                            color={Colors.bg.primary}
                            style={{ marginLeft: 6 }}
                        />
                    </TouchableOpacity>
                </View>

                {currentIdx < SLIDES.length - 1 && (
                    <TouchableOpacity onPress={() => goTo(SLIDES.length - 1)} style={styles.skipBtn}>
                        <Text style={styles.skipText}>Өткізу</Text>
                    </TouchableOpacity>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.primary },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: Radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
        borderWidth: 2,
    },
    slideTitle: {
        fontSize: 32,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 6,
        letterSpacing: -0.5,
    },
    slideSubtitle: {
        fontSize: 18,
        fontWeight: '500',
        color: Colors.text.secondary,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    slideDesc: {
        fontSize: 16,
        color: Colors.text.secondary,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 320,
    },
    dots: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingBottom: Spacing.md,
    },
    dot: { height: 8, borderRadius: Radius.full },
    buttons: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.secondary,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 4,
    },
    backBtnText: { color: Colors.text.secondary, fontWeight: '600', fontSize: 15 },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: Radius.lg,
        minWidth: 160,
    },
    nextBtnText: { color: Colors.bg.primary, fontWeight: '800', fontSize: 16 },
    skipBtn: { alignItems: 'center', paddingBottom: Spacing.md },
    skipText: { color: Colors.text.muted, fontSize: 13 },
    illustrationImg: {
        width: 240,
        height: 240,
        borderRadius: Radius.xl,
        marginBottom: Spacing.lg,
    },

    // Registration slide
    regContainer: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.md,
        paddingBottom: Spacing.xl,
        alignItems: 'stretch',
    },
    inputGroup: { marginBottom: Spacing.md },
    inputLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: Colors.text.muted,
        letterSpacing: 1.2,
        marginBottom: 8,
        marginTop: 4,
    },
    inputLabelOptional: {
        fontSize: 10,
        fontWeight: '400',
        color: Colors.text.muted,
        textTransform: 'lowercase',
    },
    regInput: {
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.md,
        padding: Spacing.md,
        color: Colors.text.primary,
        fontSize: 15,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    roleCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.bg.secondary,
        borderRadius: Radius.lg,
        borderWidth: 2,
        borderColor: Colors.border,
        gap: Spacing.md,
        marginBottom: Spacing.sm,
        marginTop: 8,
    },
    roleCardActive: {
        backgroundColor: Colors.brand.primary,
        borderColor: Colors.brand.primary,
    },
    roleCardText: { flex: 1 },
    roleTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: 2,
    },
    roleDesc: {
        fontSize: 12,
        color: Colors.text.secondary,
    },
});
