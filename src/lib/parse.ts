import {
  Player,
} from '../types';

// Parses a pasted round message, recognizing both old and new Lichess URL formats
export function parseRoundMessage(text: string, players: Player[]) {
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const round = text.match(/(?:turno|round)\s*(\d+)/i)?.[1] ?? "";
  
  // Supports lichess.org/AbCdEfGh, lichess.org/game/AbCdEfGh, lichess.org/challenge/AbCdEfGh, 12-char URLs, etc.
  const linkRe = /(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:(?:game|challenge|embed\/game|embed)\/)?([a-zA-Z0-9]{8})[a-zA-Z0-9]*(?:[^\s<>"'()]*)?/gi;
  const games: Array<{ white: string; black: string; url: string }> = [];
  const problems: string[] = [];
  let previousEnd = 0;
  let n = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(text))) {
    n++;
    const gameId = match[1];
    const segment = text.slice(previousEnd, match.index);
    previousEnd = match.index + match[0].length;

    const found = players
      .map((p) => {
        let best = -1;
        [p.name, p.handle].forEach((label) => {
          const re = new RegExp("(^|[^\\p{L}\\p{N}])" + escapeRe(label) + "(?![\\p{L}\\p{N}])", "iu");
          const hit = re.exec(segment);
          if (hit) {
            const idx = hit.index + hit[1].length;
            if (best === -1 || idx < best) best = idx;
          }
        });
        return { player: p, idx: best };
      })
      .filter((x) => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx);

    if (found.length < 2) {
      problems.push(`Link ${n} (${gameId}): non è stato possibile identificare i due giocatori nel testo prima del link.`);
      continue;
    }
    games.push({
      white: found[0].player.handle,
      black: found[1].player.handle,
      url: `https://lichess.org/${gameId}`,
    });
  }
  return { round, games, problems };
}
