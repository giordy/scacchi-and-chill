import React, { useState, useEffect } from 'react';

export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  isValid: (v: any) => boolean = () => true
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);

  return [value, setValue];
}
