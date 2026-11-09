import { afterEach, describe, expect, it, vi } from 'vitest';
import { countView, excludeThisBrowser, isExcluded, viewPath } from '../analytics';

describe('viewPath', () => {
  it('counts each view of the public page as a path', () => {
    expect(viewPath('')).toBe('/');
    expect(viewPath('#/classifica')).toBe('/classifica');
    expect(viewPath('#/pillsbury')).toBe('/pillsbury');
    expect(viewPath('#/giocatore/frasal')).toBe('/giocatore/frasal');
    expect(viewPath('#/partite?turno=2')).toBe('/partite');
  });

  it('does not count the switch of GoatCounter itself', () => {
    expect(viewPath('#toggle-goatcounter')).toBeNull();
  });
});

describe('the organizer browser', () => {
  const store = new Map<string, string>();
  const count = vi.fn();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
  vi.stubGlobal('window', { goatcounter: { count }, setTimeout });
  afterEach(() => {
    store.clear();
    count.mockClear();
  });

  it('counts the views of a visitor', () => {
    countView('#/pillsbury');
    expect(count).toHaveBeenCalledWith({ path: '/pillsbury' });
  });

  it('counts nothing once the organizer signed in from this browser', () => {
    expect(isExcluded()).toBe(false);
    excludeThisBrowser();
    expect(isExcluded()).toBe(true);
    countView('#/classifica');
    expect(count).not.toHaveBeenCalled();
  });
});
