import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { computeStandings, leaderText, PlayerStanding, pointsText, seasonStarted, sharedRanks } from './standings';
import { extractGameId, fill, formatDeadline, getApproxMoves, HOW_DRAW, HOW_WIN, tidy } from './utils';
import { gamePhase, GamePhase } from './phase';
import { upsetOf } from './upset';
import { tournamentElo } from './tournamentElo';
import { fullMovesOf, isVoid, movesText, nameFrom, pliesOf, storedStates } from './games';
import { summitGames, summitKey } from './summit';
import { gameProgress } from './progress';
import { reigningChampions } from './honours';
import { PILLSBURY_EMOJI, PILLSBURY_TITLE, PillsburyRace, pillsburyRace, reigningPillsbury } from './pillsbury';

const DAY_MS = 86400000;

// When the round's Lichess links expire: the challenges were created with an expiry counted from
// their creation, so the deadline comes from the oldest created game, not from when the message is
// written. Without a creation time it falls back to now (the links are about to be created).
export function roundDeadline(games: { createdAt?: number }[], expiryDays: number, now = Date.now()): number {
  const created = games.map((g) => g.createdAt).filter((t): t is number => typeof t === 'number' && t > 0);
  const start = created.length > 0 ? Math.min(...created) : now;
  return start + expiryDays * DAY_MS;
}

// "3 finite · 1 in corso": only the non-zero parts, with the right singular
export function roundSummary(count: { finished: number; ongoing: number; pending: number }): string {
  const parts: string[] = [];
  if (count.finished > 0) parts.push(`${count.finished} ${count.finished === 1 ? 'finita' : 'finite'}`);
  if (count.ongoing > 0) parts.push(`${count.ongoing} in corso`);
  if (count.pending > 0) parts.push(`${count.pending} da avviare`);
  return parts.join(' · ');
}

// Who leads, with the same rule and words as the site's header (tied leaders named together)
export function leaderLine(standings: PlayerStanding[]): string {
  const text = leaderText(standings).trim();
  return text ? `🥇 ${text}` : '';
}

// At the end of a round: the whole table, compact, with the places shared as on the site
//   📈 *Classifica dopo il Turno 2*
//   1. Carla – 2 punti
//   2. Anna 👑 – 1½ punti
// The crown marks the reigning champion(s), the medal who holds the Trofeo Pillsbury (lower-case
// handles), as in the site's table: only here, once per round, not on every game line
export function standingsBlock(standings: PlayerStanding[], round: string, champions: string[] = [], pillsbury: string[] = []): string {
  if (!seasonStarted(standings)) return '';
  const ranks = sharedRanks(standings);
  const marks = (s: PlayerStanding) =>
    (champions.includes(s.handle.toLowerCase()) ? ' 👑' : '') + (pillsbury.includes(s.handle.toLowerCase()) ? ` ${PILLSBURY_EMOJI}` : '');
  const rows = standings.map((s, i) => `${ranks[i]}. ${s.name}${marks(s)} – ${pointsText(s.points)}`);
  return [`📈 *Classifica dopo il Turno ${round}*`, ...rows].join('\n');
}

// "Anna", "Anna e Bruno", "Anna, Bruno e Carla"
const namesList = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : names[0] ?? '');

// At the end of a round, under the standings: the race for the Trofeo Pillsbury in one line. Good news
// only, as on the site: who is above the objective (▲), at most three, never who is in line or below
// (in a small group, naming those in line would point at the others). Nobody above yet: the race is open.
//   🏅 *Trofeo Pillsbury:* in testa Carla, poi Anna e Bruno
export function pillsburyLine(race: PillsburyRace, nameOf: (handle: string) => string): string {
  if (race.suspended || race.rows.length === 0) return '';
  const head = `${PILLSBURY_EMOJI} *${PILLSBURY_TITLE}:*`;
  const up = race.rows.filter((r) => r.trend === 'up');
  if (up.length === 0) return `${head} corsa ancora aperta, nessuno finora sopra le attese`;
  // Who share the lead are named together
  const leaders = up.filter((r) => Math.abs(r.over - up[0].over) < 1e-6);
  const others = up.slice(leaders.length, Math.max(3, leaders.length));
  const name = (r: { handle: string }) => nameOf(r.handle);
  return `${head} in testa ${namesList(leaders.map(name))}${others.length > 0 ? `, poi ${namesList(others.map(name))}` : ''}`;
}

