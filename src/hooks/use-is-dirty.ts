"use client";

import { useRef, useMemo } from "react";

/**
 * Compares a baseline snapshot against the current value to determine
 * whether form data has changed.
 *
 * - Deep-compares using JSON.stringify (sufficient for flat/serialisable
 *   form state — strings, numbers, booleans, arrays of primitives).
 * - Baseline automatically resets when `initialValue` changes
 *   (e.g. dialog re-opens with new data).
 *
 * @param initialValue - The value considered "clean".
 * @param currentValue - The live form state to compare against.
 * @returns `isDirty` — true when currentValue differs from baseline.
 */
export function useIsDirty<T>(initialValue: T, currentValue: T): boolean {
  const baselineRef = useRef<string>(JSON.stringify(initialValue));
  const prevInitialRef = useRef(initialValue);

  // Re-baseline whenever initialValue changes (dialog re-opened with new data)
  if (prevInitialRef.current !== initialValue) {
    prevInitialRef.current = initialValue;
    baselineRef.current = JSON.stringify(initialValue);
  }

  return useMemo(() => {
    return JSON.stringify(currentValue) !== baselineRef.current;
  }, [currentValue]);
}
