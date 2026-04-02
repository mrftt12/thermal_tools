import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RootStackParamList } from '../../App';
import { useDevice } from '../context/DeviceContext';
import { mobileApi } from '../lib/api';
import { Project } from '../types/api';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

export function ProjectsScreen({ navigation }: Props) {
  const { deviceId } = useDevice();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);

    try {
      const payload = await mobileApi.listProjects(deviceId);
      setProjects(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load projects';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
    }, [loadProjects]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  return (
    <View style={styles.page}>
      <Pressable style={styles.createButton} onPress={() => navigation.navigate('ProjectForm')}>
        <Text style={styles.createButtonText}>+ New Thermal Project</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.project_id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.project_id })}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.description || 'No description provided'}</Text>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTag}>{item.status.toUpperCase()}</Text>
                <Text style={styles.cardMeta}>{item.cables.length} cable(s)</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No projects yet. Create one to start calculations.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 10,
  },
  createButton: {
    backgroundColor: colors.cyan,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#06242a',
    fontWeight: '700',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  cardMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTag: {
    color: '#a5f3fc',
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.cyanMuted,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});
