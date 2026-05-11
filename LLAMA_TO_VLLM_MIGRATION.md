# llama.cpp → vLLM migration (LiveKit voice agent)

Execute this plan top-to-bottom. Goal: replace the llama.cpp LLM service with vLLM, enable prefix caching + chunked prefill, expose three manual latency knobs in `.env`, and prove it works.

## Assumed starting state

- LiveKit voice agent in `services/livekit_agent/` (Python, `livekit-agents ~=1.3`).
- `docker-compose.yml` defines a `llama` service using `ghcr.io/ggml-org/llama.cpp:server`, exposing port `11434`, with an agent service that reads `LLAMA_BASE_URL` / `LLAMA_MODEL`.
- `docker-compose.gpu.yml` and/or `docker-compose.gpu-generic.yml` overlays add GPU access for `llama`.
- NVIDIA GPU available, `nvidia-container-toolkit` working with Docker.

If the file/service names differ, adapt — the substance of every step is what matters.

---

## Step 0 — Confirm LiveKit API surface

vLLM and the agent need specific kwargs on `AgentSession`. Verify they exist in the installed version before touching anything else:

```bash
docker run --rm --entrypoint python <agent-image-tag> -c "
from livekit.agents import AgentSession
import inspect
sig = inspect.signature(AgentSession.__init__)
for k in ('min_endpointing_delay','max_endpointing_delay','preemptive_generation','turn_handling'):
    assert k in sig.parameters, f'missing kwarg: {k}'
print('OK')
"
```

If any kwarg is missing, upgrade `livekit-agents` first (`~=1.3` is sufficient). Do not proceed otherwise.

---

## Step 1 — Replace the `llama` service in `docker-compose.yml`

Delete the entire `llama:` service block. Add a `vllm:` service in its place:

```yaml
  vllm:
    image: vllm/vllm-openai:latest
    command:
      - --model
      - ${VLLM_MODEL:-unsloth/gemma-4-E4B-it}
      - --served-model-name
      - ${VLLM_SERVED_NAME:-gemma}
      - --host
      - 0.0.0.0
      - --port
      - "8000"
      - --dtype
      - ${VLLM_DTYPE:-bfloat16}
      - --quantization
      - ${VLLM_QUANTIZATION:-fp8}
      - --max-model-len
      - ${VLLM_MAX_MODEL_LEN:-8192}
      - --gpu-memory-utilization
      - ${VLLM_GPU_MEM_UTIL:-0.35}
      - --max-num-seqs
      - ${VLLM_MAX_NUM_SEQS:-4}
      - --enable-prefix-caching
      - --enable-chunked-prefill
      - --trust-remote-code
    environment:
      HF_TOKEN: ${HF_TOKEN:-}
      HUGGING_FACE_HUB_TOKEN: ${HF_TOKEN:-}
      VLLM_LOGGING_LEVEL: WARNING
    volumes:
      - vllm-cache:/root/.cache/huggingface
    ports:
      # Internal-only access is via http://vllm:8000. Host port is for debug.
      # Avoid 11434 — that's the default Ollama port and will collide if
      # systemd-managed ollama is running on the host.
      - "11436:8000"
    networks: [agent_network]
    ipc: host
    shm_size: "8gb"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 60
      start_period: 120s
    restart: unless-stopped
```

In the top-level `volumes:` block, add `vllm-cache:` next to the existing volumes.

**Do NOT pass `--disable-log-requests`** — removed in current vLLM; engine refuses to start. `VLLM_LOGGING_LEVEL=WARNING` covers it.

**Why GPU is declared in the base file, not the override:** vLLM is GPU-only. There is no working CPU fallback. The base file declaring `deploy.resources.reservations` means CPU-only compose runs are no longer supported.

---

## Step 2 — Update agent service in `docker-compose.yml`

In the `livekit_agent:` service block, change env vars and `depends_on`:

```yaml
    environment:
      # ... existing vars ...
      LLM_BASE_URL: http://vllm:8000/v1
      LLM_MODEL: ${VLLM_SERVED_NAME:-gemma}
      KOKORO_BASE_URL: http://kokoro:8880/v1
      KOKORO_VOICE: ${KOKORO_VOICE:-af_nova}
      # Latency knobs (see .env)
      RESPONSE_DELAY_MS: ${RESPONSE_DELAY_MS:-0}
      MIN_ENDPOINTING_DELAY: ${MIN_ENDPOINTING_DELAY:-0.5}
      MAX_ENDPOINTING_DELAY: ${MAX_ENDPOINTING_DELAY:-3.0}
      PREEMPTIVE_GENERATION: ${PREEMPTIVE_GENERATION:-true}
      LLM_MAX_TOKENS: ${LLM_MAX_TOKENS:-150}
      LLM_TEMPERATURE: ${LLM_TEMPERATURE:-0.7}
    depends_on:
      # ... existing deps ...
      vllm: { condition: service_healthy }   # was: llama
```

