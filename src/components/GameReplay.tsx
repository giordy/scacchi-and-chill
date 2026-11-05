import React, { useEffect, useRef, useState } from 'react';
import { extractGameId } from '../lib/utils';

// Animated replay of a finished game, as Lichess renders it (Staunty pieces, as on this site)
export const replayGifUrl = (gameId: string) =>
  `https://lichess1.org/game/export/gif/${gameId}.gif?piece=staunty&theme=green`;

// Modal with the game replayed move by move; the GIF is downloaded only when it opens
export function GameReplay({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const id = extractGameId(url);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal?.();
    return () => d?.close?.();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="replay-dialog"
      aria-label={`Rivedi ${title}`}
      onClose={onClose}
      // A click on the backdrop (the dialog itself, outside its content) closes it
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <div className="replay-body">
        <div className="replay-head">
          <strong>{title}</strong>
          <button type="button" className="replay-close" aria-label="Chiudi" onClick={() => dialog.current?.close()}>
            ✕
          </button>
        </div>
        {id && state !== 'error' && (
          <div className="replay-frame">
            {state === 'loading' && <span className="replay-loading">Caricamento della partita…</span>}
            <img
              src={replayGifUrl(id)}
              alt={`Partita ${title} mossa per mossa`}
              className={state === 'ready' ? 'is-ready' : ''}
              onLoad={() => setState('ready')}
              onError={() => setState('error')}
            />
          </div>
        )}
        {(!id || state === 'error') && <p className="note">Non riesco a caricare l'animazione della partita.</p>}
        <a href={url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn replay-link">
          Apri su Lichess per l'analisi
        </a>
      </div>
    </dialog>
  );
}
