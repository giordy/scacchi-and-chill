import React, { useState, useEffect, useRef } from 'react';
import {
  AppConfig,
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  NoticeState,
} from '../types';
import { fill, formatDeadline } from '../lib/utils';
import { createChallenge } from '../lib/lichess';
import { GameCard } from '../components/GameCard';
import { Notice } from '../components/Notice';
import { WhatsAppPreview } from '../WhatsAppPreview';
import { saveGamesBatchToFirebase } from '../firebaseService';

interface PairingsTabProps {
  config: AppConfig;
  settings: Settings;
  templates: MessageTemplates;
  round: string;
  setRound: (r: string) => void;
  pairs: GamePair[];
  setPairs: React.Dispatch<React.SetStateAction<GamePair[]>>;
  emptyPairs: () => GamePair[];
  nameOf: (handle: string) => string;
  notice: NoticeState | null;
  setNotice: (n: NoticeState | null) => void;
  flash: (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;
  onMissingToken: () => void;
}

export function PairingsTab({
  config,
  settings,
  templates,
  round,
  setRound,
  pairs,
  setPairs,
  emptyPairs,
  nameOf,
  notice,
  setNotice,
  flash,
  onMissingToken,
}: PairingsTabProps) {
  const [busy, setBusy] = useState("");
  const [editedText, setEditedText] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  const updatePair = (i: number, patch: Partial<GamePair>) => {
    setNotice(null);
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const swapPair = (i: number) =>
    updatePair(i, { white: pairs[i].black, black: pairs[i].white });

  const used = new Set(pairs.flatMap((p) => [p.white, p.black]).filter(Boolean));
  const availableFor = (current: string) =>
    config.players.filter((p) => !used.has(p.handle) || p.handle === current);

  const byes = config.players.filter((p) => !used.has(p.handle)).map((p) => p.name);

  const buildMessage = () => {
    const created = pairs.filter((p) => p.url);
    if (created.length === 0) return "";
    const expiryMs = Date.now() + settings.expiry * 86400000;
    const common = {
      round,
      days: settings.days,
      expiry: settings.expiry,
      expiryDeadline: formatDeadline(expiryMs),
      type: settings.rated ? config.typeLabels.rated : config.typeLabels.casual,
      bye: byes.join(", "),
    };
    const games = created.map((p, i) =>
      fill(templates.game, {
        ...common,
        n: config.numberEmojis[i] ?? `${i + 1}.`,
        white: nameOf(p.white),
        black: nameOf(p.black),
        url: p.url,
      })
    );
    const byeLine = byes.length > 0 ? fill(templates.bye, common) : "";
    return [fill(templates.header, common), ...games, byeLine, fill(templates.footer, common)]
      .filter((part) => part.trim() !== "")
      .join("\n\n");
  };

  const generated = buildMessage();

  useEffect(() => setEditedText(null), [generated]);
  const text = editedText ?? generated;
  const hasCreated = pairs.some((p) => p.url);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash("ok", "Messaggio copiato negli appunti.");
    } catch {
      flash("err", "Impossibile copiare automaticamente. Seleziona il testo e copialo a mano.");
    }
  };

