// Trofeo Pillsbury: to who beat their pronostico by most in the season, that is made the most
// points beyond those expected from the Elo del torneo at its start (see seasonForecast). Named
// after Harry Nelson Pillsbury, who in 1895, aged 22 and almost unknown, won Hastings ahead of
// Lasker, Steinitz, Tarrasch and Chigorin. Esordienti, and the games against them, are left out.
import { HistoryGame, LichessExportGame, Player, SeasonArchive } from '../types';
import { boardCalendar, currentSeason, eloSeasonFromCurrent, EloReport, Forecast, seasonForecast } from './tournamentElo';

export const PILLSBURY_ID = 'pillsbury';
export const PILLSBURY_EMOJI = '🌱';
export const PILLSBURY_TITLE = 'Trofeo Pillsbury';
export const PILLSBURY_ORIGIN =
  "Nel 1895, a Hastings, Harry Nelson Pillsbury era un ventiduenne americano quasi sconosciuto, al suo primo grande torneo: lo vinse davanti a Lasker, Steinitz, Tarrasch e Čigorin, i più forti del mondo. È la sorpresa più famosa della storia degli scacchi.";

export type Trend = 'up' | 'same' | 'down';

// Above, in line or below the pronostico so far: a gap of a few tenths of a point says nothing
export const trendOf = (f: Forecast): Trend => {
  const over = f.points - f.expectedSoFar;
  return over >= 0.5 ? 'up' : over <= -0.5 ? 'down' : 'same';
};

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
  newcomers: string[]; // esordienti: out of the race this season
}

// The race of the current season, in the order of the players list for the ties and the waiting
export function pillsburyRace(
  players: Player[],
  report: EloReport,
  calendar: HistoryGame[], // the season's games, created and still to create
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>
): PillsburyRace {
  const season = currentSeason(report);
  const handles = players.map((p) => p.handle);
  const finished = eloSeasonFromCurrent(handles, history, gameStates).games;
  const board = boardCalendar(calendar, gameStates, handles);
  const rows: PillsburyRow[] = [];
  const waiting: string[] = [];
  const counted: PillsburyRace['counted'] = {};
  const newcomers: string[] = [];
  players.forEach((p) => {
    const f = seasonForecast(p.handle, season, board, finished);
    if (!f) {
      newcomers.push(p.handle);
      return;
    }
    counted[p.handle] = { played: f.played, games: f.games };
    if (f.played === 0) {
      waiting.push(p.handle);
      return;
    }
    rows.push({ handle: p.handle, forecast: f, over: f.points - f.expectedSoFar, trend: trendOf(f) });
  });
  rows.sort((a, b) => b.over - a.over);
  const suspended = rows.length + waiting.length < PILLSBURY_MIN_PLAYERS;
  return { suspended, rows, waiting, newcomers, counted };
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
