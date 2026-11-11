import React, { useEffect, useState } from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { AllTimeHeadToHead, allTimeHeadToHead, allTimeNameOf, archivedName, careerOf, seasonsWithGames } from '../lib/allTime';
import { computeStandings } from '../lib/standings';
import { archivedGames, seasonDepartures } from '../lib/seasons';
import { NameOf } from '../lib/roster';
import { CareerSection, AllTimeHeadToHeadSection } from '../components/CareerSections';
import { computePlayerProfile, EndReason, formatPace, GameOutcome } from '../lib/playerProfile';
import { playerHref, publicViewHref } from '../lib/routes';
import { flairFromGames, flairUrl } from '../lib/flair';
import { InfoTip } from '../components/InfoTip';
import { fullPodium, Medal, MEDAL_EMOJI, medalsOf, PlayerMedal, reigningChampions, shortSeason } from '../lib/honours';
import { PointsChart } from '../components/PointsChart';
import { useMe } from '../hooks/useMe';
import { PresenceMeta } from '../components/PresenceDot';
import { PresenceInfo, profileFlairOf, seenAtOf } from '../lib/presence';
import { boardCalendar, CURRENT, currentSeason as eloSeasonNow, EloReport, isNewcomer, peakOf, pronosticoPoints, ratingOf, tournamentElo } from '../lib/tournamentElo';
import { bestUpset, upsetSentence } from '../lib/upset';
import { withScheduledGames } from '../lib/publicGames';
import { Trend, TrendKind } from '../components/Trend';
import { pillsburyRace, pillsburyWins, raceCalendar } from '../lib/pillsbury';
import { PillsburyIcon } from '../components/PillsburyIcon';
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
// the crown of the reigning champion first, then a medal per podium, newest first. What each
// one is opens with a tap (or on hover). With many medals, one per kind with its count. Nothing for
// a player without any.
function TrophyShelf({ medals, champion, title, pillsbury = [] }: { medals: PlayerMedal[]; champion?: string; title?: string; pillsbury?: string[] }) {
  if (medals.length === 0 && !champion && pillsbury.length === 0) return null;
  const newestFirst = [...medals].reverse();
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
  return (
    <ul className="trophy-shelf" aria-label="Trofei">
      {champion && trophy("crown", "👑", `Campione in carica · ${champion}`, "is-crown")}
      {pillsbury.length > 0 &&
        trophy("pillsbury", <PillsburyIcon />, `Trofeo Pillsbury · ${[...pillsbury].reverse().join(", ")}`, "is-pillsbury", pillsbury.length > 1 ? pillsbury.length : undefined)}
      {grouped
        ? ([1, 2, 3] as Medal[])
            .filter((m) => seasonsOf(m).length > 0)
            .map((m) => trophy(m, MEDAL_EMOJI[m], `${PLACE_LABEL[m]} · ${seasonsOf(m).join(", ")}`, `place-${m}`, seasonsOf(m).length))
        : newestFirst.map((m, i) => trophy(i, MEDAL_EMOJI[m.place], `${PLACE_LABEL[m.place]} · ${m.season}`, `place-${m.place}`))}
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
function EverLine({ ever }: { ever: AllTimeHeadToHead }) {
  return (
    <span className="h2h-ever">
      Di sempre: {ever.won} V · {ever.drawn} N · {ever.lost} P, {fmt(ever.scored)} – {fmt(ever.conceded)}
    </span>
  );
}

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
  // «Io sono…»: the visitor can say this is them (saved in the browser, see lib/me.ts)
  const [me, setMe] = useMe();

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
            <TrophyShelf medals={medalsOf(pastName.handle, winners)} title={config.tournament?.title} pillsbury={pillsburyWins(pastName.handle, seasons)} />
          </div>
          <p className="note">Non partecipa alla stagione in corso.</p>
        </section>
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
  const race = pillsburyRace(config.players, elo, seasonCalendar, history, gameStates, config.tournament?.withdrawals);
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
            {me.toLowerCase() === player.handle.toLowerCase() ? (
              <p className="me-toggle note-sm">
                ⭐ Sei tu: la tua riga è evidenziata in classifica.{" "}
                <button type="button" className="link-button" onClick={() => setMe("")}>Non sono io</button>
              </p>
            ) : (
              <button type="button" className="chip-link me-toggle" onClick={() => setMe(player.handle)}>
                ⭐ Sono io
              </button>
            )}
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
            <TrophyShelf medals={medals} champion={isChampion ? champions!.season : undefined} title={config.tournament?.title} pillsbury={pillsburyWins(player.handle, seasons)} />
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
        <h2 className="section-heading">Scontri diretti</h2>
        <ul className="h2h-list">
          {headToHead.map((h) => (
            <li key={h.opponent} className="h2h-row">
              <a href={playerHref(h.opponent)} className="h2h-name">{nameOf(h.opponent)}</a>
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
              <span className="h2h-score" aria-label={`Punteggio ${fmt(h.scored)} a ${fmt(h.conceded)}`}>
                {h.scored + h.conceded > 0 ? `${fmt(h.scored)} – ${fmt(h.conceded)}` : "–"}
              </span>
              {(() => {
                const ever = everOf(h.opponent);
                // Only when the past seasons add something to this season's games
                if (!ever || ever.seasons < 2 && ever.won + ever.drawn + ever.lost <= h.outcomes.length) return null;
                return <EverLine ever={ever} />;
              })()}
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
                  <span className="h2h-games">
                    <span className="status-badge win">{h.won} V</span>
                    <span className="status-badge draw">{h.drawn} N</span>
                    <span className="status-badge loss">{h.lost} P</span>
                  </span>
                  <span className="h2h-score">{fmt(h.scored)} – {fmt(h.conceded)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {pastGames && since && <p className="note note-sm">Gli scontri di sempre partono dalle partite registrate da {since}.</p>}
      </section>

      {acrossSeasons(false)}

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