Remove `LLAMA_BASE_URL` / `LLAMA_MODEL` and the `llama:` entry from `depends_on`.

---

## Step 3 — Update GPU overrides

In `docker-compose.gpu.yml` (and `docker-compose.gpu-generic.yml` if present), delete the `llama:` service block. The base file already grants vLLM GPU access; only add per-environment tweaks if needed, e.g.:

```yaml
services:
  vllm:
    environment:
      CUDA_VISIBLE_DEVICES: "0"   # pin to GPU 0 if multi-GPU
```

---

## Step 4 — Update `.env` and `.env.example`

Remove `LLAMA_*` and `OLLAMA_*` vars. Append:

```dotenv
# ─── LLM (vLLM) ───────────────────────────────────────────────────────────────
# Safetensors HF repo. vLLM cannot reliably load GGUF for Gemma 3n architecture —
# always use the non-GGUF version. Unsloth re-hosts are not gated.
VLLM_MODEL=unsloth/gemma-4-E4B-it
VLLM_SERVED_NAME=gemma
VLLM_QUANTIZATION=fp8         # fp8, awq, gptq, or "" for BF16
VLLM_DTYPE=bfloat16
VLLM_MAX_MODEL_LEN=8192
VLLM_MAX_NUM_SEQS=4

# 0.35 ≈ 17 GB on a 48 GB card: ~8 GB weights + ~9 GB KV cache. Single-user
# voice workload doesn't need more. Bump if you serve many concurrent rooms.
VLLM_GPU_MEM_UTIL=0.35

# Only needed if VLLM_MODEL points at a gated repo (e.g. google/gemma-*).
HF_TOKEN=

# ─── Latency knobs ────────────────────────────────────────────────────────────
# RESPONSE_DELAY_MS: wall-clock pause AFTER the user finishes speaking and
# BEFORE the LLM starts. Use if the bot feels "too snappy" / inhuman.
# Typical natural-feel range: 300–800 ms. 0 = off.
RESPONSE_DELAY_MS=0

# How long the turn detector waits in silence before deciding the user is done.
# Lower = snappier but more cut-offs. Higher = more patient but laggier.
MIN_ENDPOINTING_DELAY=0.5
MAX_ENDPOINTING_DELAY=3.0

# Start LLM generation before final transcript commits. Big TTFT win.
PREEMPTIVE_GENERATION=true

# Cap LLM output. Short replies = faster TTS start = lower perceived latency.
LLM_MAX_TOKENS=150
LLM_TEMPERATURE=0.7
```

---

## Step 5 — Patch the agent (`services/livekit_agent/src/agent.py`)

### 5a. Env-var block — replace the `LLAMA_*` reads with:

```python
LLM_BASE = os.environ.get("LLM_BASE_URL", "http://vllm:8000/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "gemma")
LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "150"))
LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.7"))

# Latency knobs — see .env for descriptions.
RESPONSE_DELAY_S = max(0.0, float(os.environ.get("RESPONSE_DELAY_MS", "0")) / 1000.0)
MIN_ENDPOINTING_DELAY = float(os.environ.get("MIN_ENDPOINTING_DELAY", "0.5"))
MAX_ENDPOINTING_DELAY = float(os.environ.get("MAX_ENDPOINTING_DELAY", "3.0"))
PREEMPTIVE_GENERATION = os.environ.get("PREEMPTIVE_GENERATION", "true").lower() in ("1", "true", "yes")
```

### 5b. Subclass `Agent` to inject the optional pre-LLM delay

Replace `patient_agent = Agent(instructions=system_prompt)` with:

```python
class PatientAgent(Agent):
    async def on_user_turn_completed(self, turn_ctx, new_message):
        if RESPONSE_DELAY_S > 0:
            await asyncio.sleep(RESPONSE_DELAY_S)

patient_agent = PatientAgent(instructions=system_prompt)
```

(If your agent class has a different name, override `on_user_turn_completed` on whatever subclass you use.)

### 5c. Update `AgentSession(...)` construction

```python
session = AgentSession(
    vad=ctx.proc.userdata["vad"],
    stt=openai.STT(base_url=STT_BASE, api_key="no-key", model=STT_MODEL),
    llm=openai.LLM(
        base_url=LLM_BASE,
        model=LLM_MODEL,
        api_key="no-key",
        temperature=LLM_TEMPERATURE,
        max_completion_tokens=LLM_MAX_TOKENS,
    ),
    tts=openai.TTS(
        base_url=KOKORO_BASE, api_key="no-key", model="tts-1",
        voice=KOKORO_VOICE, response_format="pcm",
    ),
    turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()),
    min_endpointing_delay=MIN_ENDPOINTING_DELAY,
    max_endpointing_delay=MAX_ENDPOINTING_DELAY,
    preemptive_generation=PREEMPTIVE_GENERATION,
)
```

---

