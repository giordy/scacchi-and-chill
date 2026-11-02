import React, { useState, useEffect, useRef } from 'react';
import {
  AppConfig,
  Player,
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  BackupData,
  TournamentMeta,
  ScheduledMatch,
  SeasonWinner,
} from '../types';
import { RULES } from '../lib/config';
import { DaysField } from '../components/DaysField';

export function SettingsTab({
  settings,
  setSettings,
  templates,
  setTemplates,
  history,
  setHistory,
  round,
  setRound,
  pairs,
  setPairs,
  flash,
  panelRef,
  config,
  onUpdateTournamentMeta,
  onUpdatePlayers,
  onUpdateSchedule,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  round: string;
  setRound: (r: string) => void;
  pairs: GamePair[];
  setPairs: React.Dispatch<React.SetStateAction<GamePair[]>>;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  panelRef: React.RefObject<HTMLDivElement>;
  config: AppConfig;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
}) {
  const [tokenDraft, setTokenDraft] = useState(settings.token);
  const [tournTitle, setTournTitle] = useState(config.tournament?.title || "Scacchi & Chill");
  const [tournSeason, setTournSeason] = useState(config.tournament?.season || "Stagione 2 - Capablanca");
  const [tournSubtitle, setTournSubtitle] = useState(config.tournament?.subtitle || "La macchina degli scacchi");
  const [tournMasterName, setTournMasterName] = useState(config.tournament?.masterName || "José Raúl Capablanca");
  const [tournImageUrl, setTournImageUrl] = useState(config.tournament?.imageUrl || "assets/capablanca.jpg");
  const [tournDesc, setTournDesc] = useState(
    config.tournament?.description ||
      "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite."
  );
  const [tournHowItWorks, setTournHowItWorks] = useState(
    config.tournament?.howItWorks ||
      "1. All'inizio di ogni giornata ricevi nel gruppo il link della tua partita: basta aprirlo per avviare la sfida.\n2. Quando la partita finisce, scrivi nel gruppo WhatsApp così il risultato viene registrato."
  );
  const [tournFairPlay, setTournFairPlay] = useState(
    config.tournament?.fairPlayText ||
      "• Ti impegni a giocare ogni partita con le tue forze, senza motori né aiuti esterni durante la partita (teoria e libri di aperture prima vanno bene), e a mantenere un’atmosfera di rispetto e fiducia nel torneo.\n• In caso di dubbio decide Lichess: se una partita viene chiusa da Lichess con “cheat detected”, il giocatore a cui Lichess attribuisce la violazione perde la partita e i punti del turno. Alla seconda volta, o se Lichess chiude l’account, è escluso dal torneo e i suoi risultati vengono annullati.\n• Non facciamo accuse nel gruppo: eventuali dubbi si scrivono privatamente all'organizzatore."
  );
  const [tournWinners, setTournWinners] = useState<SeasonWinner[]>(
    config.tournament?.winners || [
      { season: "Stagione 1", name: "Fabio", handle: "fsgach", year: "2026", notes: "Campione 1ª Edizione" },
    ]
  );
  const [newWinnerSeason, setNewWinnerSeason] = useState("");
  const [newWinnerHandle, setNewWinnerHandle] = useState("");
  const [newWinnerNotes, setNewWinnerNotes] = useState("");
  const [tournRules, setTournRules] = useState(config.tournament?.rulesText || "");
  
  // Players state in admin
  const [playersList, setPlayersList] = useState<Player[]>(config.players);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerHandle, setNewPlayerHandle] = useState("");

  // Schedule state in admin
  const [scheduleList, setScheduleList] = useState<ScheduledMatch[]>(config.schedule || []);
  const [newMatchRound, setNewMatchRound] = useState("1");
  const [newMatchWhite, setNewMatchWhite] = useState("");
  const [newMatchBlack, setNewMatchBlack] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlayersList(config.players);
  }, [config.players]);

  useEffect(() => {
    if (config.schedule) setScheduleList(config.schedule);
  }, [config.schedule]);

  useEffect(() => {
    setTokenDraft(settings.token);
  }, [settings.token]);

  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const setTemplate = (key: string, text: string) =>
    setTemplates((t) => ({ ...(t ?? {}), [key]: text } as Partial<MessageTemplates>));

  const handleExportBackup = () => {
    let anecdotes = {};
    let ratings = {};
    try {
      const a = localStorage.getItem("scacchi.anecdotes");
      if (a) anecdotes = JSON.parse(a);
      const r = localStorage.getItem("scacchi.ratings");
      if (r) ratings = JSON.parse(r);
    } catch {}

    const backup: BackupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      round,
      history,
      pairs,
      settings,
      templates,
      anecdotes,
      ratings,
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-scacchi-and-chill-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash("ok", `Backup esportato con successo (${history.length} partite storiche salvate in backup-scacchi-and-chill-${dateStr}.json).`);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content) as BackupData;

        if (!data || typeof data !== "object") {
          throw new Error("Formato del file di backup non valido.");
        }

        if (Array.isArray(data.history)) {
          setHistory(data.history);
        }
        if (typeof data.round === "string") {
          setRound(data.round);
        }
        if (Array.isArray(data.pairs)) {
          setPairs(data.pairs);
        }
        if (data.settings && typeof data.settings === "object") {
          setSettings((prev) => ({ ...prev, ...data.settings }));
        }
        if (data.templates !== undefined) {
          setTemplates(data.templates);
        }
        if (data.anecdotes && typeof data.anecdotes === "object") {
          localStorage.setItem("scacchi.anecdotes", JSON.stringify(data.anecdotes));
        }
        if (data.ratings && typeof data.ratings === "object") {
          localStorage.setItem("scacchi.ratings", JSON.stringify(data.ratings));
        }

        const matchCount = data.history?.length ?? 0;
        flash("ok", `Backup ripristinato con successo! Caricate ${matchCount} partite storiche, aneddoti e impostazioni.`);
      } catch (err: any) {
        flash("err", `Errore durante il ripristino del backup: ${err.message}`);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetAllData = () => {
    if (
      window.confirm(
        "Attenzione: vuoi davvero cancellare TUTTI i dati del torneo (partite salvate, turni, aneddoti e impostazioni)? Ti consigliamo di scaricare prima un backup."
      )
    ) {
      setHistory([]);
      setPairs([]);
      setRound("1");
      localStorage.removeItem("scacchi.anecdotes");
      localStorage.removeItem("scacchi.ratings");
      setTemplates(null);
      flash("ok", "Tutti i dati locali del torneo sono stati azzerati.");
    }
  };

  return (
    <div ref={panelRef} style={{ display: 'grid', gap: '14px' }}>
      {/* 🏆 Gestione Stagione / Torneo Pubblico */}
      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>🏆 Informazioni Torneo & Nuova Stagione</h3>
        <p className="note" style={{ margin: "0 0 12px" }}>
          Questi dettagli vengono mostrati nella scheda pubblica <strong>Torneo</strong> per tutti i partecipanti.
        </p>

        <div className="grid2" style={{ marginBottom: 10 }}>
          <div>
            <label htmlFor="cfg-tourn-title">Nome del Torneo</label>
            <input
              id="cfg-tourn-title"
              type="text"
              value={tournTitle}
              onChange={(e) => setTournTitle(e.target.value)}
              placeholder="es. Scacchi & Chill"
            />
          </div>
          <div>
            <label htmlFor="cfg-tourn-season">Edizione / Stagione</label>
            <input
              id="cfg-tourn-season"
              type="text"
              value={tournSeason}
              onChange={(e) => setTournSeason(e.target.value)}
              placeholder="es. Stagione 2 - Capablanca"
            />
          </div>
        </div>

        <div className="grid2" style={{ marginBottom: 10 }}>
          <div>
            <label htmlFor="cfg-tourn-master">Nome del Maestro Scacchista</label>
            <input
              id="cfg-tourn-master"
              type="text"
              value={tournMasterName}
              onChange={(e) => setTournMasterName(e.target.value)}
              placeholder="es. José Raúl Capablanca"
            />
          </div>
          <div>
            <label htmlFor="cfg-tourn-sub">Motto / Soprannome Maestro</label>
            <input
              id="cfg-tourn-sub"
              type="text"
              value={tournSubtitle}
              onChange={(e) => setTournSubtitle(e.target.value)}
              placeholder="es. La macchina degli scacchi"
            />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="cfg-tourn-img">URL Immagine / Foto Maestro</label>
          <input
            id="cfg-tourn-img"
            type="text"
            value={tournImageUrl}
            onChange={(e) => setTournImageUrl(e.target.value)}
            placeholder="es. assets/capablanca.jpg"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="cfg-tourn-desc">Presentazione / Dedica della Stagione</label>
          <textarea
            id="cfg-tourn-desc"
            rows={3}
            value={tournDesc}
            onChange={(e) => setTournDesc(e.target.value)}
            placeholder="Per rendere ogni appuntamento sempre vario e coinvolgente..."
            style={{ minHeight: 70 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="cfg-tourn-how">Svolgimento del Torneo ("Come funziona il torneo")</label>
          <textarea
            id="cfg-tourn-how"
            rows={3}
            value={tournHowItWorks}
            onChange={(e) => setTournHowItWorks(e.target.value)}
            placeholder="1. All'inizio di ogni giornata ricevi nel gruppo il link..."
            style={{ minHeight: 70 }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label htmlFor="cfg-tourn-fairplay">Regole di Fair Play</label>
          <textarea
            id="cfg-tourn-fairplay"
            rows={5}
            value={tournFairPlay}
            onChange={(e) => setTournFairPlay(e.target.value)}
            placeholder="• Ti impegni a giocare ogni partita con le tue forze..."
            style={{ minHeight: 90 }}
          />
        </div>

        {/* 🏆 Albo d'Oro - Vincitori per Edizione */}
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginBottom: 14 }}>
          <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>🏆 Albo d'Oro (Vincitori Edizioni)</h4>
          <p className="note" style={{ margin: "0 0 10px", fontSize: 12 }}>
            Aggiungi o rimuovi i campioni delle stagioni passate.
          </p>

          <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
            {tournWinners.map((w, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 10px",
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <div>
                  <strong>{w.season}:</strong> {w.name} (@{w.handle}) {w.notes && <span style={{ opacity: 0.7 }}>– {w.notes}</span>}
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ fontSize: 11, padding: "2px 6px", color: "var(--danger)" }}
                  onClick={() => {
                    const updated = tournWinners.filter((_, i) => i !== idx);
                    setTournWinners(updated);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr auto", gap: 6, alignItems: "flex-end" }}>
            <div>
              <label htmlFor="new-w-season" style={{ fontSize: 11 }}>Stagione</label>
              <input
                id="new-w-season"
                type="text"
                placeholder="es. Stagione 1"
                value={newWinnerSeason}
                onChange={(e) => setNewWinnerSeason(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new-w-handle" style={{ fontSize: 11 }}>Vincitore</label>
              <select
                id="new-w-handle"
                value={newWinnerHandle}
                onChange={(e) => setNewWinnerHandle(e.target.value)}
              >
                <option value="">Seleziona...</option>
                {playersList.map((p) => (
                  <option key={p.handle} value={p.handle}>
                    {p.name} (@{p.handle})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-w-notes" style={{ fontSize: 11 }}>Note (opzionale)</label>
              <input
                id="new-w-notes"
                type="text"
                placeholder="es. 1ª Edizione"
                value={newWinnerNotes}
                onChange={(e) => setNewWinnerNotes(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="secondary"
              style={{ minHeight: 44, whiteSpace: "nowrap", fontSize: 12 }}
              onClick={() => {
                const s = newWinnerSeason.trim();
                if (!s || !newWinnerHandle) {
                  flash("err", "Inserisci la stagione e seleziona il vincitore.");
                  return;
                }
                const p = playersList.find((pl) => pl.handle === newWinnerHandle);
                const updated = [
                  ...tournWinners,
                  {
                    season: s,
                    handle: newWinnerHandle,
                    name: p?.name || newWinnerHandle,
                    notes: newWinnerNotes.trim() || undefined,
                  },
                ];
                setTournWinners(updated);
                setNewWinnerSeason("");
                setNewWinnerHandle("");
                setNewWinnerNotes("");
              }}
            >
              + Aggiungi
            </button>
          </div>
        </div>

        <div className="actions two" style={{ marginTop: 0 }}>
          <button
            className="secondary"
            type="button"
            onClick={() => {
              onUpdateTournamentMeta({
                title: tournTitle.trim(),
                season: tournSeason.trim(),
                subtitle: tournSubtitle.trim(),
                masterName: tournMasterName.trim(),
                imageUrl: tournImageUrl.trim(),
                description: tournDesc.trim(),
                howItWorks: tournHowItWorks.trim(),
                fairPlayText: tournFairPlay.trim(),
                winners: tournWinners,
                rulesText: tournRules.trim(),
              });
              flash("ok", "Informazioni del torneo e Albo d'Oro aggiornati con successo!");
            }}
          >
            Salva informazioni torneo
          </button>
          <button
            className="secondary"
            type="button"
            title="Scarica config.json aggiornato con le impostazioni correnti e le partite salvate"
            onClick={() => {
              const fullExportConfig = {
                ...config,
                tournament: {
                  title: tournTitle.trim(),
                  season: tournSeason.trim(),
                  description: tournDesc.trim(),
                  rulesText: tournRules.trim(),
                },
                schedule: history.map((g) => ({
                  round: g.round,
                  white: g.white,
                  black: g.black,
                  url: g.url,
                })),
              };
              const blob = new Blob([JSON.stringify(fullExportConfig, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "config.json";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              flash("ok", "File config.json generato e scaricato!");
            }}
          >
            📄 Esporta config.json per GitHub
          </button>
        </div>
      </div>

      {/* 👥 Gestione Partecipanti (Salvata su Firebase) */}
      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>👥 Giocatori del Torneo ({playersList.length})</h3>
        <p className="note" style={{ margin: "0 0 12px" }}>
          Modifica i partecipanti e i loro nickname Lichess. Le modifiche vengono salvate in tempo reale nel database cloud.
        </p>

        <div style={{ display: "grid", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
          {playersList.map((p, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 10px",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 6,
              }}
            >
              <div>
                <strong>{p.name}</strong> <span style={{ opacity: 0.7, fontSize: 13 }}>({p.handle})</span>
              </div>
              <button
                type="button"
                className="secondary"
                style={{ fontSize: 11, padding: "3px 8px", color: "var(--danger)" }}
                onClick={() => {
                  const updated = playersList.filter((_, i) => i !== idx);
                  setPlayersList(updated);
                  onUpdatePlayers(updated);
                  flash("ok", `Giocatore ${p.name} rimosso.`);
                }}
              >
                Rimuovi
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "flex-end" }}>
          <div>
            <label htmlFor="new-p-name">Nome WhatsApp</label>
            <input
              id="new-p-name"
              type="text"
              placeholder="es. Marco"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="new-p-handle">Nickname Lichess</label>
            <input
              id="new-p-handle"
              type="text"
              placeholder="es. marco_chess"
              value={newPlayerHandle}
              onChange={(e) => setNewPlayerHandle(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="secondary"
            style={{ minHeight: 48, whiteSpace: "nowrap" }}
            onClick={() => {
              const name = newPlayerName.trim();
              const handle = newPlayerHandle.trim().toLowerCase();
              if (!name || !handle) {
                flash("err", "Inserisci sia il nome che il nickname Lichess.");
                return;
              }
              if (playersList.some((p) => p.handle.toLowerCase() === handle)) {
                flash("err", `Esiste già un giocatore con handle '${handle}'.`);
                return;
              }
              const updated = [...playersList, { name, handle }];
              setPlayersList(updated);
              onUpdatePlayers(updated);
              setNewPlayerName("");
              setNewPlayerHandle("");
              flash("ok", `Giocatore ${name} aggiunto con successo!`);
            }}
          >
            + Aggiungi
          </button>
        </div>
      </div>

      {/* 📅 Calendario Ufficiale Accoppiamenti (Salvato su Firebase) */}
      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 14 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>📅 Calendario Ufficiale Accoppiamenti ({scheduleList.length} partite)</h3>
        <p className="note" style={{ margin: "0 0 12px" }}>
          Gli accoppiamenti preimpostati per ciascun turno. Selezionando il turno nella scheda <em>Partite</em>, questi incontri vengono caricati in automatico con 1 clic.
        </p>

        {scheduleList.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
            {scheduleList.map((m, idx) => {
              const wName = playersList.find((p) => p.handle === m.white)?.name || m.white;
              const bName = playersList.find((p) => p.handle === m.black)?.name || m.black;
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <span className="badge" style={{ marginRight: 6 }}>T.{m.round}</span>
                    <strong>{wName}</strong> ⚪ vs <strong>{bName}</strong> ⚫
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    style={{ fontSize: 11, padding: "2px 6px", color: "var(--danger)" }}
                    onClick={() => {
                      const updated = scheduleList.filter((_, i) => i !== idx);
                      setScheduleList(updated);
                      onUpdateSchedule(updated);
                      flash("ok", "Accoppiamento rimosso dal calendario.");
                    }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr auto", gap: 8, alignItems: "flex-end" }}>
          <div>
            <label htmlFor="new-m-round">Turno</label>
            <input
              id="new-m-round"
              type="text"
              inputMode="numeric"
              value={newMatchRound}
              onChange={(e) => setNewMatchRound(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="new-m-white">Bianco</label>
            <select
              id="new-m-white"
              value={newMatchWhite}
              onChange={(e) => setNewMatchWhite(e.target.value)}
            >
              <option value="">Seleziona...</option>
              {playersList.map((p) => (
                <option key={p.handle} value={p.handle}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-m-black">Nero</label>
            <select
              id="new-m-black"
              value={newMatchBlack}
              onChange={(e) => setNewMatchBlack(e.target.value)}
            >
              <option value="">Seleziona...</option>
              {playersList.map((p) => (
                <option key={p.handle} value={p.handle}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="secondary"
            style={{ minHeight: 48, whiteSpace: "nowrap" }}
            onClick={() => {
              const r = newMatchRound.trim();
              if (!r || !newMatchWhite || !newMatchBlack) {
                flash("err", "Inserisci turno, giocatore bianco e giocatore nero.");
                return;
              }
              if (newMatchWhite === newMatchBlack) {
                flash("err", "Un giocatore non può sfidare se stesso.");
                return;
              }
              const updated = [
                ...scheduleList,
                { round: r, white: newMatchWhite, black: newMatchBlack },
              ];
              setScheduleList(updated);
              onUpdateSchedule(updated);
              setNewMatchWhite("");
              setNewMatchBlack("");
              flash("ok", `Partita aggiunta al Turno ${r}!`);
            }}
          >
            + Inserisci
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="token">Token API Lichess (Organizzatore)</label>
        <input
          id="token"
          type="password"
          autoComplete="off"
          placeholder="lip_…"
          value={tokenDraft}
          onChange={(e) => setTokenDraft(e.target.value)}
        />
        <p className="note">
          Crea un token su <code>lichess.org/account/oauth/token</code> con il permesso <em>Challenge</em>. Viene salvato esclusivamente nel browser del telefono.
        </p>
      </div>

      <div className="actions two" style={{ marginTop: 0 }}>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            set({ token: tokenDraft.trim() });
            flash("ok", "Token salvato in questo browser.");
          }}
        >
          Salva token
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            setTokenDraft("");
            set({ token: "" });
            flash("ok", "Token rimosso da questo browser.");
          }}
        >
          Dimentica token
        </button>
      </div>

      <div className="grid2">
        <DaysField
          id="days"
          label="Giorni per mossa"
          value={settings.days}
          fallback={2}
          onCommit={(n) => set({ days: n })}
        />
        <DaysField
          id="expiry"
          label="Validità link (giorni)"
          value={settings.expiry}
          fallback={2}
          onCommit={(n) => set({ expiry: n })}
        />
      </div>

      <div className="inline">
        <input
          id="rated"
          type="checkbox"
          checked={settings.rated}
          onChange={(e) => set({ rated: e.target.checked })}
        />
        <label htmlFor="rated">Partite classificate (Rated)</label>
      </div>

      <div>
        <label>Regole della partita</label>
        {RULES.map(({ key, label }) => (
          <div className="inline" key={key}>
            <input
              id={"rule-" + key}
              type="checkbox"
              checked={!!settings.rules?.[key]}
              onChange={(e) => set({ rules: { ...settings.rules, [key]: e.target.checked } as any })}
            />
            <label htmlFor={"rule-" + key}>{label}</label>
          </div>
        ))}
      </div>

      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%", margin: "10px 0" }} />

      <p className="note">
        <strong>Testo dei messaggi WhatsApp.</strong> Puoi usare <code>{"{round}"}</code> <code>{"{days}"}</code>{" "}
        <code>{"{expiry}"}</code> <code>{"{type}"}</code> ovunque. Nelle singole partite puoi usare anche{" "}
        <code>{"{n}"}</code> <code>{"{white}"}</code> <code>{"{black}"}</code> <code>{"{url}"}</code>.
      </p>

      <div>
        <label htmlFor="tpl-header">Intestazione messaggio turno</label>
        <textarea
          id="tpl-header"
          className="small"
          value={templates.header}
          onChange={(e) => setTemplate("header", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="tpl-game">Riga di ciascuna partita</label>
        <textarea
          id="tpl-game"
          className="small"
          value={templates.game}
          onChange={(e) => setTemplate("game", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="tpl-bye">Riposo (mostrato solo se qualcuno riposa; usa {"{bye}"})</label>
        <textarea
          id="tpl-bye"
          className="small"
          value={templates.bye}
          onChange={(e) => setTemplate("bye", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="tpl-footer">Chiusura messaggio turno</label>
        <textarea
          id="tpl-footer"
          className="small"
          value={templates.footer}
          onChange={(e) => setTemplate("footer", e.target.value)}
        />
      </div>

      <button
        className="secondary"
        type="button"
        onClick={() => {
          setTemplates(null);
          flash("ok", "Testi dei messaggi ripristinati da config.json.");
        }}
      >
        Ripristina testi predefiniti
      </button>

      <hr style={{ border: 0, borderTop: "1px solid var(--line)", width: "100%", margin: "14px 0" }} />

      <div>
        <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>💾 Backup & Ripristino Dati</h3>
        <p className="note" style={{ margin: "0 0 12px" }}>
          Esporta tutti i dati del torneo (storico turni, partite, aneddoti dei giocatori e impostazioni) in un file JSON per sicurezza o per trasferirli su un altro dispositivo.
        </p>

        <div className="actions two" style={{ marginTop: 0 }}>
          <button
            className="secondary"
            type="button"
            onClick={handleExportBackup}
            style={{ minHeight: 48 }}
          >
            📥 Scarica Backup (JSON)
          </button>
          <label
            className="secondary"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 48,
              cursor: "pointer",
              margin: 0,
              textAlign: "center",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            📂 Carica Backup (.json)
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={handleImportBackup}
            />
          </label>
        </div>

        <div style={{ marginTop: 14, textAlign: "right" }}>
          <button
            type="button"
            onClick={handleResetAllData}
            style={{
              background: "none",
              border: "none",
              color: "var(--danger)",
              fontSize: "13px",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            ⚠️ Azzera tutti i dati locali del torneo
          </button>
        </div>
      </div>
    </div>
  );
}
