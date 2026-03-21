// SafeRoute / Sapa Jol — Design System
// Inspired by AdvanceWork dark + green glow aesthetic

export const Colors = {
  // Core palette
  brand: {
    primary: '#2ECC71',     // Reverted back to neon green
    secondary: '#27AE60',
    glow: '#2ECC7140',
    glowStrong: '#2ECC7180',
  },

  // Backgrounds - matching the image's dark slate/carbon
  bg: {
    primary: '#1E2028',     // map background / root
    secondary: '#272935',   // floating panels, darker than before
    tertiary: '#313442',    // cards inside panels
    map: '#1E2028',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#A3A6B4',
    muted: '#6B6E7D',
    accent: '#2ECC71',
  },

  // Alert levels
  alert: {
    critical: '#E74C3C',    // restored to standard red (less aggressive than radar red)
    high: '#E67E22',
    medium: '#F1C40F',
    low: '#2ECC71',
    info: '#3498DB',
  },

  // Incident types
  incident: {
    animal: '#E67E22',
    crash: '#E74C3C',
    hazard: '#F1C40F',
    resolved: '#2ECC71',
  },

  // UI
  white: '#FFFFFF',
  black: '#000000',
  border: '#383B4A',        // Subtle panel borders
  divider: '#313442',
  overlay: 'rgba(39, 41, 53, 0.95)', // Solid glassmorphism like the image
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FFCC00',
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
    shadowColor: '#FF5722',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
};

// Backend config moved to src/config.ts
// Do not add BACKEND_URL here