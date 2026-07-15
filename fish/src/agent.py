import json
import logging
import os
import re
from collections.abc import AsyncIterable

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobExecutorType,
    JobProcess,
    cli,
)
from livekit.plugins import bey, fishaudio, silero, soniox

from llm import build_llm

logger = logging.getLogger("agent")
load_dotenv(".env.local")

# Named dispatch: the frontend requests this exact agent name. Must match
# `agentName` in web/app-config.ts. A mismatch = no agent dispatches, silently.
AGENT_NAME = "fish-avatar"

# Fish Audio voice (Stellan, American male) — the English default.
DEFAULT_VOICE_ID = "747b05c0add940baa95270cf68c0cc2e"

# The user picks an opening language on the landing page; it rides agent metadata
# (ctx.job.metadata = {"language": "<code>"}). We pick a language-native Fish voice so
# the conversation doesn't open with an English accent, and greet in that language.
# Codes must match LANGUAGES in web/app-config.ts.
LANGUAGE_VOICES = {
    "en": DEFAULT_VOICE_ID,
    "ja": "92c556e1a13e4ac7add3d1a8665c3cb8",
    "ko": "8cf5ee4cb0224c109852a206f185a05f",
    "zh": "6fc59d2b56cf402eb572934114c8d8aa",
    "fr": "9f0935a47689459480b820ed3f6d782d",
    "es": "3f45a7fd7a614655a61eb7027b955783",
    "de": "90042f762dbf49baa2e7776d011eee6b",
    "ar": "b8a16ccac9ad4bc78f5f3f5dd46dc6b5",
}
LANGUAGE_NAMES = {
    "en": "English",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ar": "Arabic",
}
DEFAULT_LANGUAGE = "en"

# Beyond Presence stock avatar. Override with BEY_AVATAR_ID — grab your own from
# the Beyond Presence dashboard (https://app.bey.dev).
DEFAULT_AVATAR_ID = "b9be11b8-89fb-4227-8f86-4a881393cbdb"


def _avatar_livekit_url() -> str:
    """ws[s]:// LiveKit URL for the Beyond Presence avatar.

    The bey plugin reads LIVEKIT_URL from the env and forwards it to Bey's API,
    which requires a ws[s]:// URL. LiveKit Cloud Agents injects LIVEKIT_URL with an
    https:// scheme, so Bey rejects it ("Invalid LiveKit URL"). Normalize the scheme
    so the avatar starts identically locally, on Render, and on Cloud Agents (where
    LIVEKIT_URL is otherwise already wss://).
    """
    url = os.getenv("LIVEKIT_URL", "")
    if url.startswith("https://"):
        return "wss://" + url[len("https://") :]
    if url.startswith("http://"):
        return "ws://" + url[len("http://") :]
    return url


# Languages to bias Soniox toward (Fish's strong code-switch set). Auto language
# identification stays on, so this hints without restricting detection.
LANGUAGE_HINTS = ["en", "zh", "ja", "es", "ar", "fr", "de", "ko", "pt", "it"]


# --- TTS pronunciation -------------------------------------------------------
# Fish mis-says "LiveKit" with a short-i ("liv-kit"). We rewrite it in the TTS path
# ONLY (the transcript is unaffected). A CMU Arpabet phoneme on just "Live" plus a
# plain "Kit" is what lands on s2.1-pro; the full-word phoneme broke it.
LIVEKIT_PHONEME = "<|phoneme_start|>L AY1 V<|phoneme_end|> Kit"
_LIVEKIT_RE = re.compile(r"\bLiveKit\b", re.IGNORECASE)
_LIVEKIT_WORD = "livekit"


async def _fix_tts_pronunciation(
    text: AsyncIterable[str], replacement: str
) -> AsyncIterable[str]:
    """Streamingly rewrite 'LiveKit' to `replacement` without splitting the word
    across chunk boundaries. Holds back only a trailing run that could be the start
    of an incomplete 'LiveKit', so latency stays low."""
    buf = ""
    async for chunk in text:
        buf += chunk
        low = buf.lower()
        hold = 0
        for k in range(min(len(_LIVEKIT_WORD), len(buf)), 0, -1):
            if low.endswith(_LIVEKIT_WORD[:k]):
                hold = k
                break
        if hold < len(buf):
            emit = buf[: len(buf) - hold]
            yield _LIVEKIT_RE.sub(replacement, emit)
            buf = buf[len(buf) - hold :]
    if buf:
        yield _LIVEKIT_RE.sub(replacement, buf)


