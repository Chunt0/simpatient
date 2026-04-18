import { Elysia, t } from 'elysia'
import { db } from '../db'
import { sessions, transcriptEntries, patients } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const sessionsRoutes = new Elysia({ prefix: '/sessions' })
  .get('/', () =>
    db.select({
      id: sessions.id,
      patientId: sessions.patientId,
      patientName: patients.name,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      durationSeconds: sessions.durationSeconds,
    })
    .from(sessions)
    .leftJoin(patients, eq(sessions.patientId, patients.id))
    .orderBy(desc(sessions.startedAt))
    .all()
  )

  .get('/:id', ({ params, status }) => {
    const session = db.select().from(sessions).where(eq(sessions.id, params.id)).get()
    if (!session) return status(404, { message: 'Session not found' })

    const patient = db
      .select({ name: patients.name, chiefComplaint: patients.chiefComplaint })
      .from(patients)
      .where(eq(patients.id, session.patientId))
      .get() ?? null

    const entries = db
      .select()
      .from(transcriptEntries)
      .where(eq(transcriptEntries.sessionId, params.id))
      .orderBy(transcriptEntries.timestamp)
      .all()

    return { ...session, patient, entries }
  })

  .post('/', ({ body }) => {
    const id = randomUUID()
    db.insert(sessions).values({ id, patientId: body.patientId, startedAt: body.startedAt }).run()
    return { id }
  }, {
    body: t.Object({
      patientId: t.String(),
      startedAt: t.String(),
    }),
  })

  .patch('/:id', ({ params, body, status }) => {
    const session = db.select().from(sessions).where(eq(sessions.id, params.id)).get()
    if (!session) return status(404, { message: 'Session not found' })
    db.update(sessions)
      .set({ endedAt: body.endedAt, durationSeconds: body.durationSeconds })
      .where(eq(sessions.id, params.id))
      .run()
    return { updated: true }
  }, {
    body: t.Object({
      endedAt: t.String(),
      durationSeconds: t.Number(),
    }),
  })

  .delete('/:id', ({ params, status }) => {
    const session = db.select().from(sessions).where(eq(sessions.id, params.id)).get()
    if (!session) return status(404, { message: 'Session not found' })
    db.delete(sessions).where(eq(sessions.id, params.id)).run()
    return { deleted: true }
  })

  .post('/:id/entries', ({ params, body, status }) => {
    const session = db.select().from(sessions).where(eq(sessions.id, params.id)).get()
    if (!session) return status(404, { message: 'Session not found' })
    const id = randomUUID()
    db.insert(transcriptEntries).values({
      id,
      sessionId: params.id,
      role: body.role,
      text: body.text,
      timestamp: body.timestamp,
    }).run()
    return { id }
  }, {
    body: t.Object({
      role: t.Union([t.Literal('student'), t.Literal('patient')]),
      text: t.String({ minLength: 1 }),
      timestamp: t.String(),
    }),
  })
