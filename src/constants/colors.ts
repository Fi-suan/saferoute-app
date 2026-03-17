// SafeRoute / Sapa Jol — Design System
// Inspired by AdvanceWork dark + green glow aesthetic

export const Colors = {
  // Core palette
  brand: {
    primary: '#2ECC71',     // main green accent
    secondary: '#27AE60',   // darker green
    glow: '#2ECC7140',      // green glow for markers
    glowStrong: '#2ECC7180',
  },

  // Backgrounds
  bg: {
    primary: '#0A0F1C',     // deep navy
    secondary: '#131A2E',   // card background
    tertiary: '#1B2340',    // elevated surface
    map: '#0D1117',         // map overlay tint
  },

  // Text
  text: {
    primary: '#F0F2F5',
    secondary: '#9CA3B4',
    muted: '#5A6275',
    accent: '#2ECC71',
  },

  // Alert levels
  alert: {
    critical: '#E74C3C',
    high: '#E67E22',
    medium: '#F1C40F',
    low: '#2ECC71',
    info: '#3498DB',
  },

  // Incident types
  incident: {
    animal: '#E67E22',      // animal on road
    crash: '#E74C3C',       // vehicle crash
    hazard: '#F1C40F',      // road hazard
    resolved: '#2ECC71',    // resolved
  },

  // UI
  white: '#FFFFFF',
  black: '#000000',
  border: '#1E2A45',
  divider: '#1A2238',
  overlay: 'rgba(10, 15, 28, 0.85)',
  success: '#2ECC71',
  error: '#E74C3C',
  warning: '#F1C40F',
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
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: {
    shadowColor: '#2ECC71',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Backend config moved to src/config.ts
// Do not add BACKEND_URL here