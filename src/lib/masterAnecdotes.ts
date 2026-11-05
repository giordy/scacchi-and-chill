import { HistoryGame, MasterAnecdote } from '../types';

// Anecdotes about the master of the season, one per round: round N gets anecdote #N. It closes
// the message that opens the round and, from then on, shows on the public page.

const roundNumber = (round: string) => {
  const n = parseInt(round, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function anecdoteForRound(list: MasterAnecdote[] | undefined, round: string): { n: number; anecdote: MasterAnecdote } | undefined {
  const n = roundNumber(round);
  const anecdote = n !== undefined ? list?.[n - 1] : undefined;
  return n !== undefined && anecdote ? { n, anecdote } : undefined;
}

// WhatsApp text, at the end of the round message
export const anecdoteText = (n: number, a: MasterAnecdote) => `📜 *Aneddoto #${n}: ${a.title}*\n${a.text}`;

// The anecdotes of the rounds already started (a round starts when its first Lichess link exists)
export function publishedAnecdotes(list: MasterAnecdote[] | undefined, history: HistoryGame[]): { n: number; anecdote: MasterAnecdote }[] {
  const started = new Set(history.filter((g) => g.url).map((g) => roundNumber(g.round)));
  return (list ?? []).map((anecdote, i) => ({ n: i + 1, anecdote })).filter(({ n }) => started.has(n));
}

// Editor format: one anecdote per block, blocks separated by a line with "---", title on the first line
export const anecdotesToText = (list: MasterAnecdote[] | undefined) =>
  (list ?? []).map((a) => `${a.title}\n${a.text}`).join('\n\n---\n\n');

export function anecdotesFromText(text: string): MasterAnecdote[] {
  return text
    .split(/^\s*---\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [first, ...rest] = block.split('\n');
      // "*Aneddoto #3: Title*" pasted from WhatsApp becomes "Title"
      const title = first.replace(/^\*|\*$/g, '').replace(/^aneddoto\s*#?\d+\s*:\s*/i, '').trim();
      return { title, text: rest.join('\n').trim() };
    })
    .filter((a) => a.title && a.text);
}
