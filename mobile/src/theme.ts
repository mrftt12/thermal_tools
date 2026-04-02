export type ThemeMode = 'dark' | 'light';

export type AppColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  cyan: string;
  cyanMuted: string;
  success: string;
  warning: string;
  danger: string;
  primaryTextOnCyan: string;
  secondarySurface: string;
};

export const themePalettes: Record<ThemeMode, AppColors> = {
  dark: {
    background: '#09090b',
    surface: '#111827',
    surfaceAlt: '#18181b',
    border: '#27272a',
    textPrimary: '#f5f5f5',
    textSecondary: '#a1a1aa',
    cyan: '#22d3ee',
    cyanMuted: '#164e63',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    primaryTextOnCyan: '#06242a',
    secondarySurface: '#0f172a',
  },
  light: {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    border: '#d4d4d8',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    cyan: '#0891b2',
    cyanMuted: '#93c5fd',
    success: '#15803d',
    warning: '#b45309',
    danger: '#b91c1c',
    primaryTextOnCyan: '#ffffff',
    secondarySurface: '#e2e8f0',
  },
};

export const colors = themePalettes.dark;
