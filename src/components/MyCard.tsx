import React from 'react';
import { MyGame, toObjectiveText } from '../lib/me';
import { playerHref } from '../lib/routes';

const halves = (n: number) => String(n).replace('.5', '½').replace(/^0½/, '½');

// «Io sono…»: at the top of the standings, what is the visitor's own: place, the game to play now
// and the objective of the Trofeo Pillsbury
export function MyCard({
  handle,
  name,
  rank,
  points,
  game,
  objective,
  pillsburyPoints,
  nameOf,
  onForget,
}: {
  handle: string;
  name: string;
  rank: number | null; // null before the first game
  points: number;
  game: MyGame | null;
  objective?: number; // none for an esordiente or with the trophy suspended
  pillsburyPoints?: number; // the points that count for the trophy
  nameOf: (handle: string) => string;
  onForget: () => void;
}) {
  const left = objective !== undefined && pillsburyPoints !== undefined ? toObjectiveText(objective, pillsburyPoints) : null;
  return (
    <section className="my-card" aria-label="La tua stagione">
      <div className="my-card-head">
        <a href={playerHref(handle)} className="my-card-name">{name}</a>
        <span className="my-card-rank">
          {rank ? `${rank}° posto` : 'Si comincia'} · {halves(points)} {points === 1 ? 'punto' : 'punti'}
        </span>
        <button type="button" className="link-button my-card-forget" onClick={onForget}>
          Non sei tu?
        </button>
      </div>
      {game ? (
        <p className="my-card-line">
          <span aria-hidden="true">♟️</span> Turno {game.round}: contro <strong>{nameOf(game.opponent)}</strong>, col {game.color === 'white' ? 'bianco' : 'nero'}
          {' · '}
          {game.state === 'ongoing' ? 'in corso' : game.url ? 'sfida da accettare' : 'sfida non ancora creata'}
          {game.url && (
            <>
              {' · '}
              <a href={game.url} target="_blank" rel="noopener noreferrer">
                {game.state === 'ongoing' ? 'Gioca' : 'Apri'} su Lichess
              </a>
            </>
          )}
        </p>
      ) : (
        <p className="my-card-line">
          <span aria-hidden="true">✅</span> Hai giocato tutte le tue partite.
        </p>
      )}
      {objective !== undefined && objective > 0 && (
        <p className="my-card-line">
          <span aria-hidden="true">🎯</span> Obiettivo per il Trofeo Pillsbury: {halves(objective)} punti
          {left ? `, ${left}` : ' · raggiunto!'}
        </p>
      )}
    </section>
  );
}