# --- Persona & product knowledge ---------------------------------------------
# "Fish" is a consultative sales engineer for Fish Audio, talking to someone
# evaluating TTS. The product facts below are what the model draws on; the 1-2
# sentence rule keeps spoken replies short.
INSTRUCTIONS = """
You are "Fish," a sales engineer for Fish Audio — voice AI infrastructure for companies that need expressive, low-latency, cost-efficient speech in production. You're talking with someone evaluating text-to-speech for their product. Your job: understand their use case and show, concretely, why Fish Audio fits. Consultative, never pushy.

LANGUAGE: You are fully multilingual. Detect the language the user is speaking and reply in THAT language, switching fluently mid-conversation if they switch. Fish Audio itself code-switches across English, Chinese, Japanese, Spanish, Arabic and more within a single generation — you embody that capability.

STYLE (this is a live spoken conversation, not a deck): one or two short sentences per reply, MAX. Lead with the single most relevant point, ask ONE good discovery question at a time (their use case, latency needs, languages, scale, deployment), and build on their answers. Warm, sharp, and confident — a real engineer who's easy to talk to, never a script. Only go long if they explicitly ask for detail.

POSTURE: Fish Audio is the company doing the hard work this category needs, and buyers can verify that by talking to engineering directly. Not "a scrappy startup competing with the big guys," not "cheaper and just as good." You're credible because the models were built for production from day one — most TTS sounds fine for ten seconds then drifts; Fish trained on messy, expressive, real recordings precisely to solve that drift.

WHAT FISH AUDIO IS: voice AI infrastructure — the layer companies build on when voice becomes core to their product. Typical production uses: agents that take phone calls, characters that talk in real time, content platforms generating voiceovers at scale, and vertical apps where the voice must sound human and arrive in under a second. Deploys across cloud, VPC, and on-premise. 80+ languages, deep coverage on 13. Millions of creators plus an enterprise API.

THE S-SERIES MODELS — match the model to the use case:
- S2 Stream (part of S2.1 Pro): real-time voice agents, phone, anything needing sub-150ms time-to-first-byte; guaranteed voice consistency by design, supports fine-tuning and zero-shot cloning. Pitch this for conversational / agent / support use cases.
- S2 Pro: expressive use cases — companions, characters, dubbing, content. Strongest emotion control, best multilingual quality, highest expressiveness ceiling.
- S2.1 Pro: the newest iteration on S2 Pro — RL-trained gains in short-phrase stability, whisper control, timbre consistency, and volume normalization.
- S1: mature, broadly tested, deterministic; still in service when a customer prefers a known, long-deployed model.
Many customers run two in parallel — one real-time, one expressive. Recommend that when it fits.

CONTROLLABILITY (the differentiator buyers respond to most): Fish supports OPEN-DOMAIN emotion tags — no fixed list. On S2 Pro the syntax is square brackets: [happy] What a beautiful day! / [whispering] come closer / [angry] get out / [soft, empathetic] I know this is hard. Use [break] for pacing. You write ANY descriptor and the model interprets it in context — structurally different from competitors' closed-set emotion controls. If they ask about emotion or expressive control, offer to show it live.

VOICE ECOSYSTEM: a library of 2M+ real, trained voice models usable today — not empty clone slots — plus the ability to train your own on top. Decisive for content, gaming, and creator platforms; signals scale for everyone else. Instant voice cloning from 30 to 90 seconds of reference audio, output ready in 5 to 15 seconds, quality at or above competitors' professional cloning out of the box.

INFRASTRUCTURE: multi-region cloud (US-East primary; Japan datacenter live for Asia with automatic regional routing). VPC and on-premise for regulated verticals (H100/H200 in production; RTX 5090, A6000 PRO, or L40S minimum). Concurrency scales with plan tier; enterprise gets custom concurrency and rate limits, and 500+ QPS needs provisioning plus a commit. The TTS endpoint streams by default, with word-level timestamps (near character-level for CJK) and WebSocket cancellation for real-time agents.

OPEN WEIGHTS: Fish ships open-weights versions of earlier models (S1-mini is the most prominent) for the research and developer community — more open than any direct competitor, though "open weights" is not OSI open-source. The SOTA models (S1, S2 Pro, S2 Flash) are closed for commercial use. This lands well with engineering buyers who want to inspect, experiment, or hedge against lock-in; many enterprise deals start as internal open-weight experiments.

LANGUAGES: 13 tier-1 (English; Simplified and Traditional Chinese; Japanese, German, French, Spanish, Korean, Arabic, Russian, Dutch, Italian, Polish, Portuguese) and 80+ total at varying quality. Instant code-switching across English, Japanese, Chinese, Spanish, Arabic and others in a single generation. Dedicated fine-tuning engagements available for smaller-dataset languages like Cantonese, Singlish, and Thai.

HONESTY: Don't invent specific prices, metrics, or customer names you don't have. If asked for figures you're unsure of, say you'll connect them with the team rather than guessing. Keep the focus on their use case.
"""


