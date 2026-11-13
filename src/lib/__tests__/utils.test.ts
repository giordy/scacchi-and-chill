import { describe, expect, it } from 'vitest';
import { errorMessage, extractGameId, getApproxMoves } from '../utils';
import { shouldPoll, REFRESH_MS } from '../../hooks/useVisiblePolling';
import { syncTargets } from '../games';

describe('getApproxMoves', () => {
  // Lichess hides up to 3 half-moves: 16 visible ones may be 16-19 real ones, i.e. 8-10 moves
  it.each([
    [0, 'meno di 10 mosse', '< 10 mosse', 'in apertura'],
    [15, 'meno di 10 mosse', '< 10 mosse', 'in apertura'],
    [16, 'una decina di mosse', '~10 mosse', 'in apertura'],
    [18, 'una decina di mosse', '~10 mosse', 'in apertura'],
    [20, 'una decina di mosse', '~10 mosse', 'in apertura'],
    [21, 'più di 10 mosse', '> 10 mosse', 'nel mediogioco'],
    [35, 'più di 10 mosse', '> 10 mosse', 'nel mediogioco'],
    [36, 'una ventina di mosse', '~20 mosse', 'nel mediogioco'],
    [40, 'una ventina di mosse', '~20 mosse', 'nel mediogioco'],
    [41, 'più di 20 mosse', '> 20 mosse', 'nel vivo del gioco'],
    [60, 'una trentina di mosse', '~30 mosse', 'nel vivo del gioco'],
    [61, 'più di 30 mosse', '> 30 mosse', 'fase avanzata'],
    [80, 'una quarantina di mosse', '~40 mosse', 'fase avanzata'],
    [81, 'più di 40 mosse', '> 40 mosse', 'in pieno finale'],
    [100, 'più di 40 mosse', '> 40 mosse', 'in pieno finale'],
  ])('%i visible half-moves: %s', (plies, approxMoves, movesBand, phase) => {
    expect(getApproxMoves(plies)).toEqual({ approxMoves, movesBand, phase });
  });

  it('never says something the hidden half-moves could make false', () => {
    for (let plies = 0; plies <= 120; plies++) {
      const { approxMoves } = getApproxMoves(plies);
      for (let real = plies; real <= plies + 3; real++) {
        const moves = Math.ceil(real / 2);
        const less = approxMoves.match(/meno di (\d+)/);
        const more = approxMoves.match(/più di (\d+)/);
        if (less) expect(moves).toBeLessThan(Number(less[1]));
        if (more) expect(moves).toBeGreaterThan(Number(more[1]));
      }
    }
  });
});

describe('errorMessage', () => {
  it('reads errors, strings and anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(42)).toBe('42');
  });
});

describe('extractGameId', () => {
  it('reads the id from the different Lichess links', () => {
    expect(extractGameId('https://lichess.org/AbCd1234')).toBe('AbCd1234');
    expect(extractGameId('https://lichess.org/AbCd1234wXyZ')).toBe('AbCd1234');
    expect(extractGameId('lichess.org/embed/game/AbCd1234')).toBe('AbCd1234');
    expect(extractGameId('')).toBeUndefined();
  });
  it('reads it after /game/ too, with or without the moves or the side after it', () => {
    expect(extractGameId('https://lichess.org/game/AbCd1234')).toBe('AbCd1234');
    expect(extractGameId('https://lichess.org/game/export/AbCd1234?moves=false')).toBe('AbCd1234');
    expect(extractGameId('https://lichess.org/AbCd1234/black#12')).toBe('AbCd1234');
    expect(extractGameId('https://lichess.org/challenge/AbCd1234')).toBe('AbCd1234');
  });
  it('never takes for a game a page of Lichess or a longer path', () => {
    ['https://lichess.org/training/abc', 'https://lichess.org/analysis', 'https://lichess.org/tournament/AbCd1234', 'https://lichess.org/AbCd123', 'https://lichess.org/AbCd12345', 'https://lichess.org/study/AbCd1234', 'https://lichess.org/@/anna1234'].forEach((u) =>
      expect(extractGameId(u), u).toBeUndefined()
    );
  });
});

describe('shouldPoll (public page: at most one call every 5 minutes, only when visible)', () => {
  const now = 10 * REFRESH_MS;
  const base = { force: false, busy: false, hidden: false, now };
  it('asks on the first load, and again once the answer is 5 minutes old', () => {
    expect(shouldPoll({ ...base, force: true, last: now })).toBe(true);
    expect(shouldPoll({ ...base, last: now - REFRESH_MS })).toBe(true);
    // the interval may fire a few seconds early
    expect(shouldPoll({ ...base, last: now - REFRESH_MS + 3000 })).toBe(true);
  });
  it('does not ask when the last answer is recent, the tab is hidden or a call is running', () => {
    expect(shouldPoll({ ...base, last: now - 60_000 })).toBe(false);
    expect(shouldPoll({ ...base, hidden: true, force: true, last: 0 })).toBe(false);
    expect(shouldPoll({ ...base, busy: true, force: true, last: 0 })).toBe(false);
    // With another interval: every 90 seconds while a game is live
    expect(shouldPoll({ ...base, last: now - 90_000, interval: 90_000 })).toBe(true);
    expect(shouldPoll({ ...base, last: now - 60_000, interval: 90_000 })).toBe(false);
  });
});

describe('syncTargets (organizer sync)', () => {
  const g = (url: string, status?: string) => ({ round: '1', white: 'a', black: 'b', url, ...(status ? { lichess: { id: 'x', status } } : {}) });
  it('reads the linked games without a final result, each id once', () => {
    const history = [
      g('https://lichess.org/aaaaaaaa'),
      g('https://lichess.org/aaaaaaaa'),
      g('https://lichess.org/bbbbbbbb', 'started'),
      g('https://lichess.org/cccccccc', 'created'),
      g('https://lichess.org/dddddddd', 'mate'),
      g(''),
    ];
    const { linked, targets, ids } = syncTargets(history);
    expect(linked).toBe(5);
    expect(targets).toHaveLength(4);
    expect(ids).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
  });
  it('tells when there are no links at all', () => {
    expect(syncTargets([g('')]).linked).toBe(0);
  });
});
