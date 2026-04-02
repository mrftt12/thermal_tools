import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RootStackParamList } from '../../App';
import { useDevice } from '../context/DeviceContext';
import { mobileApi } from '../lib/api';
import { MobileStats } from '../types/api';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { deviceId } = useDevice();
  const [stats, setStats] = useState<MobileStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const payload = await mobileApi.getStats(deviceId);
      setStats(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load dashboard stats';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats]),
  );

  const seedCables = async () => {
    if (!deviceId) return;

    try {
      const result = await mobileApi.seedCables(deviceId);
      Alert.alert('Cable library', result.message);
      await loadStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to seed cable data';
      Alert.alert('Error', message);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>THERMAL TOOLS MOBILE</Text>
      <Text style={styles.title}>Underground Cable Thermal Analysis</Text>
      <Text style={styles.subTitle}>iOS-first Expo app · Device-scoped guest mode</Text>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.cyan} />
          <Text style={styles.loaderText}>Syncing dashboard...</Text>
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Projects</Text>
            <Text style={styles.statValue}>{stats?.project_count ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Calculations</Text>
            <Text style={styles.statValue}>{stats?.calculation_count ?? 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Cables</Text>
            <Text style={styles.statValue}>{stats?.cable_count ?? 0}</Text>
          </View>
        </View>
      )}

      <View style={styles.actionsCard}>
        <Text style={styles.cardTitle}>Core Workflows</Text>
        <Pressable style={styles.primaryAction} onPress={() => navigation.navigate('Projects')}>
          <Text style={styles.primaryActionText}>Open Projects</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={() => navigation.navigate('Cables')}>
          <Text style={styles.secondaryActionText}>Browse Cable Library</Text>
        </Pressable>
        <Pressable style={styles.secondaryAction} onPress={seedCables}>
          <Text style={styles.secondaryActionText}>Seed Standard Cables</Text>
        </Pressable>
      </View>

      <View style={styles.recentCard}>
        <Text style={styles.cardTitle}>Recent Projects</Text>
        {stats?.recent_projects?.length ? (
          stats.recent_projects.map((project) => (
            <Pressable
              key={project.project_id}
              style={styles.projectRow}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: project.project_id })}
            >
              <Text style={styles.projectName}>{project.name}</Text>
              <Text style={styles.projectMeta}>{project.status.toUpperCase()}</Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>No projects yet. Create one from the Projects screen.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    gap: 16,
  },
  kicker: {
    color: colors.cyan,
    letterSpacing: 1.2,
    fontSize: 12,
    marginTop: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  subTitle: {
    color: colors.textSecondary,
    marginTop: -4,
    marginBottom: 6,
  },
  loaderWrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    color: colors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 4,
  },
  actionsCard: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 4,
  },
  primaryAction: {
    backgroundColor: colors.cyan,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#06242a',
    fontWeight: '700',
  },
  secondaryAction: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: colors.cyanMuted,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  recentCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  projectRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#0a0f1a',
    padding: 12,
  },
  projectName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  projectMeta: {
    color: colors.cyan,
    fontSize: 12,
    marginTop: 4,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
});