def greeting_for(language_name: str) -> str:
    return (
        "Greet the user warmly in ONE or two short sentences as Fish, from Fish Audio. "
        "Say you help teams find the right voice setup for what they're building, and ask "
        f"what they're working on or what brought them in. Keep it brief and natural; speak "
        f"in {language_name}."
    )


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            # Provider chosen by env (see llm.build_llm): our own OpenAI-compatible
            # endpoint when LLM_BASE_URL is set, else direct OpenAI gpt-5.4-mini.
            llm=build_llm(default_openai_model="gpt-5.4-mini"),
            instructions=INSTRUCTIONS,
        )

    def tts_node(self, text, model_settings):
        # Fix the "LiveKit" pronunciation in the audio only (transcript is unaffected).
        stream = _fix_tts_pronunciation(text, LIVEKIT_PHONEME)
        return Agent.default.tts_node(self, stream, model_settings)


# Memory: Render's 512MB Starter tier can't fit multiple PROCESS-mode job workers
# (each carries a full copy of the runtime + silero VAD). Run jobs as THREADS in a
# single process so the runtime/VAD load once and are shared. Both knobs are
# env-overridable; flip JOB_EXECUTOR=process (+ a bigger plan) for process isolation.
_EXECUTOR = (
    JobExecutorType.THREAD
    if os.getenv("JOB_EXECUTOR", "thread").lower() == "thread"
    else JobExecutorType.PROCESS
)
server = AgentServer(
    job_executor_type=_EXECUTOR,
    num_idle_processes=int(os.getenv("NUM_IDLE_PROCESSES", "1")),
)


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name=AGENT_NAME)
async def my_agent(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    # Opening language chosen on the landing page, delivered as agent dispatch metadata:
    # {"language": "<code>"}. Pick the matching native voice + greeting language.
    raw_meta = ctx.job.metadata or ""
    try:
        meta = json.loads(raw_meta) if raw_meta else {}
        if not isinstance(meta, dict):
            meta = {}
    except Exception:
        logger.warning("could not parse job metadata: %r", raw_meta)
        meta = {}
    language = meta.get("language")
    if language not in LANGUAGE_VOICES:
        language = DEFAULT_LANGUAGE
    voice_id = os.getenv("FISH_VOICE_ID") or LANGUAGE_VOICES[language]
    logger.info("session language=%s voice_id=%s", language, voice_id)

    # Connect first so the avatar worker can be dispatched into (and join) the room.
    await ctx.connect()

    session = AgentSession(
        # Soniox real-time STT: multilingual with automatic language identification
        # (on by default), so the user can switch languages mid-conversation and it
        # keeps up. Hints bias toward Fish's strong code-switch set without limiting.
        stt=soniox.STT(
            params=soniox.STTOptions(
                language_hints=LANGUAGE_HINTS,
                enable_language_identification=True,
                # Max-aggressive end-of-turn (fish-bare-agent posture, Soniox knobs):
                # 500ms is the plugin's floor for endpoint delay, and sensitivity 1.0
                # makes endpoints as likely as the model allows — Soniox finalizes on
                # the shortest confident pause it can. Back these off if the agent
                # starts cutting users off mid-sentence.
                # endpoint_sensitivity is stt-rt-v5 only (the plugin default model).
                max_endpoint_delay_ms=500,
                endpoint_sensitivity=1.0,
            )
        ),
        # The fork's fishaudio plugin (see [tool.uv.sources] in pyproject.toml) keeps
        # one prewarmed `/v1/tts/live` websocket per session — no config needed here;
        # the framework calls the plugin's prewarm() at agent-activity start.
        tts=fishaudio.TTS(
            model="s2.1-pro",
            voice_id=voice_id,
            latency_mode="low",
            # PCM, not the default WAV. With streamed LLM output the WAV-container
            # decode path produces an audible first-word "crackle" over WebRTC that
            # raw PCM avoids. Fish's bytes are clean either way.
            output_format="pcm",
        ),
        # Turn detection falls back to silero VAD — keeps the worker footprint small
        # enough for Render's 512MB Starter tier.
        vad=ctx.proc.userdata["vad"],
        # Trust the STT's endpoint (no added floor); 1.5s is just a hard safety
        # ceiling so the agent never hangs waiting on an unconfident endpoint.
        min_endpointing_delay=0.0,
        max_endpointing_delay=1.5,
        # Start generating the reply on the preflight transcript, before the turn is
        # fully committed, to shave reply latency. Safe here — no clone-read silence
        # gate to race (unlike livekit-demo).
        preemptive_generation=True,
    )

    # Beyond Presence avatar. `start` dispatches the avatar worker into the room and
    # reroutes the session's audio output to it, so the avatar publishes synchronized
    # audio + video. Must run before session.start.
    avatar = bey.AvatarSession(avatar_id=os.getenv("BEY_AVATAR_ID", DEFAULT_AVATAR_ID))
    await avatar.start(session, room=ctx.room, livekit_url=_avatar_livekit_url())

    # Start the session, which initializes the voice pipeline and warms up the models.
    await session.start(agent=Assistant(), room=ctx.room)

    session.generate_reply(instructions=greeting_for(LANGUAGE_NAMES[language]))


if __name__ == "__main__":
    cli.run_app(server)
