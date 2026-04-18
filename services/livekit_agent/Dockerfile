FROM python:3.12-slim-bookworm
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml .
# Install dependencies from pyproject.toml directly so this layer is cached
# independently of source changes (src/ doesn't exist yet, so "uv pip install ."
# would fail trying to build the local package with setuptools).
RUN uv pip install --system \
    "livekit-agents[silero,turn-detector,openai]~=1.3" \
    "livekit-plugins-noise-cancellation~=0.2" \
    "aiohttp>=3.10" \
    "python-dotenv"

COPY src/ src/

# Pre-download Silero VAD weights and LiveKit turn-detector model at build time
# Falls back to inline load if the CLI command isn't available in this agent version.
RUN python src/agent.py download-files 2>/dev/null || \
    python -c "from livekit.plugins import silero; silero.VAD.load()" || true

CMD ["python", "src/agent.py", "start"]
