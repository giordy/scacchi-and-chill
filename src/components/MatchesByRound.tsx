import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from '../lib/utils';
import { gameProgress } from '../lib/progress';
import { isReturnLeg } from '../lib/legs';
import { MiniBoard, PhaseTile, START_FEN } from './MiniBoard';
import { gamePhase, movesLabel, PHASE_LABEL } from '../lib/phase';
import { layoutMatches, RoundBlock } from '../lib/matchesLayout';
import { upsetOf, upsetTitle } from '../lib/upset';
import { summitKey } from '../lib/summit';

interface MatchesByRoundProps {
  games: HistoryGame[]; // already filtered and sorted by round
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  returnStart?: string; // first round of the return leg, if any
  summits?: Map<string, string>; // scontro al vertice: positions text by summitKey
}

// Public "Partite": the current round first, then the unfinished games of earlier rounds,
// the upcoming rounds and finally the played rounds, newest first; both collapsed
export function MatchesByRound({ games, gameStates, nameOf, returnStart, summits }: MatchesByRoundProps) {
  const stateOf = (g: HistoryGame) => {
    const id = extractGameId(g.url);
    return (id && gameStates[id]) || g.lichess;
  };
  const progressOf = (g: HistoryGame) => gameProgress(stateOf(g));
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
          state={stateOf(g)}
          nameOf={nameOf}
          showRound={showRound}
          summit={summits?.get(summitKey(g))}
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
          {layout.upcoming.map(collapsedRound)}
        </>
      )}

      {layout.played.length > 0 && (
        <>
          <h2 className="leg-heading">Turni giocati</h2>
          {layout.played.map(collapsedRound)}
        </>
      )}
    </div>
  );
}

function MatchCard({
  game,
  state: s,
  nameOf,
  showRound = false,
  summit,
}: {
  game: HistoryGame;
  state?: LichessExportGame;
  nameOf: (handle: string) => string;
  showRound?: boolean;
  summit?: string; // e.g. "1° contro 2°"
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
  const upset = progress === 'finished' ? upsetOf(s) : null;

  // Final position only: during the game Lichess hides the latest moves
  const finalFen = progress === "finished" && s?.lastFen && game.url ? s.lastFen : "";

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
          (game.url ? (
            <a href={game.url} target="_blank" rel="noopener noreferrer" className="mini-board-link">
              {tile}
            </a>
          ) : (
            <span className="mini-board-link">{tile}</span>
          ))}
        <div className="match-players">
          <div className={`player-row ${s?.winner === "white" ? "is-winner" : ""}`}>
            <span className="dot w" aria-label="Bianco" />
            <span className="player-name">{nameOf(game.white)}</span>
          </div>
          <div className={`player-row ${s?.winner === "black" ? "is-winner" : ""}`}>
            <span className="dot b" aria-label="Nero" />
            <span className="player-name">{nameOf(game.black)}</span>
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
                <span className="match-summit" title={`${summit} in classifica a inizio turno`}>
                  🔝 Scontro al vertice
                </span>
              )}
              {upset && (
                <span className="match-upset" title={upsetTitle(upset)}>
                  💥 Colpaccio +{upset.gap}
                </span>
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
    </article>
  );
}
