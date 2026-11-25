// Analysis of the finished games (job "Analisi" of the GitHub Action "Sincronizza risultati"): each
// finished game is analysed once by Stockfish, and its key moments (scripts/analysis.mjs) are saved
// on the game (field `analysis`), for the replay on the site.
// Needs Stockfish installed (the workflow installs Ubuntu's package; STOCKFISH names another
// binary) and the secret FIREBASE_SERVICE_ACCOUNT, as the results sync.
// Usage: node scripts/analyse-games.mjs
//        node scripts/analyse-games.mjs --moves "e4 e5 Nf3 …"   (one game, printed, nothing saved)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { ANALYSIS_VERSION, keyMoments, needsAnalysis, phasesOf, winPercent } from './analysis.mjs';
import { withFacts } from './moveFacts.mjs';
import { accessToken, gameIdOf, readGames, saveGameFields } from './sync-results.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOURNAMENT_DOC_ID = 'scacchi-and-chill-official';
// Nodes per position: the same search every time on any machine (one thread), about half a second
const NODES = 600000;
// Games analysed per run, the newest first: the others wait for the next run (every 10 minutes)
const MAX_GAMES = 3;

// A UCI engine over stdin/stdout: send a command, wait for the line that ends its answer
function engine(bin) {
  const proc = spawn(bin, [], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: proc.stdout });
  let waiting = null;
  let buffer = [];
  lines.on('line', (line) => {
    buffer.push(line);
    if (waiting && waiting.until(line)) {
      const { resolve } = waiting;
      const out = buffer;
      waiting = null;
      buffer = [];
      resolve(out);
    }
  });
  const failed = new Promise((_, reject) => {
    proc.on('error', reject);
    proc.on('exit', (code) => reject(new Error(`Stockfish si è fermato (codice ${code})`)));
  });
  failed.catch(() => {});
  const ask = (cmd, until) => {
    const answer = new Promise((resolve) => {
      waiting = { until, resolve };
    });
    proc.stdin.write(`${cmd}\n`);
    return Promise.race([answer, failed]);
  };
  return {
    ask,
    send: (cmd) => proc.stdin.write(`${cmd}\n`),
    name: null,
    quit: () => {
      proc.stdin.write('quit\n');
      proc.stdin.end();
    },
  };
}

export async function startEngine() {
  const bin = process.env.STOCKFISH || (fs.existsSync('/usr/games/stockfish') ? '/usr/games/stockfish' : 'stockfish');
  const e = engine(bin);
  const id = await e.ask('uci', (l) => l === 'uciok');
  e.name = id.find((l) => l.startsWith('id name '))?.slice(8) ?? 'Stockfish';
  e.send('setoption name Threads value 1');
  e.send('setoption name Hash value 64');
  e.send('setoption name MultiPV value 2');
  await e.ask('isready', (l) => l === 'readyok');
  return e;
}

// The engine's lines kept: enough to see what a move wins or loses (scripts/moveFacts.mjs)
const PV_LENGTH = 8;

// The engine's two best moves in a position, with their scores from White's side and their lines
export function parseSearch(lines, whiteToMove) {
  const lines2 = {};
  for (const l of lines) {
    const m = l.match(/^info .*\bmultipv (\d+) .*\bscore (cp|mate) (-?\d+).*? pv (.+)$/);
    if (!m) continue;
    const v = Number(m[3]) * (whiteToMove ? 1 : -1);
    const pv = m[4].trim().split(/\s+/).slice(0, PV_LENGTH);
    lines2[m[1]] = { score: m[2] === 'cp' ? { cp: v } : { mate: v }, uci: pv[0], pv };
  }
  return [lines2['1'], lines2['2']].filter(Boolean);
}

async function search(e, fen) {
  e.send(`position fen ${fen}`);
  const out = await e.ask(`go nodes ${NODES}`, (l) => l.startsWith('bestmove'));
  return parseSearch(out, fen.split(' ')[1] === 'w');
}

// White's chances in a position the game cannot go on from
function terminal(chess) {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? 0 : 100;
  if (chess.isDraw() || chess.isStalemate()) return 50;
  return undefined;
}

