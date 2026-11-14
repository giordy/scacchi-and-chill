import React, { useEffect, useState } from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { allTimeHeadToHead, allTimeNameOf, archivedName, careerOf, seasonsWithGames } from '../lib/allTime';
import { computeStandings } from '../lib/standings';
import { archivedGames, seasonDepartures } from '../lib/seasons';
import { NameOf } from '../lib/roster';
import { CareerSection, AllTimeHeadToHeadSection, recordWords } from '../components/CareerSections';
import { computePlayerProfile, EndReason, formatPace, GameOutcome } from '../lib/playerProfile';
import { playerHref, publicViewHref } from '../lib/routes';
import { flairFromGames, flairUrl } from '../lib/flair';
import { InfoTip } from '../components/InfoTip';
import { fullPodium, Medal, MEDAL_EMOJI, medalsOf, PlayerMedal, reigningChampions, shortSeason } from '../lib/honours';
import { PointsChart } from '../components/PointsChart';
import { WrappedCard } from '../components/WrappedCard';
import { seasonWrapped } from '../lib/wrapped';
import { seasonEloPath } from '../lib/eloPath';
import { computeSeasonProgress } from '../lib/progress';
import { computeSeasonAwards, shownAwards } from '../lib/awards';
import { PresenceMeta } from '../components/PresenceDot';
import { PresenceInfo, profileFlairOf, seenAtOf } from '../lib/presence';
import { boardCalendar, CURRENT, currentSeason as eloSeasonNow, EloReport, isNewcomer, peakOf, pronosticoPoints, ratingOf, tournamentElo } from '../lib/tournamentElo';
import { bestUpset, upsetSentence } from '../lib/upset';
import { withScheduledGames } from '../lib/publicGames';
import { Trend, TrendKind } from '../components/Trend';
import { finalPillsburyRace, pillsburyRace, pillsburyStandings, pillsburyWins, raceCalendar } from '../lib/pillsbury';
import { PillsburyIcon } from '../components/PillsburyIcon';
import { ScudettoIcon } from '../components/ScudettoIcon';
import { scudettoOf } from '../lib/scudetto';
import { SEED_PERF_LABEL, seedDayLabel } from '../lib/seeds';

interface PlayerPageProps {
  handle: string;
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  nameOf: NameOf;
  presence?: PresenceInfo; // when each player was last on Lichess
  seasons?: SeasonArchive[]; // archived seasons, for the career and the all-time head-to-heads
}

const OUTCOME_LABEL: Record<GameOutcome, string> = {
  win: "Vittoria",
  loss: "Sconfitta",
  draw: "Patta",
  ongoing: "In corso",
  pending: "In attesa",
};

const OUTCOME_CLASS: Record<GameOutcome, string> = {
  win: "win",
  loss: "loss",
  draw: "draw",
  ongoing: "ongoing",
  pending: "pending",
};

const END_LABEL: Record<EndReason, string> = {
  mate: "con il matto",
  resign: "per abbandono",
  timeout: "per tempo scaduto",
  other: "in altro modo",
};
const END_ORDER: EndReason[] = ["mate", "resign", "timeout", "other"];

// "2 con il matto · 1 per abbandono"
const describeEndings = (counts: Record<EndReason, number>) =>
  END_ORDER.filter((r) => counts[r] > 0)
    .map((r) => `${counts[r]} ${END_LABEL[r]}`)
    .join(" · ");

// Bare icons are narrow: beyond this many trophies the shelf groups the medals by kind
const SHELF_MAX = 8;

const PLACE_LABEL: Record<Medal, string> = { 1: "Campione", 2: "2° posto", 3: "3° posto" };

