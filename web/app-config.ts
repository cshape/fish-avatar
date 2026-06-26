/** A language the user can open the conversation in (sets Fish's greeting + voice). */
export interface Language {
  code: string;
  label: string;
}

// The agent (fish/src/agent.py) maps each code → a Fish voice_id. Keep codes in sync.
export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
];

export const DEFAULT_LANGUAGE = 'en';

export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  // agent dispatch configuration
  agentName?: string;

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'Fish Audio',
  pageTitle: 'Talk to a voice + avatar agent — powered by Fish Audio',
  pageDescription:
    "Chat with a LiveKit voice agent running Fish Audio's text-to-speech, with a real-time " +
    'video avatar from Beyond Presence. Just hit start and say hi.',

  supportsChatInput: false,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: false,

  logo: '/lk-logo.svg',
  accent: '#002cf2',
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#1fd5f9',
  startButtonText: 'Start call',

  // agent dispatch configuration — NAMED dispatch. Must match AGENT_NAME in
  // fish/src/agent.py. Hardcoded (not env-gated) so a missing env var can't silently
  // fall back to auto-dispatch and break the dispatch.
  agentName: process.env.AGENT_NAME ?? 'fish-avatar',

  // LiveKit Cloud Sandbox configuration
  sandboxId: undefined,
};