const sanOf = (fen, uci) => {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return uci;
  }
};

// The engine's view of every position of a game, from its moves in SAN (as Lichess exports them);
// undefined when the moves do not make a legal game
export async function evaluate(e, moves) {
  const chess = new Chess();
  const plies = [];
  for (const san of moves.trim().split(/\s+/)) {
    const fen = chess.fen();
    let move;
    try {
      move = chess.move(san);
    } catch {
      return undefined;
    }
    plies.push({ san: move.san, uci: move.from + move.to + (move.promotion ?? ''), color: move.color === 'w' ? 'white' : 'black', fen });
  }
  for (const p of plies) {
    const [first, second] = await search(e, p.fen);
    p.best = { uci: first.uci, san: sanOf(p.fen, first.uci), white: winPercent(first.score), score: first.score, pv: first.pv };
    if (second) p.second = { white: winPercent(second.score), score: second.score, pv: second.pv };
  }
  let final = terminal(chess);
  // The engine's line from the final position: what the last move allowed, for a turn there
  let finalLine;
  if (final === undefined) {
    const [first] = await search(e, chess.fen());
    final = winPercent(first.score);
    finalLine = { score: first.score, pv: first.pv };
  }
  const boards = [...plies.map((p) => p.fen), chess.fen()].map((f) => f.split(' ')[0]);
  return { plies, final, finalLine, mate: chess.isCheckmate(), boards };
}

// The key moments of one game and its phases (scripts/analysis.mjs); division: Lichess' own, if any
export async function analyse(e, moves, division) {
  const seen = await evaluate(e, moves);
  if (!seen) return undefined;
  const moments = withFacts(keyMoments(seen.plies, seen.final, { mate: seen.mate }), seen.plies, seen.finalLine);
  return { ...moments, phases: phasesOf(division, seen.boards) };
}

async function main() {
  const at = process.argv.indexOf('--moves');
  if (at > 0) {
    const e = await startEngine();
    console.log(JSON.stringify(await analyse(e, process.argv[at + 1]), null, 1));
    e.quit();
    return;
  }
  const secret = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!secret) {
    console.log('Manca il secret FIREBASE_SERVICE_ACCOUNT: nessuna analisi (vedi il README).');
    return;
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));
  const base =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/` +
    `${encodeURIComponent(cfg.firestoreDatabaseId || '(default)')}/documents/tournaments/${TOURNAMENT_DOC_ID}`;
  const token = await accessToken(JSON.parse(secret));
  const pending = (await readGames(base, token))
    .filter((g) => needsAnalysis(g, gameIdOf))
    .sort((a, b) => (b.lichess.lastMoveAt ?? 0) - (a.lichess.lastMoveAt ?? 0));
  if (pending.length === 0) {
    console.log('Nessuna partita da analizzare.');
    return;
  }
  const e = await startEngine();
  try {
    for (const g of pending.slice(0, MAX_GAMES)) {
      const id = gameIdOf(g.url) ?? g.lichess.id;
      const started = Date.now();
      const result = await analyse(e, g.lichess.moves, g.lichess.division);
      // Moves that do not make a game are marked, so they are not tried again at every run
      const analysis = result
        ? { v: ANALYSIS_VERSION, id, engine: e.name, nodes: NODES, at: new Date().toISOString(), ...result }
        : { v: ANALYSIS_VERSION, id, skipped: 'moves' };
      try {
        await saveGameFields(base, token, g.docId, { analysis });
      } catch (err) {
        // A game deleted meanwhile (a new season, a link made again): nothing to save it on
        if (!/HTTP (400|404)\b/.test(String(err?.message))) throw err;
        console.warn(`${g.docId}: partita non più presente, analisi non salvata.`);
        continue;
      }
      console.log(`${g.docId}: ${result ? `${result.turns.length} svolte, ${result.best.length} mosse migliori` : 'mosse non valide'} (${Math.round((Date.now() - started) / 1000)} s).`);
    }
  } finally {
    e.quit();
  }
  if (pending.length > MAX_GAMES) console.log(`Altre ${pending.length - MAX_GAMES} partite al prossimo giro.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
