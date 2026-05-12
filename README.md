# SimPatient

AI-powered patient simulation platform for nursing education. Students hold a real-time voice conversation with a simulated patient. The AI listens, reasons, and responds as that patient — with configurable clinical details, personality, and a system prompt. Every session is recorded and reviewable. All inference runs entirely on local hardware; no data leaves your machine.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start (Docker)](#quick-start-docker)
- [Service Ports](#service-ports)
- [Environment Variables](#environment-variables)
- [Local Development (without Docker)](#local-development-without-docker)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Running Tests](#running-tests)
- [GPU Support](#gpu-support)
- [Monorepo Scripts](#monorepo-scripts)

---

## How It Works

1. **Create a patient.** Fill in clinical details (chief complaint, vital signs, medications, allergies, medical history) and optional personality notes. A system prompt is auto-generated from those fields, or you can write one directly.

2. **Start a session.** Click "Start Session" on any patient card. The browser calls the API, which creates a LiveKit room with the patient's ID embedded in the room metadata, then issues a WebRTC token. The browser joins the room with that token.

3. **The agent joins.** The LiveKit Python agent picks up the new room, reads the patient ID from room metadata, fetches the full patient profile from the API, and creates a session record in the database. It then starts an `AgentSession` running:
   - **VAD** — Silero voice activity detection (prewarmed at agent startup)
   - **STT** — faster-whisper via speaches, default `distil-large-v3` (OpenAI-compatible, served locally)
   - **LLM** — vLLM with `unsloth/gemma-4-E4B-it` (OpenAI-compatible, served locally)
   - **TTS** — Kokoro FastAPI (OpenAI-compatible, served locally)
   - **Turn detection** — LiveKit multilingual turn detector

4. **The conversation.** The student speaks; the agent transcribes with Whisper, reasons with vLLM (using the patient's system prompt as instructions), and responds with Kokoro TTS. Both sides of the conversation are visible in real time in the browser's transcript panel.

5. **Transcript saving.** The agent hooks into `user_speech_committed` and `agent_speech_committed` events on the `AgentSession` object. Each finalized turn is saved to SQLite via the API (`POST /sessions/:id/entries`) as it happens.

6. **Session end.** When the student clicks "End Session" or disconnects, the agent closes the session record with an end timestamp and calculated duration.

7. **Review.** Past sessions appear in the Sessions list with the patient name, date, and duration. Opening a session shows the full transcript in a chat-style view with a plain-text export option.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser  (React + Vite + TanStack Query + livekit-client)  │
│  :3000                                                       │
│                                                              │
│  Patient CRUD ──HTTP──► Elysia API (Bun) :4000              │
│  Token request ────────►   └── SQLite (patients, sessions,  │
│                                 transcript_entries)          │
│  WebRTC audio ─────────► LiveKit Server :7880                │
│                               │                              │
│                    ┌──────────┘                              │
│                    │  Python Agent (livekit-agents 1.3)      │
│                    │  ├── STT: Whisper (speaches) :11435     │
│                    │  ├── LLM: vLLM gemma-4-E4B :11436       │
│                    │  └── TTS: Kokoro FastAPI :8880          │
│                    │  └── saves transcript ──► API :4000     │
└─────────────────────────────────────────────────────────────┘
```

All services communicate over a Docker bridge network (`agent_network`) using their service names as hostnames. The browser only ever talks to the API on `:4000` and LiveKit on `:7880`.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Docker Engine 24+ | With Compose v2 (`docker compose`) |
| 16 GB RAM | 8 GB minimum; model loading is RAM-heavy on CPU |
| 20 GB disk | For model weights (Whisper + vLLM) |
| NVIDIA GPU (optional) | Requires `nvidia-container-toolkit` for GPU mode |

For local development (outside Docker):

- [Bun](https://bun.sh) v1.1+
- Python 3.12+
- [uv](https://docs.astral.sh/uv/) (Python package manager)

---

## Quick Start (Docker)

```bash
# 1. Clone and enter the repo
cd simpatient

# 2. Copy the environment file
cp .env.example .env

# 3. Start all services (prompts for CPU vs GPU)
./compose-up.sh
```

On first run, Docker builds all images, then:
- **vLLM** downloads `unsloth/gemma-4-E4B-it` from Hugging Face (~3 GB)
- **Whisper** downloads `Systran/faster-distil-whisper-large-v3` on the first transcription (~750 MB)

This can take 5–15 minutes depending on your internet connection. The `livekit_agent` service waits for `whisper` and `vllm` to pass their healthchecks before starting.

Once everything is up, open **http://localhost:3000**.

To start without the interactive prompt:

```bash
# CPU
docker compose up

# GPU
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up
```

---

## Service Ports

| Service | Host port | Internal URL | Purpose |
|---|---|---|---|
| Frontend | 3000 | — | React UI (nginx in prod, Vite in dev) |
| API | 4000 | `http://api:4000` | REST API + SQLite |
| LiveKit | 7880 | `ws://livekit:7880` | WebRTC signaling |
| LiveKit (TCP) | 7881 | — | WebRTC TURN/TCP |
| Whisper STT | 11435 | `http://whisper:8000` | faster-whisper via speaches (`/v1/audio/transcriptions`) |
| Ollama LLM | 11434 | `http://ollama:11434` | OpenAI-compatible LLM (`/v1/chat/completions`) |
| Kokoro TTS | 8880 | `http://kokoro:8880` | OpenAI-compatible TTS (`/v1/audio/speech`) |

---

## Environment Variables

Copy `.env.example` to `.env` and adjust:

```bash
# LiveKit credentials — use random strings in production
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret

# Public WebSocket URL for the browser to connect to LiveKit.
# Change this to your server's IP/hostname if accessing remotely.
LIVEKIT_URL_PUBLIC=ws://localhost:7880

# Ollama model to pull and use. gemma4:e2b is the default (~3 GB).
OLLAMA_MODEL=gemma4:e2b

# Kokoro TTS voice. See Kokoro docs for available voices.
KOKORO_VOICE=af_nova

# CORS — set to the URL your browser uses to access the frontend
FRONTEND_ORIGIN=http://localhost:3000
```

Each package also has a `.env.local` file with the same variables pre-filled for local development outside Docker (the agent, API, and frontend each have their own). These are loaded automatically in dev mode and ignored by Docker (which uses the root `.env`).

---

## Local Development (without Docker)

Run the inference stack via Docker, then develop the API and frontend with hot reload:

```bash
# Start only the inference + signaling services
docker compose up livekit whisper vllm kokoro -d

# Wait for vLLM model load and Whisper warmup (~5 min first time)
docker compose logs -f vllm whisper
```

**API** (port 4000):
```bash
cd packages/api
bun install
bun --watch src/index.ts
```

The API creates `packages/api/dev.db` (SQLite) on first run and runs schema migrations automatically at startup.

**Frontend** (port 3000 via Vite dev server):
```bash
cd packages/frontend
bun install
bun dev
```

The Vite dev server proxies `/api` to `localhost:4000`, so the frontend works without any CORS configuration changes.

**Python Agent**:
```bash
cd services/livekit_agent
uv sync
uv run python src/agent.py dev
```

`dev` mode connects to LiveKit and waits for rooms. The agent picks up any session started from the browser automatically.

---

## Project Structure

```
simpatient/
├── .env.example                  # Template — copy to .env
├── docker-compose.yml            # Full service stack (CPU)
├── docker-compose.gpu.yml        # GPU overrides (merged on top)
├── compose-up.sh                 # Interactive launcher (CPU vs GPU)
│
├── packages/
│   ├── api/                      # Bun + Elysia REST API
│   │   └── src/
│   │       ├── index.ts          # App entry, migrations, listen
│   │       ├── db/
│   │       │   ├── index.ts      # Drizzle + bun:sqlite setup
│   │       │   ├── migrate.ts    # CREATE TABLE IF NOT EXISTS migrations
│   │       │   └── schema.ts     # patients, sessions, transcript_entries
│   │       ├── routes/
│   │       │   ├── patients.ts   # CRUD for patient profiles
│   │       │   ├── sessions.ts   # Session lifecycle + transcript entries
│   │       │   └── token.ts      # LiveKit token issuance
│   │       ├── lib/
│   │       │   └── promptBuilder.ts  # Auto-generates system prompts
│   │       └── tests/
│   │           └── api.test.ts   # bun:test integration tests
│   │
│   └── frontend/                 # React 19 + Vite + Tailwind CSS v4
│       └── src/
│           ├── pages/
│           │   ├── PatientList.tsx    # Home — patient card grid
│           │   ├── PatientForm.tsx    # Create/edit patient
│           │   ├── Session.tsx        # Live voice session
│           │   ├── SessionList.tsx    # Past sessions table
│           │   └── SessionDetail.tsx  # Full transcript + export
│           ├── components/            # Layout, cards, transcript panel, etc.
│           ├── hooks/
│           │   ├── usePatients.ts     # TanStack Query patient hooks
│           │   ├── useSessions.ts     # TanStack Query session hooks
│           │   └── useVoiceSession.ts # Token fetch + connection state
│           └── lib/
│               ├── api.ts             # Typed fetch wrapper
│               └── promptBuilder.ts   # Client-side prompt preview
│
└── services/
    └── livekit_agent/            # Python voice agent
        └── src/
            └── agent.py          # AgentServer, session loop, transcript saving
```

---

## API Reference

All endpoints accept and return JSON. The base URL is `http://localhost:4000`.

### Patients

| Method | Path | Description |
|---|---|---|
| `GET` | `/patients` | List all patients (id, name, age, sex, chiefComplaint, createdAt) |
| `GET` | `/patients/:id` | Get full patient profile; `systemPrompt` is auto-generated if not set |
| `POST` | `/patients` | Create a patient |
| `PUT` | `/patients/:id` | Replace a patient's fields |
| `DELETE` | `/patients/:id` | Delete patient (cascades to sessions + transcripts) |

**Patient body fields:**

```json
{
  "name": "Margaret Chen",
  "age": 62,
  "sex": "Female",
  "chiefComplaint": "Chest pain radiating to left arm",
  "medicalHistory": "Hypertension, Type 2 Diabetes",
  "medications": "Metformin 500mg BID",
  "allergies": "Penicillin",
  "vitalSigns": "BP 158/94, HR 88, RR 18, SpO2 97%, Temp 98.6°F",
  "personalityNotes": "Anxious, speaks softly, needs reassurance",
  "systemPrompt": ""
}
```

`name`, `age`, `sex`, and `chiefComplaint` are required. All other fields are optional and default to empty string. If `systemPrompt` is empty, the API generates one from the clinical fields.

### Sessions

| Method | Path | Description |
|---|---|---|
| `GET` | `/sessions` | List all sessions with patient name, ordered by newest first |
| `GET` | `/sessions/:id` | Get session with patient info and full transcript entries array |
| `POST` | `/sessions` | Create a session record (called by the agent on join) |
| `PATCH` | `/sessions/:id` | Close session with `endedAt` and `durationSeconds` |
| `DELETE` | `/sessions/:id` | Delete session + transcript entries |
| `POST` | `/sessions/:id/entries` | Add a transcript entry (called by the agent per turn) |

**Session entry body:**

```json
{
  "role": "student",
  "text": "Hello, can you tell me what brought you in today?",
  "timestamp": "2026-04-14T10:23:01.000Z"
}
```

`role` must be `"student"` or `"patient"`.

### Token

| Method | Path | Description |
|---|---|---|
| `POST` | `/token` | Issue a LiveKit token and create the room |

**Request:**
```json
{ "patientId": "abc-123", "roomName": "optional-custom-name" }
```

**Response:**
```json
{
  "token": "<LiveKit JWT>",
  "url": "ws://localhost:7880",
  "roomName": "session-1713088981000",
  "patient": {
    "id": "abc-123",
    "name": "Margaret Chen",
    "age": 62,
    "sex": "Female",
    "chiefComplaint": "Chest pain radiating to left arm",
    "vitalSigns": "BP 158/94, HR 88, SpO2 97%",
    "systemPrompt": "You are Margaret Chen, a 62-year-old female patient..."
  }
}
```

---

## Running Tests

### API integration tests

The test suite uses `bun:test` with an in-memory SQLite database. The full API server starts on port 4999 for the duration of the tests; no external services are required.

```bash
cd packages/api
bun test
```

The suite covers 18 tests across three groups:
- **patients** — list, create, get (with resolved system prompt), 404, update, delete
- **sessions** — create, list, get, add transcript entries, get with entries, close (PATCH), 404, delete with cascade
- **token** — full response shape, custom room name, 404 for unknown patient

### Frontend type check

```bash
cd packages/frontend
bunx tsc -b
```

### Frontend production build

```bash
cd packages/frontend
bun run build
```

Vite runs `tsc -b` first, then bundles to `dist/`. A clean build (no TypeScript errors, no missing imports) confirms the frontend is production-ready.

### API type check

```bash
cd packages/api
bunx tsc --noEmit
```

---

## GPU Support

The `docker-compose.gpu.yml` override file pins `vllm` to GPU 0 and switches `whisper` to the CUDA image of speaches. `kokoro` stays on the CPU image in this mode because its GPU build hits a cuFFT bug on the A6000. Use `docker-compose.gpu-generic.yml` instead to run every service on GPU on hardware that's not affected by that bug.

**Requirements:**
- NVIDIA drivers installed on the host
- [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed and configured

```bash
# Interactive launcher (prompts for CPU or GPU)
./compose-up.sh

# Manual GPU start
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up
```

GPU mode significantly reduces LLM inference latency and Whisper transcription time.

---

## Monorepo Scripts

The repo uses Bun workspaces. From the root:

```bash
bun install          # Install all workspace dependencies
```

From individual packages:

```bash
# packages/api
bun dev              # Hot-reload API server (port 4000)
bun start            # Production API server
bun test             # Run integration tests

# packages/frontend
bun dev              # Vite dev server (port 3000, proxies /api → :4000)
bun run build        # Production build → dist/
bun run preview      # Serve production build locally
```
