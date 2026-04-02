import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDevice } from '../context/DeviceContext';
import { useThemeColors } from '../context/ThemeContext';
import { mobileApi } from '../lib/api';
import { Project } from '../types/api';

export function ProjectDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { projectId } = route.params;
  const { deviceId } = useDevice();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [project, setProject] = useState<Project | null>(null);
  const [resultCount, setResultCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);

    try {
      const [projectPayload, resultsPayload] = await Promise.all([
        mobileApi.getProject(deviceId, projectId),
        mobileApi.getResults(deviceId, projectId),
      ]);
      setProject(projectPayload);
      setResultCount(resultsPayload.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load project details';
      Alert.alert('Error', message);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [deviceId, navigation, projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const runCalculation = async () => {
    if (!deviceId) return;

    setRunning(true);
    try {
      const result = await mobileApi.runCalculation(deviceId, projectId);
      Alert.alert('Calculation complete', `Runtime: ${Math.round(result.calculation_time_ms)} ms`);
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run calculation';
      Alert.alert('Error', message);
    } finally {
      setRunning(false);
    }
  };

  const deleteProject = () => {
    if (!deviceId) return;

    Alert.alert('Delete project', 'This will remove the project and all its calculation results.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await mobileApi.deleteProject(deviceId, projectId);
              Alert.alert('Deleted', 'Project removed successfully');
              navigation.replace('MainTabs');
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete project';
              Alert.alert('Error', message);
            }
          })();
        },
      },
    ]);
  };

  if (loading || !project) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  const methodLabel = project.parameters.calculation_type === 'transient' ? 'Transient' : 'Neher-McGrath';

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{project.name}</Text>
      <Text style={styles.description}>{project.description || 'No description provided'}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Project Snapshot</Text>
        <Text style={styles.meta}>Status: {project.status.toUpperCase()}</Text>
        <Text style={styles.meta}>Method: {methodLabel}</Text>
        <Text style={styles.meta}>Cables: {project.cables.length}</Text>
        <Text style={styles.meta}>Ambient: {project.installation.ambient_temp_c} °C</Text>
        <Text style={styles.meta}>Burial depth: {project.installation.burial_depth_m} m</Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButton} onPress={runCalculation} disabled={running}>
          <Text style={styles.primaryButtonText}>{running ? 'Running...' : 'Run Calculation'}</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('Results', { projectId })}
      >
        <Text style={styles.secondaryButtonText}>View Results ({resultCount})</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('ProjectForm', { projectId })}
      >
        <Text style={styles.secondaryButtonText}>Edit Project Inputs</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={deleteProject}>
        <Text style={styles.deleteButtonText}>Delete Project</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    loaderWrap: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '700',
    },
    description: {
      color: colors.textSecondary,
      marginTop: -4,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 6,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      marginBottom: 3,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.cyan,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.primaryTextOnCyan,
      fontWeight: '700',
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.cyanMuted,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      backgroundColor: colors.secondarySurface,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    deleteButton: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    deleteButtonText: {
      color: colors.danger,
      fontWeight: '700',
    },
  });
