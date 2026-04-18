import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const patients = sqliteTable('patients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  gender: text('gender').notNull(),
  chiefComplaint: text('chief_complaint').notNull(),
  medicalHistory: text('medical_history').notNull(),
  medications: text('medications').notNull(),
  allergies: text('allergies').notNull(),
  vitalSigns: text('vital_signs').notNull(),
  personalityNotes: text('personality_notes').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  patientId: text('patient_id').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  durationSeconds: integer('duration_seconds'),
})

export const transcriptEntries = sqliteTable('transcript_entries', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(), // 'student' | 'patient'
  text: text('text').notNull(),
  timestamp: text('timestamp').notNull(),
})
