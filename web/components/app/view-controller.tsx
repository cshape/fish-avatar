'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import { type AppConfig, LANGUAGES } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { WelcomeView } from '@/components/app/welcome-view';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: {
      opacity: 1,
    },
    hidden: {
      opacity: 0,
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: {
    duration: 0.5,
    ease: 'linear',
  },
};

interface ViewControllerProps {
  appConfig: AppConfig;
  language: string;
  onLanguageChange: (code: string) => void;
}

export function ViewController({ appConfig, language, onLanguageChange }: ViewControllerProps) {
  const { isConnected, start } = useSessionContext();

  return (
    <AnimatePresence mode="wait">
      {/* Welcome view */}
      {!isConnected && (
        <MotionWelcomeView
          key="welcome"
          {...VIEW_MOTION_PROPS}
          startButtonText={appConfig.startButtonText}
          languages={LANGUAGES}
          language={language}
          onLanguageChange={onLanguageChange}
          // Acquire the mic at the Start click (so the permission prompt rides this user
          // gesture), then the session view mutes it through load and re-enables it once
          // the avatar is up and Fish has started greeting — so the agent never hears
          // stray input during load and the user can't talk over the opener.
          onStartCall={() => start({ tracks: { microphone: { enabled: true } } })}
        />
      )}
      {/* Session view */}
      {isConnected && (
        <MotionSessionView
          key="session-view"
          {...VIEW_MOTION_PROPS}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare}
          className="fixed inset-0"
        />
      )}
    </AnimatePresence>
  );
}