// Lichess study search for an opening, readable in a chat ("+" instead of "%20")
export const studySearchUrl = (opening: string) =>
  `https://lichess.org/study/search?q=${encodeURIComponent(opening).replace(/%20/g, '+')}&order=popular`;

export interface BulletinInput {
  round: string;
  games: HistoryGame[]; // the round's games, in calendar order
  states: Record<string, LichessExportGame>; // fresh from Lichess, for the games not finished yet
  history: HistoryGame[]; // the whole season, withdrawals applied (for standings and summits)
  config: AppConfig;
  expiryDays: number;
  now?: number;
  random?: () => number; // which phrase of each list; Math.random unless a test fixes it
  seasons?: SeasonArchive[]; // archived seasons, for the Elo del torneo of the colpacci
}

export interface Bulletin {
  text: string;
  details: string[]; // what was read from Lichess, game by game (shown to the organizer)
  isComplete: boolean;
}

// Picks phrases at random without repeating one of a list until all were used
export function phrasePicker(phrases: Record<string, unknown>, random: () => number = Math.random) {
  const used: Record<string, Set<number>> = {};
  return (key: string): string => {
    const list = Array.isArray(phrases[key]) ? (phrases[key] as string[]) : [];
    if (list.length === 0) return "";
    const seen = (used[key] ??= new Set());
    if (seen.size >= list.length) seen.clear();
    const free = list.map((_, i) => i).filter((i) => !seen.has(i));
    const i = free[Math.min(free.length - 1, Math.floor(random() * free.length))];
    seen.add(i);
    return list[i];
  };
}

const PHASE_TEXT: Record<GamePhase, string> = {
  opening: "in apertura",
  middlegame: "nel mediogioco",
  endgame: "nel finale",
};