// Trophy shelf next to the player's name, in the style of Lichess profiles: bare icons in a row,
// the crown of the reigning champion first, then a scudetto per season won (the shield of its master,
// see lib/scudetto.ts) and a medal per other podium, newest first. What each one is opens with a tap
// (or on hover). With many trophies, the medals go one per kind with their count; the scudetti stay
// one by one, as each is different. Nothing for a player without any.
function TrophyShelf({ medals, champion, title, pillsbury = [], seasons }: { medals: PlayerMedal[]; champion?: string; title?: string; pillsbury?: string[]; seasons?: SeasonArchive[] }) {
  if (medals.length === 0 && !champion && pillsbury.length === 0) return null;
  const newestFirst = [...medals].reverse();
  const scudetti = newestFirst.filter((m) => m.place === 1);
  const grouped = medals.length + (champion ? 1 : 0) > SHELF_MAX;
  const seasonsOf = (m: Medal) => newestFirst.filter((x) => x.place === m).map((x) => shortSeason(x.season, title));
  const trophy = (key: string | number, icon: React.ReactNode, text: string, className = "", count?: number) => (
    <li key={key}>
      <InfoTip className={`trophy ${className}`} text={text}>
        <span className="trophy-icon" aria-hidden="true">{icon}</span>
        {count !== undefined && <span className="trophy-count" aria-hidden="true">×{count}</span>}
        <span className="sr-only">{text}</span>
      </InfoTip>
    </li>
  );
  const scudetto = (m: PlayerMedal, key: string | number) => {
    const s = scudettoOf(m.season, seasons);
    return trophy(key, <ScudettoIcon scudetto={s} />, `${s.title} · ${m.season}`, "is-scudetto");
  };
  return (
    <ul className="trophy-shelf" aria-label="Trofei">
      {champion && trophy("crown", "👑", `Campione in carica · ${champion}`, "is-crown")}
      {pillsbury.length > 0 &&
        trophy("pillsbury", <PillsburyIcon />, `Trofeo Pillsbury · ${[...pillsbury].reverse().join(", ")}`, "is-pillsbury", pillsbury.length > 1 ? pillsbury.length : undefined)}
      {grouped
        ? [
            ...scudetti.map((m) => scudetto(m, `scudetto-${m.season}`)),
            ...([2, 3] as Medal[])
              .filter((m) => seasonsOf(m).length > 0)
              .map((m) => trophy(m, MEDAL_EMOJI[m], `${PLACE_LABEL[m]} · ${seasonsOf(m).join(", ")}`, `place-${m}`, seasonsOf(m).length)),
          ]
        : newestFirst.map((m, i) =>
            m.place === 1 ? scudetto(m, i) : trophy(i, MEDAL_EMOJI[m.place], `${PLACE_LABEL[m.place]} · ${m.season}`, `place-${m.place}`)
          )}
    </ul>
  );
}

// Two career highs, good news only, under the summary of the Carriera: the highest Elo del torneo
// reached and the best colpaccio. Nothing when there is neither (in a player's first season, or
// without any colpaccio).
function CareerHighs({ handle, elo, seasonName, nameOf, title }: {
  handle: string;
  elo: EloReport;
  seasonName: (key: string) => string;
  nameOf: (handle: string) => string;
  title?: string;
}) {
  const peak = peakOf(elo, handle);
  const upset = bestUpset(elo, handle);
  if (!peak && !upset) return null;
  const now = ratingOf(elo, handle);
  const season = (key: string) => shortSeason(seasonName(key), title);
  return (
    <ul className="career-highs">
      {peak && (
        <li>
          <InfoTip className="career-high-label" text="Il suo Elo del torneo più alto di sempre, da quando il suo livello è noto (dalla fine della sua prima stagione).">
            Elo massimo <span className="infotip-mark" aria-hidden="true">ⓘ</span>
          </InfoTip>{" "}
          <strong>{peak.rating}</strong> <span className="career-high-when">({peak.season === CURRENT && peak.rating === now ? "adesso" : season(peak.season)})</span>
        </li>
      )}
      {upset && (
        <li>
          <InfoTip className="career-high-label" text={`Il suo colpaccio più grosso: ${upsetSentence(upset.upset, nameOf(handle))}.`}>
            Colpaccio migliore <span className="infotip-mark" aria-hidden="true">ⓘ</span>
          </InfoTip>{" "}
          <strong>
            {upset.upset.kind === "win" ? "vs " : "½ vs "}
            <a href={playerHref(upset.opponent)}>{nameOf(upset.opponent)}</a>
          </strong>{" "}
          <span className="career-high-when">
            (
            {upset.game.id ? (
              <a href={`https://lichess.org/${upset.game.id}`} target="_blank" rel="noopener noreferrer">{season(upset.season)}</a>
            ) : (
              season(upset.season)
            )}
            )
          </span>
        </li>
      )}
    </ul>
  );
}

