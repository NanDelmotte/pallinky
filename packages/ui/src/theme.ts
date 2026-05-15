/** * Path: apps/mobile/constants/theme.ts 
 * Description: Centralized colors and fonts. Added DASHBOARD_THEMES to support 
 * multiple style choices for the main index page. */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// NEW: Themes for the Index page sections
export const DASHBOARD_THEMES: Record<string, any> = {
  classic: {
    bg: '#F6F7F9',
    cardBg: '#ffffff',
    text: '#1f2a1b',
    accent: '#43691b',
    border: '#e2d5c8',
    label: '#43691b'
  },
  dark: {
    bg: '#121212',
    cardBg: '#1e1e1e',
    text: '#ffffff',
    accent: '#bb86fc',
    border: '#333333',
    label: '#bb86fc'
  },
  ocean: {
    bg: '#e0f2f1',
    cardBg: '#ffffff',
    text: '#004d40',
    accent: '#00897b',
    border: '#b2dfdb',
    label: '#00695c'
  },
  sunset: {
    bg: '#fff5f5',
    cardBg: '#ffffff',
    text: '#4a0e0e',
    accent: '#e63946',
    border: '#fed7d7',
    label: '#e63946'
  }
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});