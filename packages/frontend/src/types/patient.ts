export interface PatientSummary {
  id: string
  name: string
  age: number
  gender: string
  chiefComplaint: string
  createdAt: string
}

export interface PatientProfile extends PatientSummary {
  medicalHistory: string
  medications: string
  allergies: string
  vitalSigns: string
  personalityNotes: string
  systemPrompt: string
  updatedAt: string
}

export interface PatientFormData {
  name: string
  age: number
  gender: string
  chiefComplaint: string
  medicalHistory: string
  medications: string
  allergies: string
  vitalSigns: string
  personalityNotes: string
  systemPrompt: string
}

export interface SessionSummary {
  id: string
  patientId: string
  patientName: string | null
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
}

export interface TranscriptEntry {
  id: string
  sessionId: string
  role: 'student' | 'patient'
  text: string
  timestamp: string
}

export interface SessionDetail {
  id: string
  patientId: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  patient: { name: string; chiefComplaint: string } | null
  entries: TranscriptEntry[]
}

export interface TokenResponse {
  token: string
  url: string
  roomName: string
  sessionId: string
  patient: {
    id: string
    name: string
    age: number
    gender: string
    chiefComplaint: string
    vitalSigns: string
    systemPrompt: string
  }
}
