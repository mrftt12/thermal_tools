import {
  AIChatResponse,
  AIHistoryResponse,
  Cable,
  CableCreatePayload,
  CalculationResult,
  MobileStats,
  Project,
  ProjectCreatePayload,
} from '../types/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_ROOT = `${BACKEND_URL}/api/mobile`;

type QueryValue = string | number | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  deviceId: string;
  query?: Record<string, QueryValue>;
}

const toQueryString = (query?: Record<string, QueryValue>): string => {
  if (!query) return '';
  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return params.length > 0 ? `?${params.join('&')}` : '';
};

async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  if (!BACKEND_URL) {
    throw new Error('EXPO_PUBLIC_BACKEND_URL is missing. Add it to /app/mobile/.env');
  }

  const response = await fetch(`${API_ROOT}${path}${toQueryString(options.query)}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-mobile-device-id': options.deviceId,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errorPayload = (await response.json()) as { detail?: string };
      if (errorPayload.detail) {
        detail = errorPayload.detail;
      }
    } catch {
      // keep fallback
    }

    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export const mobileApi = {
  getStats: (deviceId: string) => apiRequest<MobileStats>('/stats', { deviceId }),
  seedCables: (deviceId: string) => apiRequest<{ message: string }>('/seed-cables', { method: 'POST', deviceId }),

  listCables: (deviceId: string, query?: Record<string, QueryValue>) =>
    apiRequest<Cable[]>('/cables', { deviceId, query }),
  getCable: (deviceId: string, cableId: string) => apiRequest<Cable>(`/cables/${cableId}`, { deviceId }),
  createCable: (deviceId: string, payload: CableCreatePayload) =>
    apiRequest<Cable>('/cables', { method: 'POST', body: payload, deviceId }),
  updateCable: (deviceId: string, cableId: string, payload: CableCreatePayload) =>
    apiRequest<Cable>(`/cables/${cableId}`, { method: 'PUT', body: payload, deviceId }),
  deleteCable: (deviceId: string, cableId: string) =>
    apiRequest<{ message: string }>(`/cables/${cableId}`, { method: 'DELETE', deviceId }),

  listProjects: (deviceId: string) => apiRequest<Project[]>('/projects', { deviceId }),
  getProject: (deviceId: string, projectId: string) => apiRequest<Project>(`/projects/${projectId}`, { deviceId }),
  createProject: (deviceId: string, payload: ProjectCreatePayload) =>
    apiRequest<Project>('/projects', { method: 'POST', body: payload, deviceId }),
  updateProject: (deviceId: string, projectId: string, payload: ProjectCreatePayload) =>
    apiRequest<Project>(`/projects/${projectId}`, { method: 'PUT', body: payload, deviceId }),
  deleteProject: (deviceId: string, projectId: string) =>
    apiRequest<{ message: string }>(`/projects/${projectId}`, { method: 'DELETE', deviceId }),

  runCalculation: (deviceId: string, projectId: string) =>
    apiRequest<CalculationResult>(`/calculate/${projectId}`, { method: 'POST', deviceId }),
  getResults: (deviceId: string, projectId: string) =>
    apiRequest<CalculationResult[]>(`/results/${projectId}`, { deviceId }),

  getAIMessages: (deviceId: string, sessionId = 'default') =>
    apiRequest<AIHistoryResponse>('/ai/messages', {
      deviceId,
      query: { session_id: sessionId, limit: 120 },
    }),
  sendAIMessage: (deviceId: string, message: string, sessionId = 'default') =>
    apiRequest<AIChatResponse>('/ai/chat', {
      method: 'POST',
      deviceId,
      body: { message, session_id: sessionId },
    }),
};
