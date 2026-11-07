import React, { useEffect, useState } from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import { allTimeHeadToHead, allTimeNameOf, archivedName, careerOf, seasonsWithGames } from '../lib/allTime';
import { computeStandings } from '../lib/standings';
import { departuresOf } from '../lib/departures';
import { NameOf } from '../lib/roster';
import { CareerSection, AllTimeHeadToHeadSection } from '../components/CareerSections';
import { computePlayerProfile, EndReason, formatPace, GameOutcome } from '../lib/playerProfile';
import { playerHref } from '../lib/routes';
import { flairFromGames, flairUrl } from '../lib/flair';
import { InfoTip } from '../components/InfoTip';
import { fullPodium, Medal, MEDAL_EMOJI, medalsOf, PlayerMedal, reigningChampions, shortSeason } from '../lib/honours';
import { PointsChart } from '../components/PointsChart';
import { PresenceMeta } from '../components/PresenceDot';
import { PresenceInfo, profileFlairOf, seenAtOf } from '../lib/presence';
import { currentSeason as eloSeasonNow, eloSeasonFromCurrent, isNewcomer, pronosticoPoints, ratingOf, seasonForecast, tournamentElo } from '../lib/tournamentElo';
import { withScheduledGames } from '../lib/publicGames';

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

// ▲ = ▼: how something moved, with the words for screen readers
type TrendKind = "up" | "same" | "down";
const TREND_MARK: Record<TrendKind, string> = { up: "▲", same: "=", down: "▼" };
function Trend({ kind, label }: { kind: TrendKind; label: string }) {
  return (
    <span className={`trend trend-${kind}`} role="img" aria-label={label} title={label}>
      {TREND_MARK[kind]}
    </span>
  );
}

