import React, { useEffect, useState } from 'react';
import { AppConfig, TournamentMeta, SeasonWinner } from '../../types';

export function TournamentInfoSection({
  config,
  flash,
  onUpdateTournamentMeta,
}: {
  config: AppConfig;
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
  // Keep the hall of fame in sync when it changes elsewhere (e.g. season archiving adds the champion)
  useEffect(() => {
    if (config.tournament?.winners) setTournWinners(config.tournament.winners);
  }, [config.tournament?.winners]);

  const [newWinnerSeason, setNewWinnerSeason] = useState("");
  const [newWinnerHandle, setNewWinnerHandle] = useState("");
  const [newWinnerNotes, setNewWinnerNotes] = useState("");

  return (
    <div>
      <p className="note note-flush">
        Questi dettagli vengono mostrati nella scheda pubblica <strong>Torneo</strong> per tutti i partecipanti.
      </p>

      <div className="grid2 field">
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

      <div className="grid2 field">
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

      <div className="field">
        <label htmlFor="cfg-tourn-img">URL Immagine / Foto Maestro</label>
        <input
          id="cfg-tourn-img"
          type="text"
          value={tournImageUrl}
          onChange={(e) => setTournImageUrl(e.target.value)}
          placeholder="es. assets/capablanca.jpg"
        />
      </div>

      <div className="field">
        <label htmlFor="cfg-tourn-desc">Presentazione / Dedica della Stagione</label>
        <textarea
          id="cfg-tourn-desc"
          rows={3}
          value={tournDesc}
          onChange={(e) => setTournDesc(e.target.value)}
          placeholder="Per rendere ogni appuntamento sempre vario e coinvolgente..."
          className="ta-sm"
        />
      </div>

      <div className="field">
        <label htmlFor="cfg-tourn-how">Svolgimento del Torneo ("Come funziona il torneo")</label>
        <textarea
          id="cfg-tourn-how"
          rows={3}
          value={tournHowItWorks}
          onChange={(e) => setTournHowItWorks(e.target.value)}
          placeholder="1. All'inizio di ogni giornata ricevi nel gruppo il link..."
          className="ta-sm"
        />
      </div>

      <div className="field">
        <label htmlFor="cfg-tourn-fairplay">Regole di Fair Play</label>
        <textarea
          id="cfg-tourn-fairplay"
          rows={5}
          value={tournFairPlay}
          onChange={(e) => setTournFairPlay(e.target.value)}
          placeholder="• Ti impegni a giocare ogni partita con le tue forze..."
          className="ta-md"
        />
      </div>

      {/* 🏆 Albo d'Oro - Vincitori per Edizione */}
      <div className="subcard">
        <h4 className="subcard-title">🏆 Albo d'Oro (Vincitori Edizioni)</h4>
        <p className="note note-sm">
          Aggiungi o rimuovi i campioni delle stagioni passate.
        </p>

        <div className="item-list tight">
          {tournWinners.map((w, idx) => (
            <div
              key={idx}
              className="list-row small"
            >
              <div>
                <strong>{w.season}:</strong> {w.name} (@{w.handle}) {w.notes && <span className="muted-sm">– {w.notes}</span>}
              </div>
              <button
                type="button"
                className="secondary btn-mini"
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

        <div className="add-form add-form-winner">
          <div>
            <label htmlFor="new-w-season" className="label-sm">Stagione</label>
            <input
              id="new-w-season"
              type="text"
              placeholder="es. Stagione 1"
              value={newWinnerSeason}
              onChange={(e) => setNewWinnerSeason(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="new-w-handle" className="label-sm">Vincitore</label>
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
            <label htmlFor="new-w-notes" className="label-sm">Note (opzionale)</label>
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
            className="secondary btn-add compact"
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

      <div className="actions flush">
        <button
          className="primary"
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
            });
            flash("ok", "Informazioni del torneo e Albo d'Oro aggiornati con successo!");
          }}
        >
          Salva informazioni torneo
        </button>
      </div>
    </div>
  );
}
