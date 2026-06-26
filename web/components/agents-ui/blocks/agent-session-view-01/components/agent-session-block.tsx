'use client';

import React from 'react';
import { type MotionProps, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import {
  AgentControlBar,
  type AgentControlBarControls,
} from '@/components/agents-ui/agent-control-bar';
import { AvatarTile } from '@/components/app/avatar-tile';
import { Captions } from '@/components/app/captions';
import { cn } from '@/lib/shadcn/utils';

const BOTTOM_VIEW_MOTION_PROPS: MotionProps = {
  variants: {
    visible: { opacity: 1, translateY: '0%' },
    hidden: { opacity: 0, translateY: '100%' },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: { duration: 0.3, delay: 0.5, ease: 'easeOut' },
};

export interface AgentSessionView_01Props {
  /**
   * Enables or disables camera controls in the bottom control bar.
   * @default false
   */
  supportsVideoInput?: boolean;
  /**
   * Enables or disables screen sharing controls in the bottom control bar.
   * @default false
   */
  supportsScreenShare?: boolean;

  /** Optional class name merged onto the outer `<section>` container. */
  className?: string;
}

export function AgentSessionView_01({
  supportsVideoInput = false,
  supportsScreenShare = false,
  ref,
  className,
  ...props
}: React.ComponentProps<'section'> & AgentSessionView_01Props) {
  const session = useSessionContext();

  // Voice-only, no transcript: the bottom bar is just mic + end call.
  const controls: AgentControlBarControls = {
    leave: true,
    microphone: true,
    camera: supportsVideoInput,
    screenShare: supportsScreenShare,
  };

  return (
    <section
      ref={ref}
      className={cn('bg-background relative h-full w-full overflow-hidden', className)}
      {...props}
    >
      {/* Centered avatar (loader until the video track arrives) + transient captions. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 pb-36 md:pb-40">
        <AvatarTile className="aspect-[3/2] w-full max-w-2xl" />
        <Captions className="w-full max-w-2xl" />
      </div>

      {/* Minimal bottom control bar: mic + end call. */}
      <motion.div
        {...BOTTOM_VIEW_MOTION_PROPS}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        <div className="relative mx-auto max-w-2xl pb-4 md:pb-10">
          <AgentControlBar
            variant="livekit"
            controls={controls}
            isConnected={session.isConnected}
            onDisconnect={session.end}
          />
        </div>
      </motion.div>
    </section>
  );
}
