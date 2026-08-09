import { useEffect, useState } from "react";

/** Debounces a *value* (not a callback — see debounce.ts for that) — the
 * returned value only updates `delayMs` after the input stops changing. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
