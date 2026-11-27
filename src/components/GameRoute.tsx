import React, { useEffect, useMemo, useState } from 'react';
import { GameAnalysis, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { NameOf } from '../lib/roster';
import { findGame } from '../lib/gameLookup';
import { gameHref, gameOverHref, GameRoute as Route, pageOfHash, parseGameHash } from '../lib/routes';
import { readArchivedAnalysis } from '../lib/firestoreRest';
import { hasMoments } from '../lib/analysis';
import { GameReplay } from './GameReplay';

// The address of the game the site opened over a page (lib/routes.ts gameOverHref): closing that
// replay goes back in the history, to the page, so the back button does not reopen it
let openedHere: string | null = null;

// Opens a game over the current page (a link to a game, a card's ▶ or ✨)
export function openGame(e: React.MouseEvent, href: string) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  window.location.hash = href;
  openedHere = window.location.hash;
}

// A link to a game of the tournament: its own address (to copy or open in a new tab), opened over
// the current page when tapped
export function GameLink({
  id,
  moments = false,
  className,
  children,
  ...rest
}: { id: string; moments?: boolean; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  return (
    <a {...rest} href={gameHref(id, moments)} className={className} onClick={(e) => openGame(e, gameOverHref(window.location.hash, id, moments))}>
      {children}
    </a>
  );
}

// The game of the address, replayed over the page with its key moments (lib/routes.ts parseGameHash)
export function GameRoute({
  hash,
  history,
  gameStates,
  seasons,
  nameOf,
}: {
  hash: string;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  nameOf: NameOf;
}) {
  const route = parseGameHash(hash);
  const game = useMemo(
    () => (route ? findGame(route.id, history, gameStates, seasons, nameOf) : undefined),
    [route?.id, history, gameStates, seasons, nameOf]
  );
  if (!route || !game) return null;
  // A new replay for each game: its own animation and its own scroll
  return <OpenGame key={game.id} route={route} game={game} />;
}

function OpenGame({ route, game }: { route: Route; game: NonNullable<ReturnType<typeof findGame>> }) {
  // An archived game's key moments are read when it opens
  const archived = !!game.season && !game.decided;
  const [read, setRead] = useState<{ analysis?: GameAnalysis; done: boolean }>({ done: !archived });
  useEffect(() => {
    if (!archived) return;
    let alive = true;
    readArchivedAnalysis(game.id).then(
      (analysis) => alive && setRead({ analysis, done: true }),
      () => alive && setRead({ done: true })
    );
    return () => {
      alive = false;
    };
  }, [archived, game.id]);
  const analysis = archived ? read.analysis : game.analysis;

  const close = () => {
    // Closed because the address changed (back button, another page): nothing more to do
    const now = parseGameHash(window.location.hash);
    if (!now || now.id !== game.id) return;
    if (openedHere === window.location.hash) {
      openedHere = null;
      window.history.back();
      return;
    }
    openedHere = null;
    // Arrived from a shared link: the page under it stays, without the game
    window.location.replace(`${window.location.pathname}${window.location.search}${pageOfHash(window.location.hash)}`);
  };

  const base = `${window.location.origin}${window.location.pathname}`;
  const subtitle = [game.season, game.round && `Turno ${game.round}`].filter(Boolean).join(' · ');
  return (
    <GameReplay
      url={game.url}
      title={`${game.white} – ${game.black}`}
      subtitle={subtitle}
      onClose={close}
      analysis={analysis}
      names={{ white: game.white, black: game.black }}
      ending={game.ending}
      toMoments={route.moments}
      ongoing={game.ongoing}
      loadingMoments={archived && !read.done}
      pending={game.pending}
      shareUrl={`${base}${gameHref(game.id, !game.ongoing && hasMoments(analysis))}`}
    />
  );
}
