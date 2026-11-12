// Trofeo Pillsbury: to who beat their pronostico by most in the season, that is made the most
// points beyond those expected from the Elo del torneo at its start (see seasonForecast), measured
// against how much they could be beyond it by chance (Forecast.spread): half a point beyond an
// objective that is sure is worth more than half a point beyond one that is not (a seed from Lichess,
// in a first season). Counted in points alone, the trophy went to the two newcomers of a season a
// third of the time instead of a quarter, on simulated seasons. Named
// after Harry Nelson Pillsbury, who in 1895, aged 22 and almost unknown, won Hastings ahead of
// Lasker, Steinitz, Tarrasch and Chigorin. Esordienti, and the games against them, are left out;
// so is a player who left the season, and the games won or lost at the table.
import { HistoryGame, LichessExportGame, Player, SeasonArchive, Withdrawal } from '../types';
import { boardCalendar, currentSeason, decidedAtTable, eloSeasonFromCurrent, EloReport, Forecast, pronosticoPoints, roundHalf, seasonForecast } from './tournamentElo';
import { isVoid, stateOf } from './games';

export const PILLSBURY_ID = 'pillsbury';
// In text (WhatsApp, tooltips); on the site the trophy is drawn by components/PillsburyIcon
export const PILLSBURY_EMOJI = '🏅';
export const PILLSBURY_TITLE = 'Trofeo Pillsbury';
export const PILLSBURY_ORIGIN =
  "Nel 1895, a Hastings, Harry Nelson Pillsbury era un ventiduenne americano quasi sconosciuto, al suo primo grande torneo: lo vinse davanti a Lasker, Steinitz, Tarrasch e Čigorin, i più forti del mondo. È la sorpresa più famosa della storia degli scacchi.";

export type Trend = 'up' | 'same' | 'down';


// The games of the calendar an objective is made of: not those decided at the table (forfeits after a
// withdrawal, games closed for cheating: points in the standings, see decidedAtTable) nor those aborted
export function raceCalendar(calendar: HistoryGame[], gameStates: Record<string, LichessExportGame>): HistoryGame[] {
  return calendar.filter((g) => {
    const s = stateOf(g, gameStates);
    return !s || (!decidedAtTable(s.status) && !isVoid(s));
  });
}

// Whether a player has already made the points of their objective (the pronostico as shown, to the
// half point): a mark in the race table and a moment in the cronaca. Never with an objective of zero.
export const objectiveReached = (f: Forecast) => {
  const target = pronosticoPoints(f);
  return target > 0 && f.points >= target;
};

// The points at the end of the season if from here on each game goes as the Elo expects: those
// made, plus those expected from the games still to play. The "ritmo" of the race table.
export const projectedPoints = (f: Forecast) => roundHalf(f.points + Math.max(0, f.expected - f.expectedSoFar));

// Above, in line or below the objective, read from the numbers the table shows (the ritmo and the
// objective, both to the half point), so that the arrow never contradicts them: 7 and 6½ is ▼. At the
// end of the season the ritmo is the points made: the trophy goes to who is above (▲), that is at
// least half a point beyond the objective as shown.
export const shownGap = (f: Forecast) => projectedPoints(f) - pronosticoPoints(f);
export const trendOf = (f: Forecast): Trend => {
  const gap = shownGap(f);
  return gap > 0 ? 'up' : gap < 0 ? 'down' : 'same';
};


export interface PillsburyRow {
  handle: string;
  forecast: Forecast;
  over: number; // points beyond those expected so far, exact: with score, the order of the race
  gap: number; // the same as the table shows it, to the half point (shownGap): what the texts say
  score: number; // over measured against Forecast.spread: the order of the race
  trend: Trend;
}

// With fewer players in the race (esordienti are not) the award says too little: suspended
export const PILLSBURY_MIN_PLAYERS = 4;

export interface PillsburyRace {
  suspended: boolean; // fewer than PILLSBURY_MIN_PLAYERS in the race
  rows: PillsburyRow[]; // who is in the race and has played a game that counts, best first
  waiting: string[]; // in the race, no game that counts yet
  counted: Record<string, { played: number; games: number }>; // games that count: played, in all
  forecasts: Record<string, Forecast>; // the objective of each player in the race
  newcomers: string[]; // esordienti: out of the race this season
}

// The race of the current season, in the order of the players list for the ties and the waiting
export function pillsburyRace(
  players: Player[],
  report: EloReport,
  calendar: HistoryGame[], // the season's games, created and still to create
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  withdrawals?: Withdrawal[] // who left the season: out of the race (with forfeits they stay in the list)
): PillsburyRace {
  const season = currentSeason(report);
  const handles = players.map((p) => p.handle);
  const finished = eloSeasonFromCurrent(handles, history, gameStates).games;
  const board = boardCalendar(raceCalendar(calendar, gameStates), gameStates, handles);
  const left = new Set((withdrawals ?? []).filter((w) => w.mode !== 'replaced').map((w) => w.handle.toLowerCase()));
  const rows: PillsburyRow[] = [];
  const waiting: string[] = [];
  const counted: PillsburyRace['counted'] = {};
  const forecasts: PillsburyRace['forecasts'] = {};
  const newcomers: string[] = [];
  players.forEach((p) => {
    if (left.has(p.handle.toLowerCase())) return;
    const f = seasonForecast(p.handle, season, board, finished);
    if (!f) {
      newcomers.push(p.handle);
      return;
    }
    forecasts[p.handle] = f;
    counted[p.handle] = { played: f.played, games: f.games };
    if (f.played === 0) {
      waiting.push(p.handle);
      return;
    }
    const over = f.points - f.expectedSoFar;
    rows.push({ handle: p.handle, forecast: f, over, gap: shownGap(f), score: f.spread > 0 ? over / f.spread : 0, trend: trendOf(f) });
  });
  rows.sort((a, b) => b.score - a.score || b.over - a.over);
  const suspended = rows.length + waiting.length < PILLSBURY_MIN_PLAYERS;
  return { suspended, rows, waiting, newcomers, counted, forecasts };
}

// Who wins the trophy, once the season is over: the first in the race (a tie, to a millionth, wins
// together) of those above their objective as the table shows them (▲), and not when suspended.
// The same for the awards (lib/awards.ts), the bulletin, the cronaca and the race table.
export function pillsburyWinners(race: PillsburyRace): PillsburyRow[] {
  const above = race.rows.filter((r) => r.trend === 'up');
  const best = above[0];
  if (race.suspended || !best) return [];
  return above.filter((r) => Math.abs(r.score - best.score) < 1e-6);
}

// Who won the Trofeo Pillsbury of the latest archived season that gave it
export function reigningPillsbury(seasons: SeasonArchive[]): { season: string; handles: string[] } | undefined {
  const latest = [...seasons]
    .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt))
    .find((s) => s.awards?.some((a) => a.id === PILLSBURY_ID));
  const award = latest?.awards?.find((a) => a.id === PILLSBURY_ID);
  if (!latest || !award) return undefined;
  return { season: latest.season, handles: award.winners.map((w) => w.handle.toLowerCase()) };
}

// Every season a player won it, oldest first
export function pillsburyWins(handle: string, seasons: SeasonArchive[]): string[] {
  return [...seasons]
    .sort((a, b) => a.archivedAt.localeCompare(b.archivedAt))
    .filter((s) => s.awards?.some((a) => a.id === PILLSBURY_ID && a.winners.some((w) => w.handle.toLowerCase() === handle.toLowerCase())))
    .map((s) => s.season);
}
