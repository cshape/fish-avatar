'use client';

import { useEffect, useRef } from 'react';
import { Alignment, Fit, Layout, Rive } from '@rive-app/canvas';
import { cn } from '@/lib/shadcn/utils';

// Fish Audio's official Fish-tail logo motion asset. The runtime contract (artboards,
// state machines, view model) is documented alongside the .riv in the design delivery.
const ARTBOARD = 'Logo · Black';
const STATE_MACHINE = 'Fish Tail · Autoplay · Infinite';

/**
 * The official Fish Audio Fish-tail logo animation (Rive), used as the avatar loading
 * visual. We render the black artboard and flip it to white in dark mode via `dark:invert`,
 * matching how the rest of the app themes the mark. The infinite state machine loops for
 * as long as the loader is on screen; reduced-motion users get the static rest pose.
 */
export function FishTailLogo({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rive = new Rive({
      src: '/fish-tail-logo.riv',
      canvas,
      artboard: ARTBOARD,
      stateMachines: STATE_MACHINE,
      autoplay: false,
      autoBind: false,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      onLoad() {
        rive.resizeDrawingSurfaceToCanvas();
        // Hold the rest pose for reduced-motion users; otherwise loop forever.
        if (!reduceMotion) rive.play(STATE_MACHINE);
      },
    });

    // Keep the drawing surface crisp when the container (or DPR) changes size.
    const observer = new ResizeObserver(() => rive.resizeDrawingSurfaceToCanvas());
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      rive.cleanup();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Loading"
      className={cn('block h-auto dark:invert', className)}
      style={{ aspectRatio: '435 / 225' }}
    />
  );
}