// A speedometer: the level the Elo del torneo measures
function GaugeIcon() {
  return (
    <svg className="gauge-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l4-5" />
      <circle cx="12" cy="17" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

const PLACE_LABEL: Record<Medal, string> = { 1: "Campione", 2: "2° posto", 3: "3° posto" };

// Trophy shelf next to the player's name, in the style of Lichess profiles: bare icons in a row,
// the crown of the reigning champion first, then a medal per podium, newest first. What each
// one is opens with a tap (or on hover). With many medals, one per kind with its count. Nothing for
// a player without any.
function TrophyShelf({ medals, champion, title }: { medals: PlayerMedal[]; champion?: string; title?: string }) {
  if (medals.length === 0 && !champion) return null;
  const newestFirst = [...medals].reverse();
  const grouped = medals.length + (champion ? 1 : 0) > SHELF_MAX;
  const seasonsOf = (m: Medal) => newestFirst.filter((x) => x.place === m).map((x) => shortSeason(x.season, title));
  const trophy = (key: string | number, icon: string, text: string, className = "", count?: number) => (
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
      {grouped
        ? ([1, 2, 3] as Medal[])
            .filter((m) => seasonsOf(m).length > 0)
            .map((m) => trophy(m, MEDAL_EMOJI[m], `${PLACE_LABEL[m]} · ${seasonsOf(m).join(", ")}`, `place-${m}`, seasonsOf(m).length))
        : newestFirst.map((m, i) => trophy(i, MEDAL_EMOJI[m.place], `${PLACE_LABEL[m.place]} · ${m.season}`, `place-${m.place}`))}
    </ul>
  );
}

// The player's Lichess flair after their username, as Lichess shows it. From the games when they
// played one, otherwise from their Lichess profile (read with the others' by usePresence); nothing
// when they have none or the image does not load.
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [handle]);

  // A former player, not in the current season: found in the hall of fame or in an archived table
  const winners = config.tournament?.winners;
  const podiumEntry = profile
    ? undefined
    : (winners ?? []).flatMap(fullPodium).find((p) => p.handle.toLowerCase() === handle.toLowerCase());
  const pastRow = profile ? undefined : seasons.flatMap((x) => x.standings).find((r) => r.handle.toLowerCase() === handle.toLowerCase());
  const pastName = podiumEntry ?? (pastRow && { handle: pastRow.handle, name: archivedName(handle, seasons) ?? pastRow.name });
  const shownName = profile?.player.name ?? (pastName && nameOf(pastName.handle, pastName.name));

  // Across seasons: the career needs an archived season, the all-time head-to-heads archived games
  const currentSeason = config.tournament?.season ?? "";
  const career = careerOf(handle, seasons, {
    season: currentSeason,
    standings: computeStandings(config.players, history, gameStates).standings,
    departures: departuresOf(config.tournament?.withdrawals),
  });
  const showCareer = career.some((c) => !c.current);
  const withGames = seasonsWithGames(seasons, { season: currentSeason, history, gameStates });
  const allTimeRows = allTimeHeadToHead(handle, withGames);
  const pastGames = withGames.some((s) => !s.current && s.games.some((g) => [g.white, g.black].some((h) => h.toLowerCase() === handle.toLowerCase())));
  const archivedWithGames = withGames.filter((s) => !s.current);
  const since = archivedWithGames.length < seasons.length ? archivedWithGames[0]?.season : undefined;
  const longNameOf = allTimeNameOf(nameOf, seasons);
  const acrossSeasons = (
    <>
      {showCareer && <CareerSection career={career} />}
      {pastGames && allTimeRows.length > 0 && <AllTimeHeadToHeadSection rows={allTimeRows} nameOf={longNameOf} since={since} />}
    </>
  );

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
            <TrophyShelf medals={medalsOf(pastName.handle, winners)} title={config.tournament?.title} />
          </div>
          <p className="note">Non partecipa alla stagione in corso.</p>
        </section>
        {acrossSeasons}
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
  const sum = (counts: Record<EndReason, number>) => END_ORDER.reduce((n, r) => n + counts[r], 0);
  const wins = sum(endings.wins);
  const losses = sum(endings.losses);
  const fmt = (n: number) => String(n).replace(".5", "½").replace(/^0½/, "½");
  const champions = reigningChampions(winners);
  const isChampion = !!champions?.handles.includes(player.handle.toLowerCase());
  const medals = medalsOf(player.handle, winners);
  // Elo del torneo (see lib/tournamentElo): now, and how much it moved in this season
  const elo = tournamentElo(seasons, config.players.map((p) => p.handle), history, gameStates);
  const eloNow = ratingOf(elo, player.handle);
  const eloSeason = eloSeasonNow(elo);
  const newcomer = isNewcomer(eloSeason, player.handle);
  const eloStart = eloSeason.start.get(player.handle.toLowerCase());
  const eloMove = eloNow !== undefined && eloStart !== undefined ? eloNow - Math.round(eloStart) : 0;
  // Pronostico: points expected in the season from the Elo del torneo at its start
  const forecast = seasonForecast(
    player.handle,
    eloSeason,
    withScheduledGames(history, config.schedule ?? []),
    eloSeasonFromCurrent(config.players.map((p) => p.handle), history, gameStates).games
  );
  const pronostico = forecast ? pronosticoPoints(forecast) : 0;
  // How it is going: at the end against the pronostico, before against the points expected so far
  // (a gap of a few tenths of a point says nothing)
  const over = !forecast ? 0 : forecast.played === forecast.games ? forecast.points - pronostico : forecast.points - forecast.expectedSoFar;
  const forecastTrend: TrendKind = forecast && forecast.played === forecast.games
    ? over > 0 ? "up" : over < 0 ? "down" : "same"
    : over >= 0.5 ? "up" : over <= -0.5 ? "down" : "same";
  const forecastLabel = { up: "sopra il pronostico", same: "in linea col pronostico", down: "sotto il pronostico" }[forecastTrend];
  const eloTrend: TrendKind = eloMove > 0 ? "up" : eloMove < 0 ? "down" : "same";

  return (
    <main className="public-main">
      <a href="#" className="chip-link back-link">← Torna al torneo</a>

      <section className="dossier-card player-hero">
        {eloNow !== undefined && (
          <div className="player-elo-corner">
            <InfoTip
              className="player-elo-badge"
              text={
                `Elo del torneo: ${eloNow}. Calcolato solo dalle partite del torneo, con la formula Elo: tutti partono da 1500, battere un avversario dello stesso livello vale 16 punti.` +
                (newcomer
                  ? " È un esordiente (prima stagione, o di ritorno dopo una pausa): nelle sue partite si muove solo il suo Elo, non quello degli avversari."
                  : eloMove === 0
                  ? " Come a inizio stagione."
                  : ` ${eloMove > 0 ? "+" : "−"}${Math.abs(eloMove)} da inizio stagione.`)
              }
            >
              <GaugeIcon />
              <span className="player-elo-val">{eloNow}</span>
              {!newcomer && <Trend kind={eloTrend} label={eloMove === 0 ? "come a inizio stagione" : `${eloMove > 0 ? "+" : "−"}${Math.abs(eloMove)} da inizio stagione`} />}
              <span className="sr-only">Elo del torneo</span>
            </InfoTip>
          </div>
        )}
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
          <TrophyShelf medals={medals} champion={isChampion ? champions!.season : undefined} title={config.tournament?.title} />
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
          {(["white", "black"] as const).map((c) => (
            <div key={c} className="stat-pill">
              <span className="stat-pill-label">{c === "white" ? "Col bianco" : "Col nero"}</span>
              <span className="stat-pill-val">
                {byColor[c].played > 0 ? `${fmt(byColor[c].points)} / ${byColor[c].played}` : "–"}
              </span>
            </div>
          ))}
          {forecast && forecast.games > 0 && (
            <div className="stat-pill">
              <span className="stat-pill-label">Pronostico</span>
              <InfoTip
                className="stat-pill-val"
                text={`I punti che ci si aspettava facesse in questa stagione, arrotondati al mezzo punto, dall'Elo del torneo suo e dei suoi avversari a inizio stagione. Contano ${forecast.games} partite: quelle contro gli esordienti no, il loro livello non si conosce ancora. Chi supera di più il proprio pronostico vince il Premio Rivelazione. ▲ sopra il previsto, = in linea, ▼ sotto.`}
              >
                {fmt(pronostico)} {pronostico === 1 ? "punto" : "punti"}{" "}
                {forecast.played > 0 && <Trend kind={forecastTrend} label={forecastLabel} />}{" "}
                <span className="infotip-mark" aria-hidden="true">ⓘ</span>
              </InfoTip>
              {forecast.played === 0 && <span className="stat-pill-note">su {forecast.games} partite</span>}
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
            </li>
          ))}
        </ul>
      </section>

      {acrossSeasons}

      <section className="dossier-card">
        <h2 className="section-heading">Partite ({games.length})</h2>
        {games.length === 0 ? (
          <p className="note m-0">Nessuna partita ancora registrata.</p>
        ) : (
          <ul className="player-games">
            {games.map((game) => (
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
