'use client';

import { useMemo, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import { type AppConfig, DEFAULT_LANGUAGE } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { getSandboxTokenSource } from '@/lib/utils';

function AppSetup() {
  useAgentErrors();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

export function App({ appConfig }: AppProps) {
  // The language chosen on the landing page. Rides agentMetadata to the worker, which
  // picks the matching Fish voice and greets in that language.
  const [language, setLanguage] = useState<string>(DEFAULT_LANGUAGE);

  // Recreate the token source whenever the language changes so it starts with an empty
  // cache. livekit-client's TokenSourceCached has an inverted cache check that would
  // otherwise hand back the token minted for the previous selection; a fresh source per
  // language sidesteps it (its cache is empty, so it always fetches with current metadata).
  const tokenSource = useMemo(() => {
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig)
      : TokenSource.endpoint('/api/token');
    // `language` is intentionally a dep (not used in the body) to force a fresh source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appConfig, language]);

  const sessionOptions = useMemo(
    () => ({
      agentName: appConfig.agentName,
      agentMetadata: JSON.stringify({ language }),
      // The avatar worker must be dispatched into and join the room before the agent
      // session reaches "listening", so give the connect check generous headroom over
      // the 20s default. The Beyond Presence cold start is ~6s normally but can stretch
      // to ~20s under load/reconnect churn; 75s keeps a slow join from tripping a false
      // "agent did not finish initializing" error.
      agentConnectTimeoutMilliseconds: 75_000,
    }),
    [appConfig.agentName, language]
  );

  const session = useSession(tokenSource, sessionOptions);

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController appConfig={appConfig} language={language} onLanguageChange={setLanguage} />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
