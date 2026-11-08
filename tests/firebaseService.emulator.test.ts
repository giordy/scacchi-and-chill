// The writes of season close and backup restore (src/firebaseService.ts) against the Firestore
// emulator, as the organizer, with firestore.rules on. They run with `npm run test:rules`, which
// starts the emulator (Java needed) and sets FIRESTORE_EMULATOR_HOST; `npm test` skips them.
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, terminate } from 'firebase/firestore';
import type { HistoryGame, SeasonArchive } from '../src/types';

const PROJECT = 'demo-scacchi';
const ADMIN = 'organizer@example.com';
const T = 'tournaments/scacchi-and-chill-official';

// The site's Firebase app, pointed at the emulator's demo project and default database
vi.mock('../firebase-applet-config.json', () => ({
  default: { projectId: PROJECT, appId: 'demo', apiKey: 'demo', authDomain: 'demo', storageBucket: '', messagingSenderId: '' },
}));

const emulator = process.env.FIRESTORE_EMULATOR_HOST;

describe.skipIf(!emulator)('firebaseService on Firestore', () => {
  let env: RulesTestEnvironment;
  let service: typeof import('../src/firebaseService');

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT,
      firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
    });
    service = await import('../src/firebaseService');
    const [host, port] = emulator!.split(':');
    // Signed in as the organizer: the rules decide, as on the real site
    connectFirestoreEmulator(service.db, host, Number(port), { mockUserToken: { sub: 'admin', email: ADMIN, email_verified: true } });
  });
  afterAll(async () => {
    if (service) await terminate(service.db);
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `admins/${ADMIN}`), {});
    });
  });

  // Games as the site stores them, read with the rules off
  const storedGames = async () => {
    let ids: string[] = [];
    let data: Record<string, unknown>[] = [];
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(collection(ctx.firestore(), `${T}/games`));
      ids = snap.docs.map((d) => d.id).sort();
      data = snap.docs.map((d) => d.data());
    });
    return { ids, data };
  };

  const games = (n: number, round = '1'): HistoryGame[] =>
    Array.from({ length: n }, (_, i) => ({ round, white: `w${i}`, black: `b${i}`, url: `https://lichess.org/g${String(i).padStart(7, '0')}` }));

  it('deletes every game, beyond the 400 of a single batch', async () => {
    await service.replaceAllGames(games(450));
    expect((await storedGames()).ids).toHaveLength(450);
    expect(await service.deleteAllGames()).toBe(450);
    expect((await storedGames()).ids).toEqual([]);
  });

  it('replaces the games with those of a backup, results and games without a link included', async () => {
    await service.replaceAllGames(games(3, '7')); // the games of now: none must survive
    const restored: HistoryGame[] = [
      { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/abcdefgh', createdAt: 1700000000000, lichess: { id: 'abcdefgh', status: 'mate', winner: 'white' } },
      { round: '2', white: 'bruno', black: 'anna', url: '' },
    ];
    await service.replaceAllGames(restored);
    const { ids, data } = await storedGames();
    expect(ids).toEqual(['r1_anna_bruno', 'r2_bruno_anna']);
    const first = data.find((d) => d.round === '1')!;
    expect(first).toMatchObject({ white: 'anna', black: 'bruno', url: 'https://lichess.org/abcdefgh', createdAt: 1700000000000, lichess: { id: 'abcdefgh', status: 'mate', winner: 'white' } });
    expect(first.lichess).not.toHaveProperty('moves'); // undefined fields are dropped, not refused
    expect(data.find((d) => d.round === '2')).not.toHaveProperty('lichess');
  });

  it('closes a season: the archive is public, then the games are gone', async () => {
    await service.replaceAllGames(games(2));
    const archive = {
      id: 'stagione-2',
      season: 'Stagione 2',
      archivedAt: '2026-12-31T10:00:00.000Z',
      standings: [{ handle: 'w0', name: 'W0', played: 1, won: 1, drawn: 0, lost: 0, points: 1, sb: 0 }],
      champion: { handle: 'w0', name: 'W0', points: 1 },
      gamesPlayed: 1,
    } as unknown as SeasonArchive;
    await service.saveSeasonArchive(archive);
    await service.deleteAllGames();
    const publicSeason = await getDoc(doc(env.unauthenticatedContext().firestore(), `${T}/seasons/stagione-2`));
    expect(publicSeason.data()).toMatchObject({ season: 'Stagione 2', champion: { handle: 'w0' } });
    expect((await storedGames()).ids).toEqual([]);
  });
});
