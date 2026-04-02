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
import { Cable, Project, ProjectCreatePayload } from '../types/api';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectForm'>;

const phaseSequence = ['A', 'B', 'C'];

export function ProjectFormScreen({ route, navigation }: Props) {
  const projectId = route.params?.projectId;
  const { deviceId } = useDevice();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableCables, setAvailableCables] = useState<Cable[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ambientTemp, setAmbientTemp] = useState('20');
  const [burialDepth, setBurialDepth] = useState('1');
  const [soilResistivity, setSoilResistivity] = useState('1');
  const [method, setMethod] = useState<'neher_mcgrath' | 'c57_91_2011'>('neher_mcgrath');
  const [selectedLoads, setSelectedLoads] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      if (!deviceId) return;
      setLoading(true);

      try {
        const [cables, project] = await Promise.all([
          mobileApi.listCables(deviceId, { limit: 50 }),
          projectId ? mobileApi.getProject(deviceId, projectId) : Promise.resolve(null as Project | null),
        ]);

        setAvailableCables(cables);

        if (project) {
          setName(project.name);
          setDescription(project.description || '');
          setAmbientTemp(String(project.installation.ambient_temp_c));
          setBurialDepth(String(project.installation.burial_depth_m));
          setSoilResistivity(String(project.installation.soil_thermal_resistivity));
          setMethod(project.parameters.method === 'c57_91_2011' ? 'c57_91_2011' : 'neher_mcgrath');

          const restored: Record<string, string> = {};
          project.cables.forEach((cablePosition) => {
            restored[cablePosition.cable_id] = String(cablePosition.current_load_a);
          });
          setSelectedLoads(restored);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load project data';
        Alert.alert('Error', message);
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [deviceId, navigation, projectId]);

  const selectedCableCount = useMemo(() => Object.keys(selectedLoads).length, [selectedLoads]);

  const toggleCable = (cableId: string) => {
    setSelectedLoads((current) => {
      if (current[cableId]) {
        const clone = { ...current };
        delete clone[cableId];
        return clone;
      }

      return {
        ...current,
        [cableId]: '250',
      };
    });
  };

  const setCableLoad = (cableId: string, value: string) => {
    setSelectedLoads((current) => ({
      ...current,
      [cableId]: value,
    }));
  };

  const buildPayload = (): ProjectCreatePayload => {
    const entries = Object.entries(selectedLoads);

    return {
      name: name.trim(),
      description: description.trim(),
      installation: {
        installation_type: 'direct_burial',
        burial_depth_m: Number(burialDepth) || 1,
        ambient_temp_c: Number(ambientTemp) || 20,
        soil_thermal_resistivity: Number(soilResistivity) || 1,
      },
      cables: entries.map(([cableId, load], index) => ({
        cable_id: cableId,
        position_x: Number((index * 0.2).toFixed(2)),
        position_y: Number(burialDepth) || 1,
        current_load_a: Number(load) || 250,
        load_factor: 1,
        phase: phaseSequence[index % phaseSequence.length],
      })),
      parameters: {
        method,
        calculation_type: 'steady_state',
        daily_loss_factor: 0.7,
        transformer_settings: {},
      },
    };
  };

  const onSave = async () => {
    if (!deviceId) return;

    if (!name.trim()) {
      Alert.alert('Missing project name', 'Please enter a project name.');
      return;
    }

    if (!selectedCableCount) {
      Alert.alert('No cables selected', 'Select at least one cable to run thermal calculations.');
      return;
    }

    const payload = buildPayload();
    setSaving(true);

    try {
      const project = projectId
        ? await mobileApi.updateProject(deviceId, projectId, payload)
        : await mobileApi.createProject(deviceId, payload);

      Alert.alert('Saved', 'Project saved successfully.');
      navigation.replace('ProjectDetail', { projectId: project.project_id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save project';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
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
      <Text style={styles.title}>{projectId ? 'Edit Project' : 'Create Project'}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Project Name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="City Center Feeder" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} style={styles.input} placeholder="Optional" placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Ambient Temperature (°C)</Text>
        <TextInput value={ambientTemp} onChangeText={setAmbientTemp} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Burial Depth (m)</Text>
        <TextInput value={burialDepth} onChangeText={setBurialDepth} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />

        <Text style={styles.label}>Soil Thermal Resistivity (K.m/W)</Text>
        <TextInput value={soilResistivity} onChangeText={setSoilResistivity} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.textSecondary} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Calculation Method</Text>
        <View style={styles.methodsRow}>
          <Pressable
            style={[styles.methodButton, method === 'neher_mcgrath' && styles.methodButtonActive]}
            onPress={() => setMethod('neher_mcgrath')}
          >
            <Text style={[styles.methodButtonText, method === 'neher_mcgrath' && styles.methodButtonTextActive]}>Neher-McGrath</Text>
          </Pressable>
          <Pressable
            style={[styles.methodButton, method === 'c57_91_2011' && styles.methodButtonActive]}
            onPress={() => setMethod('c57_91_2011')}
          >
            <Text style={[styles.methodButtonText, method === 'c57_91_2011' && styles.methodButtonTextActive]}>C57.91 DTR</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cable Assignment ({selectedCableCount} selected)</Text>
        {availableCables.map((cable) => {
          const selected = selectedLoads[cable.cable_id] !== undefined;
          return (
            <View style={styles.cableRow} key={cable.cable_id}>
              <Pressable style={styles.checkboxRow} onPress={() => toggleCable(cable.cable_id)}>
                <View style={[styles.checkbox, selected && styles.checkboxChecked]} />
                <View style={styles.cableInfo}>
                  <Text style={styles.cableName}>{cable.designation}</Text>
                  <Text style={styles.cableMeta}>{cable.manufacturer} · {cable.voltage_rating_kv} kV</Text>
                </View>
              </Pressable>

              {selected && (
                <TextInput
                  value={selectedLoads[cable.cable_id]}
                  onChangeText={(value) => setCableLoad(cable.cable_id, value)}
                  keyboardType="decimal-pad"
                  style={styles.loadInput}
                  placeholder="A"
                  placeholderTextColor={colors.textSecondary}
                />
              )}
            </View>
          );
        })}
      </View>

      <Pressable style={styles.saveButton} onPress={onSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Project'}</Text>
      </Pressable>
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
    paddingBottom: 34,
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
    marginBottom: 3,
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
  methodsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#111827',
    paddingVertical: 10,
    alignItems: 'center',
  },
  methodButtonActive: {
    borderColor: colors.cyan,
    backgroundColor: '#0f172a',
  },
  methodButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  methodButtonTextActive: {
    color: colors.textPrimary,
  },
  cableRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#0b1120',
    padding: 8,
    gap: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  checkboxChecked: {
    backgroundColor: colors.cyan,
    borderColor: colors.cyan,
  },
  cableInfo: {
    flex: 1,
  },
  cableName: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  cableMeta: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  loadInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 7,
    width: 90,
    alignSelf: 'flex-end',
  },
  saveButton: {
    backgroundColor: colors.cyan,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: '#06242a',
    fontWeight: '700',
  },
});
