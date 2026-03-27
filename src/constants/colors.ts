// SafeRoute / Sapa Jol — Design System
// Nothing Phone dark frosted glass aesthetic

export const Colors = {
    // Core brand
    brand: {
        primary: '#2ECC71',     // Neon green accent
        secondary: '#27AE60',
        glow: '#2ECC7120',
        glowStrong: '#2ECC7150',
    },

    // True-black Nothing Phone backgrounds
    bg: {
        primary: '#000000',     // App root — pure black
        secondary: '#0F0F0F',   // Cards, panels
        tertiary: '#1A1A1A',    // Nested elements, inputs
        map: '#0A0A0A',
        glass: 'rgba(255,255,255,0.04)',    // Frosted glass card fill
        glassStrong: 'rgba(255,255,255,0.07)',
    },

    // Text
    text: {
        primary: '#FFFFFF',
        secondary: '#8A8A8A',   // Nothing uses cooler grey
        muted: '#444444',
        accent: '#2ECC71',
    },

    // Alert levels
    alert: {
        critical: '#FF3B30',
        high: '#FF9500',
        medium: '#FFD60A',
        low: '#2ECC71',
        info: '#0A84FF',
    },

    // Incident types
    incident: {
        animal: '#FF9500',
        crash: '#FF3B30',
        hazard: '#FFD60A',
        resolved: '#2ECC71',
    },

    // UI chrome
    white: '#FFFFFF',
    black: '#000000',
    border: 'rgba(255,255,255,0.08)',    // Subtle white glass border
    borderStrong: 'rgba(255,255,255,0.14)',
    divider: 'rgba(255,255,255,0.05)',
    overlay: 'rgba(0,0,0,0.85)',
    overlayLight: 'rgba(0,0,0,0.60)',
    success: '#34C759',
    error: '#FF3B30',
    warning: '#FFD60A',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const Radius = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    full: 999,
};

export const Shadow = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    glow: {
        shadowColor: '#2ECC71',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    glowRed: {
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
};
