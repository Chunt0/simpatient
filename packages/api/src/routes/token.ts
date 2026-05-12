import { Elysia, t } from 'elysia'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { db } from '../db'
import { patients, sessions } from '../db/schema'
import { eq } from 'drizzle-orm'
import { buildSystemPrompt } from '../lib/promptBuilder'
import { randomUUID } from 'crypto'

export const tokenRoute = new Elysia()
  .post('/token', async ({ body, status, request }) => {
    const patient = db.select().from(patients).where(eq(patients.id, body.patientId)).get()
    if (!patient) return status(404, { message: 'Patient not found' })

    const resolvedPrompt = patient.systemPrompt || buildSystemPrompt(patient)
    const roomName = body.roomName ?? `session-${Date.now()}`

    // Create the session record now so the frontend has the ID before the room starts.
    const sessionId = randomUUID()
    const startedAt = new Date().toISOString()
    db.insert(sessions).values({ id: sessionId, patientId: patient.id, startedAt }).run()

    const livekitUrl = process.env.LIVEKIT_URL_INTERNAL ?? 'http://livekit:7880'
    const apiKey = process.env.LIVEKIT_API_KEY ?? 'devkey'
    const apiSecret = process.env.LIVEKIT_API_SECRET ?? 'secret'

    // Embed sessionId + patientId in room metadata so the agent can use the
    // pre-created session rather than opening a duplicate.
    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret)
    try {
      await svc.createRoom({
        name: roomName,
        metadata: JSON.stringify({ patientId: patient.id, sessionId }),
        emptyTimeout: 600,
        maxParticipants: 5,
      })
    } catch {
      // LiveKit may not be reachable in test environments, or room already exists — fine either way
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: `student-${Date.now()}`,
      name: 'Student',
    })
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    })

    // Derive the LiveKit public URL from the incoming request host so it works
    // regardless of whether the client is local or remote.  The frontend nginx
    // proxies /livekit → ws://livekit:7880, so we just need the right host.
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000'
    const proto = request.headers.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws'
    const livekitPublicUrl = `${proto}://${host}/livekit`

    return {
      token: await token.toJwt(),
      url: livekitPublicUrl,
      roomName,
      sessionId,
      patient: {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        sex: patient.sex,
        chiefComplaint: patient.chiefComplaint,
        vitalSigns: patient.vitalSigns,
        systemPrompt: resolvedPrompt,
      },
    }
  }, {
    body: t.Object({
      patientId: t.String(),
      roomName: t.Optional(t.String()),
    }),
  })
