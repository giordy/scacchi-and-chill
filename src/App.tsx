import React, { useState, useEffect, useRef } from 'react';
import {
  AppConfig,
  Player,
  GamePair,
  HistoryGame,
  Settings,
  MessageTemplates,
  NoticeState,
  LichessExportGame,
  BackupData,
  TournamentMeta,
  ScheduledMatch,
  SeasonWinner,
} from './types';
import rawConfig from '../config.json';
import { ReviewsTab } from './ReviewsTab';
import { WhatsAppPreview, Toast } from './WhatsAppPreview';
import { PublicTournamentView } from './PublicTournamentView';
import {
  saveGameToFirebase,
  saveGamesBatchToFirebase,
  saveTournamentMetaToFirebase,
  loadTournamentMetaFromFirebase,
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

export const RULES = [
  { key: "noRematch", label: "No rematch offers" },
  { key: "noGiveTime", label: "No giving time to the opponent" },
  { key: "noClaimWin", label: "No claiming victory if the opponent leaves" },
  { key: "noEarlyDraw", label: "No early draws (draw offers blocked early in the game)" },
];

function validateAndNormalizeConfig(cfg: any): AppConfig {
  const fail = (msg: string) => {
    throw new Error("config.json: " + msg);
  };
  const isText = (v: any): v is string => typeof v === "string";
  const isTextList = (v: any): v is string[] =>
    Array.isArray(v) && v.length > 0 && v.every(isText);

  // 1. Players
  const players = cfg?.players || cfg?.giocatori;
  if (
    !Array.isArray(players) ||
    players.length < 2 ||
    players.some((p: any) => !p || !isText(p.handle) || !p.handle.trim())
  ) {
    fail('"players" must be a list of at least 2 entries with { "handle": "lichess_username", "name": "Name" }.');
  }
  const handles = players.map((p: any) => p.handle.trim().toLowerCase());
  if (new Set(handles).size !== handles.length) {
    fail('"players" contains the same handle twice.');
  }

  // 2. Defaults
  const d = cfg.defaults || cfg.impostazioniPredefinite || {};
  const days = Number(d.days ?? 2);
  const expiry = Number(d.expiry ?? 2);
  if (!Number.isInteger(days) || days < 1 || days > 14) {
    fail('"days" must be a whole number from 1 to 14.');
  }
  if (!Number.isInteger(expiry) || expiry < 1 || expiry > 14) {
    fail('"expiry" must be a whole number from 1 to 14.');
  }

  // 3. Round message templates (supports roundMessage or messageTemplates)
  const rm = cfg.roundMessage || cfg.messaggioNuovoTurno || cfg.messageTemplates;
  if (!rm || !["header", "game", "bye", "footer"].every((k) => isText(rm[k]))) {
    fail('"roundMessage" needs the text fields "header", "game", "bye" and "footer".');
  }

  const typeLabels = rm.typeLabels || rm.etichetteTipo || cfg.typeLabels || { rated: "classificate", casual: "amichevoli" };
  if (!isText(typeLabels.rated) || !isText(typeLabels.casual)) {
    fail('"typeLabels" needs "rated" and "casual".');
  }

  const challengeName = isText(rm.challengeName)
    ? rm.challengeName
    : isText(rm.nomeSfida)
    ? rm.nomeSfida
    : isText(cfg.challengeName)
    ? cfg.challengeName
    : "Turno {round}";

  const numberEmojisRaw = rm.numberEmojis || rm.numeriEmoji || cfg.numberEmojis;
  const numberEmojis = isTextList(numberEmojisRaw) ? numberEmojisRaw : [];

  // 4. Status message phrases (supports statusMessage or statusPhrases)
  const sm = cfg.statusMessage || cfg.messaggioStatoPartite || cfg.statusPhrases;
  if (!sm) fail('"statusMessage" is missing in config.json.');

  const smHeader = sm.header || sm.titoli;
  const smOngoing = sm.ongoing || sm.inCorso;
  const smWin = sm.win || sm.vittoria;
  const smDraw = sm.draw || sm.patta;
  const smAborted = sm.aborted || sm.annullata;
  const smPending = sm.pending || sm.daIniziare;
  const smFooter = sm.footer || sm.riepilogo;
  const smClosingRaw = sm.closing !== undefined ? sm.closing : sm.chiusura;
  const smClosing = Array.isArray(smClosingRaw) ? smClosingRaw.filter(isText) : [];

  if (!isTextList(smHeader)) fail('"statusMessage.header" must be a non-empty list of texts.');
  if (!isTextList(smOngoing)) fail('"statusMessage.ongoing" must be a non-empty list of texts.');
  if (!isTextList(smWin)) fail('"statusMessage.win" must be a non-empty list of texts.');
  if (!isTextList(smDraw)) fail('"statusMessage.draw" must be a non-empty list of texts.');
  if (!isTextList(smAborted)) fail('"statusMessage.aborted" must be a non-empty list of texts.');
  if (!isTextList(smPending)) fail('"statusMessage.pending" must be a non-empty list of texts.');
  if (!isTextList(smFooter)) fail('"statusMessage.footer" must be a non-empty list of texts.');

  const highlightRaw = sm.highlight || sm.inEvidenza;
  const highlight = Array.isArray(highlightRaw) && isTextList(highlightRaw) ? highlightRaw : undefined;

  const roundEndHeaderRaw = sm.roundEndHeader || sm.fineTurnoTitoli;
  const roundEndHeader = Array.isArray(roundEndHeaderRaw) && isTextList(roundEndHeaderRaw) ? roundEndHeaderRaw : undefined;

  const roundEndFooterRaw = sm.roundEndFooter || sm.fineTurnoRiepilogo;
  const roundEndFooter = Array.isArray(roundEndFooterRaw) && isTextList(roundEndFooterRaw) ? roundEndFooterRaw : undefined;

  const infoLink = isText(sm.infoLink) ? sm.infoLink.trim() : (isText(cfg.infoLink) ? cfg.infoLink.trim() : undefined);
  const infoLine = isText(sm.infoLine)
    ? sm.infoLine.trim()
    : infoLink
    ? `🌐 Classifica e regolamento: ${infoLink}`
    : undefined;

  const tournamentMeta = cfg.tournament ? {
    title: isText(cfg.tournament.title) ? cfg.tournament.title : "Scacchi & Chill",
    season: isText(cfg.tournament.season) ? cfg.tournament.season : "Edizione 2026",
    description: isText(cfg.tournament.description) ? cfg.tournament.description : "Campionato amatoriale di scacchi per corrispondenza tra amici e colleghi.",
    rulesText: isText(cfg.tournament.rulesText) ? cfg.tournament.rulesText : "2 giorni a mossa. Nessuna rivincita. Fair play assoluto.",
  } : {
    title: "Scacchi & Chill",
    season: "Edizione 2026",
    description: "Campionato amatoriale di scacchi per corrispondenza tra amici e colleghi.",
    rulesText: "Partite per corrispondenza con cadenza a 2 giorni per mossa. No takeback, partite Rated, rispetto e fair play tra amici.",
  };

  const rawSchedule = cfg.schedule || cfg.calendario;
  const schedule = Array.isArray(rawSchedule)
    ? rawSchedule
        .filter((m: any) => m && isText(m.round) && isText(m.white) && isText(m.black))
        .map((m: any) => ({
          round: String(m.round).trim(),
          white: String(m.white).trim(),
          black: String(m.black).trim(),
          url: isText(m.url) ? m.url.trim() : undefined,
        }))
    : undefined;

  return {
    tournament: tournamentMeta,
    players: players.map((p: any) => ({
      handle: p.handle.trim(),
      name: (isText(p.name) && p.name.trim()) || p.handle.trim(),
    })),
    schedule,
    defaults: {
      days,
      expiry,
      rated: d.rated !== false,
      rules: Object.fromEntries(RULES.map(({ key }) => [key, !!d.rules?.[key]])) as any,
    },
    messageTemplates: {
      header: rm.header,
      game: rm.game,
      bye: rm.bye,
      footer: rm.footer,
    },
    typeLabels,
    challengeName,
    numberEmojis,
    statusPhrases: {
      header: smHeader,
      ongoing: smOngoing,
      win: smWin,
      draw: smDraw,
      aborted: smAborted,
      pending: smPending,
      footer: smFooter,
      closing: smClosing,
      highlight,
      roundEndHeader,
      roundEndFooter,
      infoLine,
      infoLink,
    },
  };
}

const defaultConfig: AppConfig = validateAndNormalizeConfig(rawConfig);

function initialStoredSettings(): Partial<Settings> {
  for (const key of ["pairings.settings.v2", "pairings.settings"]) {
    try {
      const old = JSON.parse(localStorage.getItem(key) || "{}");
      if (old?.token) return { token: old.token };
    } catch {
      // ignore
    }
  }
  return {};
}

const fill = (template: string, vars: Record<string, any>) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));

