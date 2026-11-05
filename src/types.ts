export interface Player {
  handle: string;
  name: string;
}

export interface GamePair {
  white: string;
  black: string;
  url: string;
}

export interface HistoryGame {
  round: string;
  white: string;
  black: string;
  url: string;
  createdAt?: number;
  // Stato della partita su Lichess, salvato in Firestore dal pulsante "Sincronizza"
  lichess?: LichessExportGame;
}

export interface GameRules {
  noRematch: boolean;
  noGiveTime: boolean;
  noClaimWin: boolean;
  noEarlyDraw: boolean;
  [key: string]: boolean;
}

export interface Settings {
  token: string;
  days: number;
  expiry: number;
  rated: boolean;
  rules: GameRules;
}

export interface MessageTemplates {
  header: string;
  game: string;
  bye: string;
  footer: string;
  [key: string]: string | undefined;
}

export interface TypeLabels {
  rated: string;
  casual: string;
}

export interface StatusPhrases {
  header: string[];
  ongoing: string[];
  win: string[];
  draw: string[];
  aborted: string[];
  pending: string[];
  footer: string[];
  closing?: string[];
  upset?: string[]; // colpaccio line under a win
  summit?: string[]; // scontro al vertice line under the players
  roundEndHeader?: string[];
  roundEndFooter?: string[];
  infoLine?: string;
  infoLink?: string;
  [key: string]: string | string[] | undefined;
}

// A planned game: never carries a Lichess link, which is created only when the round starts
export interface ScheduledMatch {
  round: string;
  white: string;
  black: string;
}

// A podium place below the champion; a shared place uses up the next (two seconds, no third)
export interface PodiumPlace {
  handle: string;
  name: string;
  place: 1 | 2 | 3; // 1 only for a co-champion
}

export interface SeasonWinner {
  season: string; // es. "Stagione 1"
  name: string; // es. "Fabio"
  handle: string; // es. "fsgach"
  year?: string; // es. "2026"
  notes?: string;
  podium?: PodiumPlace[]; // the other medals of the season
}

// A player who left during the season (see lib/withdrawals.ts and the "Ritiri" rule)
export interface Withdrawal {
  handle: string;
  name: string;
  at: string; // ISO date
  played: number; // games played when leaving
  total: number; // games of the season
  // annulled: under half played, every game annulled; forfeit: from half on, the games left are
  // won by the opponents; replaced: a substitute took the place and the games left
  mode: 'annulled' | 'forfeit' | 'replaced';
  forfeits?: ScheduledMatch[];
  replacedBy?: Player;
  // Players and calendar before the withdrawal, to undo it (not for a replacement)
  undo?: { players: Player[]; schedule: ScheduledMatch[] };
}

export interface TournamentMeta {
  title: string;
  season: string;
  subtitle?: string;
  imageUrl?: string;
  masterName?: string;
  description: string;
  howItWorks?: string;
  fairPlayText?: string;
  withdrawalText?: string; // rules for a player who leaves during the season
  withdrawals?: Withdrawal[];
  // Lichess parameters shown in the public rules (and used to create the challenges)
  daysPerMove?: number;
  rated?: boolean;
  winners?: SeasonWinner[];
}

export interface AppConfig {
  tournament?: TournamentMeta;
  players: Player[];
  schedule?: ScheduledMatch[];
  defaults: {
    days: number;
    expiry: number;
    rated: boolean;
    rules: GameRules;
  };
  messageTemplates: MessageTemplates;
  typeLabels: TypeLabels;
  challengeName: string;
  numberEmojis: string[];
  statusPhrases: StatusPhrases;
}

export interface NoticeState {
  kind: 'ok' | 'err' | 'warning';
  text: string;
  items?: string[];
}

export interface LichessExportPlayer {
  user?: {
    id?: string;
    name?: string;
    flair?: string; // Lichess flair, e.g. "food-drink.rice-ball"
  };
  rating?: number; // at the start of the game
  provisional?: boolean; // shown as "1500?" on Lichess
}

export interface LichessExportGame {
  id: string;
  status: string;
  winner?: 'white' | 'black';
  players?: {
    white?: LichessExportPlayer;
    black?: LichessExportPlayer;
  };
  moves?: string;
  lastFen?: string;
  daysPerTurn?: number;
  lastMoveAt?: number;
  createdAt?: number;
  opening?: {
    name?: string;
  };
  // Plies where middlegame and endgame begin (requested with division=true); missing keys = not reached
  division?: {
    middle?: number;
    end?: number;
  };
}

export interface PlayerStanding {
  handle: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  rating?: string | number | null;
  anecdote?: string;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  tournament?: TournamentMeta;
  players?: Player[];
  schedule?: ScheduledMatch[];
  history?: HistoryGame[];
  seasons?: SeasonArchive[];
  settings?: Omit<Settings, "token">;
  templates?: MessageTemplates;
  statusPhrases?: Partial<StatusPhrases> | null;
  anecdotes?: Record<string, string>;
  ratings?: Record<string, string | number | null>;
}


// Subset of the Lichess /api/user/{name} response used to read ratings
export interface LichessPerf {
  rating?: number;
  games?: number;
  prov?: boolean;
}

export interface LichessUserProfile {
  perfs?: {
    correspondence?: LichessPerf;
    rapid?: LichessPerf;
    classical?: LichessPerf;
  };
}

// Final snapshot of a finished season, saved in tournaments/{id}/seasons/{seasonId}
export interface SeasonArchiveStanding {
  handle: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  sb: number;
}

export interface SeasonArchive {
  id: string;
  season: string;
  title: string;
  masterName?: string;
  imageUrl?: string;
  archivedAt: string; // ISO date
  standings: SeasonArchiveStanding[];
  gamesPlayed: number;
  champion?: { handle: string; name: string; points: number };
  awards?: SeasonAward[];
}

// A light-hearted end-of-season award (see lib/awards.ts)
export interface SeasonAward {
  id: string;
  emoji: string;
  title: string;
  description: string;
  winners: { handle: string; name: string }[];
  detail: string; // e.g. "3 vittorie col matto"
}