// The player's Lichess flair after their username, as Lichess shows it. From the games when they
// played one, otherwise from their Lichess profile (read with the others' by usePresence); nothing
// when they have none or the image does not load.
const fmt = (n: number) => String(n).replace(".5", "½").replace(/^0½/, "½");

// Under a head-to-head of the season: the record across every season
function Flair({ flair }: { flair?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [flair]);
  if (!flair || broken) return null;
  return (
    <img
      className="player-flair"
      src={flairUrl(flair)}
      alt=""
      title={`Flair su Lichess: ${flair.split('.').pop()?.replace(/-/g, ' ')}`}
      onError={() => setBroken(true)}
    />
  );
}

// Public page of a single player: results, games and opponents still to face
export function PlayerPage({ handle, config, history, gameStates, nameOf, presence, seasons = [] }: PlayerPageProps) {
  const profile = computePlayerProfile(handle, config.players, history, gameStates, config.schedule ?? []);
  // The season chosen for «La stagione in breve», on this player's page
  const [wrappedPick, setWrappedPick] = useState<{ handle: string; season: string } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [handle]);

  // A former player, not in the current season: found in the hall of fame or in an archived table
  const winners = config.tournament?.winners;
  const podiumEntry = profile
    ? undefined
    : (winners ?? []).flatMap(fullPodium).find((p) => p.handle.toLowerCase() === handle.toLowerCase());
  const pastRow = profile ? undefined : seasons.flatMap((x) => x.standings).find((r) => r.handle.toLowerCase() === handle.toLowerCase());
  // Or who left a season and was replaced: not in its table, still with their own games
  const pastDeparture = profile || pastRow ? undefined : seasons.flatMap((x) => x.departures ?? []).find((d) => d.replacedBy && d.handle.toLowerCase() === handle.toLowerCase());
  const pastName =
    podiumEntry ??
    (pastRow && { handle: pastRow.handle, name: archivedName(handle, seasons) ?? pastRow.name }) ??
    (pastDeparture && { handle: pastDeparture.handle, name: pastDeparture.name });
  const shownName = profile?.player.name ?? (pastName && nameOf(pastName.handle, pastName.name));

  // Across seasons: the career needs an archived season, the all-time head-to-heads archived games
  const currentSeason = config.tournament?.season ?? "";
  const departures = seasonDepartures(config.tournament?.withdrawals, config.players, history, gameStates);
  const career = careerOf(handle, seasons, {
    season: currentSeason,
    standings: computeStandings(config.players, history, gameStates).standings,
    departures,
    games: archivedGames(history, gameStates),
  });
  const showCareer = career.some((c) => !c.current);
  const withGames = seasonsWithGames(seasons, { season: currentSeason, history, gameStates, departures });
  const allTimeRows = allTimeHeadToHead(handle, withGames);
  const pastGames = withGames.some((s) => !s.current && s.games.some((g) => [g.white, g.black].some((h) => h.toLowerCase() === handle.toLowerCase())));
  const archivedWithGames = withGames.filter((s) => !s.current);
  const since = archivedWithGames.length < seasons.length ? archivedWithGames[0]?.season : undefined;
  const longNameOf = allTimeNameOf(nameOf, seasons);
  // Elo del torneo (see lib/tournamentElo), for the career highs and, in the season, the Elo badge
  const elo = tournamentElo(seasons, config.players.map((p) => p.handle), history, gameStates, config.tournament?.seeds);
  const seasonName = (key: string) => (key === CURRENT ? currentSeason : seasons.find((x) => x.id === key)?.season ?? key);
  const shownHandle = profile?.player.handle ?? pastName?.handle ?? handle;
  // A player in their first season with a Lichess seed can already have a colpaccio: the Carriera
  // is then shown for it, with only the season in progress
  const hasHighs = !!peakOf(elo, shownHandle) || !!bestUpset(elo, shownHandle);
  const highs = <CareerHighs handle={shownHandle} elo={elo} seasonName={seasonName} nameOf={longNameOf} title={config.tournament?.title} />;
  // For who plays the season the all-time record goes in the season's head-to-heads (one list)
  const acrossSeasons = (withAllTime: boolean) => (
    <>
      {(showCareer || hasHighs) && <CareerSection career={career} highs={highs} />}
      {withAllTime && pastGames && allTimeRows.length > 0 && <AllTimeHeadToHeadSection rows={allTimeRows} nameOf={longNameOf} since={since} />}
    </>
  );
  // «La stagione in breve», of any season the player played: the archived ones (with their games),
  // and the current one once its last game is over. Shown first: the current season once over, and
  // otherwise the latest archived one; the others are chosen above the card
  const plays = (g: { white: string; black: string }) => [g.white, g.black].some((h) => h.toLowerCase() === shownHandle.toLowerCase());
  const progress = computeSeasonProgress(history, gameStates, config.schedule ?? []);
  const currentOver = progress.total > 0 && progress.finished === progress.total;
  const wrappable = withGames.filter((x) => (!x.current || currentOver) && x.games.some(plays));
  const chosenWrapped = wrappedPick?.handle === handle ? wrappable.find((x) => x.season === wrappedPick.season) : undefined;
  const wrappedOf = chosenWrapped ?? wrappable[wrappable.length - 1];
  // While the player is in a season still going, the card goes down by the Carriera: the top of the
  // page is for the season being played
  const wrappedBelow = !!profile && !currentOver;
  const wrappedArchive = wrappedOf && !wrappedOf.current ? seasons.find((x) => x.season === wrappedOf.season) : undefined;
  const wrapped = wrappedOf ? seasonWrapped(shownHandle, wrappedOf.games, elo, wrappedOf.current ? CURRENT : wrappedArchive?.id) : null;
  const wrappedAwards = !wrapped
    ? []
    : shownAwards(
        wrappedOf!.current
          ? computeSeasonAwards(config.players, history, gameStates, seasons, config.tournament?.seeds, config.tournament?.withdrawals, { name: config.tournament?.masterName, opening: config.tournament?.masterOpening }, config.tournament?.fairPlayAwardsBan)
          : wrappedArchive?.awards ?? []
      ).filter((a) => a.winners.some((w) => w.handle.toLowerCase() === shownHandle.toLowerCase()));
  // The final race for the Trofeo Pillsbury: as the archive kept it, or for the current season once
  // over as the awards compute it (the archive will keep the same)
  const pillsburyFinal = !wrapped
    ? undefined
    : wrappedOf!.current
    ? pillsburyStandings(finalPillsburyRace(config.players, history, gameStates, seasons, config.tournament?.seeds, config.tournament?.withdrawals, config.tournament?.fairPlayAwardsBan))
    : wrappedArchive?.pillsbury;
  const pillsburyMine = pillsburyFinal?.find((r) => r.handle.toLowerCase() === shownHandle.toLowerCase());
  const eloKey = wrappedOf?.current ? CURRENT : wrappedArchive?.id;
  const eloPath = wrapped && eloKey ? seasonEloPath(elo, shownHandle, eloKey) : null;
  const wrappedCard = wrapped && wrappedOf && (
    <WrappedCard
      season={wrappedOf.season}
      wrapped={wrapped}
      career={career.find((c) => c.season === wrappedOf.season)}
      awards={wrappedAwards}
      pillsbury={pillsburyMine && pillsburyFinal ? { mine: pillsburyMine, race: pillsburyFinal } : undefined}
      eloPath={eloPath}
      nameOf={longNameOf}
      seasons={wrappable.map((x) => x.season)}
      onPick={(season) => setWrappedPick({ handle, season })}
      label={(season) => shortSeason(season, config.tournament?.title)}
    />
  );
  const everOf = (opponent: string) => (pastGames ? allTimeRows.find((r) => r.opponent.toLowerCase() === opponent.toLowerCase()) : undefined);


  useEffect(() => {
    const previous = document.title;
    if (shownName) document.title = `${shownName} – ${config.tournament?.title ?? "Scacchi and Chill"}`;
    return () => {
      document.title = previous;
    };
  }, [shownName, config.tournament?.title]);

  if (!profile && pastName) {
    return (
      <main className="public-main">
        <a href="#" className="chip-link back-link">← Torna al torneo</a>
        <section className="dossier-card player-hero">
          <div className="player-hero-top">
            <div>
              <h1 className="hero-title">{shownName}</h1>
              <a className="player-link" href={`https://lichess.org/@/${pastName.handle}`} target="_blank" rel="noopener noreferrer">
                @{pastName.handle} su Lichess
              </a>
            </div>
            <TrophyShelf medals={medalsOf(pastName.handle, winners)} title={config.tournament?.title} pillsbury={pillsburyWins(pastName.handle, seasons)} seasons={seasons} />
          </div>
          <p className="note">Non partecipa alla stagione in corso.</p>
        </section>
        {wrappedCard}
        {acrossSeasons(true)}
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="public-main">
        <a href="#" className="chip-link back-link">← Torna al torneo</a>
        <p className="note">Giocatore «{handle}» non trovato.</p>
      </main>
    );
  }

  const { player, rank, tied, standing, games, pointsByRound, headToHead, pace, byColor, endings } = profile;
  // Opponents met only in past seasons: under this season's
  const pastOnly = pastGames ? allTimeRows.filter((r) => !headToHead.some((h) => h.opponent.toLowerCase() === r.opponent.toLowerCase())) : [];
  const sum = (counts: Record<EndReason, number>) => END_ORDER.reduce((n, r) => n + counts[r], 0);
  const wins = sum(endings.wins);
  const losses = sum(endings.losses);
  const champions = reigningChampions(winners);
  const isChampion = !!champions?.handles.includes(player.handle.toLowerCase());
  const medals = medalsOf(player.handle, winners);
  // Elo del torneo: now, and how much it moved in this season
  const eloNow = ratingOf(elo, player.handle);
  const eloSeason = eloSeasonNow(elo);
  const newcomer = isNewcomer(eloSeason, player.handle);
  // First season with a Lichess seed: where it started, said next to the Elo (see lib/seeds.ts)
  const seed = eloSeason.firstSeason.has(player.handle.toLowerCase())
    ? config.tournament?.seeds?.find((s) => s.handle.toLowerCase() === player.handle.toLowerCase() && s.rating !== null)
    : undefined;
  const eloStart = eloSeason.start.get(player.handle.toLowerCase());
  const eloMove = eloNow !== undefined && eloStart !== undefined ? eloNow - Math.round(eloStart) : 0;
  // Pronostico: points expected in the season from the Elo del torneo at its start, as the race of the
  // Trofeo Pillsbury has it (the same games, the same players: who left is not in it)
  const seasonCalendar = raceCalendar(withScheduledGames(history, config.schedule ?? []), gameStates);
  const race = pillsburyRace(config.players, elo, seasonCalendar, history, gameStates, config.tournament?.withdrawals, config.tournament?.fairPlayAwardsBan);
  const forecast = race.forecasts[player.handle];
  // All the player's games of the season, those against esordienti included: "10 delle 14"
  const calendar = boardCalendar(seasonCalendar, gameStates, config.players.map((p) => p.handle));
  const seasonGames = calendar.filter((g) => [g.white, g.black].some((h) => h.toLowerCase() === player.handle.toLowerCase())).length;
  const countedOf = forecast && forecast.games < seasonGames ? `${forecast.games} delle ${seasonGames}` : String(forecast?.games ?? 0);
  const pronostico = forecast ? pronosticoPoints(forecast) : 0;
  // The objective is the Trofeo Pillsbury's: none when the award is suspended (too few in the race)
  const pillsburySuspended = race.suspended;
  const eloTrend: TrendKind = eloMove > 0 ? "up" : eloMove < 0 ? "down" : "same";

  return (
    <main className="public-main">
      <a href="#" className="chip-link back-link">← Torna al torneo</a>

      <section className="dossier-card player-hero">
        <div className="player-hero-top">
          <div>
            <h1 className="hero-title">{player.name}</h1>
            <p className="player-meta">
              <a
                className="player-link"
                href={`https://lichess.org/@/${player.handle}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{player.handle}
                <Flair flair={flairFromGames(player.handle, history, gameStates) ?? profileFlairOf(presence, player.handle)} /> su Lichess
              </a>
              {presence && <PresenceMeta seenAt={seenAtOf(presence, player.handle)} now={presence.now} />}
            </p>
          </div>
          {/* Right side: the Elo above the trophies (on a phone the Elo goes to the corner, see CSS) */}
          <div className="player-hero-side">
            {eloNow !== undefined && (
            <div className="player-elo-corner">
              <InfoTip
                className="player-elo-badge"
                text={
                  "Elo del torneo, calcolato solo dalle nostre partite." +
                  (seed
                    ? ` Al primo anno: parte da ${seed.rating}, il suo Elo Lichess ${SEED_PERF_LABEL[seed.perf!]} del ${seedDayLabel(seed.date)} (${seed.lichess}) riportato sulla scala del torneo.`
                    : "") +
                  (newcomer
                    ? " Esordiente: nelle sue partite si muove solo il suo Elo."
                    : eloMove === 0
                    ? " Come a inizio stagione."
                    : ` ${eloMove > 0 ? "+" : "−"}${Math.abs(eloMove)} da inizio stagione.`)
                }
              >
                <span className="player-elo-label">Elo</span>
                <span className="player-elo-val">{eloNow}</span>
                {!newcomer && <Trend kind={eloTrend} label={eloMove === 0 ? "come a inizio stagione" : `${eloMove > 0 ? "+" : "−"}${Math.abs(eloMove)} da inizio stagione`} />}
              </InfoTip>
            </div>
            )}
            <TrophyShelf medals={medals} champion={isChampion ? champions!.season : undefined} title={config.tournament?.title} pillsbury={pillsburyWins(player.handle, seasons)} seasons={seasons} />
          </div>
        </div>

        <div className="stat-pills">
          <div className="stat-pill">
            <span className="stat-pill-label">Posizione</span>
            <span className="stat-pill-val accent">{rank === null ? "–" : `${rank}° / ${config.players.length}`}</span>
            {tied && <span className="stat-pill-note">pari merito</span>}
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Punti</span>
            <span className="stat-pill-val">{standing.points}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">V / N / P</span>
            <span className="stat-pill-val">{standing.won} / {standing.drawn} / {standing.lost}</span>
          </div>
        </div>
        {/* The season beyond the standings: colours, time per move */}
        {(byColor.white.played + byColor.black.played > 0 || pace) && (
        <div className="stat-pills stat-pills-minor">
          {byColor.white.played + byColor.black.played > 0 && (
            <div className="stat-pill">
              <span className="stat-pill-label">Colori</span>
              <span className="stat-pill-val stat-pill-colors">
                {(["white", "black"] as const).map((c) => (
                  <span key={c}>
                    <span className={`dot ${c === "white" ? "w" : "b"}`} aria-label={c === "white" ? "Col bianco" : "Col nero"} />
                    {byColor[c].played > 0 ? `${fmt(byColor[c].points)}/${byColor[c].played}` : "–"}
                  </span>
                ))}
              </span>
            </div>
          )}
          {pace && (
            <div className="stat-pill">
              <span className="stat-pill-label">Tempo a mossa</span>
              <InfoTip
                className="stat-pill-val"
                text={`Stima del tempo che impiega per ogni sua mossa, separato da quello degli avversari, dalle partite concluse della stagione (${pace.games} sue).`}
              >
                circa {formatPace(pace.msPerMove)} <span className="infotip-mark" aria-hidden="true">ⓘ</span>
              </InfoTip>
            </div>
          )}
        </div>
        )}
        {/* The objective is not a statistic: it is the player's mark for the Trofeo Pillsbury, in a band of
            its own with the trophy's medal and brass, as compact as the pills. Last in the card, after all the
            statistics (the championship's first, as on the home page). It leads to the race, where how it is
            going and what the trophy rewards are told */}
        {forecast && forecast.games > 0 && !pillsburySuspended && (
          <a href={publicViewHref("pillsbury")} className="pillsbury-goal">
            <PillsburyIcon size="1.6em" />
            <span className="pillsbury-goal-text">
              <span className="pillsbury-goal-label">Obiettivo per il Trofeo Pillsbury</span>
              <span className="pillsbury-goal-val">
                {fmt(pronostico)} {pronostico === 1 ? "punto" : "punti"} <small>su {countedOf} partite</small>
              </span>
            </span>
            <span className="pillsbury-goal-go" aria-hidden="true">›</span>
          </a>
        )}
      </section>

      {!wrappedBelow && wrappedCard}

      {pointsByRound.length > 0 && (
        <section className="dossier-card">
          <h2 className="section-heading">Andamento</h2>
          <PointsChart data={pointsByRound} nameOf={nameOf} />
        </section>
      )}

      {wins + losses + endings.draws > 0 && (
        <section className="dossier-card">
          <h2 className="section-heading">Come finiscono le sue partite</h2>
          <ul className="endings-list">
            {wins > 0 && (
              <li>
                <span className="endings-label">Vittorie ({wins})</span>
                <span>{describeEndings(endings.wins)}</span>
              </li>
            )}
            {losses > 0 && (
              <li>
                <span className="endings-label">Sconfitte ({losses})</span>
                <span>{describeEndings(endings.losses)}</span>
              </li>
            )}
            {endings.draws > 0 && (
              <li>
                <span className="endings-label">Patte ({endings.draws})</span>
              </li>
            )}
          </ul>
        </section>
      )}

      <section className="dossier-card">
        <h2 className="section-heading">
          Scontri diretti
          {headToHead.some((h) => h.upcoming.some((u) => u.color)) && (
            <InfoTip className="heading-tip" text="Nelle partite ancora da giocare il pallino dice con che colore giocherà: bianco o nero.">
              <span className="infotip-mark" aria-hidden="true">ⓘ</span>
              <span className="sr-only">Cosa indicano i pallini</span>
            </InfoTip>
          )}
        </h2>
        <ul className="h2h-list">
          {headToHead.map((h) => (
            <li key={h.opponent} className="h2h-row">
              <span className="h2h-who">
                <a href={playerHref(h.opponent)} className="h2h-name">{nameOf(h.opponent)}</a>
                {(() => {
                  const ever = everOf(h.opponent);
                  // Only when the past seasons add something to this season's games
                  if (!ever || ever.seasons < 2 && ever.won + ever.drawn + ever.lost <= h.outcomes.length) return null;
                  return <span className="h2h-ever">Di sempre <b>{fmt(ever.scored)}–{fmt(ever.conceded)}</b> · {recordWords(ever)}</span>;
                })()}
              </span>
              <span className="h2h-games">
                {h.outcomes.map((o, i) => (
                  <span key={i} className={`status-badge ${OUTCOME_CLASS[o]}`}>{OUTCOME_LABEL[o]}</span>
                ))}
                {h.upcoming.map((u, i) => (
                  <span key={`u${i}`} className="status-badge pending h2h-upcoming">
                    {u.color && (
                      <span className={`dot ${u.color === "white" ? "w" : "b"}`} aria-label={u.color === "white" ? "Col bianco" : "Col nero"} />
                    )}
                    {u.round ? `Turno ${u.round}` : "Da programmare"}
                  </span>
                ))}
                {h.outcomes.length === 0 && h.upcoming.length === 0 && (
                  <span className="status-badge pending">Da programmare</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {pastOnly.length > 0 && (
          <>
            <h3 className="h2h-subheading">Nelle stagioni passate</h3>
            <ul className="h2h-list">
              {pastOnly.map((h) => (
                <li key={h.opponent} className="h2h-row">
                  <a href={playerHref(h.opponent)} className="h2h-name">{longNameOf(h.opponent)}</a>
                  <span className="h2h-past-record">{recordWords(h)} <b>{fmt(h.scored)}–{fmt(h.conceded)}</b></span>
                </li>
              ))}
            </ul>
          </>
        )}
        {pastGames && since && <p className="note note-sm">Gli scontri di sempre partono dalle partite registrate da {since}.</p>}
      </section>

      {acrossSeasons(false)}

      {wrappedBelow && wrappedCard}

      <section className="dossier-card">
        <h2 className="section-heading">Partite ({games.length})</h2>
        {games.length === 0 ? (
          <p className="note m-0">Nessuna partita ancora registrata.</p>
        ) : (
          <ul className="player-games">
            {/* Newest round first: the latest games, the ongoing ones, on top */}
            {[...games].reverse().map((game) => (
              <li key={game.url} className="player-game">
                <span className="match-round">Turno {game.round}</span>
                <span className="player-game-main">
                  <span className="player-game-opp">
                    <span className={`dot ${game.color === "white" ? "w" : "b"}`} aria-label={game.color === "white" ? "Bianco" : "Nero"} />
                    <a href={playerHref(game.opponent)}>{nameOf(game.opponent)}</a>
                  </span>
                  {game.opening && (
                    <span className="opening-label" title={game.opening}>{game.opening}</span>
                  )}
                </span>
                <span className={`status-badge ${OUTCOME_CLASS[game.outcome]}`}>{OUTCOME_LABEL[game.outcome]}</span>
                {game.url ? (
                  <a href={game.url} target="_blank" rel="noopener noreferrer" className="lichess-link-btn">
                    Lichess
                  </a>
                ) : (
                  <span className="opening-label">{game.status === "forfeit" ? "A tavolino" : ""}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
