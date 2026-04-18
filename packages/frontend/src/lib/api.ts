import type {
  PatientSummary,
  PatientProfile,
  PatientFormData,
  SessionSummary,
  SessionDetail,
  TokenResponse,
} from '../types/patient'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  patients: {
    list: () => request<PatientSummary[]>('/patients'),
    get: (id: string) => request<PatientProfile>(`/patients/${id}`),
    create: (data: PatientFormData) =>
      request<PatientProfile>('/patients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: PatientFormData) =>
      request<PatientProfile>(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/patients/${id}`, { method: 'DELETE' }),
  },
  sessions: {
    list: () => request<SessionSummary[]>('/sessions'),
    get: (id: string) => request<SessionDetail>(`/sessions/${id}`),
    delete: (id: string) =>
      request<{ deleted: boolean }>(`/sessions/${id}`, { method: 'DELETE' }),
  },
  token: {
    create: (patientId: string) =>
      request<TokenResponse>('/token', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      }),
  },
}
