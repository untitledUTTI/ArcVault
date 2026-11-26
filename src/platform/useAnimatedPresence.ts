import { useEffect, useState } from 'react';

export type AnimatedPresencePhase = 'entering' | 'open' | 'closing';

export function useAnimatedPresence(
  open: boolean,
  durationMs = 260,
): { mounted: boolean; phase: AnimatedPresencePhase } {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<AnimatedPresencePhase>(
    open ? 'open' : 'closing',
  );

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase('entering');
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setPhase('open');
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }

    if (!mounted) return;
    setPhase('closing');
    const timer = window.setTimeout(() => {
      setMounted(false);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, mounted, durationMs]);

  return { mounted, phase };
}
