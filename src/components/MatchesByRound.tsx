import React from 'react';
import { HistoryGame, LichessExportGame } from '../types';
import { extractGameId } from '../lib/utils';
import { gameProgress } from '../lib/progress';
import { isReturnLeg } from '../lib/legs';
import { MiniBoard } from './MiniBoard';

interface MatchesByRoundProps {
  games: HistoryGame[]; // already filtered and sorted by round
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  returnStart?: string; // first round of the return leg, if any
}

// Public "Partite": one block per round, under an "Andata"/"Ritorno" heading when there is a return leg
export function MatchesByRound({ games, gameStates, nameOf, returnStart }: MatchesByRoundProps) {
  const stateOf = (g: HistoryGame) => {
    const id = extractGameId(g.url);
    return (id && gameStates[id]) || g.lichess;
  };

  const rounds: { round: string; games: HistoryGame[] }[] = [];
  games.forEach((g) => {
    const last = rounds[rounds.length - 1];
    if (last && last.round === g.round) last.games.push(g);
    else rounds.push({ round: g.round, games: [g] });
  });

  let previousLeg: boolean | undefined;
  return (
    <div className="rounds-list">
      {rounds.map(({ round, games: roundGames }) => {
        const inReturn = isReturnLeg(round, returnStart);
        const legHeading =
          returnStart !== undefined && inReturn !== previousLeg ? (inReturn ? "Ritorno" : "Andata") : null;
        previousLeg = inReturn;

        const progress = roundGames.map((g) => gameProgress(stateOf(g)));
        const finished = progress.filter((p) => p === "finished").length;
        const ongoing = progress.filter((p) => p === "ongoing").length;
        const pending = progress.length - finished - ongoing;
        const summary =
          finished === progress.length
            ? "Turno concluso"
            : [
                finished > 0 ? `${finished} ${finished === 1 ? "conclusa" : "concluse"}` : "",
                ongoing > 0 ? `${ongoing} in corso` : "",
                pending > 0 ? `${pending} da giocare` : "",
              ]
                .filter(Boolean)
                .join(", ");

        return (
          <React.Fragment key={round}>
            {legHeading && <h2 className="leg-heading">{legHeading}</h2>}
            <section className="round-group" aria-labelledby={`round-${round}`}>
              <header className="round-group-header">
                <h3 id={`round-${round}`} className="round-group-title">Turno {round}</h3>
                <span className="round-group-summary">{summary}</span>
              </header>
              <div className="matches-grid">
                {roundGames.map((g, idx) => (
                  <MatchCard key={`${g.url}-${idx}`} game={g} state={stateOf(g)} nameOf={nameOf} />
                ))}
              </div>
            </section>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function MatchCard({
  game,
  state: s,
  nameOf,
}: {
  game: HistoryGame;
  state?: LichessExportGame;
  nameOf: (handle: string) => string;
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
        <span className="opening-label">{detail}</span>
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
