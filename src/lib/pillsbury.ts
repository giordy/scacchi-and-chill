// Trofeo Pillsbury: to who beat their pronostico by most in the season, that is made the most
// points beyond those expected from the Elo del torneo at its start (see seasonForecast). Named
// after Harry Nelson Pillsbury, who in 1895, aged 22 and almost unknown, won Hastings ahead of
// Lasker, Steinitz, Tarrasch and Chigorin. Esordienti, and the games against them, are left out;
// so is a player who left the season, and the games won or lost at the table.
import { HistoryGame, LichessExportGame, Player, SeasonArchive, Withdrawal } from '../types';
import { boardCalendar, currentSeason, decidedAtTable, eloSeasonFromCurrent, EloReport, Forecast, seasonForecast } from './tournamentElo';
import { isVoid, stateOf } from './games';

export const PILLSBURY_ID = 'pillsbury';
// In text (WhatsApp, tooltips); on the site the trophy is drawn by components/PillsburyIcon
export const PILLSBURY_EMOJI = '🏅';
export const PILLSBURY_TITLE = 'Trofeo Pillsbury';
export const PILLSBURY_ORIGIN =
  "Nel 1895, a Hastings, Harry Nelson Pillsbury era un ventiduenne americano quasi sconosciuto, al suo primo grande torneo: lo vinse davanti a Lasker, Steinitz, Tarrasch e Čigorin, i più forti del mondo. È la sorpresa più famosa della storia degli scacchi.";

export type Trend = 'up' | 'same' | 'down';

// Above, in line or below the pronostico so far: a gap of a few tenths of a point says nothing. The
// trophy goes only to who is above it, as the table shows them (▲), not to the first of those "in line"
export const PILLSBURY_MIN_OVER = 0.5;
export const trendOf = (f: Forecast): Trend => {
  const over = f.points - f.expectedSoFar;
  return over >= PILLSBURY_MIN_OVER ? 'up' : over <= -PILLSBURY_MIN_OVER ? 'down' : 'same';
};

// The games of the calendar an objective is made of: not those decided at the table (forfeits after a
// withdrawal, games closed for cheating: points in the standings, see decidedAtTable) nor those aborted
export function raceCalendar(calendar: HistoryGame[], gameStates: Record<string, LichessExportGame>): HistoryGame[] {
  return calendar.filter((g) => {
    const s = stateOf(g, gameStates);
    return !s || (!decidedAtTable(s.status) && !isVoid(s));
  });
}

export interface PillsburyRow {
  handle: string;
  forecast: Forecast;
  over: number; // points beyond those expected so far: the order of the race
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
    rows.push({ handle: p.handle, forecast: f, over: f.points - f.expectedSoFar, trend: trendOf(f) });
  });
  rows.sort((a, b) => b.over - a.over);
  const suspended = rows.length + waiting.length < PILLSBURY_MIN_PLAYERS;
  return { suspended, rows, waiting, newcomers, counted, forecasts };
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
