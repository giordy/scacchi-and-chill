import { HistoryGame, LichessExportGame, Player, SeasonArchive, SeasonWinner, TournamentMeta } from '../types';
import { computeStandings } from './standings';

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
  // No champion until at least one game has been scored
  if (top && top.points > 0) archive.champion = { handle: top.handle, name: top.name, points: top.points };
  return archive;
}

// Adds the champion to the hall of fame, once per season name
export function withChampion(winners: SeasonWinner[] | undefined, archive: SeasonArchive): SeasonWinner[] {
  const list = winners ?? [];
  if (!archive.champion || list.some((w) => w.season === archive.season)) return list;
  return [
    ...list,
    {
      season: archive.season,
      name: archive.champion.name,
      handle: archive.champion.handle,
      year: String(new Date(archive.archivedAt).getFullYear()),
    },
  ];
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
