import { AppConfig, HistoryGame, LichessExportGame } from '../types';
import { computeStandings, PlayerStanding } from './standings';
import { extractGameId, fill, formatDeadline, getApproxMoves, HOW_DRAW, HOW_WIN, tidy } from './utils';
import { gamePhase, GamePhase } from './phase';
import { upsetOf } from './upset';
import { fullMovesOf, isVoid, movesText, nameFrom, pliesOf, storedStates } from './games';
import { summitGames, summitKey } from './summit';
import { gameProgress } from './progress';

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

const pts = (n: number) => {
  const s = String(n).replace('.5', '½').replace(/^0½/, '½');
  return `${s} ${n === 1 ? 'punto' : 'punti'}`;
};

// Who leads, as on the site's hero; ties on points are named together instead of picking one
export function leaderLine(standings: PlayerStanding[]): string {
  const top = standings[0];
  if (!top || top.points <= 0) return '';
  const tied = standings.filter((s) => s.points === top.points);
  if (tied.length === 1) return `🥇 In testa ${top.name} con ${pts(top.points)}.`;
  if (tied.length > 3) return '';
  const names = tied.map((s) => s.name);
  const list = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `🥇 In testa a pari punti ${list}, con ${pts(top.points)}.`;
}

export interface BulletinInput {
  round: string;
  games: HistoryGame[]; // the round's games, in calendar order
  states: Record<string, LichessExportGame>; // fresh from Lichess, for the games not finished yet
  history: HistoryGame[]; // the whole season, withdrawals applied (for standings and summits)
  config: AppConfig;
  expiryDays: number;
  now?: number;
  random?: () => number; // which phrase of each list; Math.random unless a test fixes it
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
export function buildBulletin({ round, games, states, history, config, expiryDays, now = Date.now(), random }: BulletinInput): Bulletin {
  const nameOf = nameFrom(config.players);
  const idToHandle = (id?: string) =>
    config.players.find((p) => p.handle.toLowerCase() === String(id ?? "").toLowerCase())?.handle;
  const count = { finished: 0, ongoing: 0, pending: 0 };
  const detailsList: string[] = [];
  const finishedOpenings = new Map<string, string>();

  const pickFor = phrasePicker(config.statusPhrases, random);

  // Deadline of the links not accepted yet (from the round's oldest created challenge)
  const deadlineMs = roundDeadline(games, expiryDays, now);
  const linkExpired = now > deadlineMs;

  // Saved results plus the fresh ones, for the standings
  const allStates: Record<string, LichessExportGame> = { ...storedStates(history), ...states };
  // Scontro al vertice: same rule as the badge on the site
  const summits = summitGames(config.players, history, allStates);

  const blocks = games.map((g, i) => {
    const id = extractGameId(g.url);
    // Fresh state for the open games; a finished game keeps its stored (final) result, and a game
    // won by forfeit after a withdrawal has no Lichess link: its result is stored with it
    const s = id ? states[id] ?? (gameProgress(g.lichess) === "finished" ? g.lichess : undefined) : g.lichess;
    const white = idToHandle(s?.players?.white?.user?.id) ?? g.white;
    const black = idToHandle(s?.players?.black?.user?.id) ?? g.black;
    const head = `${config.numberEmojis[i] ?? i + 1 + "."} *${nameOf(white)}* ⚪ vs *${nameOf(black)}* ⚫`;
    let body: string;
    const summit = summits.get(summitKey(g));

    if (!s) {
      count.pending++;
      body = linkExpired
        ? "Link scaduto: la sfida va ricreata 🔁"
        : fill(pickFor("pending"), { deadline: formatDeadline(deadlineMs) });
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
        const studyUrl = `https://lichess.org/study/search?q=${encodeURIComponent(mainOpening)}&order=popular`;
        finishedOpenings.set(mainOpening, studyUrl);
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

      // Colpaccio: same rule as the badge on the site
      const upset = upsetOf(s);
      if (upset) {
        const winnerHandle = upset.winner === "white" ? white : black;
        const loserHandle = upset.winner === "white" ? black : white;
        const line = fill(pickFor("upset") || "💥 Colpaccio: {gap} punti Elo di differenza", {
          winner: nameOf(winnerHandle),
          loser: nameOf(loserHandle),
          gap: upset.gap,
        });
        body = `${body}\n${line}`;
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
    return [head, summitLine, body].filter(Boolean).join("\n");
  });

  const isRoundComplete = games.length > 0 && count.finished === games.length;

  const headerTemplate =
    isRoundComplete && config.statusPhrases.roundEndHeader && config.statusPhrases.roundEndHeader.length > 0
      ? pickFor("roundEndHeader")
      : pickFor("header");

  const footerTemplate =
    isRoundComplete && config.statusPhrases.roundEndFooter && config.statusPhrases.roundEndFooter.length > 0
      ? pickFor("roundEndFooter")
      : pickFor("footer");

  let studiesAppendix = "";
  if (isRoundComplete && finishedOpenings.size > 0) {
    const items = Array.from(finishedOpenings.entries()).map(
      ([name, url]) => `• ${name}: ${url}`
    );
    studiesAppendix = `📚 *Studi consigliati per le aperture del turno:*\n${items.join("\n")}`;
  }

  // At the end of the round, who leads (as on the site), from the saved results plus the fresh ones
  let leader = "";
  if (isRoundComplete) {
    leader = leaderLine(computeStandings(config.players, history, allStates).standings);
  }

  const vars = { round, ...count, summary: roundSummary(count) };
  const textResult = [
    fill(headerTemplate, vars),
    ...blocks,
    fill(footerTemplate, vars),
    leader,
    config.statusPhrases.closing && config.statusPhrases.closing.length > 0 ? pickFor("closing") : "",
    studiesAppendix,
    isRoundComplete && config.statusPhrases.infoLine ? config.statusPhrases.infoLine : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { text: textResult, details: detailsList, isComplete: isRoundComplete };
}
