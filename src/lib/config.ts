import {
  AppConfig,
  ScheduledMatch,
  Settings,
} from '../types';
import { tournamentFromDoc } from './tournament';
import type { TournamentDocData } from '../firebaseService';
import rawConfig from '../../config.json';

export const RULES = [
  { key: "noRematch", label: "Niente richieste di rivincita" },
  { key: "noGiveTime", label: "Non si può regalare tempo all'avversario" },
  { key: "noClaimWin", label: "Non si può reclamare la vittoria se l'avversario sparisce" },
  { key: "noEarlyDraw", label: "Niente patta nelle prime mosse" },
];

// Untrusted JSON from config.json: every field is checked below before use.
type RawJson = any;

export function validateAndNormalizeConfig(cfg: RawJson): AppConfig {
  const fail = (msg: string) => {
    throw new Error("config.json: " + msg);
  };
  const isText = (v: unknown): v is string => typeof v === "string";
  const isTextList = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length > 0 && v.every(isText);

  // 1. Players: optional. The players of a tournament live on Firestore (added from the organizer
  // area); a list here only seeds a new tournament on its first start.
  const players = cfg?.players ?? cfg?.giocatori ?? [];
  if (
    !Array.isArray(players) ||
    players.some((p: RawJson) => !p || !isText(p.handle) || !p.handle.trim())
  ) {
    fail('"players", if given, must be a list of { "handle": "lichess_username", "name": "Name" }.');
  }
  const handles = players.map((p: RawJson) => p.handle.trim().toLowerCase());
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

  const upsetRaw = sm.upset || sm.colpaccio;
  const upset = Array.isArray(upsetRaw) && isTextList(upsetRaw) ? upsetRaw : undefined;
  const upsetDrawRaw = sm.upsetDraw || sm.colpaccioPatta;
  const upsetDraw = Array.isArray(upsetDrawRaw) && isTextList(upsetDrawRaw) ? upsetDrawRaw : undefined;
  const summitRaw = sm.summit || sm.scontroAlVertice;
  const summit = Array.isArray(summitRaw) && isTextList(summitRaw) ? summitRaw : undefined;

  const roundEndHeaderRaw = sm.roundEndHeader || sm.fineTurnoTitoli;
  const roundEndHeader = Array.isArray(roundEndHeaderRaw) && isTextList(roundEndHeaderRaw) ? roundEndHeaderRaw : undefined;


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
  } : {
    title: "Scacchi & Chill",
    season: "Edizione 2026",
    description: "Campionato amatoriale di scacchi per corrispondenza tra amici e colleghi.",
  };

  const rawSchedule = cfg.schedule || cfg.calendario;
  const schedule = Array.isArray(rawSchedule) ? normalizeSchedule(rawSchedule) : undefined;

  return {
    tournament: tournamentMeta,
    players: players.map((p: RawJson) => ({
      handle: p.handle.trim(),
      name: (isText(p.name) && p.name.trim()) || p.handle.trim(),
    })),
    schedule,
    defaults: {
      days,
      expiry,
      rated: d.rated !== false,
      rules: Object.fromEntries(RULES.map(({ key }) => [key, !!d.rules?.[key]])) as AppConfig['defaults']['rules'],
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
      upset,
      upsetDraw,
      summit,
      roundEndHeader,
      infoLine,
      infoLink,
    },
  };
}

export const defaultConfig: AppConfig = validateAndNormalizeConfig(rawConfig);

// Keeps only round, white and black of each planned game: any old "url" field is dropped,
// so a Lichess link can only come from "Crea partite su Lichess" when the round starts.
export function normalizeSchedule(raw: unknown[]): ScheduledMatch[] {
  const isText = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
  return raw
    .filter((m: RawJson) => m && isText(m.round) && isText(m.white) && isText(m.black))
    .map((m: RawJson) => ({
      round: String(m.round).trim(),
      white: String(m.white).trim(),
      black: String(m.black).trim(),
    }));
}

export function initialStoredSettings(): Partial<Settings> {
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

// The Firestore tournament document over a config: what it has (meta, players, schedule) wins
export function withTournamentDoc(cfg: AppConfig, doc: TournamentDocData | null): AppConfig {
  if (!doc) return cfg;
  const next = { ...cfg };
  const meta = tournamentFromDoc(doc);
  if (meta) next.tournament = meta;
  if (Array.isArray(doc.players)) next.players = doc.players;
  if (Array.isArray(doc.schedule)) next.schedule = normalizeSchedule(doc.schedule);
  return next;
}
