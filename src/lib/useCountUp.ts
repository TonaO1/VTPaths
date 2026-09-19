import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number towards its target. The reroute is the pitch, and a
 * distance that visibly climbs from 678 to 728 reads as something happening;
 * a number that silently swaps does not.
 *
 * No animation library: one rAF loop and an ease-out.
 */
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const frame = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = target - origin;

    if (delta === 0) return;

    const tick = (now: number) => {
      const t = Math.min((now - start) / ms, 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(origin + delta * eased);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, ms]);

  return value;
}
