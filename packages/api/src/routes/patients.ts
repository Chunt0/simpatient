import { Elysia, t } from 'elysia'
import { db } from '../db'
import { patients } from '../db/schema'
import { eq } from 'drizzle-orm'
import { buildSystemPrompt } from '../lib/promptBuilder'
import { randomUUID } from 'crypto'

const PatientBody = t.Object({
  name: t.String({ minLength: 1 }),
  age: t.Number({ minimum: 0, maximum: 120 }),
  sex: t.String({ minLength: 1 }),
  chiefComplaint: t.String({ minLength: 1 }),
  medicalHistory: t.Optional(t.String()),
  medications: t.Optional(t.String()),
  allergies: t.Optional(t.String()),
  vitalSigns: t.Optional(t.String()),
  personalityNotes: t.Optional(t.String()),
  systemPrompt: t.Optional(t.String()),
})

export const patientsRoutes = new Elysia({ prefix: '/patients' })
  .get('/', () =>
    db.select({
      id: patients.id,
      name: patients.name,
      age: patients.age,
      sex: patients.sex,
      chiefComplaint: patients.chiefComplaint,
      createdAt: patients.createdAt,
    }).from(patients).all()
  )

  .get('/:id', ({ params, status }) => {
    const patient = db.select().from(patients).where(eq(patients.id, params.id)).get()
    if (!patient) return status(404, { message: 'Patient not found' })
    return {
      ...patient,
      systemPrompt: patient.systemPrompt || buildSystemPrompt(patient),
    }
  })

  .post('/', ({ body }) => {
    const now = new Date().toISOString()
    const id = randomUUID()
    const row = {
      id,
      name: body.name,
      age: body.age,
      sex: body.sex,
      chiefComplaint: body.chiefComplaint,
      medicalHistory: body.medicalHistory ?? '',
      medications: body.medications ?? '',
      allergies: body.allergies ?? '',
      vitalSigns: body.vitalSigns ?? '',
      personalityNotes: body.personalityNotes ?? '',
      systemPrompt: body.systemPrompt ?? '',
      createdAt: now,
      updatedAt: now,
    }
    db.insert(patients).values(row).run()
    return row
  }, { body: PatientBody })

  .put('/:id', ({ params, body, status }) => {
    const existing = db.select().from(patients).where(eq(patients.id, params.id)).get()
    if (!existing) return status(404, { message: 'Patient not found' })
    const now = new Date().toISOString()
    const updates = {
      name: body.name,
      age: body.age,
      sex: body.sex,
      chiefComplaint: body.chiefComplaint,
      medicalHistory: body.medicalHistory ?? '',
      medications: body.medications ?? '',
      allergies: body.allergies ?? '',
      vitalSigns: body.vitalSigns ?? '',
      personalityNotes: body.personalityNotes ?? '',
      systemPrompt: body.systemPrompt ?? '',
      updatedAt: now,
    }
    db.update(patients).set(updates).where(eq(patients.id, params.id)).run()
    return { ...existing, ...updates }
  }, { body: PatientBody })

  .delete('/:id', ({ params, status }) => {
    const existing = db.select().from(patients).where(eq(patients.id, params.id)).get()
    if (!existing) return status(404, { message: 'Patient not found' })
    db.delete(patients).where(eq(patients.id, params.id)).run()
    return { deleted: true }
  })