const clampDays = (value: string | number, fallback: number) => {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(14, Math.max(1, n)) : fallback;
};

// Extracts 8-character game ID supporting lichess.org/ID, lichess.org/game/ID, lichess.org/challenge/ID, etc.
export function extractGameId(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:(?:game|challenge|embed\/game|embed)\/)?([a-zA-Z0-9]{8})/i);
  return match?.[1];
}

function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  isValid: (v: any) => boolean = () => true
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }, [key, value]);

  return [value, setValue];
}

async function createChallenge(
  pair: GamePair,
  {
    round,
    settings,
    challengeName,
  }: { round: string; settings: Settings; challengeName: string }
): Promise<string> {
  const body = new URLSearchParams({
    users: `${pair.white},${pair.black}`,
    rated: String(settings.rated),
    days: String(settings.days),
    name: fill(challengeName, { round }),
    expiresAt: String(Date.now() + settings.expiry * 86400000),
  });

  const rules = RULES.map((r) => r.key).filter((key) => settings.rules?.[key]);
  if (rules.length > 0) body.set("rules", rules.join(","));

  const res = await fetch("https://lichess.org/api/challenge/open", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + settings.token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    const hint =
      res.status === 401
        ? "Token non valido o scaduto."
        : res.status === 429
        ? "Limite richieste Lichess: attendi un minuto e riprova."
        : "";
    throw new Error(`HTTP ${res.status}. ${hint} ${detail}`.trim());
  }

  const data = await res.json();
  const url = (data.challenge ?? data).url;
  if (!url) throw new Error("Lichess non ha restituito un link.");
  return url;
}

