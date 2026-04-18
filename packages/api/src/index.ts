import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { migrate } from './db/migrate'
import { patientsRoutes } from './routes/patients'
import { sessionsRoutes } from './routes/sessions'
import { tokenRoute } from './routes/token'

migrate()

const app = new Elysia()
  .use(cors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  .use(patientsRoutes)
  .use(sessionsRoutes)
  .use(tokenRoute)
  .listen({ port: Number(process.env.API_PORT ?? 4000), hostname: process.env.API_HOST ?? '0.0.0.0' })

console.log(`SimPatient API listening on http://localhost:${app.server?.port}`)

export type App = typeof app
export default app
