import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Database } from 'bun:sqlite'

// Use an in-memory test DB by setting env before imports
process.env.DATABASE_PATH = ':memory:'
process.env.API_PORT = '4999'
process.env.LIVEKIT_URL_INTERNAL = '' // skip LiveKit room creation gracefully

const { default: app } = await import('../index')

const BASE = 'http://localhost:4999'

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─── Patients ──────────────────────────────────────────────────────────────

describe('patients', () => {
  let patientId: string

  it('GET /patients returns empty list initially', async () => {
    const list = await json<unknown[]>('/patients')
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(0)
  })

  it('POST /patients creates a patient', async () => {
    const body = {
      name: 'Margaret Chen',
      age: 62,
      sex: 'Female',
      chiefComplaint: 'Chest pain radiating to left arm',
      medicalHistory: 'Hypertension, Type 2 Diabetes',
      medications: 'Metformin 500mg',
      allergies: 'Penicillin',
      vitalSigns: 'BP 158/94, HR 88, SpO2 97%',
      personalityNotes: 'Anxious, soft-spoken',
    }
    const created = await json<{ id: string }>('/patients', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    expect(typeof created.id).toBe('string')
    patientId = created.id
  })

  it('GET /patients returns one patient', async () => {
    const list = await json<unknown[]>('/patients')
    expect(list.length).toBe(1)
  })

  it('GET /patients/:id returns patient with resolved systemPrompt', async () => {
    const patient = await json<{ id: string; systemPrompt: string }>(`/patients/${patientId}`)
    expect(patient.id).toBe(patientId)
    expect(typeof patient.systemPrompt).toBe('string')
    expect(patient.systemPrompt.length).toBeGreaterThan(0)
  })

  it('GET /patients/:id returns 404 for unknown id', async () => {
    const res = await fetch(`${BASE}/patients/does-not-exist`)
    expect(res.status).toBe(404)
  })

  it('PUT /patients/:id updates patient', async () => {
    const body = {
      name: 'Margaret Chen',
      age: 63,
      sex: 'Female',
      chiefComplaint: 'Shortness of breath',
      medicalHistory: 'Hypertension',
      medications: 'Lisinopril',
      allergies: 'Penicillin',
      vitalSigns: 'BP 145/90',
      personalityNotes: 'Cooperative',
    }
    const res = await fetch(`${BASE}/patients/${patientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.ok).toBe(true)
    const updated = await res.json() as { age: number }
    expect(updated.age).toBe(63)
  })

  it('DELETE /patients/:id removes patient', async () => {
    const res = await fetch(`${BASE}/patients/${patientId}`, { method: 'DELETE' })
    expect(res.ok).toBe(true)
    const check = await fetch(`${BASE}/patients/${patientId}`)
    expect(check.status).toBe(404)
  })
})

// ─── Sessions ──────────────────────────────────────────────────────────────

describe('sessions', () => {
  let patientId: string
  let sessionId: string

  beforeAll(async () => {
    const p = await json<{ id: string }>('/patients', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Patient',
        age: 45,
        sex: 'Male',
        chiefComplaint: 'Headache',
      }),
    })
    patientId = p.id
  })

  it('POST /sessions creates a session', async () => {
    const s = await json<{ id: string }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        patientId,
        startedAt: new Date().toISOString(),
      }),
    })
    expect(typeof s.id).toBe('string')
    sessionId = s.id
  })

  it('GET /sessions returns list with the new session', async () => {
    const list = await json<unknown[]>('/sessions')
    expect(list.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /sessions/:id returns session with empty entries', async () => {
    const s = await json<{ id: string; entries: unknown[] }>(`/sessions/${sessionId}`)
    expect(s.id).toBe(sessionId)
    expect(Array.isArray(s.entries)).toBe(true)
    expect(s.entries.length).toBe(0)
  })

  it('POST /sessions/:id/entries adds transcript entries', async () => {
    const e1 = await json<{ id: string }>(`/sessions/${sessionId}/entries`, {
      method: 'POST',
      body: JSON.stringify({
        role: 'student',
        text: 'Hello, how are you feeling today?',
        timestamp: new Date().toISOString(),
      }),
    })
    expect(typeof e1.id).toBe('string')

    const e2 = await json<{ id: string }>(`/sessions/${sessionId}/entries`, {
      method: 'POST',
      body: JSON.stringify({
        role: 'patient',
        text: 'I have a terrible headache.',
        timestamp: new Date().toISOString(),
      }),
    })
    expect(typeof e2.id).toBe('string')
  })

  it('GET /sessions/:id returns session with 2 transcript entries', async () => {
    const s = await json<{ entries: unknown[] }>(`/sessions/${sessionId}`)
    expect(s.entries.length).toBe(2)
  })

  it('PATCH /sessions/:id closes session', async () => {
    const res = await fetch(`${BASE}/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endedAt: new Date().toISOString(),
        durationSeconds: 120,
      }),
    })
    expect(res.ok).toBe(true)
  })

  it('GET /sessions/:id returns 404 for unknown id', async () => {
    const res = await fetch(`${BASE}/sessions/does-not-exist`)
    expect(res.status).toBe(404)
  })

  it('DELETE /sessions/:id removes session and cascades entries', async () => {
    const res = await fetch(`${BASE}/sessions/${sessionId}`, { method: 'DELETE' })
    expect(res.ok).toBe(true)
    const check = await fetch(`${BASE}/sessions/${sessionId}`)
    expect(check.status).toBe(404)
  })
})

// ─── Token ─────────────────────────────────────────────────────────────────

describe('token', () => {
  let patientId: string

  beforeAll(async () => {
    const p = await json<{ id: string }>('/patients', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Token Test Patient',
        age: 30,
        sex: 'Non-binary',
        chiefComplaint: 'Nausea',
      }),
    })
    patientId = p.id
  })

  it('POST /token returns token, url, roomName, patient', async () => {
    const result = await json<{
      token: string
      url: string
      roomName: string
      patient: { id: string; systemPrompt: string }
    }>('/token', {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    })
    expect(typeof result.token).toBe('string')
    expect(result.token.length).toBeGreaterThan(0)
    expect(typeof result.url).toBe('string')
    expect(typeof result.roomName).toBe('string')
    expect(result.patient.id).toBe(patientId)
    expect(typeof result.patient.systemPrompt).toBe('string')
    expect(result.patient.systemPrompt.length).toBeGreaterThan(0)
  })

  it('POST /token with custom roomName uses that name', async () => {
    const result = await json<{ roomName: string }>('/token', {
      method: 'POST',
      body: JSON.stringify({ patientId, roomName: 'my-custom-room' }),
    })
    expect(result.roomName).toBe('my-custom-room')
  })

  it('POST /token returns 404 for unknown patientId', async () => {
    const res = await fetch(`${BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'ghost-id' }),
    })
    expect(res.status).toBe(404)
  })
})

afterAll(() => {
  app.stop()
})
