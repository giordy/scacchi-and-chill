// Scenarios for the golden tests: the anonymised fixture (real data of a season at round 3) and
// three variants built from it, so that most texts of the site appear somewhere:
// - real: the fixture as it is
// - late: every round but the last two finished, the 13th under way (title race, objectives)
// - over: every game finished (champion, Pillsbury winner, awards, season end)
// - empty: a brand new tournament, no players, no games
import fixture from '../fixtures/tournament.json';
import { defaultConfig, withTournamentDoc } from '../../src/lib/config';
import { storedStates } from '../../src/lib/games';
import { fullRoster, rosterNameOf, NameOf } from '../../src/lib/roster';
import { applyWithdrawals } from '../../src/lib/withdrawals';
import type { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../../src/types';

export interface Scenario {
  name: string;
  now: number;
  config: AppConfig;
  history: HistoryGame[]; // withdrawals applied, as the site passes it to the views
  rawHistory: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  nameOf: NameOf;
}

const DAY = 86_400_000;
const data = fixture as any;

// Deterministic pseudo-random numbers (mulberry32)
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(name: string, now: number, rawHistory: HistoryGame[], tournament = data.tournament, players = data.players, schedule = data.schedule, seasons: SeasonArchive[] = data.seasons): Scenario {
  const config = withTournamentDoc({ ...defaultConfig, players: [], schedule: [] }, { ...tournament, players, schedule });
  const history = applyWithdrawals(rawHistory, config.tournament?.withdrawals);
  const nameOf = rosterNameOf(
    fullRoster({ roster: config.tournament?.roster, players: config.players, seasons, winners: config.tournament?.winners })
  );
  return { name, now, config, history, rawHistory, gameStates: storedStates(rawHistory), seasons, nameOf };
}

// Finished games of the fixture, used as templates for the made-up ones (moves, opening)
const templates: LichessExportGame[] = data.history
  .map((g: HistoryGame) => g.lichess)
  .filter((s: LichessExportGame | undefined) => s && s.status !== 'started' && s.status !== 'cheat');

// Strength order for the made-up results: the first players win more often
const strength = ['re_bianco', 'cavallo_pazzo', 'arrocco', 'scaccomatto', 'donna_rossa', 'alfiere7', 'pedone_lento', 'torre_nera'];

function madeUpGame(round: number, white: string, black: string, i: number, random: () => number, start: number, finished: boolean): HistoryGame {
  const created = start + (round - 1) * 9 * DAY + i * 3_600_000;
  const t = templates[(round * 4 + i) % templates.length];
  const id = `g${String(round).padStart(2, '0')}${i}${white.slice(0, 2)}${black.slice(0, 2)}`.replace(/_/g, 'x').slice(0, 8);
  const edge = (strength.indexOf(black) - strength.indexOf(white)) * 0.04;
  const r = random();
  const lastMoveAt = created + Math.round((1 + random() * 7) * DAY);
  const base = {
    ...t,
    id,
    createdAt: created,
    lastMoveAt,
    players: {
      white: { user: { id: white, name: white }, rating: 1500 + Math.round(random() * 400) },
      black: { user: { id: black, name: black }, rating: 1500 + Math.round(random() * 400) },
    },
  } as LichessExportGame;
  let lichess: LichessExportGame;
  if (!finished) {
    const moves = String(t.moves ?? '').split(' ').slice(0, 20 + i * 6).join(' ');
    lichess = { ...base, status: 'started', winner: undefined, moves, lastMoveAt: undefined } as LichessExportGame;
  } else if (r < 0.45 + edge) {
    lichess = { ...base, status: r < 0.2 ? 'mate' : 'resign', winner: 'white' };
  } else if (r < 0.8) {
    lichess = { ...base, status: r < 0.6 ? 'resign' : 'outoftime', winner: 'black' };
  } else {
    lichess = { ...base, status: r < 0.9 ? 'draw' : 'stalemate', winner: undefined };
  }
  return { round: String(round), white, black, url: `https://lichess.org/${id}`, createdAt: created, lichess };
}

// The fixture's history plus made-up games for the rounds after it: finished up to lastFinished,
// under way in the round after, nothing created after that
function extended(lastFinished: number, ongoingRound: number | null, seed: number): HistoryGame[] {
  const random = seeded(seed);
  const history: HistoryGame[] = data.history.map((g: HistoryGame) =>
    // The fixture's game still under way is finished in the made-up seasons
    g.lichess?.status === 'started' ? { ...g, lichess: { ...templates[0], id: g.lichess.id, players: g.lichess.players, status: 'draw', winner: undefined, lastMoveAt: (g.createdAt ?? 0) + 4 * DAY } } : g
  );
  const have = new Set(history.map((g) => `${g.round}|${g.white}|${g.black}`));
  const start = Math.min(...data.history.map((g: HistoryGame) => g.lichess?.createdAt ?? Infinity));
  const byRound = new Map<number, typeof data.schedule>();
  data.schedule.forEach((m: { round: string }) => byRound.set(Number(m.round), [...(byRound.get(Number(m.round)) ?? []), m]));
  [...byRound.keys()].sort((a, b) => a - b).forEach((round) => {
    const finished = round <= lastFinished;
    if (!finished && round !== ongoingRound) return;
    byRound.get(round)!.forEach((m: { white: string; black: string }, i: number) => {
      if (have.has(`${round}|${m.white}|${m.black}`)) return;
      history.push(madeUpGame(round, m.white, m.black, i, random, start, finished));
    });
  });
  return history;
}

const lastMove = (h: HistoryGame[]) => Math.max(...h.map((g) => g.lichess?.lastMoveAt ?? g.createdAt ?? 0));

export function scenarios(): Scenario[] {
  const real = build('real', Date.parse('2026-11-21T11:00:00Z'), data.history);
  const lateHistory = extended(12, 13, 7);
  const late = build('late', lastMove(lateHistory) + DAY / 2, lateHistory);
  const overHistory = extended(14, null, 11);
  const over = build('over', lastMove(overHistory) + 2 * DAY, overHistory);
  const empty = build('empty', Date.parse('2026-11-21T11:00:00Z'), [], { title: 'Nuovo torneo', season: 'Stagione 1', description: '' }, [], [], []);
  return [real, late, over, empty];
}
