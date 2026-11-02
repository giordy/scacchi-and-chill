import React, { useState } from 'react';
import { AppConfig, HistoryGame, TournamentMeta, SeasonWinner } from '../../types';

export function TournamentInfoSection({
  config,
  history,
  flash,
  onUpdateTournamentMeta,
}: {
  config: AppConfig;
  history: HistoryGame[];
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
}) {
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

  return (
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
              {config.players.map((p) => (
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
              const p = config.players.find((pl) => pl.handle === newWinnerHandle);
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
  );
}
