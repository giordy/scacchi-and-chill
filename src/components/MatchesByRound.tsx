import React, { Fragment, useState } from 'react';
import { HistoryGame, LichessExportGame } from '../types';
import { GameReplay } from './GameReplay';
import { InfoTip } from './InfoTip';
import { gameProgress } from '../lib/progress';
import { isReturnLeg } from '../lib/legs';
import { MiniBoard, PhaseTile, START_FEN } from './MiniBoard';
import { gamePhase, movesLabel, PHASE_LABEL } from '../lib/phase';
import { layoutMatches, RoundBlock } from '../lib/matchesLayout';
import { upsetOf, upsetSentence } from '../lib/upset';
import { EloReport } from '../lib/tournamentElo';
import { extractGameId } from '../lib/utils';
import { positionsText, summitKey, SummitRanks } from '../lib/summit';
import { byOrganizer, DECIDED, DOUBLE_LOSS, stateOf } from '../lib/games';
import { playerHref } from '../lib/routes';
import { PresenceInfo, seenAtOf } from '../lib/presence';
import { ColorDot } from './PresenceDot';
import { OpeningFamily, playsFamily } from '../lib/masterOpening';
import { recentMove } from '../lib/live';
import { formatRoundEnd, roundExpired } from '../lib/roundDeadline';
import { analysisOf, hasMoments } from '../lib/analysis';

export interface MasterTag {
  family: OpeningFamily;
  surname: string;
}

interface MatchesByRoundProps {
  games: HistoryGame[]; // already filtered and sorted by round
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  returnStart?: string; // first round of the return leg, if any
  summits?: Map<string, SummitRanks>; // scontro al vertice: the places of its two players, by summitKey
  presence?: PresenceInfo; // when each player was last on Lichess, for the ongoing games
  elo?: EloReport; // Elo del torneo, for the colpacci
  masterTag?: MasterTag; // the master's opening, tagged on the games that play it
  moved?: Set<string>; // Lichess ids of the games with moves the visitor has not seen (lib/seenMoves.ts)
  roundEndOf?: (round: string) => number | undefined; // Turni con scadenza (lib/roundDeadline.ts)
  now?: number;
}

