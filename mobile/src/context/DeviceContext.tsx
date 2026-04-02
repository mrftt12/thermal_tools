import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { getOrCreateDeviceId } from '../lib/device';

interface DeviceContextValue {
  deviceId: string | null;
  loading: boolean;
}

const DeviceContext = createContext<DeviceContextValue>({
  deviceId: null,
  loading: true,
});

export function DeviceProvider({ children }: PropsWithChildren) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const id = await getOrCreateDeviceId();
      setDeviceId(id);
      setLoading(false);
    };

    void load();
  }, []);

  const value = useMemo(
    () => ({
      deviceId,
      loading,
    }),
    [deviceId, loading],
  );

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  return useContext(DeviceContext);
}