function formatDeadline(ms: number) {
  // Round to nearest 10 minutes for natural readability (e.g. 15:40 instead of 15:37)
  const roundedMs = Math.round(ms / (10 * 60 * 1000)) * (10 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(roundedMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("weekday")} ${get("day")}/${get("month")} alle ${get("hour")}:${get("minute")}`;
}

async function fetchGameStates(ids: string[]): Promise<Record<string, LichessExportGame>> {
  if (ids.length === 0) return {};
  const res = await fetch("https://lichess.org/api/games/export/_ids?pgnInJson=false&lastFen=true&opening=true", {
    method: "POST",
    headers: { "Content-Type": "text/plain", Accept: "application/x-ndjson" },
    body: ids.join(","),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const states: Record<string, LichessExportGame> = {};
  const text = await res.text();
  text
    .split("\n")
    .filter((l) => l.trim())
    .forEach((line) => {
      try {
        const g = JSON.parse(line);
        if (g.id) states[g.id] = g;
      } catch {
        // ignore
      }
    });
  return states;
}

const HOW_WIN: Record<string, string> = {
  mate: "con il matto",
  resign: "per abbandono",
  outoftime: "per tempo scaduto",
  timeout: "per tempo scaduto",
};
const HOW_DRAW: Record<string, string> = {
  stalemate: "per stallo",
};

const tidy = (t: string) =>
  t.replace(/\(\s*\)/g, "").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n+/g, "\n").trim();

// Estimates the moves threshold for ongoing games (single thresholds: meno di 10, più di 10/20/30/40)
function getApproxMoves(plies: number): { approxMoves: string; movesBand: string; phase: string } {
  const estimatedMoves = Math.max(1, Math.floor(plies / 2) + 1);
  if (estimatedMoves < 10) {
    return {
      approxMoves: "meno di 10 mosse",
      movesBand: "< 10 mosse",
      phase: "in apertura",
    };
  }
  if (estimatedMoves < 20) {
    return {
      approxMoves: "più di 10 mosse",
      movesBand: "> 10 mosse",
      phase: "nel mediogioco",
    };
  }
  if (estimatedMoves < 30) {
    return {
      approxMoves: "più di 20 mosse",
      movesBand: "> 20 mosse",
      phase: "nel vivo del gioco",
    };
  }
  if (estimatedMoves < 40) {
    return {
      approxMoves: "più di 30 mosse",
      movesBand: "> 30 mosse",
      phase: "fase avanzata",
    };
  }
  return {
    approxMoves: "più di 40 mosse",
    movesBand: "> 40 mosse",
    phase: "in pieno finale",
  };
}

// Parses a pasted round message, recognizing both old and new Lichess URL formats
function parseRoundMessage(text: string, players: Player[]) {
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const round = text.match(/(?:turno|round)\s*(\d+)/i)?.[1] ?? "";
  
  // Supports lichess.org/AbCdEfGh, lichess.org/game/AbCdEfGh, lichess.org/challenge/AbCdEfGh, 12-char URLs, etc.
  const linkRe = /(?:https?:\/\/)?(?:www\.)?lichess\.org\/(?:(?:game|challenge|embed\/game|embed)\/)?([a-zA-Z0-9]{8})[a-zA-Z0-9]*(?:[^\s<>"'()]*)?/gi;
  const games: Array<{ white: string; black: string; url: string }> = [];
  const problems: string[] = [];
  let previousEnd = 0;
  let n = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(text))) {
    n++;
    const gameId = match[1];
    const segment = text.slice(previousEnd, match.index);
    previousEnd = match.index + match[0].length;

    const found = players
      .map((p) => {
        let best = -1;
        [p.name, p.handle].forEach((label) => {
          const re = new RegExp("(^|[^\\p{L}\\p{N}])" + escapeRe(label) + "(?![\\p{L}\\p{N}])", "iu");
          const hit = re.exec(segment);
          if (hit) {
            const idx = hit.index + hit[1].length;
            if (best === -1 || idx < best) best = idx;
          }
        });
        return { player: p, idx: best };
      })
      .filter((x) => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx);

    if (found.length < 2) {
      problems.push(`Link ${n} (${gameId}): non è stato possibile identificare i due giocatori nel testo prima del link.`);
      continue;
    }
    games.push({
      white: found[0].player.handle,
      black: found[1].player.handle,
      url: `https://lichess.org/${gameId}`,
    });
  }
  return { round, games, problems };
}

