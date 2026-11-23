import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame, MessageTemplates, ScheduledMatch, SeasonArchive, Settings, TournamentMeta } from '../types';
import { RoundSummary, currentRound, nextRoundNumber, roundsOf } from '../lib/rounds';
import { gameProgress } from '../lib/progress';
import { errorMessage, extractGameId } from '../lib/utils';
import { saveGamesBatchToFirebase } from '../firebaseService';
import { usePersistentState } from '../hooks/usePersistentState';
import { RoundDetail } from './rounds/RoundDetail';
import { usePledges } from '../hooks/usePledges';
import { pledgeStatus, rulesVersion } from '../lib/pledges';
import { expiredRound, formatRoundEnd, roundEndOf, roundExpired, waitText } from '../lib/roundDeadline';

type Flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;

// The rounds of the season: the list (planned and started) and, for each round, its games, the
// Lichess links and its WhatsApp messages. The calendar is generated in Stagioni > Calendario.
export function RoundsTab({
  openRound,
  setOpenRound,
  config,
  settings,
  templates,
  history,
  setHistory,
  gameStates,
  onUpdateSchedule,
  onUpdateTournamentMeta,
  nameOf,
  flash,
  triggerToast,
  onMissingToken,
  onOpenCalendar,
  seasons = [],
}: {
  // Round shown in detail; empty for the list
  openRound: string;
  setOpenRound: (round: string) => void;
  config: AppConfig;
  settings: Settings;
  templates: MessageTemplates;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  gameStates: Record<string, LichessExportGame>;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
  // For the end of a round (Turni con scadenza, lib/roundDeadline.ts)
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  nameOf: (handle: string) => string;
  flash: Flash;
  triggerToast: (msg: string) => void;
  onMissingToken: () => void;
  // Opens Stagioni, where the calendar is generated
  onOpenCalendar?: () => void;
  seasons?: SeasonArchive[]; // archived seasons, for the Elo del torneo in the bulletin
}) {
  const schedule = config.schedule ?? [];
  // Who accepted the rules of the season (lib/pledges.ts)
  const { pledges, loaded: pledgesLoaded } = usePledges();
  const season = config.tournament?.season ?? '';
  const pledgeState = pledgeStatus(pledges, season, config.players, rulesVersion(config.tournament));
  // Only once read: before, nobody would look missing
  const missingPledges = pledgesLoaded ? pledgeState.missing.map((p) => p.name) : [];

  // Games created on Lichess whose saving on Firestore failed: kept on this device until saved,
  // so their links are not lost.
  const [pending, setPending] = usePersistentState<HistoryGame[]>('pairings.unsavedGames', [], Array.isArray);
  const knownIds = new Set(history.map((g) => extractGameId(g.url)).filter(Boolean));
  const unsaved = pending.filter((g) => !knownIds.has(extractGameId(g.url)));

  const rounds = roundsOf(schedule, [...history, ...unsaved]);
  const current = currentRound(rounds);
  const now = Date.now();
  // Turni con scadenza: the round in progress is over its end and the next one can start
  const expired = expiredRound(config.tournament, rounds, history, gameStates, now);

  // Idempotent (one document per round/white/black), so it can be retried safely
  const save = async (games: HistoryGame[]): Promise<boolean> => {
    if (games.length === 0) return true;
    setPending((prev) => [...prev.filter((p) => !games.some((g) => g.url === p.url)), ...games]);
    try {
      await saveGamesBatchToFirebase(games);
      setPending((prev) => prev.filter((p) => !games.some((g) => g.url === p.url)));
      return true;
    } catch (e) {
      flash(
        "err",
        "Le sfide esistono su Lichess ma non sono state salvate nel torneo: " +
          errorMessage(e) +
          ". Premi «Salva nel torneo» per riprovare."
      );
      return false;
    }
  };

  const retrySave = async () => {
    const n = unsaved.length;
    if (await save(unsaved)) flash("ok", `${n} ${n === 1 ? "partita salvata" : "partite salvate"} nel torneo.`);
  };

  const unsavedNotice = unsaved.length > 0 && (
    <div className="notice warning mb-14">
      {unsaved.length === 1
        ? "Una partita creata su Lichess non è ancora salvata nel torneo, quindi non compare"
        : `${unsaved.length} partite create su Lichess non sono ancora salvate nel torneo, quindi non compaiono`}{" "}
      nella pagina pubblica.
      <button className="secondary btn-block mt-8" type="button" onClick={retrySave}>
        Salva nel torneo
      </button>
    </div>
  );

  if (openRound) {
    const idx = rounds.findIndex((r) => r.round === openRound);
    const summary = idx >= 0 ? rounds[idx] : undefined;
    // A new round without games yet sits after the last one
    const prev = idx >= 0 ? rounds[idx - 1]?.round : rounds[rounds.length - 1]?.round;
    const next = idx >= 0 ? rounds[idx + 1]?.round : undefined;
    return (
      <>
        {unsavedNotice}
        <RoundDetail
          key={openRound}
          round={openRound}
          summary={summary}
          prev={prev}
          next={next}
          onOpen={setOpenRound}
          onBack={() => setOpenRound("")}
          config={config}
          settings={settings}
          templates={templates}
          history={history}
          setHistory={setHistory}
          gameStates={gameStates}
          schedule={schedule}
          onUpdateSchedule={onUpdateSchedule}
          onUpdateTournamentMeta={onUpdateTournamentMeta}
          onCreated={save}
          nameOf={nameOf}
          flash={flash}
          triggerToast={triggerToast}
          onMissingToken={onMissingToken}
          seasons={seasons}
          missingPledges={missingPledges}
        />
      </>
    );
  }

  return (
    <div className="settings-stack">
      {unsavedNotice}
      {expired && expired.waitReason && (
        <div className="notice">
          Il Turno {expired.round} si è chiuso {formatRoundEnd(expired.end)}.{" "}
          {expired.waitReason === "final" ? "Siamo alle ultime giornate: il" : "Il"} Turno {expired.next} parte{" "}
          {waitText({ reason: expired.waitReason, count: expired.waitFor.length })}.
        </div>
      )}
      {expired && !expired.waitReason && (
        <div className="notice warning">
          Il Turno {expired.round} è scaduto {formatRoundEnd(expired.end)}: puoi creare il Turno {expired.next}.{" "}
          {expired.open.length === 0
            ? "Le sue partite sono tutte concluse."
            : `${expired.open.length === 1 ? "Continua" : "Continuano"} accanto al nuovo turno: ${expired.open
                .map((g) => `${nameOf(g.white)} – ${nameOf(g.black)}`)
                .join(", ")}.`}
          <button className="secondary btn-block mt-8" type="button" onClick={() => setOpenRound(expired.next)}>
            Apri il Turno {expired.next}
          </button>
        </div>
      )}
      <section className="panel">
        <h2 className="panel-title">
          Turni <span className="muted-normal">· {rounds.length}</span>
        </h2>
        {rounds.length === 0 ? (
          <p className="note note-flush">
            Nessun turno ancora. Genera il calendario con il girone all'italiana in{" "}
            {onOpenCalendar ? (
              <button type="button" className="link-muted" onClick={onOpenCalendar}>
                ♛ Stagioni → Calendario
              </button>
            ) : (
              "♛ Stagioni → Calendario"
            )}
            , oppure crea un turno a mano.
          </p>
        ) : (
          <div className="round-list">
            {rounds.map((r) => (
              <button
                key={r.round}
                type="button"
                className={`list-row round-row ${r.round === current ? "is-current" : ""}`}
                onClick={() => setOpenRound(r.round)}
              >
                <span>
                  <strong>Turno {r.round}</strong>{" "}
                  <span className="muted-sm">
                    · {r.matches.length} {r.matches.length === 1 ? "partita" : "partite"}
                  </span>
                </span>
                <RoundBadge summary={r} gameStates={gameStates} end={roundEndOf(config.tournament, r.round)} now={now} />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="secondary btn-block mt-12"
          onClick={() => setOpenRound(nextRoundNumber(rounds))}
        >
          + Nuovo turno ({nextRoundNumber(rounds)})
        </button>
      </section>

    </div>
  );
}

function RoundBadge({
  summary,
  gameStates,
  end,
  now,
}: {
  summary: RoundSummary;
  gameStates: Record<string, LichessExportGame>;
  end?: number; // Turni con scadenza: when the round ends
  now: number;
}) {
  const { matches, created } = summary;
  if (created === 0) return <span className="status-badge pending">Da avviare</span>;
  if (created < matches.length) {
    return <span className="status-badge pending">Link {created}/{matches.length}</span>;
  }
  const finished = matches.every((m) => {
    const id = extractGameId(m.url);
    return gameProgress((id && gameStates[id]) || m.game?.lichess) === "finished";
  });
  if (finished) return <span className="status-badge result">Concluso</span>;
  // Past its end, with games still open: they go on, the badge says the time is up
  if (end !== undefined && roundExpired(end, now)) return <span className="status-badge loss">Scaduto</span>;
  return <span className="status-badge ongoing">In corso</span>;
}
