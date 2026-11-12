import { describe, expect, it } from 'vitest';
import { loadSnapshot, PublicSnapshot, saveSnapshot } from '../publicCache';
import { HistoryGame, SeasonArchive } from '../../types';

const memory = (limit = Infinity) => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (v.length > limit) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  };
};

const games = [{ round: '1', white: 'anna', black: 'bruno', url: '', createdAt: 5 }] as HistoryGame[];
const seasons = [{ id: 's1', season: 'Stagione 1', notes: 'x'.repeat(500) }] as unknown as SeasonArchive[];
const snapshot: PublicSnapshot = { at: 1000, doc: null, games, seasons };

describe('publicCache', () => {
  it('gives back what was saved', () => {
    const store = memory();
    saveSnapshot(snapshot, store);
    expect(loadSnapshot(store)).toEqual(snapshot);
  });
  it('with no room keeps the tournament without the archived seasons', () => {
    const store = memory(300);
    saveSnapshot(snapshot, store);
    expect(loadSnapshot(store)).toEqual({ ...snapshot, seasons: [] });
  });
  it('nothing saved, unreadable or without storage: no snapshot', () => {
    expect(loadSnapshot(memory())).toBeNull();
    const store = memory();
    store.setItem('sc:public-snapshot:v1', '{"at":"ieri"}');
    expect(loadSnapshot(store)).toBeNull();
    store.setItem('sc:public-snapshot:v1', 'not json');
    expect(loadSnapshot(store)).toBeNull();
    expect(loadSnapshot(undefined)).toBeNull();
  });
});
