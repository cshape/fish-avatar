# CLAUDE.md

LiveKit Agents (Python) **voice + avatar** demo. A single agent at `src/agent.py` talks
through Fish Audio TTS with a real-time **Beyond Presence** video avatar. React frontend
in the sibling dir at `../web/` (Next.js 15 + Tailwind v4 + shadcn + `@livekit/components-react`,
bootstrapped from the `agent-starter-react` template).

**The agent is "Fish," a multilingual sales engineer for Fish Audio**, talking to a prospect
evaluating TTS. Its persona + product knowledge (S-series models, open-domain emotion tags,
voice ecosystem, infra, languages, open weights, sales posture) live in `INSTRUCTIONS` in
`src/agent.py`. It detects the user's language and replies in kind, switching fluently —
backed by Soniox multilingual STT and Fish's code-switching TTS.

This was forked from `cshape/livekit-demo` (the Fish voice-cloning demo) and **stripped to
basics**: no voice cloning, no expressive presets, no mood ring, and no fork dependency —
it runs on released `livekit-agents`.

Use `uv` for everything. App code lives under `src/` with `agent.py` as the entrypoint;
`uv run ruff check src/` / `uv run ruff format src/` must stay green.

## Stack

- **STT**: Soniox real-time `stt-rt-v5` (`livekit-plugins-soniox`, via the `livekit-agents[soniox]` extra). Multilingual with `enable_language_identification=True` (default) so the user can switch languages mid-call; `language_hints` bias toward Fish's code-switch set without restricting detection. Needs `SONIOX_API_KEY`. (Swapped off AssemblyAI, which was English-only.)
- **LLM**: OpenAI `gpt-5.4-mini` (`livekit-plugins-openai`, direct via `OPENAI_API_KEY`); override with `OPENAI_MODEL`. The LLM is set on the `Assistant` (Agent), not the session.
- **TTS**: Fish Audio `s2.1-pro` (`livekit-plugins-fishaudio`), `latency_mode="low"`, `output_format="pcm"` (raw PCM avoids a first-word WebRTC crackle the WAV-container path produces). Voice = Stellan; override with `FISH_VOICE_ID`.
- **Avatar**: Beyond Presence (`bey`, via the `livekit-agents[bey]` extra). `bey.AvatarSession(avatar_id=...)`, default stock avatar; override with `BEY_AVATAR_ID`.
- **VAD / turn**: silero VAD only (no separate turn-detector model — keeps the worker inside Render's 512MB Starter tier).
- Runs against self-hosted `livekit-server --dev` (`ws://localhost:7880`, `devkey`/`secret`) or LiveKit Cloud.

## How the avatar is wired (`my_agent`)

The order matters — see `src/agent.py`:

1. `await ctx.connect()` — connect first so the avatar worker can be dispatched into and join the room.
2. Build the `AgentSession` (stt + tts + vad).
3. `avatar = bey.AvatarSession(avatar_id=...)`; `await avatar.start(session, room=ctx.room)`. **Before** `session.start`. `avatar.start` reroutes the session's audio output to the avatar worker, which publishes synchronized audio + video — so **no `RoomOutputOptions(audio_enabled=False)` is needed** (the SDK handles it). The frontend renders the avatar's camera track.
4. `await session.start(agent=Assistant(), room=ctx.room)`, then `session.generate_reply(GREETING)`.

## `.env.local` (gitignored)

```
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
ASSEMBLYAI_API_KEY=...
OPENAI_API_KEY=...
FISH_API_KEY=...      # Fish reads FISH_API_KEY, not FISH_AUDIO_API_KEY
BEY_API_KEY=...       # Beyond Presence (https://app.bey.dev → API keys)
OPENAI_MODEL=gpt-5.4-mini   # optional
# FISH_VOICE_ID=... / BEY_AVATAR_ID=...   # optional overrides
```

## Common commands

All from `fish/` (the dir with `pyproject.toml`).

```bash
uv sync
uv run python src/agent.py download-files   # silero VAD weights
uv run python src/agent.py console           # terminal mic smoke test (NOTE: avatar needs a real room — see below)
uv run python src/agent.py dev               # worker against local livekit-server --dev
uv run ruff check src/ && uv run ruff format src/
```

`uv run python -c "import src.agent"` is the fastest "did I break the imports" check.

## Full local stack (three terminals)

```bash
livekit-server --dev                 # devkey/secret on ws://localhost:7880
cd fish && uv run python src/agent.py dev
cd web && pnpm install && pnpm dev   # http://localhost:3000
```

Open http://localhost:3000, hit "Start call". Uses **named dispatch** — the frontend requests agent `fish-avatar`, so the worker must be registered under that name (`@server.rtc_session(agent_name="fish-avatar")`). `AGENT_NAME` in `src/agent.py` MUST match `agentName` in `web/app-config.ts` (`'fish-avatar'`) — a mismatch means no agent dispatches, silently.

## Things to know

- **The avatar requires LiveKit Cloud (or any publicly-reachable LiveKit server) — it will NOT work against `livekit-server --dev` on localhost.** Beyond Presence's avatar runs on *their* cloud and joins your room; it can't reach `ws://localhost:7880`. Against localhost you get `bey ... 400 {"detail":"Failed to connect to LiveKit room, please make sure your credentials are correct."}` and the job crashes ("Agent left the room unexpectedly" in the UI). The bey API key is fine — point both `.env.local`s at the LiveKit Cloud project (`wss://...livekit.cloud`) and it works. Verified 2026-06-25: avatar joins as participant `bey-avatar-agent`, publishes a ~1028×684 video track, and lip-syncs the Fish-TTS greeting.
- **Console mode has no real room**, so the avatar can't publish video there. Use `dev` + the web frontend against **LiveKit Cloud** to see the avatar. Console is still fine for testing the voice pipeline.
- **`fishaudio.TTS.update_options(voice_id=...)` applies to the *next* synthesis**, not mid-utterance.
- **TTS pronunciation fix**: `Assistant.tts_node` rewrites "LiveKit" → a phoneme spelling so Fish doesn't say "liv-kit", in the audio path only (the transcript is untouched). A phoneme on just "Live" plus a plain "Kit" is what lands on s2.1-pro; the full-word phoneme broke it.
- **Worker runs jobs as THREADS** (`JobExecutorType.THREAD`) so the runtime + silero VAD load once — fits Render's 512MB Starter tier. Flip `JOB_EXECUTOR=process` (+ a bigger plan) for process isolation.
- **Avatar cold start**: the frontend bumps `agentConnectTimeoutMilliseconds` to 45s (`web/components/app/app.tsx`) so the avatar worker has time to join before the connect check fires.

## Project layout

```
src/
└── agent.py     # Assistant (plain Agent), tts_node pronunciation fix, avatar wiring, server entrypoint
tests/
└── test_agent.py  # 3 LLM-judge eval tests (friendliness, grounding, refusal) — instantiate Assistant()
```

## Frontend (`../web`)

- Landing page (`components/app/welcome-view.tsx`): "Hit start and say hi in `<language ▾>`" — an inline shadcn `Select` of 8 languages (English default, then Japanese, Korean, Chinese, French, Spanish, German, Arabic; defined in `web/app-config.ts` `LANGUAGES`).
- **Opening-language → voice (named-dispatch metadata).** `app.tsx` holds the language and passes `agentMetadata: JSON.stringify({ language })` to `useSession` (and recreates the token source per language to dodge livekit-client's inverted token cache — see the comment). LiveKit forwards it to the worker as `ctx.job.metadata`; `my_agent` reads `language`, maps it via `LANGUAGE_VOICES` to a native Fish `voice_id` (so a non-English convo doesn't open with an English accent — the Stellan default is English-only), and greets in that language via `greeting_for(LANGUAGE_NAMES[language])`. `LANGUAGE_VOICES` codes MUST match `LANGUAGES` in `web/app-config.ts`. The voice is fixed for the session; mid-call the user can still switch languages by speaking (Soniox detects, the LLM mirrors), but the timbre stays the picked voice.
- **Voice-only, no transcript.** The session view (`agent-session-view-01/components/agent-session-block.tsx`) is just a centered avatar + a minimal mic/end-call control bar. The transcript, pre-connect shimmer, mode toggle, and mood ring are all gone.
- The avatar renders via `components/app/avatar-tile.tsx` (`useTracks([Track.Source.Camera])` → first remote camera track → `<VideoTrack>`), centered. Until the track arrives it shows the **Fish Audio whale animation** (`components/app/whale-loader.tsx` renders `public/fish.audio.riv` via `@rive-app/react-webgl2`, dynamic-imported with `ssr:false`; the `.riv` came from `~/code/fish/platform-web`) behind a progress bar that fills 0→95% over **20s**, then creeps +1%/3s to 99%. No "Connecting…" text. Track arrival reveals the video immediately.
- `agent-chat-transcript.tsx` still exists but is no longer mounted (kept for reference; safe to delete).
- Deploy: `render.yaml` (web + worker on Render Starter against LiveKit Cloud); env group `fish-avatar-shared` needs `BEY_API_KEY` in addition to the LiveKit/AssemblyAI/OpenAI/Fish keys.
```
