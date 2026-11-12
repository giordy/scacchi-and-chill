import { describe, expect, it } from 'vitest';
import { masterSurname, openingFamily, OPENING_FAMILIES, playsFamily, scudettoTitle } from '../masterOpening';
import { awardTitle, computeSeasonAwards } from '../awards';
import { HistoryGame, LichessExportGame, Player } from '../../types';

const fam = (key: string) => openingFamily(key)!;

describe('playsFamily', () => {
  // Names as Lichess sends them (lichess-org/chess-openings)
  it.each([
    ['queens-gambit', "Queen's Gambit Declined: Chigorin Defense", true],
    ['queens-gambit', "Queen's Gambit Accepted: Classical Defense", true],
    ['queens-gambit', "Queen's Pawn Game: Chigorin Variation", false], // 1.d4 d5 2.Nf3 Nc6: no c4
    ['queens-gambit', "Queen's Indian Defense: Fianchetto Variation", false],
    ['sicilian', 'Sicilian Defense: Najdorf Variation, English Attack', true],
    ['sicilian', 'Sicilian Defense', true],
    ['italian', 'Italian Game: Two Knights Defense, Modern Bishop\'s Opening', true],
    ['italian', 'Vienna Game: Falkbeer Variation', false],
    ['vienna', 'Vienna Game: Falkbeer Variation', true],
    ['london', 'London System: Poisoned Pawn Variation', true],
    ['london', "Queen's Pawn Game: Accelerated London System", true],
    ['london', 'Indian Defense: London System', true],
    ['london', 'Grob Opening: London Defense', false],
    ['grunfeld', 'Grünfeld Defense: Exchange Variation', true],
    ['slav', 'Semi-Slav Defense: Meran Variation', true],
    ['kings-gambit', "King's Gambit Accepted: Kieseritzky Gambit", true],
  ])('%s – %s: %s', (key, name, expected) => {
    expect(playsFamily(name, fam(key))).toBe(expected);
  });

  it('is false without a name or a family', () => {
    expect(playsFamily(undefined, fam('sicilian'))).toBe(false);
    expect(playsFamily('', fam('sicilian'))).toBe(false);
    expect(playsFamily('Sicilian Defense', undefined)).toBe(false);
  });

  it('has unique keys', () => {
    expect(new Set(OPENING_FAMILIES.map((f) => f.key)).size).toBe(OPENING_FAMILIES.length);
  });
});

describe('masterSurname', () => {
  it('takes the last word', () => {
    expect(masterSurname('José Raúl Capablanca')).toBe('Capablanca');
    expect(masterSurname('Tal')).toBe('Tal');
    expect(masterSurname(undefined)).toBe('');
  });
});

describe('scudettoTitle', () => {
  it("is named after the season's master, the site's name without one", () => {
    expect(scudettoTitle('José Raúl Capablanca')).toBe('Scudetto Capablanca');
    expect(scudettoTitle('  ')).toBe('Scudetto Chill');
    expect(scudettoTitle(undefined)).toBe('Scudetto Chill');
  });
});

describe("L'allievo", () => {
  const players: Player[] = [
    { name: 'Anna', handle: 'anna' },
    { name: 'Bruno', handle: 'bruno' },
    { name: 'Carla', handle: 'carla' },
  ];
  const g = (white: string, black: string, id: string): HistoryGame => ({ round: '1', white, black, url: `https://lichess.org/${id}` });
  const st = (id: string, opening: string, status = 'resign'): LichessExportGame => ({
    id, status, winner: 'white', moves: 'e4 e5 Nf3 Nc6', opening: { name: opening },
  });
  const history = [g('anna', 'bruno', 'aaaaaaaa'), g('bruno', 'carla', 'bbbbbbbb'), g('anna', 'carla', 'cccccccc'), g('carla', 'anna', 'dddddddd')];
  const states = {
    aaaaaaaa: st('aaaaaaaa', "Queen's Gambit Declined: Exchange Variation"),
    bbbbbbbb: st('bbbbbbbb', "Queen's Gambit Accepted"),
    cccccccc: st('cccccccc', "Queen's Gambit Declined"),
    dddddddd: st('dddddddd', "Queen's Gambit Declined", 'started'), // ongoing: not counted
  };
  const award = (opening?: string) =>
    computeSeasonAwards(players, history, states, [], undefined, undefined, { name: 'José Raúl Capablanca', opening }).find((a) => a.id === 'master-opening');

  it('goes to who played it most from its side', () => {
    const a = award('queens-gambit')!;
    expect(a.title).toBe("L'allievo");
    expect(a.winners.map((w) => w.handle)).toEqual(['anna']); // twice with White; Bruno once
    expect(a.detail).toBe('Gambetto di Donna: 2 partite');
  });

  it('shows the new name on seasons archived as "Premio Capablanca"', () => {
    const old = { ...award('queens-gambit')!, title: 'Premio Capablanca' };
    expect(awardTitle(old)).toBe("L'allievo");
  });

  it('counts Black for a defense, and is not given when nobody played it', () => {
    expect(award('slav')).toBeUndefined();
    expect(award(undefined)).toBeUndefined();
    const sicilian = computeSeasonAwards(players, [g('anna', 'bruno', 'aaaaaaaa')], { aaaaaaaa: st('aaaaaaaa', 'Sicilian Defense: Dragon Variation') }, [], undefined, undefined, { name: 'Mikhail Tal', opening: 'sicilian' });
    expect(sicilian.find((a) => a.id === 'master-opening')?.winners.map((w) => w.handle)).toEqual(['bruno']);
  });
});
