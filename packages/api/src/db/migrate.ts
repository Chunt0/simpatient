import { sqlite } from './index'

export function migrate() {
  sqlite.exec('PRAGMA journal_mode = WAL')
  sqlite.exec('PRAGMA foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      sex TEXT NOT NULL,
      chief_complaint TEXT NOT NULL,
      medical_history TEXT NOT NULL DEFAULT '',
      medications TEXT NOT NULL DEFAULT '',
      allergies TEXT NOT NULL DEFAULT '',
      vital_signs TEXT NOT NULL DEFAULT '',
      personality_notes TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // Idempotent rename for older databases that still have the 'gender' column.
  const patientCols = sqlite.prepare('PRAGMA table_info(patients)').all() as { name: string }[]
  if (patientCols.some(c => c.name === 'gender') && !patientCols.some(c => c.name === 'sex')) {
    sqlite.exec('ALTER TABLE patients RENAME COLUMN gender TO sex')
    console.log('[db] renamed patients.gender -> patients.sex')
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER
    )
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS transcript_entries (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('student', 'patient')),
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `)

  console.log('[db] migrations complete')
}
