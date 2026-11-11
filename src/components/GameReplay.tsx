import React, { useEffect, useRef, useState } from 'react';
import { extractGameId } from '../lib/utils';
import { ColorDot } from './PresenceDot';

// Animated replay of a finished game, as Lichess renders it (Staunty pieces, as on this site)
export const replayGifUrl = (gameId: string) =>
  `https://lichess1.org/game/export/gif/${gameId}.gif?piece=staunty&theme=green`;

// A chapter of a Lichess study (lichess.org/study/<study>/<chapter>): the master's famous game is
// often found as one. Lichess renders those as a GIF too, from the public or unlisted ones.
export function studyChapterOf(url?: string): { study: string; chapter: string } | undefined {
  const m = url?.match(/lichess\.org\/study\/([a-zA-Z0-9]{8})\/([a-zA-Z0-9]{8})/);
  return m ? { study: m[1], chapter: m[2] } : undefined;
}

// The GIF of a game or of a study chapter; undefined for any other link
export function replayGifFor(url?: string): string | undefined {
  const chapter = studyChapterOf(url);
  if (chapter) return `https://lichess.org/study/${chapter.study}/${chapter.chapter}.gif?piece=staunty&theme=green`;
  const id = extractGameId(url);
  return id ? replayGifUrl(id) : undefined;
}

// The players of a game from its title, White first: "Capablanca – Marshall, New York 1918"
export function playersFromTitle(title: string): { white: string; black: string } | undefined {
  const m = title.match(/^\s*(.+?)\s+[–—-]\s+(.+?)\s*(?:[,(]|$)/);
  return m ? { white: m[1], black: m[2] } : undefined;
}

// Modal with the game replayed move by move; the GIF is downloaded only when it opens
export function GameReplay({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const gif = replayGifFor(url);
  // A study chapter GIF has no names around the board: they come from the title
  const study = !!studyChapterOf(url);
  const players = study ? playersFromTitle(title) : undefined;

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
        {gif && state !== 'error' && (
          // A game GIF has the players above and below the board, a study chapter GIF only the board
          <div className={`replay-frame${study ? " is-square" : ""}`}>
            {state === 'loading' && <span className="replay-loading">Caricamento della partita…</span>}
            <img
              src={gif}
              alt={`Partita ${title} mossa per mossa`}
              className={state === 'ready' ? 'is-ready' : ''}
              onLoad={() => setState('ready')}
              onError={() => setState('error')}
            />
          </div>
        )}
        {players && state !== 'error' && (
          <p className="replay-players">
            {/* The same discs as the match cards */}
            <span><ColorDot color="w" now={0} name={players.white} /> {players.white}</span>
            <span><ColorDot color="b" now={0} name={players.black} /> {players.black}</span>
          </p>
        )}
        {(!gif || state === 'error') && <p className="note">Non riesco a caricare l'animazione della partita.</p>}
        <a href={url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn replay-link">
          Apri su Lichess per l'analisi
        </a>
      </div>
    </dialog>
  );
}
