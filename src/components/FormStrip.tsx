import React from 'react';
import { FormResult } from '../lib/form';

const LETTER: Record<FormResult, string> = { win: "V", draw: "N", loss: "P" };
const WORD: Record<FormResult, string> = { win: "vittoria", draw: "patta", loss: "sconfitta" };

// Last results as small lettered squares, oldest first (letter + color, never color alone)
export function FormStrip({ results }: { results: FormResult[] }) {
  if (results.length === 0) return null;
  return (
    <span className="form-strip" role="img" aria-label={`Ultimi risultati: ${results.map((r) => WORD[r]).join(", ")}`}>
      {results.map((r, i) => (
        <span key={i} className={`form-sq ${r}`} aria-hidden="true">{LETTER[r]}</span>
      ))}
    </span>
  );
}
