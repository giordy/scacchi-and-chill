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
  highlight?: string[];
  roundEndHeader?: string[];
  roundEndFooter?: string[];
  infoLine?: string;
  infoLink?: string;
  [key: string]: string | string[] | undefined;
}

export interface ScheduledMatch {
  round: string;
  white: string;
  black: string;
  url?: string;
}

export interface SeasonWinner {
  season: string; // es. "Stagione 1"
  name: string; // es. "Fabio"
  handle: string; // es. "fsgach"
  year?: string; // es. "2026"
  notes?: string;
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
  };
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
}
