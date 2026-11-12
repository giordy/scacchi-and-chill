import React, { useState } from "react";
import { AppConfig, HistoryGame, LichessExportGame, NoticeState, PlayerStanding, SeasonArchive } from "./types";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { fullMovesOf, isVoid, stateOf } from "./lib/games";
import { computeStandings, sharedRanks } from "./lib/standings";
import { currentSeason, isNewcomer, ratingOf, tournamentElo } from "./lib/tournamentElo";
import { pillsburyRace, reigningPillsbury } from "./lib/pillsbury";
import { scudettoTitle } from "./lib/masterOpening";
import type { OrganizerStore } from "./hooks/useOrganizerData";

interface ReviewsTabProps {
  history: HistoryGame[];
  // Fresh Lichess states from the organizer sync (top of the admin area); finished games are stored
  gameStates: Record<string, LichessExportGame>;
  config: AppConfig;
  nameOf: (handle: string) => string;
  triggerToast?: (msg: string) => void;
  organizer: OrganizerStore;
  seasons?: SeasonArchive[]; // archived seasons, for the Elo del torneo
}

export type ReviewMoment = "andata" | "volata" | "finale";

export function ReviewsTab({ history, gameStates, config, nameOf, triggerToast, organizer, seasons = [] }: ReviewsTabProps) {
  // null: the moment detected from the games, until the organizer picks one
  const [pickedType, setReviewType] = useState<ReviewMoment | null>(null);
  const tournamentTitle = config.tournament?.title || "Scacchi & Chill";
  // The main trophy, named after the season's master ("Scudetto Capablanca")
  const scudetto = scudettoTitle(config.tournament?.masterName);
  const [generalNotes, setGeneralNotes] = useState("");
  
  // Anecdotes live in the private Firestore document (see useOrganizerData); the ratings are the
  // Elo del torneo, computed from the games
  const { anecdotes, setAnecdote } = organizer;
  const elo = tournamentElo(seasons, config.players.map((p) => p.handle), history, gameStates, config.tournament?.seeds);
  const eloSeason = currentSeason(elo);

  const [generatedReview, setGeneratedReview] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedReview, setCopiedReview] = useState(false);
  const [showAnecdotes, setShowAnecdotes] = useState(false);


  // Calculate Standings & Game Summary
  const calculateStandings = (): {
    standings: PlayerStanding[];
    ranks: number[]; // shared on a full tie, as on the site
    finishedMatches: Array<{ round: string; white: string; black: string; result: string; winner?: string; moves?: number; opening?: string }>;
    ongoingMatches: Array<{ white: string; black: string; round: string }>;
  } => {
    const finishedMatches: Array<{
      round: string;
      white: string;
      black: string;
      result: string;
      winner?: string;
      moves?: number;
      opening?: string;
    }> = [];

    const ongoingMatches: Array<{ white: string; black: string; round: string }> = [];

    history.forEach((g) => {
      const s = stateOf(g, gameStates);
      const white = g.white;
      const black = g.black;

      if (!s) {
        ongoingMatches.push({ white, black, round: g.round });
        return;
      }

      if (s.status === "created" || s.status === "started") {
        ongoingMatches.push({ white, black, round: g.round });
      } else if (!isVoid(s)) {
        const moves = fullMovesOf(s);
        const opening = s.opening?.name;

        if (s.winner === "white") {
          finishedMatches.push({ round: g.round, white, black, result: "1-0", winner: white, moves, opening });
        } else if (s.winner === "black") {
          finishedMatches.push({ round: g.round, white, black, result: "0-1", winner: black, moves, opening });
        } else {
          finishedMatches.push({ round: g.round, white, black, result: "½-½", moves, opening });
        }
      }
    });

    // Same order as the public standings (points, Sonneborn-Berger, wins, name)
    const official = computeStandings(config.players, history, gameStates).standings;
    const standings: PlayerStanding[] = official.map((p) => ({
      handle: p.handle,
      name: p.name,
      played: p.played,
      won: p.won,
      drawn: p.drawn,
      lost: p.lost,
      points: p.points,
      rating: ratingOf(elo, p.handle) ?? null,
      anecdote: anecdotes[p.handle] || "",
    }));

    return { standings, ranks: sharedRanks(official), finishedMatches, ongoingMatches };
  };

  const { standings, ranks, finishedMatches, ongoingMatches } = calculateStandings();


  // Recommended moment based on match numbers
  const getRecommendedMoment = (): ReviewMoment => {
    if (ongoingMatches.length === 0 && finishedMatches.length > 0) return "finale";
    if (ongoingMatches.length > 0 && ongoingMatches.length <= 3) return "volata";
    return "andata";
  };

  // Prompt for the review: a friend telling the season, sober and kind to every player.
  // Short, positive instructions and no catalog of examples (models copy them verbatim);
  // personal facts come only from the organizer's notes, never from this code.
  const buildPrompt = () => {
    const lines: string[] = [];
    const add = (...l: string[]) => lines.push(...l);

    add(
      `Scrivi un messaggio WhatsApp per il gruppo del torneo di scacchi tra amici "${tournamentTitle}".`,
      `Racconta la stagione come farebbe un amico del gruppo, non un telecronista.`,
      ``,
      `TONO`,
      `- Ironia leggera e affettuosa, frasi asciutte. Niente superlativi in serie, niente parole come "epico", "leggenda", "eroe", "impresa storica".`,
      `- Ogni giocatore, dal primo all'ultimo, deve potersi rileggere volentieri. Racconta cosa è successo sulla scacchiera, non giudicare le persone.`,
      `- Parla dei risultati per quello che sono (una patta combattuta, una partita lunga, una vittoria netta, una rimonta). Non dividere i giocatori in forti e deboli e non usare la retorica dello sfavorito.`,
      `- L'Elo qui sotto è l'Elo del torneo, calcolato solo dalle partite del torneo (per un esordiente, alla prima stagione, dice ancora poco): è solo contesto per te, non citarlo e non fare confronti di Elo nel testo.`,
      `- Gli aneddoti personali vanno usati solo se scritti nelle note, al massimo uno per giocatore e solo se si inserisce in modo naturale.`,
      `- Poche emoji, e mai numeri in stile voto.`,
      ``,
      `IL PEZZO DI OGNI GIOCATORE`,
      `- Accanto al nome metti il simbolo di un pezzo (♔ ♕ ♖ ♗ ♘ ♙) che gli somiglia per come ha giocato in questa stagione, letto dai dati: partite lunghe, aperture ricorrenti, attacchi, patte, costanza.`,
      `- Non scrivere "pezzo guida" né spiegare il simbolo in un'etichetta: il motivo deve capirsi da mezza frase dentro il testo.`,
      `- Pezzi diversi per giocatori diversi quando possibile; il Re non è riservato al primo.`,
      ``,
      `FORMATO`,
      `- Testo per WhatsApp: *grassetto* per i nomi, _corsivo_ con parsimonia, paragrafi brevi separati da una riga vuota.`,
      `- Per ogni giocatore 2 o 3 frasi, nell'ordine della classifica, con la riga: <simbolo> *Posizione. Nome*`,
    );

    if (reviewType === "andata") {
      add(
        ``,
        `MOMENTO: fine del girone d'andata.`,
        `- Apri con una riga di titolo e una o due frasi su come è andata l'andata nel complesso.`,
        `- Poi i giocatori, come sopra.`,
        `- Chiudi con una frase sul ritorno, senza promesse di grandi emozioni.`,
      );
    } else if (reviewType === "volata") {
      add(
        ``,
        `MOMENTO: ultime partite della stagione (${ongoingMatches.length || "poche"} ancora da finire).`,
        `- Niente schede per giocatore: racconta in pochi paragrafi cosa è ancora in gioco in testa (lo ${scudetto}), per il podio e nel resto della classifica.`,
        `- Cita le partite ancora aperte qui sotto e i giocatori coinvolti, senza caricare le attese su chi le gioca.`,
        `- Chiudi con un augurio di buon gioco, in una frase.`,
      );
    } else {
      add(
        ``,
        `MOMENTO: fine della stagione, tutte le partite concluse.`,
        `- Apri con una riga di titolo e una o due frasi sulla stagione, poi il campione in una frase semplice: vince lo ${scudetto}.`,
        `- Poi i giocatori, come sopra.`,
        `- In fondo, se i dati lo permettono, al massimo 2 o 3 menzioni per tutto il gruppo (per esempio la partita più lunga o la patta più combattuta), preferibilmente non per i primi tre.`,
        `- Chiudi con un grazie a tutti, in una frase.`,
      );
    }

    // The second trophy: a sentence or two, after the Scudetto. Good news only, as on the site: the
    // model is told who is above or in line with the objective, never who is below
    const race = pillsburyRace(config.players, elo, history, history, gameStates, config.tournament?.withdrawals);
    if (seasons.length > 0 && !race.suspended && race.rows.length > 0) {
      const up = race.rows.filter((r) => r.trend === "up");
      const inLine = race.rows.filter((r) => r.trend === "same");
      const holder = reigningPillsbury(seasons);
      add(
        ``,
        `TROFEO PILLSBURY`,
        `- È il secondo trofeo della stagione, meno importante dello ${scudetto}: va a chi, a fine stagione, ha superato di più il proprio obiettivo di punti, calcolato dal suo livello di inizio stagione. Gli esordienti non sono in corsa.`,
        `- Dagli al massimo una o due frasi, sempre dopo lo ${scudetto}. Puoi anche farlo capire dentro il pezzo di un giocatore (per esempio "una stagione sopra le attese").`,
        `- Nomina solo chi è sopra le attese. Non dire mai chi è sotto, non fare elenchi di chi è in linea, niente numeri, e non sottolineare che gli esordienti sono esclusi.`,
      );
      if (reviewType === "finale") {
        add(up.length > 0 ? `- Il vincitore in una frase semplice, subito dopo il campione.` : `- Nessuno è andato sopra le attese: il trofeo quest'anno non viene assegnato. Dillo in mezza frase o non citarlo.`);
      } else if (reviewType === "volata") {
        add(`- Una frase sola, e solo se la corsa è ancora aperta (più di un giocatore sopra le attese).`);
      } else {
        add(`- Una frase su chi sta battendo le attese${up.length === 0 ? ": finora nessuno, la corsa è aperta" : ""}.`);
      }
      add(`Situazione della corsa (solo contesto per te, non riportarla così):`);
      if (up.length > 0) add(`- Sopra le attese, dal primo: ${up.map((r) => nameOf(r.handle)).join(", ")}`);
      if (inLine.length > 0) add(`- In linea con le attese: ${inLine.map((r) => nameOf(r.handle)).join(", ")} (solo dentro il loro pezzo, mai in un elenco)`);
      add(`- Per tutti gli altri giocatori non citare il trofeo.`);
      if (holder) add(`- L'ha vinto la stagione scorsa (${holder.season}): ${holder.handles.map((h) => config.players.find((p) => p.handle.toLowerCase() === h)?.name ?? h).join(", ")}.`);
    }

    if (generalNotes.trim()) add(``, `NOTE DELL'ORGANIZZATORE`, generalNotes.trim());

    add(``, `CLASSIFICA (ordine ufficiale del sito, spareggio Sonneborn-Berger; stesso numero = pari merito)`);
    standings.forEach((st, idx) => {
      const elo = st.rating ? `Elo del torneo ${st.rating}${isNewcomer(eloSeason, st.handle) ? ", esordiente" : ""}` : `Elo n/d`;
      const note = st.anecdote ? ` | Nota: "${st.anecdote}"` : "";
      add(`${ranks[idx]}. ${st.name} (@${st.handle}) – ${st.points} punti: ${st.won} vinte, ${st.drawn} patte, ${st.lost} perse su ${st.played} giocate [${elo}]${note}`);
    });

    add(``, `PARTITE CONCLUSE`);
    if (finishedMatches.length === 0) add(`Nessuna partita ancora conclusa.`);
    finishedMatches.forEach((m) => {
      const op = m.opening ? `, apertura ${m.opening}` : "";
      const mv = m.moves ? `, ${m.moves} mosse` : "";
      add(`- Turno ${m.round}: ${nameOf(m.white)} (bianco) – ${nameOf(m.black)} (nero) ${m.result}${mv}${op}`);
    });

    if (ongoingMatches.length > 0) {
      add(``, `PARTITE ANCORA APERTE`);
      ongoingMatches.forEach((m) => add(`- Turno ${m.round}: ${nameOf(m.white)} – ${nameOf(m.black)}`));
    }

    return lines.join("\n") + "\n";
  };

  // Copy full prompt to clipboard
  const handleCopyPrompt = async () => {
    try {
      const prompt = buildPrompt();
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      if (triggerToast) {
        triggerToast("Prompt copiato negli appunti! 📋 Pronto per Claude/ChatGPT");
      }
      setNotice({
        kind: "ok",
        text: "📋 Prompt completo copiato negli appunti! Ora puoi incollarlo direttamente nella tua chat con Claude o ChatGPT.",
      });
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      setNotice({ kind: "err", text: "Impossibile copiare automaticamente il prompt negli appunti." });
    }
  };

  // Download raw JSON
  // Copy generated review
  const handleCopyReview = async () => {
    try {
      await navigator.clipboard.writeText(generatedReview);
      setCopiedReview(true);
      if (triggerToast) {
        triggerToast("Testo della recensione copiato negli appunti! 📋");
      }
      setTimeout(() => setCopiedReview(false), 2500);
    } catch {}
  };

  const recommended = getRecommendedMoment();
  const reviewType = pickedType ?? recommended;

  return (
    <section>
      <p className="note mb-14">
        Prepara il racconto di fine andata, delle ultime partite o di fine stagione: tono sobrio e affettuoso, senza voti né classifiche di bravura.
      </p>

      {notice && (
        <div className={`notice ${notice.kind} mb-14`}>
          {notice.text}
        </div>
      )}

      {/* What the prompt is built from: the games saved by the sync at the top of the area */}
      <div className="stat-pills">
        <div className="stat-pill">
          <span className="stat-pill-label">Partite</span>
          <span className="stat-pill-val">
            {history.length} <small className="muted-normal">({finishedMatches.length} finite, {ongoingMatches.length} in corso)</small>
          </span>
        </div>
      </div>
      <p className="note note-13 mt-8 mb-14">L'Elo dei giocatori nel prompt è l'Elo del torneo, calcolato dalle partite: non serve scaricarlo da Lichess.</p>

      {/* MOMENTO DEL TORNEO (3 PULSANTI CHIAVE) */}
      <div className="mb-14">
        <label>Momento del Torneo</label>
        <div className="review-types-3">
          <button
            type="button"
            className={`review-moment-btn ${reviewType === "andata" ? "active" : ""}`}
            onClick={() => setReviewType("andata")}
          >
            <span className="review-moment-title">🔄 Fine Andata{recommended === "andata" && <span className="review-moment-tag">consigliato</span>}</span>
            <span className="review-moment-sub">Com'è andata l'andata, due o tre frasi per giocatore.</span>
          </button>

          <button
            type="button"
            className={`review-moment-btn ${reviewType === "volata" ? "active" : ""}`}
            onClick={() => setReviewType("volata")}
          >
            <span className="review-moment-title">⏱️ Volata Finale{recommended === "volata" && <span className="review-moment-tag">consigliato</span>}</span>
            <span className="review-moment-sub">Cosa resta in gioco nelle ultime partite.</span>
          </button>

          <button
            type="button"
            className={`review-moment-btn ${reviewType === "finale" ? "active" : ""}`}
            onClick={() => setReviewType("finale")}
          >
            <span className="review-moment-title">🏆 Fine Torneo{recommended === "finale" && <span className="review-moment-tag">consigliato</span>}</span>
            <span className="review-moment-sub">Il racconto finale, il campione e poche menzioni per il gruppo.</span>
          </button>
        </div>
      </div>

      {/* Tournament Settings */}
      <div className="mb-12">
        <div>
          <label htmlFor="rev-general-notes">Note extra dell'organizzatore (opzionale)</label>
          <input
            id="rev-general-notes"
            type="text"
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="es. Tante partite decise nel finale, ritmo rilassato..."
          />
        </div>
      </div>

      {/* Accordion for Player Anecdotes & Elo */}
      <div className="mb-18">
        <div className="space-row mb-6">
          <label className="m-0">Aneddoti personali dei giocatori ({config.players.length})</label>
          <button
            type="button"
            className="secondary btn-compact xs"
            onClick={() => setShowAnecdotes(!showAnecdotes)}
          >
            {showAnecdotes ? "Chiudi note ▲" : "Modifica note ▼"}
          </button>
        </div>

        {showAnecdotes && (
          <div className="anecdote-grid">
            <p className="note note-13">
              Piccoli fatti o battute che il giocatore sarebbe contento di rileggere nel gruppo (es. gioca solo di notte, ha cambiato apertura). Vengono usati solo se si inseriscono in modo naturale:
            </p>
            {standings.map((p) => (
              <div key={p.handle} className="anecdote-card">
                <div className="anecdote-card-header">
                  <strong>
                    {p.name} <span className="muted-normal">({p.handle})</span>
                  </strong>
                  <span className="rating-badge">
                    {p.rating ? `Elo ${p.rating}` : "Elo n/d"} · {p.points} pt
                  </span>
                </div>
                <input
                  type="text"
                  className="anecdote-input"
                  value={anecdotes[p.handle] || ""}
                  onChange={(e) => setAnecdote(p.handle, e.target.value)}
                  placeholder={`Aneddoto per ${p.name} (es. papà da poco, gioca solo di notte...)`}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons: Copia Prompt is the primary frictionless action */}
      <div className="actions mb-12">
        <button
          type="button"
          className="primary"
          onClick={handleCopyPrompt}
        >
          {copiedPrompt ? "✅ Prompt Copiato!" : "📋 Copia Prompt per Claude / ChatGPT"}
        </button>
      </div>

      <p className="note mb-16">
        💡 Copia il prompt, incollalo nella tua chat AI abituale e poi incolla qui sotto la recensione ottenuta per vedere l'anteprima WhatsApp.
      </p>

      {/* Review pasted from the AI chat: preview and share */}
      <div className="mt-16">
        <label htmlFor="generated-review-text">Recensione ricevuta dall'AI</label>
        <textarea
          id="generated-review-text"
          value={generatedReview}
          onChange={(e) => setGeneratedReview(e.target.value)}
          rows={10}
          className="ta-xl"
          placeholder="Incolla qui il testo generato da Claude o ChatGPT…"
        />

        {generatedReview.trim() && (
          <>
            <WhatsAppPreview text={generatedReview} title="Anteprima WhatsApp" />

            <div className="actions two mt-10">
              <a
                className="primary"
                target="_blank"
                rel="noopener noreferrer"
                href={"https://wa.me/?text=" + encodeURIComponent(generatedReview)}
              >
                📲 Condividi su WhatsApp
              </a>
              <button type="button" className="secondary" onClick={handleCopyReview}>
                {copiedReview ? "✅ Copiato!" : "📋 Copia Testo"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
