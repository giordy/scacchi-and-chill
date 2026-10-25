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
} from './types';
import rawConfig from '../config.json';

export const RULES = [
  { key: "noRematch", label: "No rematch offers" },
  { key: "noGiveTime", label: "No giving time to the opponent" },
  { key: "noClaimWin", label: "No claiming victory if the opponent leaves" },
  { key: "noEarlyDraw", label: "No early draws (draw offers blocked early in the game)" },
];

function validateAndNormalizeConfig(cfg: any): AppConfig {
  const fail = (msg: string) => { throw new Error("config.json: " + msg); };
  const isText = (v: any): v is string => typeof v === "string";
  const isTextList = (v: any): v is string[] => Array.isArray(v) && v.length > 0 && v.every(isText);

  if (!Array.isArray(cfg?.players) || cfg.players.length < 2 || cfg.players.some((p: any) => !p || !isText(p.handle) || !p.handle.trim())) {
    fail('"players" must be a list of at least 2 entries like { "handle": "lichess_username", "name": "Name" }.');
  }
  const handles = cfg.players.map((p: any) => p.handle.trim().toLowerCase());
  if (new Set(handles).size !== handles.length) fail('"players" contains the same handle twice.');

  const t = cfg.messageTemplates;
  if (!t || !["header", "game", "bye", "footer"].every((k) => isText(t[k]))) {
    fail('"messageTemplates" needs the text fields "header", "game", "bye" and "footer".');
  }
  if (!cfg.typeLabels || !isText(cfg.typeLabels.rated) || !isText(cfg.typeLabels.casual)) {
    fail('"typeLabels" needs "rated" and "casual".');
  }
  if (!isText(cfg.challengeName)) fail('"challengeName" must be text.');

  const sp = cfg.statusPhrases;
  const spKeys = ["header", "ongoing", "win", "draw", "aborted", "pending", "footer", "closing"];
  const badKey = sp && spKeys.find((k) => !isTextList(sp[k]));
  if (!sp || badKey) fail(`"statusPhrases.${badKey ?? "…"}" must be a non-empty list of texts.`);
  if (sp.highlight !== undefined && !isTextList(sp.highlight)) fail('"statusPhrases.highlight" must be a non-empty list of texts (or left out).');

  const d = cfg.defaults ?? {};
  const days = Number(d.days ?? 2);
  const expiry = Number(d.expiry ?? 2);
  if (!Number.isInteger(days) || days < 1 || days > 14) fail('"defaults.days" must be a whole number from 1 to 14.');
  if (!Number.isInteger(expiry) || expiry < 1 || expiry > 14) fail('"defaults.expiry" must be a whole number from 1 to 14.');

  return {
    players: cfg.players.map((p: any) => ({
      handle: p.handle.trim(),
      name: (isText(p.name) && p.name.trim()) || p.handle.trim(),
    })),
    defaults: {
      days,
      expiry,
      rated: d.rated !== false,
      rules: Object.fromEntries(RULES.map(({ key }) => [key, !!d.rules?.[key]])) as any,
    },
    messageTemplates: {
      header: t.header,
      game: t.game,
      bye: t.bye,
      footer: t.footer,
    },
    typeLabels: {
      rated: cfg.typeLabels.rated,
      casual: cfg.typeLabels.casual,
    },
    challengeName: cfg.challengeName,
    numberEmojis: isTextList(cfg.numberEmojis) ? cfg.numberEmojis : [],
    statusPhrases: sp,
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
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("weekday")} alle ${get("hour")}:${get("minute")}`;
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
  return (
    <div className="side">
      <span className={"dot " + (color === "white" ? "w" : "b")} title={color} />
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{color === "white" ? "Bianco…" : "Nero…"}</option>
        {players.map((p) => (
          <option key={p.handle} value={p.handle}>
            {p.name}
          </option>
        ))}
      </select>
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
  flash,
  panelRef,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  flash: (kind: 'ok' | 'err', text: string, items?: string[]) => void;
  panelRef: React.RefObject<HTMLDivElement>;
}) {
  const [tokenDraft, setTokenDraft] = useState(settings.token);
  useEffect(() => {
    setTokenDraft(settings.token);
  }, [settings.token]);

  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const setTemplate = (key: string, text: string) =>
    setTemplates((t) => ({ ...(t ?? {}), [key]: text } as Partial<MessageTemplates>));

  return (
    <div ref={panelRef} style={{ display: 'grid', gap: '14px' }}>
      <div>
        <label htmlFor="token">Token API Lichess</label>
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
    </div>
  );
}

function StatusTab({
  history,
  setHistory,
  defaultDays,
  config,
  onLoadIntoActivePairs,
}: {
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  defaultDays: number;
  config: AppConfig;
  onLoadIntoActivePairs: (round: string, games: HistoryGame[]) => void;
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
  const [status, setStatus] = useState({ busy: false, error: "", info: "" });

  // Recover games section
  const [recText, setRecText] = useState("");
  const [recRound, setRecRound] = useState("");
  const [parsedPreview, setParsedPreview] = useState<{
    round: string;
    games: Array<{ white: string; black: string; url: string }>;
    problems: string[];
  } | null>(null);
  const [recNotice, setRecNotice] = useState<NoticeState | null>(null);

  // Manage saved rounds
  const [showManage, setShowManage] = useState(false);

  const handleAnalyzeRecovery = () => {
    setRecNotice(null);
    if (!recText.trim()) {
      return setRecNotice({ kind: "err", text: "Incolla prima il messaggio WhatsApp del turno." });
    }
    const parsed = parseRoundMessage(recText, config.players);
    if (parsed.games.length === 0) {
      return setRecNotice({
        kind: "err",
        text: "Nessun link Lichess trovato nel testo incollato. Controlla che contenga i link delle partite.",
        items: parsed.problems,
      });
    }
    const roundToUse = parsed.round || recRound.trim() || "1";
    setRecRound(roundToUse);
    setParsedPreview({
      round: roundToUse,
      games: parsed.games,
      problems: parsed.problems,
    });
  };

  const handleConfirmRecovery = (mode: 'replace' | 'merge') => {
    if (!parsedPreview) return;
    const targetRound = recRound.trim() || parsedPreview.round;
    if (!targetRound) {
      return setRecNotice({ kind: "err", text: "Inserisci il numero del turno." });
    }

    if (mode === 'replace') {
      // Remove all existing games for this round and add recovered ones
      setHistory((prev) => {
        const otherRounds = prev.filter((g) => g.round !== targetRound);
        const newGames: HistoryGame[] = parsedPreview.games.map((g) => ({
          round: targetRound,
          white: g.white,
          black: g.black,
          url: g.url,
          createdAt: Date.now(),
        }));
        return [...otherRounds, ...newGames].slice(-100);
      });
      setRecNotice({
        kind: "ok",
        text: `Turno ${targetRound} sostituito con successo con ${parsedPreview.games.length} partite.`,
      });
    } else {
      // Merge only missing games
      setHistory((prev) => {
        const existingUrls = new Set(prev.filter((g) => g.round === targetRound).map((g) => extractGameId(g.url)));
        const fresh = parsedPreview.games
          .filter((g) => !existingUrls.has(extractGameId(g.url)))
          .map((g) => ({
            round: targetRound,
            white: g.white,
            black: g.black,
            url: g.url,
            createdAt: Date.now(),
          }));
        return [...prev, ...fresh].slice(-100);
      });
      setRecNotice({
        kind: "ok",
        text: `Partite del Turno ${targetRound} integrate nello storico.`,
      });
    }

    setChosen(targetRound);
    setParsedPreview(null);
    setRecText("");
  };

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
      const head = `${config.numberEmojis[i] ?? i + 1 + "."} ${nameOf(white)} ⚪ vs ${nameOf(black)} ⚫`;
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
        const common = { moves, opening, openingNote: opening ? `Apertura: ${opening}` : "" };
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
        finishedInfo.push({ names: `${nameOf(white)}–${nameOf(black)}`, moves });
        detailsList.push(
          `${i + 1}. ${id}: stato ${s.status}, vincitore ${s.winner ?? "nessuno"}, mosse ${moves}, apertura ${
            opening || "n/d"
          }`
        );
      }
      return `${head}\n${body}`;
    });

    let highlight = "";
    const timed = finishedInfo.filter((x) => x.moves > 0).sort((a, b) => a.moves - b.moves);
    if (config.statusPhrases.highlight && timed.length >= 2 && timed[0].moves !== timed[timed.length - 1].moves) {
      const label = (x: { names: string; moves: number }) => `${x.names} (${x.moves} mosse)`;
      highlight = fill(pickFor("highlight"), {
        longest: label(timed[timed.length - 1]),
        shortest: label(timed[0]),
      });
    }

    const textResult = [
      fill(pickFor("header"), { round }),
      ...blocks,
      highlight,
      fill(pickFor("footer"), count),
      pickFor("closing"),
    ]
      .filter(Boolean)
      .join("\n\n");

    return { text: textResult, details: detailsList };
  };

  const load = async () => {
    const games = history.filter((g) => g.round === round);
    setStatus({ busy: true, error: "", info: "" });
    try {
      const ids = games.map((g) => extractGameId(g.url)).filter((id): id is string => Boolean(id));
      const states = await fetchGameStates(ids);
      const built = buildStatusMessageInternal(games, states);
      setText(built.text);
      setDetails(built.details);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus((s) => ({ ...s, info: "Messaggio copiato negli appunti." }));
    } catch {
      setStatus((s) => ({ ...s, info: "Impossibile copiare automaticamente: seleziona il testo e copia a mano." }));
    }
  };

  return (
    <section>
      <h2>Stato e Risultati Partite</h2>
      {rounds.length === 0 ? (
        <p className="note">
          Nessuna partita memorizzata. Crea un turno nella scheda <strong>Partite</strong> oppure recupera un turno precedente incollando il messaggio WhatsApp più in basso.
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
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

          <div className="actions">
            <button className="primary" type="button" disabled={status.busy} onClick={load}>
              {status.busy ? "Controllo in corso su Lichess…" : "Aggiorna stato da Lichess"}
            </button>
          </div>

          {status.error && <div className="notice err">{status.error}</div>}

          {text && (
            <>
              <div style={{ marginTop: 14 }}>
                <textarea
                  aria-label="Messaggio di aggiornamento"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
              <div className="actions two">
                <a
                  className="primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={"https://wa.me/?text=" + encodeURIComponent(text)}
                >
                  Condividi su WhatsApp
                </a>
                <button className="secondary" type="button" onClick={copy}>
                  Copia testo
                </button>
              </div>
              {status.info && <div className="notice ok">{status.info}</div>}
              <details>
                <summary>Dettagli tecnici Lichess (verifica mosse)</summary>
                <div className="body">
                  <p className="note">
                    Dati restituiti dalle API pubbliche di Lichess. Ricorda che per le partite in corso le ultimissime mosse non vengono mostrate in pubblico per evitare aiuti esterni.
                  </p>
                  <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>
                    {details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </details>
            </>
          )}
        </>
      )}

      {/* Management of saved rounds */}
      <details open={showManage} onToggle={(e) => setShowManage((e.target as HTMLDetailsElement).open)}>
        <summary>Gestione turni salvati ({rounds.length} {rounds.length === 1 ? 'turno' : 'turni'})</summary>
        <div className="body">
          <p className="note">
            Qui puoi vedere tutte le partite memorizzate per ciascun turno, eliminare turni caricati per errore o ricaricarli nella schermata principale.
          </p>
          {rounds.length === 0 ? (
            <p className="note">Nessun turno presente nello storico.</p>
          ) : (
            <div>
              {rounds.map((r) => {
                const roundGames = history.filter((g) => g.round === r);
                return (
                  <div key={r} className="round-card">
                    <div className="round-header">
                      <strong>Turno {r}</strong>
                      <span className="badge">{roundGames.length} {roundGames.length === 1 ? 'partita' : 'partite'}</span>
                    </div>
                    <ul className="match-list">
                      {roundGames.map((g, idx) => (
                        <li key={idx}>
                          {nameOf(g.white)} ⚪ vs {nameOf(g.black)} ⚫ —{' '}
                          <a href={g.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                            {extractGameId(g.url)}
                          </a>
                        </li>
                      ))}
                    </ul>
                    <div className="actions two">
                      <button
                        className="secondary"
                        type="button"
                        style={{ minHeight: '38px', fontSize: '13px' }}
                        onClick={() => onLoadIntoActivePairs(r, roundGames)}
                      >
                        Carica in Partite
                      </button>
                      <button
                        className="danger"
                        type="button"
                        style={{ minHeight: '38px', fontSize: '13px' }}
                        onClick={() => handleDeleteRound(r)}
                      >
                        Elimina Turno {r}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 12 }}>
                <button className="danger" type="button" style={{ width: '100%' }} onClick={handleClearAllHistory}>
                  Cancella tutto lo storico
                </button>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* Protected Recovery from WhatsApp message */}
      <details>
        <summary>Recupera partite da messaggio WhatsApp</summary>
        <div className="body">
          <p className="note">
            Incolla il testo del messaggio che avevi pubblicato all'avvio del turno. Supporta automaticamente sia i link Lichess tradizionali che i nuovi formati (<code>lichess.org/...</code> e <code>lichess.org/challenge/...</code>).
          </p>
          <textarea
            className="small"
            aria-label="Messaggio turno da recuperare"
            value={recText}
            placeholder="Incolla qui il messaggio del turno..."
            onChange={(e) => {
              setRecText(e.target.value);
              setParsedPreview(null);
              setRecNotice(null);
            }}
          />

          <button className="secondary" type="button" disabled={!recText.trim()} onClick={handleAnalyzeRecovery}>
            Analizza messaggio
          </button>

          <Notice notice={recNotice} />

          {/* Safe Interactive Preview with overwrite protection */}
          {parsedPreview && (
            <div className="preview-box">
              <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Anteprima partite riconosciute</h3>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="edit-rec-round">Numero Turno da assegnare</label>
                <input
                  id="edit-rec-round"
                  type="text"
                  inputMode="numeric"
                  value={recRound}
                  onChange={(e) => setRecRound(e.target.value)}
                />
              </div>

              <ul className="match-list" style={{ marginBottom: 12 }}>
                {parsedPreview.games.map((g, idx) => (
                  <li key={idx}>
                    <strong>Partita {idx + 1}:</strong> {nameOf(g.white)} (bianco) vs {nameOf(g.black)} (nero)
                    <br />
                    <span style={{ fontSize: '12px', opacity: 0.85 }}>{g.url}</span>
                  </li>
                ))}
              </ul>

              {parsedPreview.problems.length > 0 && (
                <div className="notice warning" style={{ margin: '8px 0' }}>
                  <strong>Attenzione:</strong>
                  <ul>
                    {parsedPreview.problems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Check if targetRound already exists */}
              {rounds.includes(recRound.trim()) ? (
                <div>
                  <div className="notice warning" style={{ margin: '8px 0 12px' }}>
                    ⚠️ Il <strong>Turno {recRound.trim()}</strong> esiste già nello storico (
                    {history.filter((g) => g.round === recRound.trim()).length} partite). Scegli come procedere per evitare sovrascritture accidentali:
                  </div>
                  <div className="actions">
                    <button
                      className="primary"
                      type="button"
                      style={{ background: 'var(--danger)' }}
                      onClick={() => handleConfirmRecovery('replace')}
                    >
                      Sostituisci completamente il Turno {recRound.trim()}
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => handleConfirmRecovery('merge')}
                    >
                      Unisci solo le partite mancanti
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => setParsedPreview(null)}
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <div className="actions two">
                  <button
                    className="primary"
                    type="button"
                    onClick={() => handleConfirmRecovery('replace')}
                  >
                    Salva nel Turno {recRound.trim()}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setParsedPreview(null)}
                  >
                    Annulla
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </details>
    </section>
  );
}

/* ---------------- Main App ---------------- */

export function App() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [activeTab, setActiveTab] = usePersistentState<'pairings' | 'status' | 'settings'>(
    'pairings.activeTab',
    'pairings'
  );

  // Attempt to load live config.json if available
  useEffect(() => {
    fetch("config.json", { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`config.json non trovato (HTTP ${res.status}).`);
        return res.json();
      })
      .then((cfg) => {
        const validated = validateAndNormalizeConfig(cfg);
        setConfig(validated);
      })
      .catch((err) => {
        console.warn("Utilizzo configurazione incorporata di default:", err.message);
      });
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
  const settingsTabRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);

  const flash = (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) =>
    setNotice({ kind, text, items });

  // Remember every created game in history without duplicating
  useEffect(() => {
    setHistory((h) => {
      const knownIds = new Set(h.map((g) => extractGameId(g.url)));
      const added = pairs
        .filter((p) => p.url && extractGameId(p.url) && !knownIds.has(extractGameId(p.url)))
        .map((p) => ({
          round,
          white: p.white,
          black: p.black,
          url: p.url,
          createdAt: Date.now(),
        }));
      return added.length ? [...h, ...added].slice(-100) : h;
    });
  }, [pairs, round, setHistory]);

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
    const common = {
      round: currentRound,
      days: currentSettings.days,
      expiry: currentSettings.expiry,
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
      flash("ok", "Partite create con successo! Puoi condividere il messaggio qui sotto.");
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

  return (
    <main>
      <h1>Round pairings</h1>
      <p className="sub">Crea gli accoppiamenti, genera le sfide su Lichess e segui lo stato del torneo.</p>
      <div className="strip" aria-hidden="true" />

      {/* Modern Phone-Friendly Tabs Navigation */}
      <nav className="tabs" role="tablist" aria-label="Navigazione sezioni">
        <button
          className={`tab-btn ${activeTab === 'pairings' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'pairings'}
          onClick={() => setActiveTab('pairings')}
        >
          ♟️ Partite
        </button>
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'status'}
          onClick={() => setActiveTab('status')}
        >
          📊 Stato
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Impostazioni
        </button>
      </nav>

      {/* Tab 1: Pairings & Challenge Creation */}
      {activeTab === 'pairings' && (
        <section>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="round">Numero del Turno</label>
            <input
              id="round"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={round}
              onChange={(e) => setRound(e.target.value)}
            />
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
              <textarea
                aria-label="Messaggio per il gruppo WhatsApp"
                value={text}
                onChange={(e) => setEditedText(e.target.value)}
              />
              <div className="actions two">
                <a
                  className="primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={"https://wa.me/?text=" + encodeURIComponent(text)}
                >
                  Condividi su WhatsApp
                </a>
                <button className="secondary" type="button" onClick={copyText}>
                  Copia testo
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
        />
      )}

      {/* Tab 3: Settings */}
      {activeTab === 'settings' && (
        <section>
          <h2>Impostazioni e Regole</h2>
          <Notice notice={notice} />
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            templates={tpl}
            setTemplates={setTemplates}
            flash={flash}
            panelRef={settingsTabRef}
          />
        </section>
      )}
    </main>
  );
}

export default App;
