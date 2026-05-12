# SimPatient

AI patient-simulation platform for nursing education.

## Core
- Real-time voice conversation with simulated patients
- Configurable patient data: chief complaint, vitals, meds, allergies, history, personality, system prompt
- Sessions recorded, transcribed, reviewable
- Fully local inference; no data leaves machine

## Stack
- Frontend: React + Vite + TanStack Query + livekit-client
- API: Bun + Elysia + SQLite
- Realtime: LiveKit
- Agent: Python `livekit-agents`
- STT: Nemotron NeMo ASR
- LLM: Ollama `gemma4:e2b`
- TTS: Kokoro
- Turn detection: LiveKit multilingual turn detector

## Flow
1. Create patient
2. Start session
3. API creates LiveKit room + token, embeds patientId in room metadata
4. Python agent joins room, fetches patient profile, creates session record
5. Agent runs STT→LLM→TTS locally
6. Transcript saved per finalized turn to SQLite via API
7. Session closed on end/disconnect
8. Past sessions viewable with transcript + text export

## Ports
- Frontend: `3000`
- API: `4000`
- LiveKit: `7880`
- LiveKit TCP/TURN: `7881`
- Nemotron STT: `11435` / internal `8000`
- Ollama: `11434`
- Kokoro: `8880`

## API
- `GET /patients`
- `GET /patients/:id`
- `POST /patients`
- `PUT /patients/:id`
- `DELETE /patients/:id`

- `GET /sessions`
- `GET /sessions/:id`
- `POST /sessions`
- `PATCH /sessions/:id`
- `DELETE /sessions/:id`
- `POST /sessions/:id/entries`

- `POST /token` -> creates LiveKit room + issues token

## Required patient fields
- `name`
- `age`
- `sex`
- `chiefComplaint`

## Local setup
- Docker Engine 24+
- Docker Compose v2
- 16 GB RAM recommended
- 20 GB disk
- Optional NVIDIA GPU + `nvidia-container-toolkit`

## Dev
- Root: `bun install`
- API: `bun --watch src/index.ts`
- Frontend: `bun dev`
- Agent: `uv run python src/agent.py dev`

## Defaults
- `.env` at repo root for Docker
- `LIVEKIT_API_KEY=devkey`
- `LIVEKIT_API_SECRET=secret`
- `LIVEKIT_URL_PUBLIC=ws://localhost:7880`
- `OLLAMA_MODEL=gemma4:e2b`
- `KOKORO_VOICE=af_nova`
- `FRONTEND_ORIGIN=http://localhost:3000`
