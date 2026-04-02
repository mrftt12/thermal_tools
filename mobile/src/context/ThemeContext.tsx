import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppColors, ThemeMode, themePalettes } from '../theme';

const THEME_MODE_KEY = 'thermal_tools_theme_mode';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: AppColors;
  setMode: (nextMode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  colors: themePalettes.dark,
  setMode: async () => undefined,
  toggleMode: async () => undefined,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    const loadMode = async () => {
      const stored = await AsyncStorage.getItem(THEME_MODE_KEY);
      if (stored === 'dark' || stored === 'light') {
        setModeState(stored);
      }
    };

    void loadMode();
  }, []);

  const setMode = async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  };

  const toggleMode = async () => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    await setMode(nextMode);
  };

  const value = useMemo(
    () => ({
      mode,
      colors: themePalettes[mode],
      setMode,
      toggleMode,
    }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  return useContext(ThemeContext);
}

export function useThemeColors() {
  return useThemeContext().colors;
}
