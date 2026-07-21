'use client';

import { useEffect, useState } from 'react';
import { Track } from 'livekit-client';
import { motion } from 'motion/react';
import { VideoTrack, useSessionContext, useTracks } from '@livekit/components-react';
import { FishTailLogo } from '@/components/app/fish-tail-logo';
import { cn } from '@/lib/shadcn/utils';

/**
 * Renders the agent's avatar video. The Beyond Presence avatar worker joins the room
 * as a separate participant and publishes the only camera track, synchronized with the
 * agent's Fish Audio speech — so we grab the first remote camera track and render it.
 *
 * Until that track arrives we show the Fish Audio waveform animation + a progress bar.
 * The moment the track arrives we reveal the video immediately, whatever the bar reads.
 */
export function AvatarTile({ className }: { className?: string }) {
  const { isConnected } = useSessionContext();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const avatarTrack = tracks.find((t) => t.publication && !t.participant.isLocal);

  if (avatarTrack) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn('overflow-hidden rounded-3xl bg-black shadow-2xl', className)}
      >
        <VideoTrack trackRef={avatarTrack} className="h-full w-full object-cover" />
      </motion.div>
    );
  }

  // While the session is tearing down (End Call), the avatar track drops but the view
  // is still fading out — show nothing rather than flashing the loader.
  if (!isConnected) {
    return <div className={cn('rounded-3xl', className)} />;
  }

  return <AvatarLoader className={className} />;
}

/**
 * Loading state: the Fish waveform animation above a progress bar that fills 0 → 95% over
 * 20s, then creeps +1% every 3s up to 99% until either the track arrives (AvatarTile
 * swaps to video) or the session's connect timeout errors out. The 20s fill is slow
 * enough that a normal cold start reveals the avatar well before the bar nears the end.
 */
function AvatarLoader({ className }: { className?: string }) {
  const [bar, setBar] = useState({ pct: 0, dur: 0 });

  useEffect(() => {
    // Kick off the 0 → 95% fill over 20s on the next frame (so it animates from 0).
    const startFill = requestAnimationFrame(() => setBar({ pct: 95, dur: 20000 }));

    let creep: ReturnType<typeof setInterval> | undefined;
    const toCreep = setTimeout(() => {
      creep = setInterval(() => setBar((b) => ({ pct: Math.min(b.pct + 1, 99), dur: 3000 })), 3000);
    }, 20000);

    return () => {
      cancelAnimationFrame(startFill);
      clearTimeout(toCreep);
      if (creep) clearInterval(creep);
    };
  }, []);

  return (
    <div
      className={cn(
        'relative grid place-content-center overflow-hidden rounded-3xl',
        'from-muted/40 to-muted/10 bg-gradient-to-b',
        className
      )}
    >
      <FishTailLogo className="w-44 md:w-52" />
      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <div className="bg-foreground/10 h-1.5 w-48 overflow-hidden rounded-full">
          <div
            className="bg-foreground/60 h-full rounded-full"
            style={{ width: `${bar.pct}%`, transition: `width ${bar.dur}ms linear` }}
          />
        </div>
      </div>
    </div>
  );
}
