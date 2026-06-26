# Voice + avatar agent — agent worker

The backend half of the [voice + avatar agent demo](../README.md): a Python
[LiveKit Agents](https://docs.livekit.io/agents/) worker that speaks with
[Fish Audio](https://fish.audio)'s TTS and drives a real-time
[Beyond Presence](https://www.beyondpresence.ai) video avatar.

This directory is self-contained — you can run it on its own and point any
[compatible frontend](https://docs.livekit.io/frontends/) (or the
[`web/`](../web/) app, or telephony) at the same LiveKit project.

## Stack

- **STT** — AssemblyAI streaming (`livekit-plugins-assemblyai`)
- **LLM** — OpenAI `gpt-5.4-mini` (`livekit-plugins-openai`, your `OPENAI_API_KEY`); override the model with `OPENAI_MODEL`
- **TTS** — Fish Audio `s2.1-pro` (`livekit-plugins-fishaudio`); override the voice with `FISH_VOICE_ID`
- **Avatar** — Beyond Presence (`bey`, via the `livekit-agents[bey]` extra); override the avatar with `BEY_AVATAR_ID`
- **VAD / turn detection** — Silero VAD only (no separate turn-detector model, to keep the worker footprint small)

The avatar wiring (connect → `avatar.start` → `session.start`) is documented in
[`CLAUDE.md`](./CLAUDE.md). The code is in [`src/agent.py`](./src/agent.py).

## Run it standalone

```bash
cp .env.example .env.local                  # then fill in your keys
uv sync
uv run python src/agent.py download-files   # Silero VAD weights

# Talk to it in your terminal (no LiveKit server needed — voice only, no avatar):
uv run python src/agent.py console

# Or register as a worker against your LiveKit project (for use with a frontend):
uv run python src/agent.py dev
```

The avatar needs a real LiveKit room to publish video, so use `dev` + a frontend
(or LiveKit Cloud) to see it; `console` exercises the voice pipeline only. In
production use `start` instead of `dev` (this is what the Dockerfile and the
Render deploy run).

### Docker

```bash
docker build -t fish-avatar-agent .
docker run --rm --env-file .env.local fish-avatar-agent
```

The worker has no inbound port — it connects out to LiveKit and waits for room
dispatch.

## Environment variables

```env
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

ASSEMBLYAI_API_KEY=
OPENAI_API_KEY=
FISH_API_KEY=      # Fish reads FISH_API_KEY (not FISH_AUDIO_API_KEY)
BEY_API_KEY=       # Beyond Presence (https://app.bey.dev → API keys)
```

## Lint

```bash
uv run ruff check src/
uv run ruff format --check src/
```