// The WhatsApp message on the state of a round, from the games and what Lichess says of them
export function buildBulletin({ round, games, states, history, config, expiryDays, now = Date.now(), random, seasons = [] }: BulletinInput): Bulletin {
  const nameOf = nameFrom(config.players);
  const idToHandle = (id?: string) =>
    config.players.find((p) => p.handle.toLowerCase() === String(id ?? "").toLowerCase())?.handle;
  const count = { finished: 0, ongoing: 0, pending: 0 };
  const detailsList: string[] = [];
  const finishedOpenings = new Map<string, string>();
  const toAccept: string[] = []; // games whose challenge is still to accept, "Anna–Bruno"

  const pickFor = phrasePicker(config.statusPhrases, random);

  // Each challenge expires on its own (a link recreated later has a later deadline); the one written
  // under the games is the earliest of those still open, or the round's when none was created yet
  const deadlineOf = (g: HistoryGame) => roundDeadline([g], expiryDays, now);
  const openDeadlines = games.map(deadlineOf).filter((d) => d >= now);
  const deadlineMs = openDeadlines.length > 0 ? Math.min(...openDeadlines) : roundDeadline(games, expiryDays, now);

  // Saved results plus the fresh ones, for the standings
  const allStates: Record<string, LichessExportGame> = { ...storedStates(history), ...states };
  // Scontro al vertice: same rule as the badge on the site
  const summits = summitGames(config.players, history, allStates);
  // Colpaccio: same rule as the badge on the site, on the Elo del torneo
  const elo = tournamentElo(seasons, config.players.map((p) => p.handle), history, allStates, config.tournament?.seeds);

  // The colpaccio line of each game: written only in the bulletin of the round's end, so that it is
  // news once instead of a headline repeated in every update while the round goes on
  const upsetLines: string[] = [];
  const blocks = games.map((g, i) => {
    const id = extractGameId(g.url);
    // Fresh state for the open games; a finished game keeps its stored (final) result, and a game
    // won by forfeit after a withdrawal has no Lichess link: its result is stored with it
    const s = id ? states[id] ?? (gameProgress(g.lichess) === "finished" ? g.lichess : undefined) : g.lichess;
    const white = idToHandle(s?.players?.white?.user?.id) ?? g.white;
    const black = idToHandle(s?.players?.black?.user?.id) ?? g.black;
    const head = `${config.numberEmojis[i] ?? i + 1 + "."} *${nameOf(white)}* ⚪ vs *${nameOf(black)}* ⚫`;
    let body: string;
    let upsetLine = "";
    const summit = summits.get(summitKey(g));

    if (!s) {
      count.pending++;
      const linkExpired = now > deadlineOf(g);
      if (!linkExpired) toAccept.push(`${nameOf(white)}–${nameOf(black)}`);
      // The deadline is the same for the whole round: written once, under the games
      // ({deadline} still works in a phrase that asks for it)
      body = linkExpired
        ? "Link scaduto: la sfida va ricreata 🔁"
        : fill(pickFor("pending"), { deadline: formatDeadline(deadlineOf(g)) });
      detailsList.push(`${i + 1}. ${id}: non ancora trovata su Lichess (sfida non ancora accettata)`);
    } else if (s.status === "created" || s.status === "started") {
      count.ongoing++;
      // Lichess shows ongoing games 3 plies late (anti-cheat): whose turn it is and the deadline
      // cannot be known reliably, so the message gives only an approximate number of moves.
      const plies = pliesOf(s);
      const approx = getApproxMoves(plies);
      const lichessPhase = gamePhase(s);

      body = fill(pickFor("ongoing"), {
        approxMoves: approx.approxMoves,
        movesBand: approx.movesBand,
        // Lichess' own phase when available, the estimate from the number of moves otherwise
        phase: lichessPhase ? PHASE_TEXT[lichessPhase] : approx.phase,
        // Moves band plus the phase, the latter only when Lichess sent it
        progress: [approx.approxMoves, lichessPhase && PHASE_TEXT[lichessPhase]].filter(Boolean).join(", "),
      });

      detailsList.push(
        `${i + 1}. ${id}: bianco=${s.players?.white?.user?.name ?? "?"}, nero=${s.players?.black?.user?.name ?? "?"}, ` +
          `semimosse visibili via API=${plies} (Lichess ne nasconde fino a 3), ~${approx.approxMoves}, fase Lichess=${lichessPhase ?? "n/d"}`
      );
    } else if (isVoid(s)) {
      body = pickFor("aborted");
      detailsList.push(`${i + 1}. ${id}: stato ${s.status}`);
    } else {
      count.finished++;
      const moves = fullMovesOf(s);
      const inMoves = moves > 0 ? `in ${movesText(moves)}` : "";
      const opening = s.opening?.name ?? "";
      const mainOpening = opening.split(":")[0].trim();
      if (mainOpening) {
        finishedOpenings.set(mainOpening, studySearchUrl(mainOpening));
      }
      const openingNote = opening ? `♟️ Apertura: ${opening}` : "";
      const common = { moves, opening, mainOpening, openingNote };
      const won = s.winner === "white" || s.winner === "black";

      if (won) {
        const winnerHandle = s.winner === "white" ? white : black;
        const loserHandle = s.winner === "white" ? black : white;
        const color = s.winner === "white" ? "col bianco" : "col nero";
        const how = HOW_WIN[s.status] ?? "";
        body = tidy(
          fill(pickFor("win"), {
            ...common,
            winner: nameOf(winnerHandle),
            loser: nameOf(loserHandle),
            result: s.winner === "white" ? "1-0" : "0-1",
            color,
            how,
            details: [color, how, inMoves].filter(Boolean).join(" "),
          })
        );
      } else {
        const how = HOW_DRAW[s.status] ?? "";
        body = tidy(
          fill(pickFor("draw"), {
            ...common,
            result: "½-½",
            how,
            details: [how, inMoves].filter(Boolean).join(" "),
          })
        );
      }

      // Guarantee opening is included whenever Lichess detected it
      if (opening && !body.includes(opening)) {
        body = `${body}\n${openingNote}`;
      }

      const upset = upsetOf(s, elo, { round: g.round, white: g.white, black: g.black, id: id || undefined });
      if (upset) {
        const player = upset.player === "white" ? white : black;
        const opponent = upset.player === "white" ? black : white;
        upsetLine =
          upset.kind === "win"
            ? fill(pickFor("upset") || "💥 Colpaccio di {winner}", { winner: nameOf(player), loser: nameOf(opponent), gap: upset.gap })
            : fill(pickFor("upsetDraw") || "🛡️ Colpaccio di patta: {player} ferma {opponent}", { player: nameOf(player), opponent: nameOf(opponent), gap: upset.gap });
      }

      detailsList.push(
        `${i + 1}. ${id}: stato ${s.status}, vincitore ${s.winner ?? "nessuno"}, mosse ${moves}, Elo bianco ${s.players?.white?.rating ?? "?"}${s.players?.white?.provisional ? "?" : ""}, Elo nero ${s.players?.black?.rating ?? "?"}${s.players?.black?.provisional ? "?" : ""}, apertura ${
          opening || "n/d"
        }`
      );
    }
    const summitLine = summit
      ? fill(pickFor("summit") || "🔝 Scontro al vertice: {positions} in classifica", { positions: summit })
      : "";
    upsetLines.push(upsetLine);
    return [head, summitLine, body].filter(Boolean).join("\n");
  });

  const isRoundComplete = games.length > 0 && count.finished === games.length;
  const gameBlocks = isRoundComplete ? blocks.map((b, i) => [b, upsetLines[i]].filter(Boolean).join("\n")) : blocks;

  const headerTemplate =
    isRoundComplete && config.statusPhrases.roundEndHeader && config.statusPhrases.roundEndHeader.length > 0
      ? pickFor("roundEndHeader")
      : pickFor("header");

  // During the round: the summary. At its end the summary would only repeat the header, so the
  // leader and the table after the round take its place
  const footerTemplate = isRoundComplete ? "" : pickFor("footer");

  let studiesAppendix = "";
  if (isRoundComplete && finishedOpenings.size > 0) {
    const items = Array.from(finishedOpenings.entries()).map(
      ([name, url]) => `• ${name}: ${url}`
    );
    studiesAppendix = `📚 *Studi consigliati per le aperture del turno:*\n${items.join("\n")}`;
  }

  // At the end of the round, who leads and the table (as on the site), from the saved results plus
  // the fresh ones
  let leader = "";
  let table = "";
  let pillsbury = "";
  if (isRoundComplete) {
    const { standings } = computeStandings(config.players, history, allStates);
    leader = leaderLine(standings);
    table = standingsBlock(standings, round, reigningChampions(config.tournament?.winners)?.handles, reigningPillsbury(seasons)?.handles);
    // The second trophy, after the championship; from the second season (in the first all are esordienti)
    if (seasons.length > 0) {
      pillsbury = pillsburyLine(pillsburyRace(config.players, elo, history, history, allStates, config.tournament?.withdrawals), nameOf);
    }
  }

  // The challenges still to accept, with their one deadline
  const reminder =
    toAccept.length > 0 ? `⏳ *Da accettare entro ${formatDeadline(deadlineMs)}:* ${toAccept.join(", ")}` : "";

  const vars = { round, ...count, summary: roundSummary(count) };
  const textResult = [
    fill(headerTemplate, vars),
    ...gameBlocks,
    reminder,
    footerTemplate ? fill(footerTemplate, vars) : "",
    leader,
    table,
    pillsbury,
    config.statusPhrases.closing && config.statusPhrases.closing.length > 0 ? pickFor("closing") : "",
    studiesAppendix,
    // The site, where results update between two bulletins
    config.statusPhrases.infoLine ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { text: textResult, details: detailsList, isComplete: isRoundComplete };
}
