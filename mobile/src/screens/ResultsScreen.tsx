import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDevice } from '../context/DeviceContext';
import { useThemeColors } from '../context/ThemeContext';
import { mobileApi } from '../lib/api';
import { CalculationResult } from '../types/api';

export function ResultsScreen({ route }: { route: any }) {
  const { projectId } = route.params;
  const { deviceId } = useDevice();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [results, setResults] = useState<CalculationResult[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);

    try {
      const payload = await mobileApi.getResults(deviceId, projectId);
      setResults(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load results';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [deviceId, projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const latest = useMemo(() => (results.length ? results[0] : null), [results]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {latest ? (
        <View style={styles.highlightCard}>
          <Text style={styles.highlightTitle}>Latest Calculation</Text>
          <Text style={styles.highlightMeta}>Method: {latest.calculation_method}</Text>
          <Text style={styles.highlightMeta}>Runtime: {Math.round(latest.calculation_time_ms)} ms</Text>
          <Text style={styles.highlightMeta}>
            Hotspot: {String(latest.hotspot_info.temperature_c ?? 'N/A')} °C
          </Text>
        </View>
      ) : (
        <Text style={styles.emptyText}>No results yet. Run a calculation first.</Text>
      )}

      <FlatList
        data={latest?.ampacity_values ?? []}
        keyExtractor={(item, index) => `${String(item.cable_id)}-${index}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{String(item.cable_id)}</Text>
            <Text style={styles.cardMeta}>Ampacity: {String(item.ampacity_a ?? 'N/A')} A</Text>
            <Text style={styles.cardMeta}>Derating: {String(item.derating_factor ?? item.derating ?? 'N/A')}</Text>
            <Text style={styles.cardMeta}>Operating Temp: {String(item.operating_temp_c ?? 'N/A')} °C</Text>
          </View>
        )}
        ListEmptyComponent={latest ? <Text style={styles.emptyText}>No ampacity rows available.</Text> : null}
      />
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
      gap: 10,
    },
    loaderWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    highlightCard: {
      backgroundColor: colors.secondarySurface,
      borderWidth: 1,
      borderColor: colors.cyanMuted,
      borderRadius: 14,
      padding: 12,
      gap: 5,
    },
    highlightTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    highlightMeta: {
      color: colors.textPrimary,
      fontSize: 13,
    },
    listContent: {
      gap: 10,
      paddingBottom: 30,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
    },
    cardMeta: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
  });
