import Constants from 'expo-constants';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useThemeContext } from '../context/ThemeContext';

export function SettingsScreen() {
  const { deviceId } = useDevice();
  const { mode, colors, toggleMode } = useThemeContext();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'Not configured';

  const copyInfo = () => {
    Alert.alert('Info', 'Device and environment values are shown below for debugging and support.');
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Theme Mode</Text>
          <Text style={styles.modeText}>{mode === 'dark' ? 'Dark' : 'Light'}</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Enable dark mode</Text>
          <Switch value={mode === 'dark'} onValueChange={() => void toggleMode()} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Environment</Text>
        <Text style={styles.valueLabel}>Device ID</Text>
        <Text style={styles.valueText}>{deviceId ?? 'Loading...'}</Text>

        <Text style={styles.valueLabel}>Backend URL</Text>
        <Text style={styles.valueText}>{backendUrl}</Text>

        <Text style={styles.valueLabel}>App Version</Text>
        <Text style={styles.valueText}>{appVersion}</Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={copyInfo}>
        <Text style={styles.secondaryButtonText}>Environment Notes</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeContext>['colors']) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      gap: 12,
      paddingBottom: 36,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 8,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    modeText: {
      color: colors.cyan,
      fontWeight: '700',
      fontSize: 12,
    },
    valueLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 4,
    },
    valueText: {
      color: colors.textPrimary,
      fontSize: 13,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.cyanMuted,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: 'center',
      backgroundColor: colors.secondarySurface,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
  });
