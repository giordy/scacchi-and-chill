import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chess } from 'chess.js';
// @ts-expect-error a Node script without types
import { analyse, evaluate, NoLine, parseSearch } from '../../../scripts/analyse-games.mjs';
// @ts-expect-error a Node script without types
import { saveGameFields } from '../../../scripts/sync-results.mjs';

// An engine that answers like Stockfish: the first legal moves of the position as its two lines,
// scored +0.10 for the side to move
function fakeEngine() {
  let fen = '';
  const searched: string[] = [];
  return {
    searched,
    send(cmd: string) {
      if (cmd.startsWith('position fen ')) fen = cmd.slice(13);
    },
    async ask(cmd: string) {
      if (!cmd.startsWith('go ')) return [];
      searched.push(fen);
      const moves = new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
      return [
        ...moves.slice(0, 2).map((m, i) => `info depth 12 seldepth 15 multipv ${i + 1} score cp ${10 - i * 30} nodes 1000 nps 1 pv ${m}`),
        `bestmove ${moves[0]}`,
      ];
    },
  };
}

const SCHOLAR = 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#';

describe('the analysis of a game, start to end', () => {
  it('searches every position before a move, and the final one unless the game ended on the board', async () => {
    const e = fakeEngine();
    const seen = await evaluate(e, 'e4 e5 Nf3');
    expect(seen.plies.map((p: { san: string; color: string }) => [p.san, p.color])).toEqual([
      ['e4', 'white'],
      ['e5', 'black'],
      ['Nf3', 'white'],
    ]);
    // three positions before a move, then the final one, searched for what the last move allowed
    expect(e.searched).toHaveLength(4);
    expect(seen.finalLine.pv).toHaveLength(1);
    expect(seen.mate).toBe(false);
    expect(seen.boards).toHaveLength(4);
    // a score for the side to move, turned to White's side
    expect(seen.plies[1].best.score).toEqual({ cp: -10 });
    expect(seen.plies[0].second.score).toEqual({ cp: -20 });
  });

  it('knows a checkmate on the board without asking the engine', async () => {
    const e = fakeEngine();
    const seen = await evaluate(e, SCHOLAR);
    expect(seen.mate).toBe(true);
    expect(seen.final).toBe(100);
    expect(seen.finalLine).toBeUndefined();
    expect(e.searched).toHaveLength(7);
    const a = await analyse(fakeEngine(), SCHOLAR);
    expect(a.finish).toMatchObject({ ply: 7, color: 'white', san: 'Qxf7#', move: { piece: 'q', to: 'f7', capture: 'p', check: true } });
    expect(a.curve.at(-1)).toBe(100);
    expect(a.phases).toEqual({});
  });

  it('knows a stalemate and a draw as level', async () => {
    // the shortest stalemate known (Sam Loyd)
    const stalemate = 'e3 a5 Qh5 Ra6 Qxa5 h5 h4 Rah6 Qxc7 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6 Qe6';
    const seen = await evaluate(fakeEngine(), stalemate);
    expect(seen.final).toBe(50);
    expect(seen.mate).toBe(false);
  });

  it('stops on a position the engine gives no line for, as a game that cannot be analysed', async () => {
    // an engine that, at its third search, answers with no line at all
    const silent = () => {
      const e = fakeEngine();
      return { ...e, async ask(cmd: string) {
        const out = await e.ask(cmd);
        return e.searched.length === 3 ? ['bestmove (none)'] : out;
      } };
    };
    await expect(evaluate(silent(), 'e4 e5 Nf3 Nc6')).rejects.toBeInstanceOf(NoLine);
    await expect(analyse(silent(), 'e4 e5 Nf3 Nc6')).rejects.toThrow('Nessuna linea del motore');
  });

  it('gives up on moves that do not make a game', async () => {
    expect(await evaluate(fakeEngine(), 'e4 e5 Ke3 Ke6 Qxh7')).toBeUndefined();
    expect(await analyse(fakeEngine(), 'e4 e4')).toBeUndefined();
  });

  it("uses Lichess' division when the game has it", async () => {
    const a = await analyse(fakeEngine(), 'e4 e5 Nf3 Nc6 Bb5 a6', { middle: 4, end: 5 });
    expect(a.phases).toEqual({ middle: 4, end: 5 });
  });

  it('reads the lines of a search, extra fields and long lines included', () => {
    const long = 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7';
    const out = [
      'info string NNUE evaluation using nn-1111.nnue',
      'info depth 1 currmove e2e4 currmovenumber 1',
      `info depth 20 seldepth 28 multipv 1 score cp 31 wdl 60 900 40 upperbound nodes 600000 nps 900000 hashfull 10 tbhits 0 time 600 pv ${long}`,
      'bestmove e2e4 ponder e7e5',
    ];
    const [first, second] = parseSearch(out, true);
    expect(first.pv).toHaveLength(8);
    expect(first.score).toEqual({ cp: 31 });
    expect(second).toBeUndefined();
    expect(parseSearch(['bestmove (none)'], true)).toEqual([]);
  });
});

describe('saving the analysis', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes only the given fields, and only on a game that still exists', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }));
    vi.stubGlobal('fetch', fetch);
    await saveGameFields('https://x/doc', 'TOKEN', 'r1_anna_bruno', { analysis: { v: 3, id: 'AbCd1234' } });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, { method: string; body: string }];
    const params = new URL(url).searchParams;
    expect(url.startsWith('https://x/doc/games/r1_anna_bruno?')).toBe(true);
    expect(params.getAll('updateMask.fieldPaths')).toEqual(['analysis']);
    expect(params.get('currentDocument.exists')).toBe('true');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body).fields.analysis.mapValue.fields.id).toEqual({ stringValue: 'AbCd1234' });
  });

  it('says why a save failed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => 'NOT_FOUND' })));
    await expect(saveGameFields('https://x/doc', 'T', 'r1_a_b', { analysis: {} })).rejects.toThrow('Salvataggio di r1_a_b: HTTP 404 NOT_FOUND');
  });
});

describe('the results sync', () => {
  // Its job installs no dependency: only the analysis job has chess.js (scripts/moveFacts.mjs)
  it('loads nothing that needs the dependencies installed', () => {
    for (const file of ['sync-results.mjs', 'analysis.mjs', 'push.mjs', 'backup.mjs']) {
      const src = fs.readFileSync(path.resolve(__dirname, '../../../scripts', file), 'utf8');
      const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
      expect(imports.filter((i) => !i.startsWith('node:') && !i.startsWith('./')), file).toEqual([]);
      expect(imports, file).not.toContain('./moveFacts.mjs');
      expect(imports, file).not.toContain('./analyse-games.mjs');
    }
  });
});
