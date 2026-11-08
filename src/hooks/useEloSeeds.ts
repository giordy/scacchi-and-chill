import { useEffect, useRef } from 'react';
import { AppConfig, EloSeed, HistoryGame, LichessExportGame, SeasonArchive, TournamentMeta } from '../types';
import { currentSeason, tournamentElo } from '../lib/tournamentElo';
import { computeSeed, firstGames, seedsToFix, SEED_PERF_LABEL } from '../lib/seeds';
import { fetchRatingHistory } from '../lib/lichess';
import { errorMessage } from '../lib/utils';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;

// Organizer area: fixes the seed of each player in their first season (see lib/seeds.ts) as soon as
// their first game exists, reading the Lichess rating histories of the season's players. Each seed
// is saved once in the tournament and never computed again. When Lichess does not answer, nothing
// is saved and it is tried again the next time the organizer area opens.
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
      const fresh: EloSeed[] = toFix.map((t) => computeSeed(t.handle, t.date, regulars, histories));
      const { config: now, onUpdateTournamentMeta: save, flash: say } = latest.current;
      const kept = (now.tournament?.seeds ?? []).filter((s) => !fresh.some((f) => f.handle === s.handle));
      save({ seeds: [...kept, ...fresh] });
      say(
        'ok',
        'Elo di partenza fissati per chi gioca la prima stagione.',
        fresh.map((s) =>
          s.rating === null
            ? `${nameOf(s.handle)}: nessun Elo Lichess affidabile, resta esordiente`
            : `${nameOf(s.handle)}: ${s.rating} (Lichess ${SEED_PERF_LABEL[s.perf!]} ${s.lichess} al ${s.date}, correzione ${s.offset! >= 0 ? '+' : '−'}${Math.abs(s.offset!)})`
        )
      );
    })()
      .catch((e) => latest.current.flash('warning', 'Elo di partenza non fissati, Lichess non risponde: si riprova alla prossima apertura. ' + errorMessage(e)))
      .finally(() => {
        running.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
}
