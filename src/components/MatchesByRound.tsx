import { useState } from 'react';
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
import { summitKey } from '../lib/summit';
import { stateOf } from '../lib/games';
import { playerHref } from '../lib/routes';
import { PresenceInfo, seenAtOf } from '../lib/presence';
import { ColorDot } from './PresenceDot';

interface MatchesByRoundProps {
  games: HistoryGame[]; // already filtered and sorted by round
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  returnStart?: string; // first round of the return leg, if any
  summits?: Map<string, string>; // scontro al vertice: positions text by summitKey
  presence?: PresenceInfo; // when each player was last on Lichess, for the ongoing games
  elo?: EloReport; // Elo del torneo, for the colpacci
}

// Public "Partite": the current round first, then the unfinished games of earlier rounds,
// the upcoming rounds and finally the played rounds, newest first; both collapsed
export function MatchesByRound({ games, gameStates, nameOf, returnStart, summits, presence, elo }: MatchesByRoundProps) {
  const stateOfGame = (g: HistoryGame) => stateOf(g, gameStates);
  const progressOf = (g: HistoryGame) => gameProgress(stateOfGame(g));
  const legOf = (round: string) =>
    returnStart === undefined ? undefined : isReturnLeg(round, returnStart) ? "ritorno" : "andata";

  const summaryOf = (roundGames: HistoryGame[]) => {
    const progress = roundGames.map(progressOf);
    const finished = progress.filter((p) => p === "finished").length;
    const ongoing = progress.filter((p) => p === "ongoing").length;
    const pending = progress.length - finished - ongoing;
    return finished === progress.length
      ? "Turno concluso"
      : [
          finished > 0 ? `${finished} ${finished === 1 ? "conclusa" : "concluse"}` : "",
          ongoing > 0 ? `${ongoing} in corso` : "",
          pending > 0 ? `${pending} da giocare` : "",
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
        />
      ))}
    </div>
  );

  const header = (block: RoundBlock, tag?: string) => {
    const leg = legOf(block.round);
    return (
      <>
        <h3 id={`round-${block.round}`} className="round-group-title">
          Turno {block.round}
          {leg && <span className="round-group-leg">{leg}</span>}
          {tag && <span className="round-group-tag">{tag}</span>}
        </h3>
        <span className="round-group-summary">{summaryOf(block.games)}</span>
      </>
    );
  };

  const openRound = (block: RoundBlock, extraClass = "", tag?: string) => (
    <section key={block.round} className={`round-group${extraClass}`} aria-labelledby={`round-${block.round}`}>
      <header className="round-group-header">{header(block, tag)}</header>
      {grid(block.games)}
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
  const roundCount = layout.played.length + layout.upcoming.length + (layout.current ? 1 : 0);

  // A single round (filter) or a season not started yet: nothing to reorder
  if (roundCount <= 1 || !layout.current) {
    const blocks = [...(layout.current ? [layout.current] : []), ...layout.upcoming];
    return <div className="rounds-list">{blocks.map((b) => openRound(b))}</div>;
  }

  return (
    <div className="rounds-list">
      {openRound(layout.current, " is-current", layout.concluded ? "Ultimo turno" : "Turno attuale")}

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

function MatchCard({
  game,
  state: s,
  nameOf,
  showRound = false,
  summit,
  presence,
  elo,
}: {
  game: HistoryGame;
  state?: LichessExportGame;
  nameOf: (handle: string) => string;
  showRound?: boolean;
  summit?: string; // e.g. "1° contro 2°"
  presence?: PresenceInfo;
  elo?: EloReport;
}) {
  // Scheduled game not created on Lichess yet
  let badge = game.url
    ? <span className="status-badge pending">Da giocare</span>
    : <span className="status-badge pending">In programma</span>;
  if (s?.status === "started") badge = <span className="status-badge ongoing">In corso</span>;
  // Neutral result: here 0-1 is a win for Black, not a "loss"
  else if (s?.winner === "white") badge = <span className="status-badge result">1 – 0</span>;
  else if (s?.winner === "black") badge = <span className="status-badge result">0 – 1</span>;
  else if (s?.status === "draw" || s?.status === "stalemate") badge = <span className="status-badge result">½ – ½</span>;

  const progress = gameProgress(s);
  // Ongoing games: Lichess hides the last moves, so only an approximate count is shown
  const moves = progress === 'pending' ? '' : movesLabel(s, progress === 'finished');
  const phase = progress === 'ongoing' ? gamePhase(s) : undefined;
  const progressText = [moves, phase && PHASE_LABEL[phase]].filter(Boolean).join(' · ');
  const opening = s?.opening?.name ?? '';
  const upset = progress === 'finished' ? upsetOf(s, elo, { ...game, id: extractGameId(game.url) || undefined }) : null;

  // Final position only: during the game Lichess hides the latest moves
  const finalFen = progress === "finished" && s?.lastFen && game.url ? s.lastFen : "";

  const [replay, setReplay] = useState(false);
  const pairing = `${nameOf(game.white)} – ${nameOf(game.black)}`;
  const tile = finalFen ? (
    <MiniBoard fen={finalFen} label={`Posizione finale di ${pairing}`} />
  ) : progress === 'ongoing' ? (
    <PhaseTile phase={phase} label={`${pairing}: partita in corso${phase ? `, ${PHASE_LABEL[phase]}` : ''}`} />
  ) : progress === 'pending' ? (
    <MiniBoard fen={START_FEN} faded label={`${pairing}: partita da giocare`} />
  ) : null;

  return (
    <article className={`match-card${s?.status === "started" ? " is-ongoing" : ""}${upset ? " is-upset" : ""}`}>

      <div className="match-card-body">
        {tile &&
          (finalFen ? (
            // Finished game: the final position opens its replay
            <button type="button" className="mini-board-link mini-board-replay" onClick={() => setReplay(true)} aria-label={`Rivedi ${pairing}`}>
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
          <div className={`player-row ${s?.winner === "white" ? "is-winner" : ""}`}>
            <ColorDot
              color="w"
              seenAt={progress === "ongoing" ? seenAtOf(presence, game.white) : undefined}
              now={presence?.now ?? 0}
              name={nameOf(game.white)}
            />
            <a href={playerHref(game.white)} className="player-name player-page-link">{nameOf(game.white)}</a>
          </div>
          <div className={`player-row ${s?.winner === "black" ? "is-winner" : ""}`}>
            <ColorDot
              color="b"
              seenAt={progress === "ongoing" ? seenAtOf(presence, game.black) : undefined}
              now={presence?.now ?? 0}
              name={nameOf(game.black)}
            />
            <a href={playerHref(game.black)} className="player-name player-page-link">{nameOf(game.black)}</a>
          </div>
        </div>
        {badge}
      </div>
      <div className="match-footer">
        <div className="match-footer-info">
          {(showRound || opening) && (
            <span className="opening-label">
              {showRound && <span className="match-round">Turno {game.round}</span>}
              {showRound && opening ? " · " : ""}
              {opening}
            </span>
          )}
          {(progressText || upset || summit) && (
            <span className="match-progress">
              {progressText}
              {summit && (
                <InfoTip className="match-summit" text={`Scontro al vertice: ${summit} in classifica a inizio turno.`}>
                  🔝 Scontro al vertice
                </InfoTip>
              )}
              {upset && (
                <InfoTip className="match-upset" text={`Colpaccio: ${upsetSentence(upset, nameOf(upset.player === "white" ? game.white : game.black))}.`}>
                  💥 Colpaccio +{upset.gap}
                </InfoTip>
              )}
            </span>
          )}
        </div>
        {s?.status === "forfeit" ? (
          <span className="opening-label">Vittoria a tavolino</span>
        ) : game.url ? (
          <a href={game.url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn">
            Apri su Lichess
          </a>
        ) : (
          <span className="opening-label">Link in arrivo all'inizio del turno</span>
        )}
      </div>
      {replay && <GameReplay url={game.url} title={pairing} onClose={() => setReplay(false)} />}
    </article>
  );
}