/* ---------------- Components ---------------- */

function PlayerSelect({
  color,
  label,
  value,
  players,
  disabled,
  onChange,
}: {
  color: 'white' | 'black';
  label: string;
  value: string;
  players: Player[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedPlayer = players.find((p) => p.handle === value);

  return (
    <div className="side-container">
      <div className="side">
        <span className={"dot " + (color === "white" ? "w" : "b")} title={color} />
        
        {/* Quick Chip Button that opens the visual player picker grid */}
        <div style={{ display: "flex", gap: 6, width: "100%" }}>
          <button
            type="button"
            className={`player-chip-btn ${value ? "filled" : "empty"}`}
            disabled={disabled}
            onClick={() => setShowPicker(!showPicker)}
            aria-label={label}
          >
            <span style={{ fontWeight: value ? 600 : 400 }}>
              {selectedPlayer ? selectedPlayer.name : (color === "white" ? "Seleziona Bianco…" : "Seleziona Nero…")}
            </span>
            <span style={{ fontSize: 11, opacity: 0.6 }}>▼</span>
          </button>
          {value && !disabled && (
            <button
              type="button"
              className="chip-clear-btn"
              title="Rimuovi giocatore"
              onClick={() => onChange("")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Visual Chip Grid Modal/Dropdown */}
      {showPicker && !disabled && (
        <div className="player-chips-popover">
          <div className="player-chips-header">
            <span>Scegli giocatore per il {color === "white" ? "⚪ Bianco" : "⚫ Nero"}:</span>
            <button type="button" className="close-chips-btn" onClick={() => setShowPicker(false)}>✕</button>
          </div>
          <div className="player-chips-grid">
            {players.map((p) => {
              const isCurrent = p.handle === value;
              return (
                <button
                  key={p.handle}
                  type="button"
                  className={`player-chip ${isCurrent ? "current" : ""}`}
                  onClick={() => {
                    onChange(p.handle);
                    setShowPicker(false);
                  }}
                >
                  <span className="chip-name">{p.name}</span>
                  <span className="chip-handle">@{p.handle}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GameCard({
  index,
  pair,
  available,
  onChange,
  onSwap,
}: {
  index: number;
  pair: GamePair;
  available: (current: string) => Player[];
  onChange: (patch: Partial<GamePair>) => void;
  onSwap: () => void;
}) {
  const locked = !!pair.url;
  return (
    <div className="game">
      <h2>
        <span>Partita {index + 1}</span>
        <span className="state">{locked ? "Creata" : ""}</span>
      </h2>
      <div className="pair">
        <div className="selects">
          <PlayerSelect
            color="white"
            label={`Partita ${index + 1} bianco`}
            value={pair.white}
            players={available(pair.white)}
            disabled={locked}
            onChange={(v) => onChange({ white: v })}
          />
          <PlayerSelect
            color="black"
            label={`Partita ${index + 1} nero`}
            value={pair.black}
            players={available(pair.black)}
            disabled={locked}
            onChange={(v) => onChange({ black: v })}
          />
        </div>
        <button
          className="swap"
          type="button"
          disabled={locked}
          onClick={onSwap}
          aria-label={`Scambia colori partita ${index + 1}`}
        >
          ⇅
        </button>
      </div>
    </div>
  );
}

function Notice({ notice }: { notice: NoticeState | null }) {
  if (!notice) return null;
  return (
    <div className={"notice " + notice.kind} role="status" aria-live="polite">
      {notice.text}
      {notice.items && (
        <ul>
          {notice.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DaysField({
  id,
  label,
  value,
  fallback,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  fallback: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setText(raw);
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= 14) onCommit(n);
  };
  const handleBlur = () => {
    const n = clampDays(text, fallback);
    if (n !== value) onCommit(n);
    setText(String(n));
  };

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}

function SettingsTab({
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

function StatusTab({
  history,
  setHistory,
  defaultDays,
  config,
  onLoadIntoActivePairs,
  triggerToast,
}: {
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  defaultDays: number;
  config: AppConfig;
  onLoadIntoActivePairs: (round: string, games: HistoryGame[]) => void;
  triggerToast?: (msg: string) => void;
}) {
  const nameOf = (handle: string) => config.players.find((p) => p.handle === handle)?.name ?? handle;
  const idToHandle = (id?: string) =>
    config.players.find((p) => p.handle.toLowerCase() === String(id ?? "").toLowerCase())?.handle;

  const rounds = [...new Set(history.map((g) => g.round))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  const [chosen, setChosen] = useState("");
  const round = rounds.includes(chosen) ? chosen : rounds[rounds.length - 1] ?? "";
  const [text, setText] = useState("");
  const [details, setDetails] = useState<string[]>([]);
  const [isRoundComplete, setIsRoundComplete] = useState(false);
  const [status, setStatus] = useState({ busy: false, error: "", info: "" });
  const [showManage, setShowManage] = useState(false);

  const handleDeleteRound = (roundToDelete: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare tutte le partite del Turno ${roundToDelete}?`)) {
      setHistory((prev) => prev.filter((g) => g.round !== roundToDelete));
      if (chosen === roundToDelete) setChosen("");
    }
  };

  const handleClearAllHistory = () => {
    if (window.confirm("Attenzione: questo cancellerà TUTTO lo storico delle partite salvate. Continuare?")) {
      setHistory([]);
      setChosen("");
      setText("");
    }
  };

  const buildStatusMessageInternal = (games: HistoryGame[], states: Record<string, LichessExportGame>) => {
    const count = { finished: 0, ongoing: 0, pending: 0 };
    const detailsList: string[] = [];
    const finishedInfo: Array<{ names: string; moves: number }> = [];
    const finishedOpenings = new Map<string, string>();

    const used: Record<string, Set<number>> = {};
    const pickFor = (key: string): string => {
      const list = config.statusPhrases[key] ?? [];
      if (!list || list.length === 0) return "";
      const seen = (used[key] ??= new Set());
      if (seen.size >= list.length) seen.clear();
      let i: number;
      do {
        i = Math.floor(Math.random() * list.length);
      } while (seen.has(i));
      seen.add(i);
      return list[i];
    };

    const blocks = games.map((g, i) => {
      const id = extractGameId(g.url);
      const s = id ? states[id] : undefined;
      const white = idToHandle(s?.players?.white?.user?.id) ?? g.white;
      const black = idToHandle(s?.players?.black?.user?.id) ?? g.black;
      const head = `${config.numberEmojis[i] ?? i + 1 + "."} *${nameOf(white)}* ⚪ vs *${nameOf(black)}* ⚫`;
      let body: string;

      if (!s) {
        count.pending++;
        body = pickFor("pending");
        detailsList.push(`${i + 1}. ${id}: non ancora trovata su Lichess (sfida non ancora accettata)`);
      } else if (s.status === "created" || s.status === "started") {
        count.ongoing++;
        const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
        const fen = typeof s.lastFen === "string" ? s.lastFen.trim().split(/\s+/) : [];
        const hasFen = fen[1] === "w" || fen[1] === "b";
        const whiteToMove = hasFen ? fen[1] === "w" : plies % 2 === 0;
        const fenMove = parseInt(fen[5], 10);
        const move = hasFen && Number.isFinite(fenMove) ? fenMove : Math.floor(plies / 2) + 1;
        const days = s.daysPerTurn ?? defaultDays;
        const deadlineMs = (s.lastMoveAt ?? s.createdAt ?? Date.now()) + days * 86400000;

        const approx = getApproxMoves(plies);

        body = fill(pickFor("ongoing"), {
          move,
          turn: nameOf(whiteToMove ? white : black),
          approxMoves: approx.approxMoves,
          movesBand: approx.movesBand,
          phase: approx.phase,
          deadline: deadlineMs < Date.now() ? "adesso (tempo scaduto)" : formatDeadline(deadlineMs),
        });

        detailsList.push(
          `${i + 1}. ${id}: bianco=${s.players?.white?.user?.name ?? "?"}, nero=${s.players?.black?.user?.name ?? "?"}, ` +
            `semi-mosse=${plies} (~${approx.approxMoves}), tocca a=${whiteToMove ? "bianco" : "nero"}, ` +
            `ultimo movimento: ${s.lastMoveAt ? new Date(s.lastMoveAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "?"}`
        );
      } else if (s.status === "aborted" || s.status === "noStart") {
        body = pickFor("aborted");
        detailsList.push(`${i + 1}. ${id}: stato ${s.status}`);
      } else {
        count.finished++;
        const plies = s.moves && s.moves.trim() ? s.moves.trim().split(/\s+/).length : 0;
        const moves = Math.ceil(plies / 2);
        const movesText = moves > 0 ? `in ${moves} ${moves === 1 ? "mossa" : "mosse"}` : "";
        const opening = s.opening?.name ?? "";
        const mainOpening = opening.split(":")[0].trim();
        if (mainOpening) {
          const studyUrl = `https://lichess.org/study/search?q=${encodeURIComponent(mainOpening)}&order=popular`;
          finishedOpenings.set(mainOpening, studyUrl);
        }
        const openingNote = opening ? `♟️ Apertura: ${opening}` : "";
        const common = { moves, opening, mainOpening, openingNote };
        const won = s.winner === "white" || s.winner === "black";

        if (won) {
          const winnerHandle = s.winner === "white" ? white : black;
          const loserHandle = s.winner === "white" ? black : white;
          const color = s.winner === "white" ? "col bianco" : "col nero";
          const how = HOW_WIN[s.status] ?? "";
          body = tidy(
            fill(pickFor("win"), {
              ...common,
              winner: nameOf(winnerHandle),
              loser: nameOf(loserHandle),
              result: s.winner === "white" ? "1-0" : "0-1",
              color,
              how,
              details: [color, how, movesText].filter(Boolean).join(" "),
            })
          );
        } else {
          const how = HOW_DRAW[s.status] ?? "";
          body = tidy(
            fill(pickFor("draw"), {
              ...common,
              result: "½-½",
              how,
              details: [how, movesText].filter(Boolean).join(" "),
            })
          );
        }

        // Guarantee opening is included whenever Lichess detected it
        if (opening && !body.includes(opening)) {
          body = `${body}\n${openingNote}`;
        }

        finishedInfo.push({ names: `${nameOf(white)}–${nameOf(black)}`, moves });
        detailsList.push(
          `${i + 1}. ${id}: stato ${s.status}, vincitore ${s.winner ?? "nessuno"}, mosse ${moves}, apertura ${
            opening || "n/d"
          }`
        );
      }
      return `${head}\n${body}`;
    });

    const isRoundComplete = games.length > 0 && count.finished === games.length;

    let highlight = "";
    const timed = finishedInfo.filter((x) => x.moves > 0).sort((a, b) => a.moves - b.moves);
    if (
      isRoundComplete &&
      config.statusPhrases.highlight &&
      timed.length >= 2 &&
      timed[0].moves !== timed[timed.length - 1].moves
    ) {
      const label = (x: { names: string; moves: number }) => `${x.names} (${x.moves} mosse)`;
      highlight = fill(pickFor("highlight"), {
        longest: label(timed[timed.length - 1]),
        shortest: label(timed[0]),
      });
    }

    const headerTemplate =
      isRoundComplete && config.statusPhrases.roundEndHeader && config.statusPhrases.roundEndHeader.length > 0
        ? pickFor("roundEndHeader")
        : pickFor("header");

    const footerTemplate =
      isRoundComplete && config.statusPhrases.roundEndFooter && config.statusPhrases.roundEndFooter.length > 0
        ? pickFor("roundEndFooter")
        : pickFor("footer");

    let studiesAppendix = "";
    if (isRoundComplete && finishedOpenings.size > 0) {
      const items = Array.from(finishedOpenings.entries()).map(
        ([name, url]) => `• ${name}: ${url}`
      );
      studiesAppendix = `📚 *Studi consigliati per le aperture del turno:*\n${items.join("\n")}`;
    }

    const textResult = [
      fill(headerTemplate, { round, ...count }),
      ...blocks,
      fill(footerTemplate, { round, ...count }),
      highlight,
      config.statusPhrases.closing && config.statusPhrases.closing.length > 0 ? pickFor("closing") : "",
      studiesAppendix,
      isRoundComplete && config.statusPhrases.infoLine ? config.statusPhrases.infoLine : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return { text: textResult, details: detailsList, isComplete: isRoundComplete };
  };

  const loadStatusForRound = async (targetRound: string) => {
    let games = history.filter((g) => g.round === targetRound);
    if (games.length === 0) {
      setText("");
      setIsRoundComplete(false);
      return;
    }

    // Sort games in the exact order defined in the tournament schedule
    if (config.schedule && config.schedule.length > 0) {
      games = [...games].sort((a, b) => {
        const idxA = config.schedule!.findIndex(
          (m) => m.round === a.round && m.white === a.white && m.black === a.black
        );
        const idxB = config.schedule!.findIndex(
          (m) => m.round === b.round && m.white === b.white && m.black === b.black
        );
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
    setStatus({ busy: true, error: "", info: "" });
    try {
      const ids = games.map((g) => extractGameId(g.url)).filter((id): id is string => Boolean(id));
      const states = await fetchGameStates(ids);
      const built = buildStatusMessageInternal(games, states);
      setText(built.text);
      setDetails(built.details);
      setIsRoundComplete(built.isComplete);
      setStatus({ busy: false, error: "", info: "" });
    } catch (e: any) {
      setStatus({
        busy: false,
        info: "",
        error:
          e instanceof TypeError
            ? "Errore di connessione di rete verso Lichess."
            : e.message,
      });
    }
  };

  // Automatically update status whenever round is chosen or games change
  useEffect(() => {
    if (round) {
      loadStatusForRound(round);
    }
  }, [round, history.length]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus((s) => ({ ...s, info: "Messaggio copiato negli appunti." }));
      if (triggerToast) {
        triggerToast("Messaggio di stato copiato negli appunti! 📋");
      }
    } catch {
      setStatus((s) => ({ ...s, info: "Impossibile copiare automaticamente: seleziona il testo e copia a mano." }));
    }
  };

  return (
    <section>
      <h2>Stato e Risultati Partite</h2>
      {rounds.length === 0 ? (
        <p className="note">
          Nessuna partita memorizzata. Crea un turno nella scheda <strong>Partite</strong> per monitorarne lo stato in tempo reale.
        </p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="status-round">Seleziona Turno</label>
              <select id="status-round" value={round} onChange={(e) => setChosen(e.target.value)}>
                {rounds.map((r) => {
                  const count = history.filter((g) => g.round === r).length;
                  return (
                    <option key={r} value={r}>
                      Turno {r} ({count} {count === 1 ? 'partita' : 'partite'})
                    </option>
                  );
                })}
              </select>
            </div>
            <button
              className="secondary"
              type="button"
              disabled={status.busy}
              onClick={() => loadStatusForRound(round)}
              style={{ minHeight: 48, whiteSpace: "nowrap" }}
            >
              {status.busy ? "Verifica in corso…" : "🔄 Aggiorna da Lichess"}
            </button>
          </div>

          {status.error && <div className="notice err">{status.error}</div>}

          {status.busy && (
            <div className="notice ok" style={{ marginBottom: 14 }}>
              ⏳ Recupero stati, aperture e mosse delle partite da Lichess…
            </div>
          )}

          {text && (
            <>
              {isRoundComplete && (
                <div className="notice ok" style={{ marginTop: 10, marginBottom: 12 }}>
                  🏁 <strong>Turno {round} completato!</strong> Tutte le partite sono terminate. Il messaggio contiene i risultati finali.
                </div>
              )}

              {/* WhatsApp Live Bubble Preview */}
              <WhatsAppPreview text={text} title={`Anteprima WhatsApp (Stato Turno ${round})`} />

              <div className="actions two" style={{ marginTop: 12 }}>
                <a
                  className="primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={"https://wa.me/?text=" + encodeURIComponent(text)}
                >
                  📲 Condividi su WhatsApp
                </a>
                <button className="secondary" type="button" onClick={copy}>
                  📋 Copia testo
                </button>
              </div>

              {status.info && <div className="notice ok" style={{ marginTop: 8 }}>{status.info}</div>}

              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
                  ✏️ Modifica testo prima dell'invio
                </summary>
                <div style={{ marginTop: 8 }}>
                  <textarea
                    aria-label="Messaggio di aggiornamento"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    style={{ minHeight: 180 }}
                  />
                </div>
              </details>
            </>
          )}
        </>
      )}

      {/* Archivio Compatto turni salvati */}
      {rounds.length > 0 && (
        <details style={{ marginTop: 24 }} open={showManage} onToggle={(e) => setShowManage((e.target as HTMLDetailsElement).open)}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
            🗂️ Archivio e pulizia turni ({rounds.length} {rounds.length === 1 ? 'turno' : 'turni'})
          </summary>
          <div className="body" style={{ marginTop: 10 }}>
            {rounds.map((r) => {
              const roundGames = history.filter((g) => g.round === r);
              return (
                <div key={r} className="round-card" style={{ marginBottom: 10 }}>
                  <div className="round-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>Turno {r}</strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="secondary"
                        type="button"
                        style={{ fontSize: 12, padding: "3px 8px" }}
                        onClick={() => onLoadIntoActivePairs(r, roundGames)}
                      >
                        Carica in Partite
                      </button>
                      <button
                        className="danger"
                        type="button"
                        style={{ fontSize: 12, padding: "3px 8px" }}
                        onClick={() => handleDeleteRound(r)}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, textDecoration: "underline", cursor: "pointer" }}
                onClick={handleClearAllHistory}
              >
                Cancella tutto lo storico salvato
              </button>
            </div>
          </div>
        </details>
      )}
    </section>
  );
}

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
