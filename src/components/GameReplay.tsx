import React, { useEffect, useRef, useState } from 'react';
import { extractGameId } from '../lib/utils';
import { ColorDot } from './PresenceDot';
import { KeyMoments } from './KeyMoments';
import { GameAnalysis } from '../types';
import { hasMoments } from '../lib/analysis';

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

// Modal with the game replayed move by move; the GIF is downloaded only when it opens. A tournament
// game analysed by the GitHub Action has its key moments under it (lib/analysis.ts)
export function GameReplay({
  url,
  title,
  onClose,
  analysis,
  names,
  ending,
  toMoments = false,
  subtitle,
  shareUrl,
  ongoing = false,
  loadingMoments = false,
  pending = false,
}: {
  url: string;
  title: string;
  onClose: () => void;
  analysis?: GameAnalysis;
  names?: { white: string; black: string };
  // How the game ended on Lichess, for the last line of the key moments
  ending?: { status?: string; winner?: 'white' | 'black' };
  // Opened from "Momenti chiave": straight to them, past the animation
  toMoments?: boolean;
  // Under the title: the season and the round
  subtitle?: string;
  // The game's own address on the site, for "Condividi" (lib/routes.ts gameHref)
  shareUrl?: string;
  // Still on the board: no animation (it would show the position the site keeps hidden)
  ongoing?: boolean;
  // The key moments of an archived game, still being read
  loadingMoments?: boolean;
  // The analysis on its way: said under the animation
  pending?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const gif = ongoing ? undefined : replayGifFor(url);
  const [shared, setShared] = useState<'copied' | 'failed' | null>(null);
  // A study chapter GIF has no names around the board: they come from the title
  const study = !!studyChapterOf(url);
  const players = study ? playersFromTitle(title) : undefined;

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal?.();
    return () => d?.close?.();
  }, []);
  // Straight to the key moments, also when they arrive after the dialog (an archived game's)
  const showMoments = !!analysis && !!names && hasMoments(analysis);
  useEffect(() => {
    if (toMoments && showMoments) dialog.current?.querySelector('.key-moments')?.scrollIntoView?.({ block: 'start' });
  }, [toMoments, showMoments]);

  // The phone's share sheet (WhatsApp…) where there is one, otherwise the link copied
  const share = async () => {
    if (!shareUrl) return;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        // Closed without sharing
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShared('copied');
    } catch {
      setShared('failed');
    }
  };

  return (
    <dialog
      ref={dialog}
      className="replay-dialog"
      aria-label={`Rivedi ${title}`}
      // Only a real close: one followed at once by a new opening (React mounting the dialog twice
      // in development) is no close, and would take the visitor back a page
      onClose={() => !dialog.current?.open && onClose()}
      // A click on the backdrop (the dialog itself, outside its content) closes it
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <div className="replay-body">
        <div className="replay-head">
          <span className="replay-title">
            <strong>{title}</strong>
            {subtitle && <span className="replay-subtitle">{subtitle}</span>}
          </span>
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
        {ongoing ? (
          <p className="note">La partita è ancora in corso: il replay e i momenti chiave arrivano quando finisce.</p>
        ) : (
          (!gif || state === 'error') && <p className="note">Non riesco a caricare l'animazione della partita.</p>
        )}
        {showMoments && <KeyMoments analysis={analysis!} names={names!} state={ending} />}
        {loadingMoments && <p className="note replay-loading-moments">Carico i momenti chiave…</p>}
        {pending && <p className="note">I momenti chiave sono in preparazione: di solito arrivano entro un quarto d'ora dalla fine della partita.</p>}
        <div className="replay-actions">
          <a href={url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn replay-link">
            {ongoing ? 'Segui su Lichess' : "Apri su Lichess per l'analisi"}
          </a>
          {shareUrl && (
            <button type="button" className="lichess-link-btn replay-share" onClick={share}>
              Condividi
            </button>
          )}
        </div>
        {shared && (
          <p className="note note-sm replay-shared" role="status">
            {shared === 'copied' ? 'Link copiato: incollalo dove vuoi.' : `Copia il link: ${shareUrl}`}
          </p>
        )}
      </div>
    </dialog>
  );
}
