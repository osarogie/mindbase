import { useEffect, useRef } from 'react';

export function useDebouncedEffect(effect: () => void | (() => void), deps: unknown[], delayMs: number) {
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    const timer = setTimeout(() => {
      void effectRef.current();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [...deps, delayMs]);
}
