import { HistoryGame, LichessExportGame, Player, SeasonArchive, SeasonWinner, TournamentMeta } from '../types';
import { computeStandings, seasonStarted, sharedRanks } from './standings';
import { computeSeasonAwards } from './awards';
import { podiumFromStandings } from './honours';
import { monthKey, periodOfGames } from './period';

// Stable document id from the season name: "Stagione 2 - Capablanca" -> "stagione-2-capablanca"
export function seasonId(season: string): string {
  return (
    season
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "stagione"
  );
}

// Pure function: final snapshot of the current season (standings, champion, games played)
export function buildSeasonArchive(
  meta: TournamentMeta,
  players: Player[],
  history: HistoryGame[],
  gameStates: Record<string, LichessExportGame>,
  now: Date = new Date()
): SeasonArchive {
  const { standings } = computeStandings(players, history, gameStates);
  const top = standings[0];
  const archive: SeasonArchive = {
    id: seasonId(meta.season),
    season: meta.season,
    title: meta.title,
    archivedAt: now.toISOString(),
    standings,
    gamesPlayed: standings.reduce((sum, s) => sum + s.played, 0) / 2,
  };
  if (meta.masterName) archive.masterName = meta.masterName;
  if (meta.imageUrl) archive.imageUrl = meta.imageUrl;
  // When it was played: from the games, ending at the archive date if games were left unfinished
  const period = periodOfGames(history, gameStates);
  if (period.start) archive.start = period.start;
  archive.end = period.end ?? monthKey(now.getTime());
  // No champion until at least one game has been scored
  if (top && top.points > 0) archive.champion = { handle: top.handle, name: top.name, points: top.points };
  const awards = computeSeasonAwards(players, history, gameStates);
  if (awards.length > 0) archive.awards = awards;
  return archive;
}

// Puts the champion and the podium in the hall of fame, one entry per season name. An existing
// entry for the season keeps its notes when it names the same champion, and its podium when it has one.
export function withChampion(winners: SeasonWinner[] | undefined, archive: SeasonArchive): SeasonWinner[] {
  const list = winners ?? [];
  if (!archive.champion) return list;
  const entry: SeasonWinner = {
    season: archive.season,
    name: archive.champion.name,
    handle: archive.champion.handle,
  };
  if (archive.start) entry.start = archive.start;
  if (archive.end) entry.end = archive.end;
  const podium = podiumFromStandings(archive.standings);
  if (podium.length > 0) entry.podium = podium;
  const idx = list.findIndex((w) => w.season === archive.season);
  if (idx === -1) return [...list, entry];
  const old = list[idx];
  if (old.handle === entry.handle) {
    // Same champion: keep what was typed, fill in only what is missing
    const filled: SeasonWinner = { ...old };
    if (!old.podium && entry.podium) filled.podium = entry.podium;
    if (!old.start && entry.start) filled.start = entry.start;
    if (!old.end && entry.end) filled.end = entry.end;
    const changed = filled.podium !== old.podium || filled.start !== old.start || filled.end !== old.end;
    return changed ? list.map((w, i) => (i === idx ? filled : w)) : list;
  }
  return list.map((w, i) => (i === idx ? entry : w));
}

// A new season needs a name that does not collide with the current one or an archived one
// (the archive id comes from the name, so a collision would overwrite a past season)
export function validateNewSeasonName(
  name: string,
  currentSeason: string,
  archived: Array<{ id: string }>
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Inserisci il nome della nuova stagione.";
  const id = seasonId(trimmed);
  if (id === seasonId(currentSeason)) return "Il nome è uguale a quello della stagione corrente.";
  if (archived.some((s) => s.id === id)) return "Esiste già una stagione archiviata con questo nome.";
  return null;
}

// Newest first
export const sortSeasons = (seasons: SeasonArchive[]): SeasonArchive[] =>
  [...seasons].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));

// Current standings as CSV for a spreadsheet: semicolons and decimal commas (Italian Excel),
// with a BOM so accented names open correctly. Touches neither the archive nor the hall of fame.
export function standingsCsv(archive: SeasonArchive): string {
  const num = (n: number) => String(n).replace(".", ",");
  const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // Shared places, as on the site; none before the first game
  const ranks = sharedRanks(archive.standings);
  const started = seasonStarted(archive.standings);
  const rows = [
    ["Posizione", "Giocatore", "Lichess", "Punti", "Giocate", "Vinte", "Patte", "Perse", "Sonneborn-Berger"],
    ...archive.standings.map((s, i) => [
      started ? String(ranks[i]) : "",
      s.name,
      s.handle,
      num(s.points),
      String(s.played),
      String(s.won),
      String(s.drawn),
      String(s.lost),
      num(s.sb),
    ]),
  ];
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
