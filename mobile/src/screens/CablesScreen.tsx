import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useDevice } from '../context/DeviceContext';
import { useThemeColors } from '../context/ThemeContext';
import { mobileApi } from '../lib/api';
import { Cable } from '../types/api';

export function CablesScreen({ navigation }: { navigation: any }) {
  const { deviceId } = useDevice();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cables, setCables] = useState<Cable[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadCables = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);

    try {
      const payload = await mobileApi.listCables(deviceId, { search: search.trim() || undefined, limit: 150 });
      setCables(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load cable library';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [deviceId, search]);

  useFocusEffect(
    useCallback(() => {
      void loadCables();
    }, [loadCables]),
  );

  const onRefresh = async () => {
    if (!deviceId) return;
    setRefreshing(true);
    await loadCables();
    setRefreshing(false);
  };

  const seedLibrary = async () => {
    if (!deviceId) return;

    try {
      const response = await mobileApi.seedCables(deviceId);
      Alert.alert('Cable library', response.message);
      await loadCables();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to seed cables';
      Alert.alert('Error', message);
    }
  };

  const renderItem = ({ item }: { item: Cable }) => {
    const isCustom = item.created_by?.startsWith('mobile_');

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{item.designation}</Text>
          <Text style={[styles.badge, isCustom ? styles.badgeCustom : styles.badgeLibrary]}>
            {isCustom ? 'CUSTOM' : 'LIBRARY'}
          </Text>
        </View>
        <Text style={styles.cardMeta}>{item.manufacturer} · {item.voltage_rating_kv} kV · {item.conductor.material}</Text>
        <Text style={styles.cardMeta}>Conductor {item.conductor.size_mm2} mm² · {item.num_conductors} core(s)</Text>

        {isCustom && (
          <Pressable
            style={styles.editButton}
            onPress={() => navigation.navigate('CableForm', { cableId: item.cable_id })}
          >
            <Text style={styles.editButtonText}>Edit Custom Cable</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.toolbar}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by designation or manufacturer"
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
          onSubmitEditing={() => void loadCables()}
        />
      </View>

      <View style={styles.actionsRow}>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('CableForm')}>
          <Text style={styles.primaryButtonText}>+ Add Custom Cable</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={seedLibrary}>
          <Text style={styles.secondaryButtonText}>Seed</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      ) : (
        <FlatList
          data={cables}
          keyExtractor={(item) => item.cable_id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.cyan} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No cables found.</Text>}
        />
      )}
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
    toolbar: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 10,
    },
    searchInput: {
      color: colors.textPrimary,
      fontSize: 14,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.cyan,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.primaryTextOnCyan,
      fontWeight: '700',
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.cyanMuted,
      paddingHorizontal: 14,
      borderRadius: 10,
      justifyContent: 'center',
      backgroundColor: colors.secondarySurface,
    },
    secondaryButtonText: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    loaderWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingBottom: 24,
      gap: 10,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontWeight: '700',
      flex: 1,
    },
    cardMeta: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    badge: {
      fontSize: 10,
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontWeight: '700',
    },
    badgeLibrary: {
      backgroundColor: colors.secondarySurface,
      color: colors.textSecondary,
    },
    badgeCustom: {
      backgroundColor: colors.cyanMuted,
      color: colors.textPrimary,
    },
    editButton: {
      marginTop: 2,
      borderWidth: 1,
      borderColor: colors.cyanMuted,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: 'center',
      backgroundColor: colors.secondarySurface,
    },
    editButtonText: {
      color: colors.textPrimary,
      fontWeight: '600',
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
  });
