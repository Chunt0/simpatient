"""
SimPatient LiveKit Agent — simulates a patient for nursing student education.

On room join: reads patientId from room metadata, fetches patient profile from
the API server, creates a session record, and starts a voice pipeline as that patient.
All turns are saved to the database in real time via the API.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import aiohttp
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    TurnHandlingOptions,
)
from livekit.plugins import openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")

logger = logging.getLogger("simpatient.agent")
logging.basicConfig(level=logging.INFO)

API_BASE = os.environ.get("API_BASE_URL", "http://api:4000")
STT_BASE = os.environ.get("STT_BASE_URL", "http://nemotron:8000/v1")
STT_MODEL = os.environ.get("STT_MODEL", "nemotron-speech-streaming")
LLM_BASE = os.environ.get("LLM_BASE_URL", "http://vllm:8000/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "gemma")
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "150"))
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.7"))
KOKORO_BASE = os.environ.get("KOKORO_BASE_URL", "http://kokoro:8880/v1")
KOKORO_VOICE = os.environ.get("KOKORO_VOICE", "af_nova")
KOKORO_VOICE_FEMALE = os.environ.get("KOKORO_VOICE_FEMALE", "af_nova")
KOKORO_VOICE_MALE = os.environ.get("KOKORO_VOICE_MALE", "am_michael")


def _voice_for_gender(gender: str | None) -> str:
    g = (gender or "").strip().lower()
    if g.startswith("m"):
        return KOKORO_VOICE_MALE
    if g.startswith("f"):
        return KOKORO_VOICE_FEMALE
    return KOKORO_VOICE

# Latency knobs — see .env for full descriptions.
RESPONSE_DELAY_S = max(0.0, float(os.environ.get("RESPONSE_DELAY_MS", "0")) / 1000.0)
MIN_ENDPOINTING_DELAY = float(os.environ.get("MIN_ENDPOINTING_DELAY", "0.5"))
MAX_ENDPOINTING_DELAY = float(os.environ.get("MAX_ENDPOINTING_DELAY", "3.0"))
PREEMPTIVE_GENERATION = os.environ.get("PREEMPTIVE_GENERATION", "true").lower() in ("1", "true", "yes")


def _extract_text(msg) -> str:
    """Safely extract plain text from a ChatMessage or string."""
    if isinstance(msg, str):
        return msg
    content = getattr(msg, "content", None)
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif hasattr(item, "text"):
                parts.append(item.text)
        return " ".join(parts)
    return str(content)


async def _fetch_patient(patient_id: str) -> dict:
    async with aiohttp.ClientSession() as http:
        async with http.get(f"{API_BASE}/patients/{patient_id}") as resp:
            resp.raise_for_status()
            return await resp.json()


async def _create_session(patient_id: str, started_at: str) -> str:
    async with aiohttp.ClientSession() as http:
        async with http.post(
            f"{API_BASE}/sessions",
            json={"patientId": patient_id, "startedAt": started_at},
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return data["id"]


async def _close_session(session_id: str, started_at_iso: str) -> None:
    ended = datetime.now(timezone.utc)
    started = datetime.fromisoformat(started_at_iso)
    duration = int((ended - started).total_seconds())
    async with aiohttp.ClientSession() as http:
        await http.patch(
            f"{API_BASE}/sessions/{session_id}",
            json={"endedAt": ended.isoformat(), "durationSeconds": duration},
        )


async def _save_entry(session_id: str, role: str, text: str) -> None:
    if not text.strip():
        return
    async with aiohttp.ClientSession() as http:
        await http.post(
            f"{API_BASE}/sessions/{session_id}/entries",
            json={
                "role": role,
                "text": text.strip(),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


# --- Agent server setup ---

server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session()
async def patient_session(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    # Connect first — room metadata is not populated until after connect
    await ctx.connect()

    # Parse room metadata to get patientId (set by the API token endpoint)
    metadata_str = ctx.room.metadata or "{}"
    try:
        metadata = json.loads(metadata_str)
    except json.JSONDecodeError:
        metadata = {}

    patient_id = metadata.get("patientId")
    if not patient_id:
        logger.error("No patientId in room metadata for room %s", ctx.room.name)
        return

    # Fetch patient profile (resolved system prompt included)
    try:
        patient = await _fetch_patient(patient_id)
    except Exception as exc:
        logger.error("Failed to fetch patient %s: %s", patient_id, exc)
        return

    system_prompt = patient.get("systemPrompt", "")
    voice = _voice_for_gender(patient.get("gender"))
    logger.info(
        "Starting session as patient: %s (id=%s, gender=%s, voice=%s)",
        patient.get("name"), patient_id, patient.get("gender"), voice,
    )

    # Use the session ID created by the token endpoint if available, otherwise create one.
    started_at = datetime.now(timezone.utc).isoformat()
    session_id = metadata.get("sessionId")
    if not session_id:
        try:
            session_id = await _create_session(patient_id, started_at)
        except Exception as exc:
            logger.warning("Could not create session record: %s", exc)
            session_id = None

    # Build agent with patient's system prompt. Override on_user_turn_completed
    # to inject the optional response delay — runs after the user turn closes
    # and before LLM generation kicks off.
    class PatientAgent(Agent):
        async def on_user_turn_completed(self, turn_ctx, new_message):
            if RESPONSE_DELAY_S > 0:
                await asyncio.sleep(RESPONSE_DELAY_S)

    patient_agent = PatientAgent(instructions=system_prompt)

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=openai.STT(
            base_url=STT_BASE,
            api_key="no-key",
            model=STT_MODEL,
        ),
        llm=openai.LLM(
            base_url=LLM_BASE,
            model=LLM_MODEL,
            api_key="no-key",
            temperature=LLM_TEMPERATURE,
            max_completion_tokens=LLM_MAX_TOKENS,
        ),
        tts=openai.TTS(
            base_url=KOKORO_BASE,
            api_key="no-key",
            model="tts-1",
            voice=voice,
            response_format="pcm",
        ),
        turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()),
        min_endpointing_delay=MIN_ENDPOINTING_DELAY,
        max_endpointing_delay=MAX_ENDPOINTING_DELAY,
        preemptive_generation=PREEMPTIVE_GENERATION,
    )

    # Hook transcript events to save to DB
    if session_id:
        @session.on("conversation_item_added")
        def on_conversation_item(ev):
            from livekit.agents.llm import ChatMessage
            item = ev.item
            if not isinstance(item, ChatMessage):
                return
            text = item.text_content
            if not text or not text.strip():
                return
            if item.role == "user":
                asyncio.create_task(_save_entry(session_id, "student", text.strip()))
            elif item.role == "assistant" and not item.interrupted:
                asyncio.create_task(_save_entry(session_id, "patient", text.strip()))

    await session.start(agent=patient_agent, room=ctx.room)

    # Wait for room to disconnect
    disconnect_event = asyncio.Event()
    ctx.room.on("disconnected", lambda *_: disconnect_event.set())
    await disconnect_event.wait()

    if session_id:
        try:
            await _close_session(session_id, started_at)
        except Exception as exc:
            logger.warning("Could not close session %s: %s", session_id, exc)

    logger.info("Session ended for patient %s", patient_id)


if __name__ == "__main__":
    from livekit.agents import cli
    cli.run_app(server)