// Public "Partite": the current round first (its games by what there is to see), then the unfinished games of earlier rounds,
// the upcoming rounds and finally the played rounds, newest first; both collapsed
export function MatchesByRound({ games, gameStates, nameOf, returnStart, summits, presence, elo, masterTag, moved, roundEndOf, now = Date.now() }: MatchesByRoundProps) {
  const hasMoved = (g: HistoryGame) => {
    const id = extractGameId(g.url);
    return !!id && !!moved?.has(id);
  };
  const stateOfGame = (g: HistoryGame) => stateOf(g, gameStates);
  const progressOf = (g: HistoryGame) => gameProgress(stateOfGame(g));
  const legOf = (round: string) =>
    returnStart === undefined ? undefined : isReturnLeg(round, returnStart) ? "ritorno" : "andata";

  const summaryOf = (roundGames: HistoryGame[]) => {
    const progress = roundGames.map(progressOf);
    const finished = progress.filter((p) => p === "finished").length;
    const ongoing = progress.filter((p) => p === "ongoing").length;
    const pending = progress.length - finished - ongoing;
    // A closed round still says which of its games moved: it may hide the end of one
    const news = roundGames.filter(hasMoved).length;
    const newsText = news === 0 ? "" : news === 1 ? "1 con mosse nuove" : `${news} con mosse nuove`;
    return finished === progress.length
      ? ["Turno concluso", newsText].filter(Boolean).join(" · ")
      : [
          finished > 0 ? `${finished} ${finished === 1 ? "conclusa" : "concluse"}` : "",
          ongoing > 0 ? `${ongoing} in corso` : "",
          pending > 0 ? `${pending} da giocare` : "",
          newsText,
        ]
          .filter(Boolean)
          .join(", ");
  };

  const grid = (roundGames: HistoryGame[], showRound = false) => (
    <div className="matches-grid">
      {roundGames.map((g, idx) => (
        <MatchCard
          key={`${g.url}-${idx}`}
          game={g}
          state={stateOfGame(g)}
          nameOf={nameOf}
          showRound={showRound}
          summit={summits?.get(summitKey(g))}
          presence={presence}
          elo={elo}
          masterTag={masterTag}
          moved={hasMoved(g)}
        />
      ))}
    </div>
  );

  // Turni con scadenza: until when the round in progress goes on, while some of its games do. The date
  // only, no countdown: for the players the deadline decides nothing (the organizer sees one in Turni)
  const deadlineOf = (block: RoundBlock) => {
    const end = roundEndOf?.(block.round);
    if (end === undefined || block.games.every((g) => progressOf(g) === "finished")) return null;
    return roundExpired(end, now) ? (
      <span className="round-group-deadline is-over">
        <span aria-hidden="true">🗓️ </span>Si è chiuso {formatRoundEnd(end)}: le partite in corso continuano
      </span>
    ) : (
      <span className="round-group-deadline">
        <span aria-hidden="true">🗓️ </span>Fino a {formatRoundEnd(end)}
      </span>
    );
  };

  const header = (block: RoundBlock, tag?: string, deadline = false) => {
    const leg = legOf(block.round);
    return (
      <>
        <h3 id={`round-${block.round}`} className="round-group-title">
          Turno {block.round}
          {leg && <span className="round-group-leg">{leg}</span>}
          {tag && <span className="round-group-tag">{tag}</span>}
        </h3>
        <span className="round-group-summary">{summaryOf(block.games)}</span>
        {deadline && deadlineOf(block)}
      </>
    );
  };

  // The current round by what there is to see, not by pairing: the games with moves the visitor has not
  // seen, then those being played, those still to start and last the finished ones. Within each, as paired
  const ORDER = { ongoing: 1, pending: 2, finished: 3 } as const;
  const rankOf = (g: HistoryGame) => (hasMoved(g) ? 0 : ORDER[progressOf(g)]);
  const byNews = (roundGames: HistoryGame[]) =>
    roundGames.map((g, i) => ({ g, i, rank: rankOf(g) })).sort((a, b) => a.rank - b.rank || a.i - b.i).map((x) => x.g);

  const openRound = (block: RoundBlock, extraClass = "", tag?: string, sorted = false) => (
    <section key={block.round} className={`round-group${extraClass}`} aria-labelledby={`round-${block.round}`}>
      <header className="round-group-header">{header(block, tag, block === layout.current)}</header>
      {grid(sorted ? byNews(block.games) : block.games)}
    </section>
  );

  // One line with the round summary, open on tap
  const collapsedRound = (block: RoundBlock) => (
    <details key={block.round} className="round-group round-group-collapsible">
      <summary className="round-group-header">{header(block)}</summary>
      {grid(block.games)}
    </details>
  );

  const layout = layoutMatches(games, progressOf);
  const movedCount = games.filter(hasMoved).length;
  const movedNote = movedCount > 0 && (
    <p className="note new-moves-note" role="status">
      <span className="switch-dot" aria-hidden="true" />
      {movedCount === 1 ? "Una partita ha mosse nuove dall'ultima visita: è segnata qui sotto." : `${movedCount} partite hanno mosse nuove dall'ultima visita: sono segnate qui sotto.`}
    </p>
  );
  const roundCount = layout.played.length + layout.upcoming.length + (layout.current ? 1 : 0);

  // A single round (filter) or a season not started yet: nothing to reorder
  if (roundCount <= 1 || !layout.current) {
    const blocks = [...(layout.current ? [layout.current] : []), ...layout.upcoming];
    return (
      <div className="rounds-list">
        {movedNote}
        {blocks.map((b) => openRound(b))}
      </div>
    );
  }

  return (
    <div className="rounds-list">
      {movedNote}
      {openRound(layout.current, " is-current", layout.concluded ? "Ultimo turno" : "Turno attuale", true)}

      {layout.late.length > 0 && (
        <section className="round-group is-late" aria-labelledby="late-games">
          <header className="round-group-header">
            <h3 id="late-games" className="round-group-title">Ancora aperte dai turni precedenti</h3>
            <span className="round-group-summary">
              {layout.late.length} {layout.late.length === 1 ? "partita" : "partite"}
            </span>
          </header>
          {grid(layout.late, true)}
        </section>
      )}

      {layout.upcoming.length > 0 && (
        <>
          <h2 className="leg-heading">Prossimi turni</h2>
          <FoldedRounds blocks={layout.upcoming} render={collapsedRound} more="turni" />
        </>
      )}

      {layout.played.length > 0 && (
        <>
          <h2 className="leg-heading">Turni giocati</h2>
          <FoldedRounds blocks={layout.played} render={collapsedRound} more="turni giocati" />
        </>
      )}
    </div>
  );
}

