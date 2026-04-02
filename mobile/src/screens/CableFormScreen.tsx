import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RootStackParamList } from '../../App';
import { useDevice } from '../context/DeviceContext';
import { mobileApi } from '../lib/api';
import { CableCreatePayload } from '../types/api';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CableForm'>;

export function CableFormScreen({ route, navigation }: Props) {
  const cableId = route.params?.cableId;
  const { deviceId } = useDevice();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [designation, setDesignation] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [voltage, setVoltage] = useState('12');
  const [size, setSize] = useState('240');
  const [material, setMaterial] = useState('copper');
  const [numConductors, setNumConductors] = useState('1');

  useEffect(() => {
    const loadCable = async () => {
      if (!deviceId || !cableId) return;
      setLoading(true);

      try {
        const cable = await mobileApi.getCable(deviceId, cableId);
        setDesignation(cable.designation);
        setManufacturer(cable.manufacturer);
        setVoltage(String(cable.voltage_rating_kv));
        setSize(String(cable.conductor.size_mm2));
        setMaterial(cable.conductor.material);
        setNumConductors(String(cable.num_conductors));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load cable';
        Alert.alert('Error', message);
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    void loadCable();
  }, [deviceId, cableId, navigation]);

  const payload = useMemo<CableCreatePayload>(
    () => ({
      designation: designation.trim(),
      manufacturer: manufacturer.trim(),
      voltage_rating_kv: Number(voltage) || 0,
      num_conductors: Number(numConductors) || 1,
      cable_type: Number(numConductors) > 1 ? 'multi-core' : 'single-core',
      conductor: {
        material: material.toLowerCase(),
        size_mm2: Number(size) || 0,
      },
    }),
    [designation, manufacturer, material, numConductors, size, voltage],
  );

  const onSave = async () => {
    if (!deviceId) return;

    if (!payload.designation || !payload.manufacturer || payload.voltage_rating_kv <= 0 || (payload.conductor?.size_mm2 ?? 0) <= 0) {
      Alert.alert('Missing data', 'Please fill designation, manufacturer, voltage and conductor size.');
      return;
    }

    setSaving(true);
    try {
      if (cableId) {
        await mobileApi.updateCable(deviceId, cableId, payload);
      } else {
        await mobileApi.createCable(deviceId, payload);
      }
      Alert.alert('Saved', 'Cable saved successfully');
      navigation.goBack();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save cable';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deviceId || !cableId) return;

    Alert.alert('Delete cable', 'This will permanently remove the custom cable.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await mobileApi.deleteCable(deviceId, cableId);
              Alert.alert('Deleted', 'Cable removed successfully');
              navigation.goBack();
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete cable';
              Alert.alert('Error', message);
            }
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{cableId ? 'Edit Custom Cable' : 'Create Custom Cable'}</Text>

      <View style={styles.inputCard}>
        <Text style={styles.label}>Designation</Text>
        <TextInput value={designation} onChangeText={setDesignation} style={styles.input} placeholder="e.g. Custom XLPE 1x300" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Manufacturer</Text>
        <TextInput value={manufacturer} onChangeText={setManufacturer} style={styles.input} placeholder="e.g. In-house" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Voltage (kV)</Text>
        <TextInput value={voltage} onChangeText={setVoltage} keyboardType="decimal-pad" style={styles.input} placeholder="12" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Conductor Size (mm²)</Text>
        <TextInput value={size} onChangeText={setSize} keyboardType="decimal-pad" style={styles.input} placeholder="240" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Conductor Material</Text>
        <TextInput value={material} onChangeText={setMaterial} style={styles.input} placeholder="copper / aluminum" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Number of Conductors</Text>
        <TextInput value={numConductors} onChangeText={setNumConductors} keyboardType="number-pad" style={styles.input} placeholder="1" placeholderTextColor={colors.textSecondary} />
      </View>

      <Pressable style={styles.saveButton} onPress={onSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Cable'}</Text>
      </Pressable>

      {cableId && (
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>Delete Cable</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0b1120',
    borderRadius: 10,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  saveButton: {
    backgroundColor: colors.cyan,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#06242a',
    fontWeight: '700',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontWeight: '700',
  },
});
