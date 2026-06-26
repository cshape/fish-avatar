"""Conversation-LLM factory.

The single seam where we choose the LLM provider, kept out of the SDK's path so
`livekit-agents` / `livekit-plugins-openai` stay freely upgradable.

The LiveKit `openai.LLM` plugin is a generic OpenAI-compatible `/v1/chat/completions`
client (`base_url` + `api_key` are first-class args), so pointing it at our own
self-hosted model needs no fork and no custom `llm.LLM` subclass — just a base_url.
When `LLM_BASE_URL` is set we target that endpoint (e.g. the Gemma model served via
SGLang at `https://...api.fish.audio/v1`); otherwise we fall back to direct OpenAI.
"""

import os

from livekit.plugins import openai


def build_llm(default_openai_model: str) -> openai.LLM:
    """Build the conversation LLM from the environment.

    - `LLM_BASE_URL` set  -> our own OpenAI-compatible endpoint, using
      `LLM_MODEL` (default Gemma) + `LLM_API_KEY`, optional `LLM_TEMPERATURE`.
    - `LLM_BASE_URL` unset -> direct OpenAI, model from `OPENAI_MODEL` or the
      project default passed in.
    """
    base_url = os.getenv("LLM_BASE_URL")
    if base_url:
        kwargs = {}
        temperature = os.getenv("LLM_TEMPERATURE")
        if temperature is not None:
            kwargs["temperature"] = float(temperature)
        return openai.LLM(
            model=os.getenv("LLM_MODEL", "google/gemma-4-26B-A4B-it"),
            base_url=base_url,
            api_key=os.getenv("LLM_API_KEY"),
            **kwargs,
        )
    return openai.LLM(model=os.getenv("OPENAI_MODEL", default_openai_model))
