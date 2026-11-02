import React, { useState, useEffect, useRef } from 'react';
import {
  AppConfig,
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  NoticeState,
  LichessExportGame,
  TournamentMeta,
} from './types';
import { validateAndNormalizeConfig, defaultConfig, initialStoredSettings } from './lib/config';
import { fill, extractGameId, formatDeadline } from './lib/utils';
import { createChallenge, fetchGameStates } from './lib/lichess';
import { usePersistentState } from './hooks/usePersistentState';
import { GameCard } from './components/GameCard';
import { Notice } from './components/Notice';
import { SettingsTab } from './tabs/SettingsTab';
import { StatusTab } from './tabs/StatusTab';
import { ReviewsTab } from './ReviewsTab';
import { WhatsAppPreview, Toast } from './WhatsAppPreview';
import { PublicTournamentView } from './PublicTournamentView';
import {
  saveGamesBatchToFirebase,
  saveTournamentMetaToFirebase,
  saveTournamentFullToFirebase,
  loadTournamentFullFromFirebase,
  subscribeToTournamentDoc,
  subscribeToGames,
  testFirestoreConnection,
  saveLichessStatesToFirebase,
  subscribeToAuth,
  signInAdminWithGoogle,
  signOutAdmin,
  isAdminUser,
} from './firebaseService';

/* ---------------- Main App ---------------- */

