# Voice + avatar agent — frontend

The web half of the [voice + avatar agent demo](../README.md): a Next.js 15 app
that mints LiveKit room tokens and renders the call UI — a landing page with an
inline language picker, then a centered real-time video avatar with a Fish Audio
waveform loader and transient (fade-out) captions. Voice-only: no transcript, no
chat input. It's built on [Agents UI](https://livekit.io/ui) components + the
[LiveKit JS SDK](https://github.com/livekit/client-sdk-js), bootstrapped from
[`agent-starter-react`](https://github.com/livekit-examples/agent-starter-react).

This directory is self-contained — you can run it on its own against any
LiveKit project that has the [`fish/`](../fish/) agent (or any compatible agent)
connected to it.

## Run it standalone

You need a [LiveKit Cloud](https://cloud.livekit.io) project and an agent
running against it (see [`fish/README.md`](../fish/README.md)).

```bash
cp .env.example .env.local   # then fill in your LiveKit credentials
pnpm install
pnpm dev                     # http://localhost:3000
```

### Docker

```bash
docker build -t fish-avatar-web .
docker run --rm -p 3000:3000 --env-file .env.local fish-avatar-web
```

The image is built from Next's standalone output (`output: 'standalone'` in
[`next.config.ts`](./next.config.ts)) so it ships just the server + traced
dependencies.

## Environment variables

Server-side only (used by the `/api/token` route to mint access tokens):

```env
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Optional override for the dispatched agent name. The app uses NAMED dispatch so
# the chosen language can ride agent metadata to the worker, and defaults to
# "fish-avatar" (must match AGENT_NAME in fish/src/agent.py). Only set this if you
# renamed the agent on both sides.
AGENT_NAME=
```

## Customizing

- Landing copy and the inline language picker live in [`components/app/welcome-view.tsx`](./components/app/welcome-view.tsx).
- The language list (codes + labels) and the dispatched `agentName` live in [`app-config.ts`](./app-config.ts). The language codes must match `LANGUAGE_VOICES` in [`fish/src/agent.py`](../fish/src/agent.py), which maps each to a native Fish voice.
- The avatar tile + Fish waveform loader are [`components/app/avatar-tile.tsx`](./components/app/avatar-tile.tsx) and [`components/app/waveform-loader.tsx`](./components/app/waveform-loader.tsx); transient captions are [`components/app/captions.tsx`](./components/app/captions.tsx). The composed in-call view is [`components/agents-ui/blocks/agent-session-view-01/components/agent-session-block.tsx`](./components/agents-ui/blocks/agent-session-view-01/components/agent-session-block.tsx), which also gates the mic until the avatar starts speaking.

For the full Agents UI component reference (updating
components via `pnpm shadcn:install`, etc.), see the upstream
[`agent-starter-react`](https://github.com/livekit-examples/agent-starter-react) README.
