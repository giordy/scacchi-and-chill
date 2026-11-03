import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from '../lib/utils';
import { gameProgress } from '../lib/progress';
import { isReturnLeg } from '../lib/legs';
import { MiniBoard } from './MiniBoard';
import { layoutMatches, RoundBlock } from '../lib/matchesLayout';

interface MatchesByRoundProps {
  games: HistoryGame[]; // already filtered and sorted by round
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  returnStart?: string; // first round of the return leg, if any
}

// Public "Partite": the current round first, then the unfinished games of earlier rounds,
// the upcoming rounds and finally the played rounds, newest first and collapsed
export function MatchesByRound({ games, gameStates, nameOf, returnStart }: MatchesByRoundProps) {
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
        <MatchCard key={`${g.url}-${idx}`} game={g} state={stateOf(g)} nameOf={nameOf} showRound={showRound} />
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
          {layout.upcoming.map((b) => openRound(b))}
        </>
      )}

      {layout.played.length > 0 && (
        <>
          <h2 className="leg-heading">Turni giocati</h2>
          {layout.played.map((b) => (
            <details key={b.round} className="round-group round-group-collapsible">
              <summary className="round-group-header">{header(b)}</summary>
              {grid(b.games)}
            </details>
          ))}
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
}: {
  game: HistoryGame;
  state?: LichessExportGame;
  nameOf: (handle: string) => string;
  showRound?: boolean;
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

  const plies = s?.moves?.trim() ? s.moves.trim().split(/\s+/).length : 0;
  const moves = Math.ceil(plies / 2);
  // Ongoing games: Lichess hides the last moves, so their length is shown only once finished
  const detail =
    s?.opening?.name || (gameProgress(s) === "finished" && moves > 0 ? `${moves} ${moves === 1 ? "mossa" : "mosse"}` : "");

  // Final position only: during the game Lichess hides the latest moves
  const finalFen = gameProgress(s) === "finished" && s?.lastFen && game.url ? s.lastFen : "";

  return (
    <article className={`match-card${s?.status === "started" ? " is-ongoing" : ""}`}>
      <div className="match-card-body">
        {finalFen && (
          <a href={game.url} target="_blank" rel="noopener noreferrer" className="mini-board-link">
            <MiniBoard fen={finalFen} label={`Posizione finale di ${nameOf(game.white)} – ${nameOf(game.black)}`} />
          </a>
        )}
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
        <span className="opening-label">
          {showRound && <span className="match-round">Turno {game.round}</span>}
          {showRound && detail ? " · " : ""}
          {detail}
        </span>
        {game.url ? (
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
