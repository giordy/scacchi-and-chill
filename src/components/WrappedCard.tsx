import React from 'react';
import { SeasonWrapped } from '../lib/wrapped';
import { CareerSeason } from '../lib/allTime';
import { playerHref } from '../lib/routes';
import { PillsburyEntry, SeasonAward } from '../types';
import { awardEmoji, awardTitle } from '../lib/awards';
import { EloPath } from '../lib/eloPath';
import { EloChart } from './EloChart';
import { PILLSBURY_EMOJI, PILLSBURY_TITLE } from '../lib/pillsbury';

const halves = (n: number) => String(n).replace('.5', '½').replace(/^0½/, '½');
const pts = (n: number) => `${halves(n)} ${n === 1 ? 'punto' : 'punti'}`;
const OUTCOME = ['persa', 'patta', 'vinta'];
const one = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signedOne = (n: number) => (n < 0 ? `−${one(-n)}` : `+${one(n)}`);

// How the race for the Trofeo Pillsbury went for the player: the objective, the points, the gap
// measured against what chance alone could do, and the place. The numbers the trophy was given by
export function pillsburyLine(mine: PillsburyEntry, race: PillsburyEntry[]): string {
  const objective = Math.round(mine.objective * 2) / 2;
  const gap = mine.points - objective;
  const gapText = gap > 0 ? `${halves(gap)} in più` : gap < 0 ? `${halves(-gap)} in meno` : "pari all'obiettivo";
  const over = mine.points - mine.objective;
  const margin = `Il caso da solo può spostare circa ±${one(mine.spread)} punti`;
  const ratio = over > 0 ? `${margin}: lo scarto esatto, ${signedOne(over)}, vale ${one(mine.score)} volte questo margine.` : `${margin}.`;
  const winners = race.filter((r) => r.winner);
  const place = mine.winner
    ? `${mine.place}° su ${race.length} nella corsa: il più alto.`
    : `${mine.place}° su ${race.length} nella corsa${winners.length > 0 ? `; chi l'ha vinto: ${one(winners[0].score)} volte.` : ', nessuno sopra il proprio obiettivo.'}`;
  return `Obiettivo ${halves(objective)}, fatti ${halves(mine.points)}: ${gapText}. ${ratio} ${place}`;
}

// Player page, at the end of a season: «La stagione in breve», one line per figure that says something
export function WrappedCard({
  season,
  wrapped,
  career,
  awards,
  pillsbury,
  eloPath,
  nameOf,
}: {
  season: string;
  wrapped: SeasonWrapped;
  career?: CareerSeason; // place and players of that season
  awards: SeasonAward[]; // the season's awards this player won
  pillsbury?: { mine: PillsburyEntry; race: PillsburyEntry[] }; // the final race (SeasonArchive.pillsbury), when the player was in it
  eloPath?: EloPath | null; // the Elo del torneo game after game
  nameOf: (handle: string) => string;
}) {
  const w = wrapped;
  const vs = (handle: string) => <a href={playerHref(handle)}>{nameOf(handle)}</a>;
  const lines: { emoji: string; text: React.ReactNode }[] = [];
  lines.push({
    emoji: '🏁',
    text: (
      <>
        {career?.place ? <strong>{career.tied ? `${career.place}° a pari merito` : `${career.place}°`} su {career.of}</strong> : null}
        {career?.place ? ' con ' : ''}
        {pts(w.points)} · {w.won} V · {w.drawn} N · {w.lost} P
      </>
    ),
  });
  awards.forEach((a) => lines.push({ emoji: awardEmoji(a), text: <><strong>{awardTitle(a)}</strong> ({a.detail})</> }));
  if (w.winStreak) lines.push({ emoji: '🔥', text: <>{w.winStreak} vittorie di fila</> });
  if (w.unbeaten) lines.push({ emoji: '🛡️', text: <>{w.unbeaten} partite di fila senza perdere</> });
  if (w.upsets) lines.push({ emoji: '🗡️', text: <>{w.upsets === 1 ? 'Un colpaccio' : `${w.upsets} colpacci`} contro avversari molto più forti</> });
  if (w.favourite) lines.push({ emoji: '🍀', text: <>Il bersaglio preferito: {vs(w.favourite.opponent)} ({halves(w.favourite.scored)}–{halves(w.favourite.conceded)})</> });
  if (w.nemesis) lines.push({ emoji: '😈', text: <>L'avversario più duro: {vs(w.nemesis.opponent)} ({halves(w.nemesis.scored)}–{halves(w.nemesis.conceded)})</> });
  if (w.quickestWin) lines.push({ emoji: '⚡', text: <>La vittoria più rapida: {w.quickestWin.moves} mosse contro {vs(w.quickestWin.opponent)}</> });
  if (w.longest) lines.push({ emoji: '🐢', text: <>La partita più lunga: {w.longest.moves} mosse contro {vs(w.longest.opponent)}, {OUTCOME[w.longest.score * 2]}</> });
  if (w.opening) lines.push({ emoji: '📖', text: <>L'apertura più giocata: {w.opening.name} ({w.opening.games} partite)</> });
  if (pillsbury) lines.push({ emoji: PILLSBURY_EMOJI, text: <><strong>{PILLSBURY_TITLE}:</strong> {pillsburyLine(pillsbury.mine, pillsbury.race)}</> });
  if (w.elo) {
    const move = w.elo.end - w.elo.start;
    lines.push({ emoji: move >= 0 ? '📈' : '📉', text: <>Elo del torneo: {w.elo.start} → {w.elo.end} ({move >= 0 ? '+' : ''}{move})</> });
  }
  return (
    <section className="dossier-card wrapped-card">
      <h2 className="section-heading">La stagione in breve</h2>
      <p className="note note-sm">{season}</p>
      <ul className="wrapped-list">
        {lines.map((l, i) => (
          <li key={i}>
            <span className="wrapped-emoji" aria-hidden="true">{l.emoji}</span>
            <span>{l.text}</span>
          </li>
        ))}
      </ul>
      {eloPath && <EloChart path={eloPath} nameOf={nameOf} />}
    </section>
  );
}