// The first round of a list (the next one, or the last played), the others behind a button
function FoldedRounds({ blocks, render, more }: { blocks: RoundBlock[]; render: (b: RoundBlock) => JSX.Element; more: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? blocks : blocks.slice(0, 1);
  const hidden = blocks.length - shown.length;
  return (
    <>
      {shown.map(render)}
      {hidden > 0 && (
        <button type="button" className="rounds-more" onClick={() => setAll(true)}>
          Mostra {hidden === 1 ? `l'altro turno` : `gli altri ${hidden} ${more}`}
        </button>
      )}
    </>
  );
}

// Each player's score, as on a scoreboard: none while the game is not over
function scoresOf(s?: LichessExportGame): [string, string] | null {
  if (!s || s.status === "started") return null;
  if (s.winner === "white") return ["1", "0"];
  if (s.winner === "black") return ["0", "1"];
  if (s.status === "draw" || s.status === "stalemate" || s.status === DECIDED) return ["½", "½"];
  if (s.status === DOUBLE_LOSS) return ["0", "0"];
  return null;
}

// Separates the pieces of the line under the players
const joinDots = (parts: React.ReactNode[]) =>
  parts.filter(Boolean).map((part, i) => (
    <Fragment key={i}>
      {i > 0 && " · "}
      {part}
    </Fragment>
  ));

// A game: its board, the two players with their scores, and one line for the rest. The signs
// (colpaccio, summit, the master's opening) sit by what they speak of and explain themselves on a
// tap; only the actions (key moments, Lichess) look like buttons.
function MatchCard({
  game,
  state: s,
  nameOf,
  showRound = false,
  summit,
  presence,
  elo,
  masterTag,
  moved = false,
}: {
  game: HistoryGame;
  state?: LichessExportGame;
  nameOf: (handle: string) => string;
  showRound?: boolean;
  summit?: SummitRanks;
  presence?: PresenceInfo;
  elo?: EloReport;
  masterTag?: MasterTag;
  moved?: boolean; // moves the visitor has not seen yet
}) {
  const progress = gameProgress(s);
  const ongoing = s?.status === "started";
  const scores = scoresOf(s);
  // Ongoing games: Lichess hides the last moves, so only an approximate count is shown
  const moves = progress === 'pending' ? '' : movesLabel(s, progress === 'finished');
  const phase = progress === 'ongoing' ? gamePhase(s) : undefined;
  // Only when the move is fresh: see lib/live.ts
  const lastMove = progress === 'ongoing' ? recentMove(s, presence?.now ?? Date.now()) : null;
  const opening = s?.opening?.name ?? '';
  // The family alone ("Italian Game"), on one line: the whole name on hover
  const family = opening.split(':')[0].trim();
  const inMasterOpening = !!masterTag && playsFamily(opening, masterTag.family);
  const upset = progress === 'finished' ? upsetOf(s, elo, { ...game, id: extractGameId(game.url) || undefined }) : null;
  const forfeit = s?.status === "forfeit";
  const decided = byOrganizer(s?.status);

  // Final position only: during the game Lichess hides the latest moves
  const finalFen = progress === "finished" && s?.lastFen && game.url ? s.lastFen : "";

  // The replay, opened on the animation or (from the key moments) on the key moments
  const [replay, setReplay] = useState<false | 'game' | 'moments'>(false);
  const pairing = `${nameOf(game.white)} – ${nameOf(game.black)}`;
  // The key moments, once the GitHub Action has analysed the game: in the replay, for everyone
  const analysis = finalFen ? analysisOf(game) : undefined;
  const moments = hasMoments(analysis);
  const tile = finalFen ? (
    <MiniBoard fen={finalFen} label={`Posizione finale di ${pairing}`} />
  ) : progress === 'ongoing' ? (
    <PhaseTile phase={phase} label={`${pairing}: partita in corso${phase ? `, ${PHASE_LABEL[phase]}` : ''}`} />
  ) : progress === 'pending' ? (
    <MiniBoard fen={START_FEN} faded label={`${pairing}: partita da giocare`} />
  ) : null;

  // By the name: the place in the standings of a summit, the colpaccio of who pulled it off
  const summitText = summit && `Scontro al vertice: ${positionsText(summit.white, summit.black)} in classifica a inizio turno.`;
  const marksOf = (side: "white" | "black") => {
    const rank = summit?.[side];
    const upsetHere = upset?.player === side;
    if (rank === undefined && !upsetHere) return null;
    return (
      <span className="match-marks">
        {rank !== undefined && (
          <InfoTip className="match-mark match-rank" text={summitText!}>
            <span aria-hidden="true">{rank}°</span>
            <span className="sr-only">Scontro al vertice</span>
          </InfoTip>
        )}
        {upsetHere && (
          <InfoTip className="match-mark match-upset" text={`Colpaccio: ${upsetSentence(upset, nameOf(game[side]))}.`}>
            <span aria-hidden="true">💥</span>
            <span className="sr-only">Colpaccio</span>
          </InfoTip>
        )}
      </span>
    );
  };
  const row = (side: "white" | "black") => {
    const score = scores?.[side === "white" ? 0 : 1];
    return (
      <div className={`player-row ${s?.winner === side ? "is-winner" : ""}`}>
        <ColorDot
          color={side === "white" ? "w" : "b"}
          seenAt={progress === "ongoing" ? seenAtOf(presence, game[side]) : undefined}
          now={presence?.now ?? 0}
          name={nameOf(game[side])}
        />
        <a href={playerHref(game[side])} className="player-name player-page-link">{nameOf(game[side])}</a>
        {marksOf(side)}
        {score && <span className="match-score" aria-hidden="true">{score}</span>}
      </div>
    );
  };

  const fresh = moved && (
    // The same brass dot as on the tab
    <span className="new-moves-tag">
      <span className="switch-dot" aria-hidden="true" />
      {progress === "finished" ? "Appena conclusa" : "Mosse nuove"}
    </span>
  );
  const master = inMasterOpening && (
    <InfoTip
      className="match-mark match-master"
      text={`L'apertura ${masterTag!.surname ? `di ${masterTag!.surname}` : "del maestro"}: ${masterTag!.family.label}.`}
    >
      <span aria-hidden="true">♞</span>
      <span className="sr-only">L'apertura {masterTag!.surname ? `di ${masterTag!.surname}` : "del maestro"}</span>
    </InfoTip>
  );
  const meta =
    progress === "ongoing"
      ? [
          fresh || <span className="match-live">In corso</span>,
          phase && PHASE_LABEL[phase],
          lastMove ? (
            <span title={lastMove.full}>
              <span aria-hidden="true">{"\u265F\uFE0E"} {lastMove.short}</span>
              <span className="sr-only">{lastMove.full}</span>
            </span>
          ) : (
            moves
          ),
        ]
      : progress === "pending"
        ? [game.url ? "Da giocare" : "In programma", !game.url && "link in arrivo all'inizio del turno"]
        : [
            fresh,
            forfeit ? "Vittoria a tavolino" : decided ? "Deciso dall'organizzatore" : "",
            family && <span title={opening}>{family}</span>,
            moves,
          ];
  const lichess = game.url && !forfeit && !decided;

  return (
    <article className={`match-card${ongoing ? " is-ongoing" : ""}${upset ? " is-upset" : ""}${moved ? " has-new-moves" : ""}${tile ? "" : " no-tile"}`}>
      {tile &&
        (finalFen ? (
          // Finished game: the final position opens its replay
          <button type="button" className="mini-board-link mini-board-replay" onClick={() => setReplay('game')} aria-label={`Rivedi ${pairing}`}>
            {tile}
            <span className="replay-badge" aria-hidden="true">▶</span>
          </button>
        ) : game.url ? (
          <a href={game.url} target="_blank" rel="noopener noreferrer" className="mini-board-link">
            {tile}
          </a>
        ) : (
          <span className="mini-board-link">{tile}</span>
        ))}
      <div className="match-players">
        {row("white")}
        {row("black")}
        {scores && <span className="sr-only">Risultato {scores[0]} – {scores[1]}</span>}
      </div>
      <div className="match-meta">
        {/* Outside the line that shortens with an ellipsis, which would cut its explanation */}
        {progress === "finished" && master}
        <span className="match-meta-text">
          {joinDots([showRound && <span className="match-round">Turno {game.round}</span>, ...meta])}
        </span>
        {(moments || lichess) && (
          <span className="match-actions">
            {moments && (
              <button type="button" className="match-action match-moments" onClick={() => setReplay('moments')} aria-label="Momenti chiave" title="Momenti chiave">
                <span aria-hidden="true">✨</span>
                <span className="match-action-label" aria-hidden="true">Momenti</span>
              </button>
            )}
            {lichess && (
              <a href={game.url} target="_blank" rel="noopener noreferrer" className="match-action match-lichess" aria-label="Apri su Lichess" title="Apri su Lichess">
                <span aria-hidden="true">↗</span>
              </a>
            )}
          </span>
        )}
      </div>
      {replay && (
        <GameReplay
          url={game.url}
          title={pairing}
          onClose={() => setReplay(false)}
          analysis={analysis}
          names={{ white: nameOf(game.white), black: nameOf(game.black) }}
          ending={s}
          toMoments={replay === 'moments'}
        />
      )}
    </article>
  );
}
