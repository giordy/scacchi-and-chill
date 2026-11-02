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
  [key: string]: any;
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
  rulesText?: string;
  howItWorks?: string;
  fairPlayText?: string;
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
  round?: string;
  history?: HistoryGame[];
  pairs?: GamePair[];
  settings?: Partial<Settings>;
  templates?: Partial<MessageTemplates> | null;
  anecdotes?: Record<string, string>;
  ratings?: Record<string, string | number | null>;
}