## Step 6 — Validate config + rebuild agent image

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml config >/dev/null && echo "compose OK"
docker compose -f docker-compose.yml -f docker-compose.gpu.yml build livekit_agent
```

Compile-check the agent file:

```bash
docker run --rm -v $(pwd)/services/livekit_agent/src/agent.py:/tmp/agent.py:ro \
  --entrypoint python <agent-image-tag> -c "import py_compile; py_compile.compile('/tmp/agent.py', doraise=True); print('OK')"
```

---

## Step 7 — Boot vLLM alone and wait for `/health`

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d vllm

# Tail in another terminal — or run this in background:
until curl -sf http://localhost:11436/health >/dev/null 2>&1; do sleep 5; done && echo "vllm healthy"
```

First start downloads ~15 GB and compiles CUDA graphs; expect 3–6 min. Subsequent starts are <30 s.

### Common failures

| Symptom | Cause | Fix |
|---|---|---|
| `bind: address already in use` on 11434 | Host `systemd` Ollama service holds 11434 | Already accounted for — host port is `11436` |
| `unrecognized arguments: --disable-log-requests` | Flag removed in current vLLM | Don't add it (this plan omits it) |
| `Free memory on device cuda:0 (X) … less than desired GPU memory utilization` | Another GPU process (neighbor LXC, X server, etc.) holds memory | Lower `VLLM_GPU_MEM_UTIL` in `.env` (try `0.35` then `0.25`) |
| `Your GPU does not have native support for FP8` (WARNING) | Pre-Ada GPU (e.g. A6000, A100, 3090) | Harmless — vLLM falls back to Marlin weight-only FP8 (still a memory-bandwidth win). For max throughput on Ampere, switch to `VLLM_QUANTIZATION=awq` with an AWQ-INT4 checkpoint |
| vLLM tries to load `*-GGUF` repo and fails | Wrong model var | Use safetensors repo (`unsloth/gemma-4-E4B-it`), never the `-GGUF` variant |

---

## Step 8 — Smoke-test the OpenAI endpoint

```bash
curl -s http://localhost:11436/v1/models | python3 -m json.tool

time curl -s http://localhost:11436/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma",
    "messages": [
      {"role":"system","content":"You are a hospital patient."},
      {"role":"user","content":"Hi, how are you feeling today?"}
    ],
    "max_tokens": 80
  }' | python3 -m json.tool
```

Expected on a 48 GB Ampere card with Gemma-4-E4B FP8:
- Cold call: 1.5–3 s for 80 tokens.
- Warm call (same system prompt → prefix cache hit): **0.6–1.0 s** for 80 tokens.

---

## Step 9 — Boot the full stack

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --remove-orphans

docker compose ps --format 'table {{.Name}}\t{{.Status}}'
```

All seven services should report `Up`, with `vllm` and `nemotron` showing `(healthy)`.

---

## Step 10 — Verify agent → vLLM path and knob propagation

```bash
docker exec <agent-container> env | grep -E '^(LLM_|RESPONSE_DELAY|MIN_ENDPOINTING|MAX_ENDPOINTING|PREEMPTIVE)' | sort

docker exec <agent-container> python -c "
import os, time, urllib.request, json
url = os.environ['LLM_BASE_URL'] + '/chat/completions'
body = json.dumps({
    'model': os.environ['LLM_MODEL'],
    'messages':[{'role':'user','content':'Say hi.'}],
    'max_tokens': 20
}).encode()
req = urllib.request.Request(url, body, {'Content-Type':'application/json'})
t = time.time()
resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
print(f'roundtrip: {time.time()-t:.2f}s -> {resp[\"choices\"][0][\"message\"][\"content\"]}')
"
```

Expected:
- All knobs present and set to `.env` values.
- Roundtrip on a warm cache: **<0.3 s**.
- Agent logs show `registered worker` against the LiveKit server.

---

## Step 11 — Tuning after a real audio session

After running an end-to-end session in the browser, edit `.env` and `docker compose restart livekit_agent`:

| Symptom | Knob to change |
|---|---|
| Bot answers before user is done speaking | Raise `MIN_ENDPOINTING_DELAY` (e.g. 0.5 → 0.8) |
| Long awkward pauses after user stops | Lower `MAX_ENDPOINTING_DELAY` (e.g. 3.0 → 1.5) |
| Bot feels unnaturally instant | Set `RESPONSE_DELAY_MS=400` (try 300–800) |
| Replies are too long / slow to start TTS | Lower `LLM_MAX_TOKENS` (e.g. 150 → 80) |
| Bot hallucinates from partial transcripts | Set `PREEMPTIVE_GENERATION=false` |

No image rebuilds needed for `.env` changes — only restart the agent container.

---

## Step 12 — Cleanup

Old llama.cpp artifacts to remove once vLLM is verified:

```bash
docker rm simpatient-llama-1 2>/dev/null
docker volume ls | grep -E 'llama|gguf'   # then docker volume rm any matches
rm -rf services/llama/models/              # if you keep llama.cpp around for fallback, skip this
```

If you keep the `services/llama/` directory as a fallback, leave it; nothing references it any more.
