# Voice + avatar agent demo

A small voice agent you can talk to, with a real-time **video avatar**. It speaks
with [Fish Audio](https://fish.audio)'s text-to-speech and shows a synchronized
talking-head avatar from [Beyond Presence](https://www.beyondpresence.ai). Powered by
[Fish Audio](https://fish.audio), [Beyond Presence](https://www.beyondpresence.ai),
[AssemblyAI](https://www.assemblyai.com), [OpenAI](https://openai.com), and
[LiveKit Agents](https://docs.livekit.io/agents/).

```
fish/   Python agent worker (livekit-agents, uv)  → fish/README.md
web/    Next.js 15 frontend (pnpm, Tailwind)       → web/README.md
```

The two halves never talk to each other directly — they meet in a LiveKit room.
Each directory is self-contained (its own deps, `.env.example`, README, and
Dockerfile), so you can run the whole thing together or grab just one half.

## Prereqs

- A [LiveKit Cloud](https://cloud.livekit.io) project (free tier is plenty)
- API keys for [Fish Audio](https://fish.audio), [Beyond Presence](https://app.bey.dev), [AssemblyAI](https://www.assemblyai.com), and [OpenAI](https://platform.openai.com)
- Then either [Docker](https://docs.docker.com/get-started/get-docker/) (Compose path) **or**
  [`uv`](https://docs.astral.sh/uv/getting-started/installation/) + [`pnpm`](https://pnpm.io/installation) (Node 20+) for the local path

## Run the whole thing

### Option A — Docker Compose

```bash
cp .env.example .env   # then fill in your LiveKit + provider keys
docker compose up --build
```

Open <http://localhost:3000> and hit **Start call**. Both containers and your
browser connect to the same LiveKit Cloud project from `.env`.

### Option B — local processes (uv + pnpm)

```bash
make env       # bootstrap empty fish/.env.local and web/.env.local
# fill in fish/.env.local and web/.env.local with your keys
make install   # uv sync + download VAD weights + pnpm install
make dev       # runs the agent worker and Next.js side-by-side
```

`make dev` uses `uvx honcho start` to run both processes with interleaved logs
under a single `Ctrl-C` (see `Procfile`).

## Run just one half

- **Backend only** (point your own frontend/telephony at it): [`fish/README.md`](fish/README.md)
- **Frontend only** (point at an already-running agent): [`web/README.md`](web/README.md)

## Deploy to Render

This repo ships a [Render Blueprint](https://render.com/docs/infrastructure-as-code) (`render.yaml`)
that provisions both services from a single click — no Docker needed.

1. Push the repo to GitHub.
2. In the Render dashboard: **New → Blueprint**, pick this repo. Render reads
   `render.yaml` and creates both services — `fish-avatar-web` (Next.js frontend)
   and `fish-avatar-agent` (Python worker).
3. Fill in the `fish-avatar-shared` env-var group with your real LiveKit / Fish /
   Beyond Presence / AssemblyAI / OpenAI keys.
4. Hit deploy. Both services come up against the same LiveKit Cloud project.

## How it works

- **Hit start and talk.** The landing page is a single button. On connect, a
  LiveKit room is created, the agent worker is dispatched into it by name
  (`fish-avatar`), and the Beyond Presence avatar worker joins the same room.
- **Voice → avatar.** The agent runs an STT → LLM → Fish Audio TTS pipeline. The
  avatar session reroutes the agent's audio to the Beyond Presence worker, which
  publishes a video track lip-synced to the speech. The frontend renders that
  video as the centered talking head, with a live transcript beneath it.

See `fish/CLAUDE.md` for the agent-side wiring and `fish/src/agent.py` for the code.

## License

[MIT](LICENSE).