  const createGames = async () => {
    setNotice(null);
    if (!settings.token) {
      onMissingToken();
      return flash("err", "Aggiungi prima il tuo token API Lichess nella scheda Impostazioni.");
    }
    const todo = pairs.map((p, i) => ({ p, i })).filter(({ p }) => !p.url);
    const ready = todo.filter(({ p }) => p.white && p.black);
    const half = todo.filter(({ p }) => (p.white || p.black) && !(p.white && p.black));
    if (ready.length === 0) {
      return flash("err", "Seleziona un giocatore bianco e uno nero per almeno una partita.");
    }
    if (
      half.length &&
      !window.confirm(
        `La partita ${half.map(({ i }) => i + 1).join(", ")} è incompleta e verrà saltata. Continuare?`
      )
    ) {
      return;
    }

    const errors: string[] = [];
    for (const { p, i } of ready) {
      setBusy(`Creazione partita ${i + 1} su Lichess…`);
      try {
        const url = await createChallenge(p, { round, settings, challengeName: config.challengeName });
        setPairs((prev) => prev.map((x, idx) => (idx === i ? { ...x, url } : x)));
      } catch (e: any) {
        errors.push(
          `Partita ${i + 1}: ` +
            (e instanceof TypeError
              ? "errore di rete. Controlla la connessione a Internet o eventuali blocchi del browser."
              : e.message)
        );
      }
    }
    setBusy("");
    if (errors.length) {
      flash(
        "err",
        "Alcune partite non sono state create. Correggi l'errore e premi di nuovo Crea; le partite già create restano valide.",
        errors
      );
      return;
    }

    // Sync created games to Firestore in background
    try {
      const gamesToSave: HistoryGame[] = ready
        .map(({ p, i }) => ({
          round,
          white: p.white,
          black: p.black,
          url: pairs[i]?.url || "",
          createdAt: Date.now(),
        }))
        .filter((g) => Boolean(g.url));

      if (gamesToSave.length > 0) {
        saveGamesBatchToFirebase(gamesToSave);
      }
    } catch (err) {
      console.warn("Salvataggio Firebase in background fallito:", err);
    }

    flash("ok", "Partite create con successo e sincronizzate sul database cloud!");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const clearPairs = () => {
    if (
      hasCreated &&
      !window.confirm(
        "Questa azione rimuove i link creati da questa pagina (le partite su Lichess restano comunque aperte). Vuoi azzerare?"
      )
    ) {
      return;
    }
    setPairs(emptyPairs());
    setNotice(null);
  };

  const nextRound = () => {
    const n = parseInt(round, 10);
    setPairs(emptyPairs());
    if (Number.isFinite(n)) setRound(String(n + 1));
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Fills the pairs with the official schedule of the given round
  const loadScheduledRound = (targetRound: string) => {
    const scheduled = (config.schedule || []).filter((m) => m.round === targetRound.trim());
    const newPairs = emptyPairs();
    scheduled.forEach((m, idx) => {
      if (idx < newPairs.length) {
        newPairs[idx] = { white: m.white, black: m.black, url: m.url || "" };
      }
    });
    setPairs(newPairs);
  };

  const roundIsScheduled = (r: string) => (config.schedule || []).some((m) => m.round === r.trim());

  return (
    <section>
      <div className="round-picker">
        <div className="round-picker-row">
          <div className="round-picker-field">
            <label htmlFor="round">Numero del Turno</label>
            <input
              id="round"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={round}
              onChange={(e) => {
                const nextR = e.target.value;
                setRound(nextR);
                if (roundIsScheduled(nextR)) loadScheduledRound(nextR);
              }}
            />
          </div>
          {roundIsScheduled(round) && (
            <button
              type="button"
              className="secondary btn-add compact-13"
              onClick={() => {
                loadScheduledRound(round);
                flash("ok", `Accoppiamenti del Turno ${round} ricaricati dal calendario ufficiale!`);
              }}
            >
              🔄 Ricarica Turno {round}
            </button>
          )}
        </div>
      </div>

      {pairs.map((pair, i) => (
        <GameCard
          key={i}
          index={i}
          pair={pair}
          available={availableFor}
          onChange={(patch) => updatePair(i, patch)}
          onSwap={() => swapPair(i)}
        />
      ))}
      <p className="progress">
        {used.size} di {config.players.length} giocatori inseriti
        {byes.length > 0 && ` (Riposa: ${byes.join(", ")})`}
      </p>

      <button className="primary" type="button" disabled={!!busy} onClick={createGames}>
        {busy || "Crea partite su Lichess"}
      </button>
      <div className="actions">
        <button className="secondary" type="button" onClick={clearPairs}>
          Azzera accoppiamenti
        </button>
      </div>
      <Notice notice={notice} />

      {hasCreated && (
        <section className="result" ref={resultRef}>
          <h2>Messaggio per il gruppo WhatsApp</h2>

          {/* WhatsApp styled live chat bubble preview */}
          <WhatsAppPreview text={text} title="Anteprima WhatsApp (Lancio Turno)" />

          <details className="raw-text">
            <summary>
              Modifica testo grezzo prima dell'invio
            </summary>
            <div className="raw-text-body">
              <textarea
                aria-label="Messaggio per il gruppo WhatsApp"
                value={text}
                onChange={(e) => setEditedText(e.target.value)}
                className="ta-lg"
              />
            </div>
          </details>

          <div className="actions two">
            <a
              className="primary"
              target="_blank"
              rel="noopener noreferrer"
              href={"https://wa.me/?text=" + encodeURIComponent(text)}
            >
              📲 Condividi su WhatsApp
            </a>
            <button className="secondary" type="button" onClick={copyText}>
              📋 Copia testo
            </button>
          </div>
          <div className="actions">
            <button className="secondary" type="button" onClick={nextRound}>
              Inizia prossimo turno
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
