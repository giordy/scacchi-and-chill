import { describe, expect, it } from 'vitest';
import { buildMasterPrompt, parseMasterReply } from '../masterPrompt';
import { roundsForAnecdotes } from '../../tabs/settings/MasterAISection';

const reply = (data: object, around = true) =>
  around ? `Ecco i testi:\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\nBuona stagione!` : JSON.stringify(data);

const full = {
  motto: '«Il mago di Riga»',
  presentation: 'Mikhail Tal fu *campione del mondo* nel 1960.',
  anecdotes: [
    { title: 'Il mago', text: 'Sacrificava pezzi.' },
    { title: 'Il fumo', text: 'Fumava molto.' },
    { title: '', text: 'senza titolo: scartato' },
  ],
  opening: 'sicilian',
  famousGame: { white: 'Tal', black: 'Larsen', place: 'Bled', year: 1965, note: 'Un sacrificio di cavallo.' },
  photo: 'Wikimedia Commons, "Mikhail Tal 1960"',
  toCheck: ['La data del match'],
};

describe('buildMasterPrompt', () => {
  it('asks for one anecdote per round, the site openings and a JSON reply', () => {
    const p = buildMasterPrompt({ master: 'Mikhail Tal', rounds: 14, tournamentTitle: 'Scacchi & Chill' });
    expect(p).toContain('dedicata a Mikhail Tal');
    expect(p).toContain('esattamente 14 aneddoti');
    expect(p).toContain('- sicilian: Siciliana (la sceglie il nero)');
    expect(p).toContain('"famousGame"');
    expect(p).toContain('Non scrivere link');
  });
});

describe('parseMasterReply', () => {
  it('fills the season fields from the JSON, with text around it', () => {
    const r = parseMasterReply(reply(full));
    expect(r.patch.subtitle).toBe('Il mago di Riga');
    expect(r.patch.description).toContain('*campione del mondo*');
    expect(r.patch.masterAnecdotes).toEqual([
      { title: 'Il mago', text: 'Sacrificava pezzi.' },
      { title: 'Il fumo', text: 'Fumava molto.' },
    ]);
    expect(r.patch.masterOpening).toBe('sicilian');
    expect(r.patch.famousGame).toEqual({ url: '', title: 'Tal – Larsen, Bled 1965', note: 'Un sacrificio di cavallo.' });
    expect(r.photo).toContain('Wikimedia');
    expect(r.toCheck).toEqual(['La data del match']);
    expect(r.warnings).toEqual([]);
  });

  it('reads a bare JSON too, and keeps the link only for the same game', () => {
    const same = parseMasterReply(reply(full, false), { url: 'https://lichess.org/abcdefgh', title: 'Tal – Larsen, Bled 1965' });
    expect(same.patch.famousGame?.url).toBe('https://lichess.org/abcdefgh');
    const other = parseMasterReply(reply(full), { url: 'https://lichess.org/abcdefgh', title: 'Capablanca – Marshall, New York 1918' });
    expect(other.patch.famousGame?.url).toBe('');
  });

  it('warns about an opening the site does not know, and leaves it out', () => {
    const r = parseMasterReply(reply({ ...full, opening: 'najdorf' }));
    expect(r.patch.masterOpening).toBeUndefined();
    expect(r.warnings[0]).toContain('najdorf');
  });

  it('explains what is wrong with a reply it cannot read', () => {
    expect(() => parseMasterReply('Non so chi sia.')).toThrow('blocco JSON');
    expect(() => parseMasterReply('```json\n{ "motto": "a", }\n```')).toThrow('non è valido');
    expect(() => parseMasterReply('{"other": 1}')).toThrow('nessun campo');
  });
});

describe('roundsForAnecdotes', () => {
  it('counts the rounds of the calendar, or a double round robin', () => {
    const m = (round: string) => ({ round, white: 'a', black: 'b' });
    expect(roundsForAnecdotes([m('1'), m('1'), m('2')], 8)).toBe(2);
    expect(roundsForAnecdotes([], 8)).toBe(14);
    expect(roundsForAnecdotes([], 7)).toBe(14);
  });
});
