import { useEffect, useRef } from 'react';
import { AppConfig, EloSeed, HistoryGame, LichessExportGame, SeasonArchive, TournamentMeta } from '../types';
import { currentSeason, tournamentElo } from '../lib/tournamentElo';
import { computeSeed, firstGames, seedsToFix, SEED_PERF_LABEL } from '../lib/seeds';
import { fetchRatingHistory } from '../lib/lichess';
import { errorMessage } from '../lib/utils';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;

// Organizer area: fixes the seed of each player in their first season (see lib/seeds.ts) as soon as
// their first game exists, reading the Lichess rating histories of the season's players. A seed with
// a rating is saved once and never computed again; one without is tried again, on its own day, each
// time the organizer area opens, and saved (and told, with the reason) when the result changes: a
// rating, or a different reason. The reason stays in Stagioni > Elo di partenza. When Lichess does
// not answer, nothing is saved and it is tried again the next time the organizer area opens.
export function useEloSeeds({
  enabled,
  config,
  history,
  gameStates,
  seasons,
  onUpdateTournamentMeta,
  flash,
  nameOf,
}: {
  enabled: boolean;
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  seasons: SeasonArchive[];
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  flash: Flash;
  nameOf: (handle: string) => string;
}) {
  // The latest values, for when the answers from Lichess arrive
  const latest = useRef({ config, onUpdateTournamentMeta, flash });
  latest.current = { config, onUpdateTournamentMeta, flash };
  const running = useRef(false);

  const handles = config.players.map((p) => p.handle);
  const seeds = config.tournament?.seeds;
  // The first season of the tournament has no regulars to set a scale from
  const report = seasons.length > 0 ? tournamentElo(seasons, handles, history, gameStates, seeds) : null;
  const season = report ? currentSeason(report) : null;
  const toFix = season ? seedsToFix(season.firstSeason, seeds, firstGames(history, gameStates, handles)) : [];
  const key = toFix.map((t) => `${t.handle}@${t.date}`).join(',');

  useEffect(() => {
    if (!enabled || !season || toFix.length === 0 || running.current) return;
    running.current = true;
    const regulars = new Map([...season.start].filter(([h]) => !season.firstSeason.has(h)));
    const needed = [...new Set([...regulars.keys(), ...toFix.map((t) => t.handle)])];
    (async () => {
      const histories = new Map<string, unknown>();
      for (const h of needed) histories.set(h, await fetchRatingHistory(h));
      const { config: now, onUpdateTournamentMeta: save, flash: say } = latest.current;
      const same = (a: EloSeed, b: EloSeed) => a.handle.toLowerCase() === b.handle.toLowerCase();
      // A retry that finds the same as last time (no rating, same reason) is not saved again nor told
      const fresh: EloSeed[] = toFix
        .map((t) => computeSeed(t.handle, t.date, regulars, histories))
        .filter((seed) => {
          const before = (now.tournament?.seeds ?? []).find((s) => same(s, seed));
          return !before || seed.rating !== null || seed.reason !== before.reason;
        });
      if (fresh.length === 0) return;
      const kept = (now.tournament?.seeds ?? []).filter((s) => !fresh.some((f) => same(f, s)));
      save({ seeds: [...kept, ...fresh] });
      const anyRating = fresh.some((s) => s.rating !== null);
      say(
        anyRating ? 'ok' : 'warning',
        anyRating ? 'Elo di partenza fissati per chi gioca la prima stagione.' : 'Elo di partenza: nessun nuovo Elo fissato.',
        fresh.map((s) =>
          s.rating === null
            ? `${nameOf(s.handle)} resta esordiente: ${s.reason}`
            : `${nameOf(s.handle)}: ${s.rating} (Lichess ${SEED_PERF_LABEL[s.perf!]} ${s.lichess} al ${s.date}, correzione ${s.offset! >= 0 ? '+' : '−'}${Math.abs(s.offset!)})`
        )
      );
    })()
      .catch((e) => {
        // Only retries pending: nothing new is waiting, no need to say it
        if (toFix.some((t) => !t.retry)) {
          latest.current.flash('warning', 'Elo di partenza non fissati, Lichess non risponde: si riprova alla prossima apertura. ' + errorMessage(e));
        }
      })
      .finally(() => {
        running.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
}
