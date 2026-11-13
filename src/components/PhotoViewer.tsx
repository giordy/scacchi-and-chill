import React, { useEffect, useRef } from 'react';

// A photo shown large, over the page: closes with a tap anywhere, the ✕ or Escape
export function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal?.();
    return () => d?.close?.();
  }, []);

  return (
    <dialog ref={dialog} className="photo-dialog" aria-label={alt} onClose={onClose} onClick={() => dialog.current?.close()}>
      <img src={src} alt={alt} className="photo-dialog-img" />
      <button type="button" className="photo-dialog-close" aria-label="Chiudi">
        ✕
      </button>
    </dialog>
  );
}
