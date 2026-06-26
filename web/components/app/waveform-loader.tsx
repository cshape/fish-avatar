import { cn } from '@/lib/shadcn/utils';

// The Fish Audio waveform mark — exact bar geometry from the fish.audio app logo
// (viewBox 0 0 512 512, every bar w=16 rx=8). Black bars form the mark; the six gray
// bars are the lower accent. `dark:invert` flips it for dark mode.
const BLACK_BARS: Array<[number, number, number]> = [
  [38.1, 200, 19.4],
  [71, 202.7, 30.7],
  [103.9, 198.4, 77.4],
  [136.9, 192, 20],
  [136.9, 245.4, 58.3],
  [168.6, 235.1, 100.8],
  [200.6, 222.4, 102.2],
  [232.6, 204.1, 115.8],
  [264.5, 190.2, 120.1],
  [297.1, 181.9, 107.1],
  [328.9, 177, 87.8],
  [360.9, 175, 86.6],
  [392.9, 178.1, 75.4],
  [424.7, 185.2, 60.2],
  [456.7, 204.1, 38],
];

const GRAY_BARS: Array<[number, number, number]> = [
  [297.1, 299.3, 21.4],
  [328.9, 276.4, 46],
  [360.9, 270.7, 51.6],
  [392.9, 264.3, 52.1],
  [424.7, 256.6, 47.4],
  [456.7, 249.9, 27.1],
];

// Ripple left → right: delay scales with the bar's x across the mark's span.
const X_MIN = 38.1;
const X_SPAN = 456.7 - 38.1;
const SWEEP_S = 0.7;
const delayFor = (x: number) => `${((x - X_MIN) / X_SPAN) * SWEEP_S}s`;

/** Animated Fish Audio waveform, used as the avatar loading visual. */
export function WaveformLoader({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Loading"
      className={cn('dark:invert', className)}
    >
      {BLACK_BARS.map(([x, y, h], i) => (
        <rect
          key={`b-${i}`}
          className="fish-waveform-bar"
          x={x}
          y={y}
          width={16}
          height={h}
          rx={8}
          fill="#000"
          style={{ animationDelay: delayFor(x) }}
        />
      ))}
      {GRAY_BARS.map(([x, y, h], i) => (
        <rect
          key={`g-${i}`}
          className="fish-waveform-bar"
          x={x}
          y={y}
          width={16}
          height={h}
          rx={8}
          fill="#7a7a7a"
          style={{ animationDelay: delayFor(x) }}
        />
      ))}
    </svg>
  );
}