export function App() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  // Check URL hash for admin mode: #admin or ?admin
  const checkIsAdmin = () => {
    return (
      window.location.hash.toLowerCase().includes("admin") ||
      window.location.search.toLowerCase().includes("admin")
    );
  };

  const [isAdmin, setIsAdmin] = useState(checkIsAdmin);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminAuthError, setAdminAuthError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  useEffect(() => {
    const handleHash = () => setIsAdmin(checkIsAdmin());
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Stato di login Firebase Authentication: l'accesso vale solo per gli account in ADMIN_EMAILS
  useEffect(() => {
    return subscribeToAuth((user) => {
      const ok = isAdminUser(user);
      setIsAdminAuthenticated(ok);
      setAdminEmail(ok && user?.email ? user.email : "");
      if (user && !ok) {
        setAdminAuthError(`L'account ${user.email} non è autorizzato come organizzatore.`);
        signOutAdmin().catch(() => {});
      }
    });
  }, []);

  const handleAdminLogin = async () => {
    setAdminAuthError("");
    setIsVerifyingPassword(true);
    try {
      await signInAdminWithGoogle();
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        setAdminAuthError("Errore durante l'accesso: " + (err?.message || err));
      }
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleAdminLogout = () => {
    signOutAdmin().catch(() => {});
    window.location.hash = "";
  };

  const [activeTab, setActiveTab] = usePersistentState<'pairings' | 'status' | 'reviews' | 'settings'>(
    'pairings.adminActiveTab',
    'pairings'
  );

  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string | null>(null);

  // Attempt to load live config.json and Firestore state on boot
  useEffect(() => {
    testFirestoreConnection();

    fetch("config.json", { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`config.json non trovato (HTTP ${res.status}).`);
        return res.json();
      })
      .then(async (cfg) => {
        const validated = validateAndNormalizeConfig(cfg);
        // Check if Firestore already has full tournament data (meta, players, schedule)
        const remoteTournament = await loadTournamentFullFromFirebase();
        if (remoteTournament) {
          if (remoteTournament.title && remoteTournament.season) {
            validated.tournament = {
              title: remoteTournament.title,
              season: remoteTournament.season,
              subtitle: remoteTournament.subtitle || "La macchina degli scacchi",
              masterName: remoteTournament.masterName || "José Raúl Capablanca",
              imageUrl: remoteTournament.imageUrl || "assets/capablanca.jpg",
              description:
                remoteTournament.description ||
                "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite.",
              rulesText: remoteTournament.rulesText || "",
              howItWorks: remoteTournament.howItWorks || "",
              fairPlayText: remoteTournament.fairPlayText || "",
              winners: remoteTournament.winners || [],
            };
          }
          if (Array.isArray(remoteTournament.players) && remoteTournament.players.length > 0) {
            validated.players = remoteTournament.players;
          }
          if (Array.isArray(remoteTournament.schedule) && remoteTournament.schedule.length > 0) {
            validated.schedule = remoteTournament.schedule;
          }
        } else {
          // If Firestore is empty on first boot, initialize it with the default config!
          saveTournamentFullToFirebase({
            meta: {
              title: "Scacchi & Chill",
              season: "Stagione 2 - Capablanca",
              subtitle: "La macchina degli scacchi",
              masterName: "José Raúl Capablanca",
              imageUrl: "assets/capablanca.jpg",
              description:
                "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite.",
              rulesText: "",
              howItWorks:
                "1. All'inizio di ogni giornata ricevi nel gruppo il link della tua partita: basta aprirlo per avviare la sfida.\n2. Quando la partita finisce, scrivi nel gruppo WhatsApp così il risultato viene registrato.",
              fairPlayText:
                "• Ti impegni a giocare ogni partita con le tue forze, senza motori né aiuti esterni durante la partita (teoria e libri di aperture prima vanno bene), e a mantenere un’atmosfera di rispetto e fiducia nel torneo.\n• In caso di dubbio decide Lichess: se una partita viene chiusa da Lichess con “cheat detected”, il giocatore a cui Lichess attribuisce la violazione perde la partita e i punti del turno. Alla seconda volta, o se Lichess chiude l’account, è escluso dal torneo e i suoi risultati vengono annullati.\n• Non facciamo accuse nel gruppo: eventuali dubbi si scrivono privatamente all'organizzatore.",
              winners: [
                { season: "Stagione 1", name: "Fabio", handle: "fsgach", year: "2026", notes: "Campione 1ª Edizione" },
              ],
            },
            players: validated.players,
            schedule: validated.schedule,
          }).catch((e) => console.warn("Inizializzazione Firestore saltata:", e));
        }
        setConfig(validated);
      })
      .catch((err) => {
        console.warn("Utilizzo configurazione incorporata di default:", err.message);
      });

    // Real-time listener for Tournament Doc changes (players, schedule, rules)
    const unsubDoc = subscribeToTournamentDoc((doc) => {
      setConfig((prev) => {
        const next = { ...prev };
        if (doc.title && doc.season) {
          next.tournament = {
            title: doc.title,
            season: doc.season,
            subtitle: doc.subtitle || "La macchina degli scacchi",
            masterName: doc.masterName || "José Raúl Capablanca",
            imageUrl: doc.imageUrl || "assets/capablanca.jpg",
            description:
              doc.description ||
              "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite.",
            rulesText: doc.rulesText || "",
            howItWorks: doc.howItWorks || "",
            fairPlayText: doc.fairPlayText || "",
            winners: doc.winners || [],
          };
        }
        if (Array.isArray(doc.players) && doc.players.length > 0) {
          next.players = doc.players;
        }
        if (Array.isArray(doc.schedule)) {
          next.schedule = doc.schedule;
        }
        return next;
      });
    });

    // Real-time listener for Firestore games: updates games across all devices instantly!
    const unsubGames = subscribeToGames((remoteGames) => {
      if (remoteGames.length > 0) {
        setHistory((prevLocal) => {
          const remoteByUrl = new Map(remoteGames.filter((rg) => rg.url).map((rg) => [rg.url, rg]));
          const knownUrls = new Set(prevLocal.map((g) => g.url).filter(Boolean));
          // Aggiorna lo stato Lichess delle partite già note con quello salvato in Firestore
          const merged = prevLocal.map((g) => {
            const r = g.url ? remoteByUrl.get(g.url) : undefined;
            return r?.lichess ? { ...g, lichess: r.lichess } : g;
          });
          const toAdd = remoteGames.filter((rg) => rg.url && !knownUrls.has(rg.url));
          return [...merged, ...toAdd];
        });
      }
    });

    return () => {
      unsubDoc();
      unsubGames();
    };
  }, []);

  const gameCount = Math.floor(config.players.length / 2);
  const emptyPairs = (): GamePair[] =>
    Array.from({ length: gameCount }, () => ({ white: "", black: "", url: "" }));

  const nameOf = (handle: string) => config.players.find((p) => p.handle === handle)?.name ?? handle;

  const [round, setRound] = usePersistentState<string>("pairings.round", "1");
  const [history, setHistory] = usePersistentState<HistoryGame[]>(
    "pairings.history",
    [],
    Array.isArray
  );
  const [pairs, setPairs] = usePersistentState<GamePair[]>(
    "pairings.pairs.v2",
    emptyPairs,
    (v) => Array.isArray(v) && v.length === gameCount
  );
  const [storedSettings, setSettings] = usePersistentState<Partial<Settings>>(
    "pairings.settings.v3",
    initialStoredSettings
  );

  const defaultSettings: Settings = {
    token: "",
    days: config.defaults.days,
    expiry: config.defaults.expiry,
    rated: config.defaults.rated,
    rules: config.defaults.rules,
  };

  const settings: Settings = {
    ...defaultSettings,
    ...storedSettings,
    rules: { ...defaultSettings.rules, ...(storedSettings.rules ?? {}) },
  };

  const [templates, setTemplates] = usePersistentState<Partial<MessageTemplates> | null>(
    "pairings.templates.v2",
    null
  );

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [busy, setBusy] = useState("");
  const [editedText, setEditedText] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const settingsTabRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2800);
  };

  const flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => {
    setNotice({ kind, text, items });
    if (kind === 'ok') {
      triggerToast(text);
    }
  };

  // Remember every created game in history without duplicating, and sync with config.schedule
  useEffect(() => {
    setHistory((h) => {
      const knownIds = new Set(h.map((g) => extractGameId(g.url)));
      const addedFromPairs = pairs
        .filter((p) => p.url && extractGameId(p.url) && !knownIds.has(extractGameId(p.url)))
        .map((p) => ({
          round,
          white: p.white,
          black: p.black,
          url: p.url,
          createdAt: Date.now(),
        }));

      // Also merge any games present in config.schedule that have a URL
      const addedFromSchedule: HistoryGame[] = [];
      if (config.schedule && config.schedule.length > 0) {
        config.schedule.forEach((m) => {
          if (m.url) {
            const id = extractGameId(m.url);
            if (id && !knownIds.has(id)) {
              knownIds.add(id);
              addedFromSchedule.push({
                round: m.round,
                white: m.white,
                black: m.black,
                url: m.url,
                createdAt: Date.now(),
              });
            }
          }
        });
      }

      const allAdded = [...addedFromPairs, ...addedFromSchedule];
      return allAdded.length ? [...h, ...allAdded].slice(-200) : h;
    });
  }, [pairs, round, config.schedule, setHistory]);

  // Lo stato delle partite (esito, mosse, apertura) è salvato in Firestore nel campo `lichess`:
  // la vista pubblica lo legge da lì, senza chiamare Lichess dal browser di ogni visitatore.
  const liveGameStates = React.useMemo(() => {
    const map: Record<string, LichessExportGame> = {};
    history.forEach((g) => {
      const id = extractGameId(g.url);
      if (id && g.lichess) map[id] = g.lichess;
    });
    return map;
  }, [history]);

  // Pulsante "Sincronizza" (solo organizzatore): legge da Lichess e salva su Firestore.
  const syncLichessToFirebase = async () => {
    const isFinished = (s?: LichessExportGame) =>
      Boolean(s && s.status && s.status !== "created" && s.status !== "started");

    const targets = history.filter((g) => extractGameId(g.url) && !isFinished(g.lichess));
    if (history.filter((g) => extractGameId(g.url)).length === 0) {
      flash("warning", "Non ci sono ancora partite con un link Lichess da sincronizzare.");
      return;
    }
    if (targets.length === 0) {
      flash("ok", "Tutte le partite risultano già concluse e salvate: niente da aggiornare.");
      return;
    }

    setIsSyncingLive(true);
    try {
      const ids = Array.from(new Set(targets.map((g) => extractGameId(g.url) as string)));
      const states = await fetchGameStates(ids);
      const saved = await saveLichessStatesToFirebase(targets, states, extractGameId);

      setHistory((prev) =>
        prev.map((g) => {
          const id = extractGameId(g.url);
          const s = id ? states[id] : undefined;
          return s ? { ...g, lichess: s } : g;
        })
      );

      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setLastLiveSyncTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);

      const missing = targets.length - saved;
      flash(
        missing > 0 ? "warning" : "ok",
        `Sincronizzate ${saved} partite su Firestore.` +
          (missing > 0 ? ` ${missing} non ancora trovate su Lichess (sfida non accettata).` : "")
      );
    } catch (e: any) {
      flash("err", "Sincronizzazione fallita: " + (e?.message || e));
    } finally {
      setIsSyncingLive(false);
    }
  };

  const updatePair = (i: number, patch: Partial<GamePair>) => {
    setNotice(null);
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const swapPair = (i: number) =>
    updatePair(i, { white: pairs[i].black, black: pairs[i].white });

  const used = new Set(pairs.flatMap((p) => [p.white, p.black]).filter(Boolean));
  const availableFor = (current: string) =>
    config.players.filter((p) => !used.has(p.handle) || p.handle === current);

  const tpl: MessageTemplates = { ...config.messageTemplates, ...(templates ?? {}) };
  const byes = config.players.filter((p) => !used.has(p.handle)).map((p) => p.name);

  const buildMessage = ({
    currentPairs,
    currentRound,
    currentSettings,
    currentTemplates,
    currentByes,
  }: {
    currentPairs: GamePair[];
    currentRound: string;
    currentSettings: Settings;
    currentTemplates: MessageTemplates;
    currentByes: string[];
  }) => {
    const created = currentPairs.filter((p) => p.url);
    if (created.length === 0) return "";
    const expiryMs = Date.now() + currentSettings.expiry * 86400000;
    const expiryDeadline = formatDeadline(expiryMs);
    const common = {
      round: currentRound,
      days: currentSettings.days,
      expiry: currentSettings.expiry,
      expiryDeadline,
      type: currentSettings.rated ? config.typeLabels.rated : config.typeLabels.casual,
      bye: currentByes.join(", "),
    };
    const games = created.map((p, i) =>
      fill(currentTemplates.game, {
        ...common,
        n: config.numberEmojis[i] ?? `${i + 1}.`,
        white: nameOf(p.white),
        black: nameOf(p.black),
        url: p.url,
      })
    );
    const byeLine = currentByes.length > 0 ? fill(currentTemplates.bye, common) : "";
    return [
      fill(currentTemplates.header, common),
      ...games,
      byeLine,
      fill(currentTemplates.footer, common),
    ]
      .filter((part) => part.trim() !== "")
      .join("\n\n");
  };

  const generated = buildMessage({
    currentPairs: pairs,
    currentRound: round,
    currentSettings: settings,
    currentTemplates: tpl,
    currentByes: byes,
  });

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
      setActiveTab('settings');
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
        const url = await createChallenge(p, {
          round,
          settings,
          challengeName: config.challengeName,
        });
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
    } else {
      // Sync created games to Firestore in background
      try {
        const gamesToSave: HistoryGame[] = ready.map(({ p, i }) => ({
          round,
          white: p.white,
          black: p.black,
          url: pairs[i]?.url || "",
          createdAt: Date.now(),
        })).filter((g) => Boolean(g.url));

        if (gamesToSave.length > 0) {
          saveGamesBatchToFirebase(gamesToSave);
        }
      } catch (err) {
        console.warn("Salvataggio Firebase in background fallito:", err);
      }

      flash("ok", "Partite create con successo e sincronizzate sul database cloud!");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
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

  const handleLoadRoundIntoPairs = (loadedRound: string, loadedGames: HistoryGame[]) => {
    const newPairs = emptyPairs();
    loadedGames.forEach((g, idx) => {
      if (idx < newPairs.length) {
        newPairs[idx] = { white: g.white, black: g.black, url: g.url };
      }
    });
    setRound(loadedRound);
    setPairs(newPairs);
    setActiveTab('pairings');
    flash("ok", `Turno ${loadedRound} caricato nella scheda Partite.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // If NOT in admin mode: show the Public Tournament Page (Clean, with discreet link to admin)
  if (!isAdmin) {
    return (
      <main>
        <PublicTournamentView
          config={config}
          tournamentMeta={
            config.tournament || {
              title: "Scacchi & Chill",
              season: "Stagione 2 - Capablanca",
              subtitle: "La macchina degli scacchi",
              masterName: "José Raúl Capablanca",
              imageUrl: "assets/capablanca.jpg",
              description:
                "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite.",
              rulesText: "2 giorni a mossa. Nessuna rivincita. Fair play assoluto.",
            }
          }
          history={history}
          gameStates={liveGameStates}
          nameOf={nameOf}
        />

        {/* Link per l'organizzatore nella parte pubblica */}
        <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <a
            href="#admin"
            style={{
              fontSize: 12,
              color: "var(--muted)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              opacity: 0.85,
            }}
          >
            🔒 Area Organizzatore
          </a>
        </div>
      </main>
    );
  }

  // If in admin mode but NOT authenticated: show Password Login Screen
  if (!isAdminAuthenticated) {
    return (
      <main>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--accent)" }}>
              Accesso Riservato
            </span>
            <h1 style={{ margin: "2px 0 0", fontSize: 22 }}>🔒 Area Organizzatore</h1>
          </div>
          <a
            href="#"
            className="secondary"
            style={{
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 8,
              textDecoration: "none",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            ← Torna al Torneo
          </a>
        </div>

        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 20, maxWidth: 440, margin: "20px auto" }}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Accedi con Google</h2>
          <p className="note" style={{ margin: "0 0 16px" }}>
            La gestione del torneo è riservata all'organizzatore. Accedi con l'account Google autorizzato.
          </p>

          {adminAuthError && (
            <div className="notice err" style={{ marginBottom: 14 }}>
              {adminAuthError}
            </div>
          )}

          <button
            className="primary"
            type="button"
            onClick={handleAdminLogin}
            disabled={isVerifyingPassword}
            style={{ width: "100%", minHeight: 48 }}
          >
            {isVerifyingPassword ? "Accesso in corso…" : "Accedi con Google 🔓"}
          </button>
        </div>
      </main>
    );
  }

  // If in admin mode AND authenticated: show the Full Tournament Admin Console
  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--accent)", letterSpacing: 0.5 }}>
            🔒 Area Organizzatore · {adminEmail}
          </span>
          <h1 style={{ margin: "2px 0 0", fontSize: 22 }}>Gestione Torneo</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <a
            href="#"
            className="secondary"
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 8,
              textDecoration: "none",
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            👁️ Vista Pubblica
          </a>
          <button
            type="button"
            className="secondary"
            onClick={handleAdminLogout}
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--danger)",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Esci dalla sessione amministratore"
          >
            Esci 🚪
          </button>
        </div>
      </div>
      <p className="sub">Crea gli accoppiamenti, genera le sfide su Lichess e gestisci il torneo.</p>
      <div className="strip" aria-hidden="true" />

      {/* Sincronizzazione risultati: Lichess → Firestore (la vista pubblica legge da qui) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="secondary"
          onClick={syncLichessToFirebase}
          disabled={isSyncingLive}
          style={{ minHeight: 40, fontWeight: 600 }}
        >
          {isSyncingLive ? "Sincronizzazione…" : "🔄 Sincronizza risultati"}
        </button>
        <span className="note" style={{ margin: 0, fontSize: 12 }}>
          {lastLiveSyncTime
            ? `Ultima sincronizzazione alle ${lastLiveSyncTime}`
            : "Aggiorna i risultati visibili al pubblico"}
        </span>
      </div>

      {/* Modern Phone-Friendly Tabs Navigation (Admin Only) */}
      <nav className="tabs" role="tablist" aria-label="Navigazione sezioni">
        <button
          className={`tab-btn ${activeTab === 'pairings' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'pairings'}
          onClick={() => setActiveTab('pairings')}
        >
          <span className="tab-icon">♟️</span>
          <span className="tab-label">Partite</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'status'}
          onClick={() => setActiveTab('status')}
        >
          <span className="tab-icon">📊</span>
          <span className="tab-label">Stato</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'reviews'}
          onClick={() => setActiveTab('reviews')}
        >
          <span className="tab-icon">✨</span>
          <span className="tab-label">Recensione</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Opzioni</span>
        </button>
      </nav>

      {/* Tab 1: Pairings & Challenge Creation */}
      {activeTab === 'pairings' && (
        <section>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ flex: 1, marginRight: 8 }}>
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
                    const scheduledForRound = (config.schedule || []).filter((m) => m.round === nextR.trim());
                    if (scheduledForRound.length > 0) {
                      const newPairs = emptyPairs();
                      scheduledForRound.forEach((m, idx) => {
                        if (idx < newPairs.length) {
                          newPairs[idx] = { white: m.white, black: m.black, url: m.url || "" };
                        }
                      });
                      setPairs(newPairs);
                    }
                  }}
                />
              </div>
              {config.schedule && config.schedule.some((m) => m.round === round.trim()) && (
                <button
                  type="button"
                  className="secondary"
                  style={{ minHeight: 48, fontSize: 13, whiteSpace: "nowrap" }}
                  onClick={() => {
                    const scheduledForRound = (config.schedule || []).filter((m) => m.round === round.trim());
                    const newPairs = emptyPairs();
                    scheduledForRound.forEach((m, idx) => {
                      if (idx < newPairs.length) {
                        newPairs[idx] = { white: m.white, black: m.black, url: m.url || "" };
                      }
                    });
                    setPairs(newPairs);
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
            {byes.length > 0 && ` (Riposa: ${byes.join(', ')})`}
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

              <details style={{ marginTop: 8, marginBottom: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
                  Modifica testo grezzo prima dell'invio
                </summary>
                <div style={{ marginTop: 8 }}>
                  <textarea
                    aria-label="Messaggio per il gruppo WhatsApp"
                    value={text}
                    onChange={(e) => setEditedText(e.target.value)}
                    style={{ minHeight: 180 }}
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
      )}

      {/* Tab 2: Game Status & Recovery */}
      {activeTab === 'status' && (
        <StatusTab
          history={history}
          setHistory={setHistory}
          defaultDays={settings.days}
          config={config}
          onLoadIntoActivePairs={handleLoadRoundIntoPairs}
          triggerToast={triggerToast}
        />
      )}

      {/* Tab 3: AI Reviews & Highlights */}
      {activeTab === 'reviews' && (
        <ReviewsTab
          history={history}
          config={config}
          nameOf={nameOf}
          triggerToast={triggerToast}
        />
      )}

      {/* Tab 4: Settings */}
      {activeTab === 'settings' && (
        <section>
          <h2>Impostazioni e Regole</h2>
          <Notice notice={notice} />
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            templates={tpl}
            setTemplates={setTemplates}
            history={history}
            setHistory={setHistory}
            round={round}
            setRound={setRound}
            pairs={pairs}
            setPairs={setPairs}
            flash={flash}
            panelRef={settingsTabRef}
            config={config}
            onUpdateTournamentMeta={(patch) => {
              const updatedMeta: TournamentMeta = {
                title: patch.title ?? config.tournament?.title ?? "Scacchi & Chill",
                season: patch.season ?? config.tournament?.season ?? "Stagione 2 - Capablanca",
                subtitle: patch.subtitle ?? config.tournament?.subtitle ?? "La macchina degli scacchi",
                masterName: patch.masterName ?? config.tournament?.masterName ?? "José Raúl Capablanca",
                imageUrl: patch.imageUrl ?? config.tournament?.imageUrl ?? "assets/capablanca.jpg",
                description:
                  patch.description ??
                  config.tournament?.description ??
                  "Per rendere ogni appuntamento sempre vario e coinvolgente, ogni stagione del nostro torneo è dedicata a un grande campione della storia degli scacchi, con aneddoti e curiosità legati alla sua carriera durante lo svolgimento delle partite.",
                howItWorks:
                  patch.howItWorks ??
                  config.tournament?.howItWorks ??
                  "1. All'inizio di ogni giornata ricevi nel gruppo il link della tua partita: basta aprirlo per avviare la sfida.\n2. Quando la partita finisce, scrivi nel gruppo WhatsApp così il risultato viene registrato.",
                fairPlayText:
                  patch.fairPlayText ??
                  config.tournament?.fairPlayText ??
                  "• Ti impegni a giocare ogni partita con le tue forze, senza motori né aiuti esterni durante la partita (teoria e libri di aperture prima vanno bene), e a mantenere un’atmosfera di rispetto e fiducia nel torneo.\n• In caso di dubbio decide Lichess: se una partita viene chiusa da Lichess con “cheat detected”, il giocatore a cui Lichess attribuisce la violazione perde la partita e i punti del turno. Alla seconda volta, o se Lichess chiude l’account, è escluso dal torneo e i suoi risultati vengono annullati.\n• Non facciamo accuse nel gruppo: eventuali dubbi si scrivono privatamente all'organizzatore.",
                winners:
                  patch.winners ??
                  config.tournament?.winners ?? [
                    { season: "Stagione 1", name: "Fabio", handle: "fsgach", year: "2026", notes: "Campione 1ª Edizione" },
                  ],
                rulesText: patch.rulesText ?? config.tournament?.rulesText ?? "",
              };
              setConfig((prev) => ({
                ...prev,
                tournament: updatedMeta,
              }));
              saveTournamentMetaToFirebase(updatedMeta).catch((e) =>
                console.warn("Salvataggio metadati su Firestore fallito:", e)
              );
            }}
            onUpdatePlayers={(updatedPlayers) => {
              setConfig((prev) => ({ ...prev, players: updatedPlayers }));
              saveTournamentFullToFirebase({ players: updatedPlayers }).catch((e) =>
                console.warn("Salvataggio giocatori su Firestore fallito:", e)
              );
            }}
            onUpdateSchedule={(updatedSchedule) => {
              setConfig((prev) => ({ ...prev, schedule: updatedSchedule }));
              saveTournamentFullToFirebase({ schedule: updatedSchedule }).catch((e) =>
                console.warn("Salvataggio calendario su Firestore fallito:", e)
              );
            }}
          />
        </section>
      )}

      {/* Floating Global Toast Notification */}
      <Toast message={toastMessage || ""} isVisible={Boolean(toastMessage)} />
    </main>
  );
}

export default App;
