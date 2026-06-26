'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext, useSessionMessages } from '@livekit/components-react';
import { cn } from '@/lib/shadcn/utils';

// Defensive: strip any stray markup so captions read clean (the agent's transcript is
// already plain, but the TTS phoneme fix etc. never reach here anyway).
function clean(text: string): string {
  return text
    .replace(/<[^<>]*>/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// How long a caption lingers after its text stops updating, before fading out.
const LINGER_MS = 4000;

/**
 * Transient captions under the avatar: shows the latest utterance — your speech (STT)
 * or the agent's reply (LLM) — then fades it out a few seconds after it stops updating.
 * No persistent transcript.
 */
export function Captions({ className }: { className?: string }) {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const latest = messages.at(-1);
  const text = latest ? clean(latest.message) : '';
  const isUser = latest?.from?.isLocal === true;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!text) {
      setVisible(false);
      return;
    }
    // Show, and (re)arm the fade timer on every text change so it stays up while the
    // utterance is still streaming, then fades LINGER_MS after the last update.
    setVisible(true);
    const t = setTimeout(() => setVisible(false), LINGER_MS);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className={cn('pointer-events-none flex h-16 items-start justify-center px-6', className)}>
      <AnimatePresence mode="wait">
        {visible && text && (
          <motion.p
            key={latest?.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className={cn(
              'max-w-xl text-center text-base leading-relaxed text-balance',
              isUser ? 'text-muted-foreground italic' : 'text-foreground'
            )}
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
