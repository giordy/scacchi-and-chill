import { describe, expect, it } from 'vitest';
import { toPhrases } from '../../tabs/settings/StatusPhrasesSection';

describe('toPhrases', () => {
  it('splits on blank lines and keeps multi-line phrases', () => {
    expect(toPhrases('Vince {winner}\n{openingNote}\n\n  \nPunto a {winner}  \n\n\n')).toEqual([
      'Vince {winner}\n{openingNote}',
      'Punto a {winner}',
    ]);
    expect(toPhrases('  \n\n')).toEqual([]);
  });
});
