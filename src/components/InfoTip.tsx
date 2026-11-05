import React, { useEffect, useRef, useState } from 'react';

// An explanation that opens with a tap (phones have no hover), and also on hover with a mouse.
// The bubble is placed against the nearest positioned container (a card footer, a row of
// pills), across its whole width, so it never runs off a phone screen. Closes with a second tap,
// a tap elsewhere or Escape.
export function InfoTip({
  text,
  className,
  children,
}: {
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={`infotip${open ? ' is-open' : ''}`}>
      <button type="button" className={`infotip-trigger ${className ?? ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children}
      </button>
      <span role="tooltip" className="infotip-bubble">
        {text}
      </span>
    </span>
  );
}
