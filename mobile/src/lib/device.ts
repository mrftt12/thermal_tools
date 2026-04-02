import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'thermal_tools_mobile_device_id';

const generateDeviceId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timestampPart = Date.now().toString(36);
  return `device_${timestampPart}_${randomPart}`;
};

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = generateDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}
