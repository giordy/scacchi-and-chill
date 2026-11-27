// Tests of firestore.rules against the Firestore emulator. They run with `npm run test:rules`, which
// starts the emulator (Java needed) and sets FIRESTORE_EMULATOR_HOST; `npm test` skips them.
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { pledgeCommit } from '../src/lib/firestoreRest';
import { pushCommit, seenCommit } from '../src/lib/push';

const RULES = fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8');
const ADMIN = 'organizer@example.com';
const T = 'tournaments/scacchi-and-chill-official';

const tournament = { title: 'Scacchi & Chill', season: 'Stagione 2', players: [] };
const game = { round: '1', white: 'anna', black: 'bruno', url: 'https://lichess.org/abcdefgh' };
const season = { season: 'Stagione 1', standings: [], games: [], departures: [] };
const photo = { dataUrl: 'data:image/jpeg;base64,AAAA' };
const analysis = { v: 5, id: 'abcdefgh', curve: [50, 52], turns: [] };

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('firestore.rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: 'demo-scacchi', firestore: { rules: RULES } });
  });
  afterAll(async () => {
    await env?.cleanup();
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, T), tournament);
      await setDoc(doc(db, `${T}/games/g1`), game);
      await setDoc(doc(db, `${T}/seasons/stagione-1`), season);
      await setDoc(doc(db, `${T}/media/m1`), photo);
      await setDoc(doc(db, `${T}/analyses/abcdefgh`), analysis);
      await setDoc(doc(db, `${T}/private/organizer`), { token: 'secret' });
      await setDoc(doc(db, `admins/${ADMIN}`), {});
    });
  });

  const visitor = () => env.unauthenticatedContext().firestore();
  const stranger = () => env.authenticatedContext('u1', { email: 'someone@example.com', email_verified: true }).firestore();
  const admin = (verified = true) => env.authenticatedContext('admin', { email: ADMIN, email_verified: verified }).firestore();

  describe('public data', () => {
    it('can be read by anyone', async () => {
      for (const p of [T, `${T}/games/g1`, `${T}/seasons/stagione-1`, `${T}/media/m1`, `${T}/analyses/abcdefgh`]) {
        await assertSucceeds(getDoc(doc(visitor(), p)));
      }
    });

    it('cannot be written by a visitor or by another account', async () => {
      for (const db of [visitor(), stranger()]) {
        await assertFails(setDoc(doc(db, T), tournament));
        await assertFails(setDoc(doc(db, `${T}/games/g2`), game));
        await assertFails(deleteDoc(doc(db, `${T}/games/g1`)));
        await assertFails(setDoc(doc(db, `${T}/seasons/stagione-2`), season));
        await assertFails(setDoc(doc(db, `${T}/media/m2`), photo));
        await assertFails(deleteDoc(doc(db, `${T}/media/m1`)));
        await assertFails(setDoc(doc(db, `${T}/analyses/ijklmnop`), { ...analysis, id: 'ijklmnop' }));
        await assertFails(deleteDoc(doc(db, `${T}/analyses/abcdefgh`)));
      }
    });
  });

  describe('private data (token, anecdotes)', () => {
    it('is hidden from visitors and other accounts', async () => {
      await assertFails(getDoc(doc(visitor(), `${T}/private/organizer`)));
      await assertFails(getDoc(doc(stranger(), `${T}/private/organizer`)));
      await assertFails(setDoc(doc(stranger(), `${T}/private/organizer`), { token: 'x' }));
    });

    it('is readable and writable by the organizer, only with a verified email', async () => {
      await assertSucceeds(getDoc(doc(admin(), `${T}/private/organizer`)));
      await assertSucceeds(setDoc(doc(admin(), `${T}/private/organizer`), { token: 'y' }));
      await assertFails(getDoc(doc(admin(false), `${T}/private/organizer`)));
    });
  });

  describe('the list of organizers', () => {
    it('lets an account check only its own entry, with a verified email', async () => {
      await assertSucceeds(getDoc(doc(admin(), `admins/${ADMIN}`)));
      await assertSucceeds(getDoc(doc(stranger(), 'admins/someone@example.com')));
      await assertFails(getDoc(doc(stranger(), `admins/${ADMIN}`)));
      await assertFails(getDoc(doc(visitor(), `admins/${ADMIN}`)));
      await assertFails(getDoc(doc(admin(false), `admins/${ADMIN}`)));
    });

    it('cannot be listed or changed from the site', async () => {
      await assertFails(getDocs(collection(admin(), 'admins')));
      await assertFails(setDoc(doc(stranger(), 'admins/someone@example.com'), {}));
      await assertFails(setDoc(doc(admin(), 'admins/someone@example.com'), {}));
      await assertFails(deleteDoc(doc(admin(), `admins/${ADMIN}`)));
    });
  });

  describe('the organizer', () => {
    it('writes the tournament with a title and a season', async () => {
      await assertSucceeds(setDoc(doc(admin(), T), tournament));
      await assertFails(setDoc(doc(admin(), T), { title: 'Scacchi & Chill' }));
      await assertFails(setDoc(doc(admin(false), T), tournament));
    });

    it('writes games with players, round and a Lichess link (or none), and deletes them', async () => {
      await assertSucceeds(setDoc(doc(admin(), `${T}/games/g2`), game));
      await assertSucceeds(setDoc(doc(admin(), `${T}/games/g3`), { ...game, url: '' }));
      await assertSucceeds(setDoc(doc(admin(), `${T}/games/g4`), { round: '1', white: 'a', black: 'b' }));
      await assertFails(setDoc(doc(admin(), `${T}/games/g5`), { ...game, url: 'https://evil.example/x' }));
      await assertFails(setDoc(doc(admin(), `${T}/games/g6`), { round: '1', white: 'a' }));
      await assertSucceeds(deleteDoc(doc(admin(), `${T}/games/g1`)));
    });

    it('archives seasons with their games and departures', async () => {
      await assertSucceeds(setDoc(doc(admin(), `${T}/seasons/stagione-2`), { ...season, season: 'Stagione 2' }));
      await assertFails(setDoc(doc(admin(), `${T}/seasons/stagione-3`), { season: 'Stagione 3' }));
    });

    it('keeps the key moments of archived games, each under its own Lichess id', async () => {
      await assertSucceeds(setDoc(doc(admin(), `${T}/analyses/ijklmnop`), { ...analysis, id: 'ijklmnop' }));
      await assertSucceeds(getDocs(collection(visitor(), `${T}/analyses`)));
      await assertFails(setDoc(doc(admin(), `${T}/analyses/qrstuvwx`), analysis)); // another game's
      await assertFails(setDoc(doc(admin(), `${T}/analyses/not-a-game-id`), { ...analysis, id: 'not-a-game-id' }));
      await assertFails(setDoc(doc(admin(), `${T}/analyses/qrstuvwx`), { id: 'qrstuvwx' })); // no version
      await assertSucceeds(deleteDoc(doc(admin(), `${T}/analyses/abcdefgh`)));
    });

    it('uploads photos only as small image data URLs', async () => {
      await assertSucceeds(setDoc(doc(admin(), `${T}/media/m2`), photo));
      await assertFails(setDoc(doc(admin(), `${T}/media/m3`), { dataUrl: 'data:text/html;base64,AAAA' }));
      await assertFails(setDoc(doc(admin(), `${T}/media/m4`), { dataUrl: 'data:image/png;base64,' + 'A'.repeat(900_000) }));
      await assertSucceeds(deleteDoc(doc(admin(), `${T}/media/m1`)));
    });
  });
  describe('accepting the rules (pledges)', () => {
    const P = `${T}/pledges`;
    const pledge = (handle = 'anna', season = 'Stagione 2') => ({ handle, season, rules: '0a1b2c3d', at: serverTimestamp() });

    it('a visitor accepts for the current season, once, and everyone reads it', async () => {
      await assertSucceeds(setDoc(doc(visitor(), `${P}/stagione-2--anna`), pledge()));
      await assertSucceeds(getDocs(collection(visitor(), P)));
      // Once: no rewriting, no deleting
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-2--anna`), pledge()));
      await assertFails(deleteDoc(doc(visitor(), `${P}/stagione-2--anna`)));
    });

    it('refuses another season, a document of another player, other fields or a time of the client', async () => {
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-1--anna`), pledge('anna', 'Stagione 1')));
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-2--bruno`), pledge('anna')));
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-2--anna`), { ...pledge(), extra: true }));
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-2--anna`), { ...pledge(), at: new Date(2020, 0, 1) }));
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-2--anna`), { ...pledge(), rules: 'not a version' }));
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-2--Anna!`), pledge('Anna!')));
    });

    it('with the list of the season on the tournament, only its players and under the id of the season', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), T), { ...tournament, pledgeKeys: ['stagione-2--anna', 'stagione-2--bruno'] });
      });
      await assertSucceeds(setDoc(doc(visitor(), `${P}/stagione-2--anna`), pledge()));
      // Not a player of the season
      await assertFails(setDoc(doc(visitor(), `${P}/stagione-2--zeno`), pledge('zeno')));
      // A player, under another id: it would add a second acceptance, out of the organizer's reach
      await assertFails(setDoc(doc(visitor(), `${P}/altro--bruno`), pledge('bruno')));
      await assertSucceeds(setDoc(doc(visitor(), `${P}/stagione-2--bruno`), pledge('bruno')));
    });

    it('the organizer can cancel one, and the player accepts again', async () => {
      await assertSucceeds(setDoc(doc(visitor(), `${P}/stagione-2--anna`), pledge()));
      await assertFails(deleteDoc(doc(stranger(), `${P}/stagione-2--anna`)));
      await assertSucceeds(deleteDoc(doc(admin(), `${P}/stagione-2--anna`)));
      await assertSucceeds(setDoc(doc(visitor(), `${P}/stagione-2--anna`), pledge()));
    });

    it('takes the write of the public page, as it sends it (REST, no sign-in)', async () => {
      const database = 'projects/demo-scacchi/databases/(default)';
      const send = (body: unknown) =>
        fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/${database}/documents:commit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const first = await send(pledgeCommit(database, 'Stagione 2', 'Anna', '0a1b2c3d'));
      expect(first.status).toBe(200);
      const again = await send(pledgeCommit(database, 'Stagione 2', 'Anna', '0a1b2c3d'));
      expect(again.ok).toBe(false);
      const old = await send(pledgeCommit(database, 'Stagione 1', 'Bruno', '0a1b2c3d'));
      expect(old.status).toBe(403);
      const saved = await getDoc(doc(visitor(), `${P}/stagione-2--anna`));
      expect(saved.data()).toMatchObject({ handle: 'anna', season: 'Stagione 2', rules: '0a1b2c3d' });
    });
  });

  describe('push notifications (pushSubscriptions)', () => {
    const S = `${T}/pushSubscriptions`;
    const ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';
    const sub = (extra: Record<string, unknown> = {}) => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc:DEF',
      p256dh: 'B' + 'a'.repeat(86),
      auth: 'q'.repeat(22),
      skip: '',
      at: serverTimestamp(),
      ...extra,
    });

    it('a visitor subscribes, changes it and deletes it, but nobody reads or lists them from the site', async () => {
      await assertSucceeds(setDoc(doc(visitor(), `${S}/${ID}`), sub()));
      await assertSucceeds(setDoc(doc(visitor(), `${S}/${ID}`), sub({ skip: 'anna' })));
      await assertFails(getDoc(doc(visitor(), `${S}/${ID}`)));
      await assertFails(getDocs(collection(visitor(), S)));
      await assertFails(getDocs(collection(admin(), S)));
      await assertSucceeds(deleteDoc(doc(visitor(), `${S}/${ID}`)));
    });

    it('refuses a short id, another address, other fields or a time of the client', async () => {
      await assertFails(setDoc(doc(visitor(), `${S}/short`), sub()));
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ endpoint: 'https://evil.example/fcm.googleapis.com/x' })));
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ endpoint: 'http://fcm.googleapis.com/x' })));
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ extra: true })));
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ at: new Date(2020, 0, 1) })));
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ skip: 'Anna!' })));
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ p256dh: 'short' })));
    });

    it('takes the write of the public page, as it sends it (REST, no sign-in)', async () => {
      const database = 'projects/demo-scacchi/databases/(default)';
      const res = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/${database}/documents:commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pushCommit(database, ID, { endpoint: 'https://web.push.apple.com/QAbc-123', p256dh: 'B' + 'x'.repeat(86), auth: 'y'.repeat(22) }, 'Anna')),
      });
      expect(res.status).toBe(200);
      await env.withSecurityRulesDisabled(async (ctx) => {
        const saved = await getDoc(doc(ctx.firestore(), `${S}/${ID}`));
        expect(saved.data()).toMatchObject({ endpoint: 'https://web.push.apple.com/QAbc-123', skip: 'anna' });
      });
    });

    it('takes the moves seen on an existing subscription only, and a capped map', async () => {
      const database = 'projects/demo-scacchi/databases/(default)';
      const commit = (body: unknown) =>
        fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/${database}/documents:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      // No subscription yet: nothing is created
      expect((await commit(seenCommit(database, ID, { aaaaaaaa: 100 }))).ok).toBe(false);
      await assertSucceeds(setDoc(doc(visitor(), `${S}/${ID}`), sub()));
      expect((await commit(seenCommit(database, ID, { aaaaaaaa: 100 }))).status).toBe(200);
      await env.withSecurityRulesDisabled(async (ctx) => {
        const saved = await getDoc(doc(ctx.firestore(), `${S}/${ID}`));
        expect(saved.data()).toMatchObject({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc:DEF', seen: { aaaaaaaa: 100 } });
      });
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ seen: 'x' })));
      const tooMany = Object.fromEntries(Array.from({ length: 301 }, (_, i) => [`g${String(i).padStart(7, '0')}`, i + 1]));
      await assertFails(setDoc(doc(visitor(), `${S}/${ID}`), sub({ seen: tooMany })));
    });
  });
});
