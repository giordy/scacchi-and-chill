import React, { useState, useEffect } from 'react';
import { clampDays } from '../lib/utils';

export function DaysField({
  id,
  label,
  value,
  fallback,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  fallback: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setText(raw);
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 14) onCommit(n);
  };
  const handleBlur = () => {
    const n = clampDays(text, fallback);
    if (n !== value) onCommit(n);
    setText(String(n));
  };

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}
