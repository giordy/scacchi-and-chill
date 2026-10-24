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
  closing: string[];
  highlight?: string[];
  [key: string]: string[] | undefined;
}

export interface AppConfig {
  players: Player[];
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
  tournamentDescriptions?: Record<string, string>;
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

export interface LichessBroadcastTourInfo {
  format?: string;
  tc?: string;
  fideTC?: string;
  location?: string;
  timeZone?: string;
  website?: string;
  standings?: string;
  players?: string;
  regulations?: string;
}

export interface LichessBroadcastTour {
  id: string;
  name: string;
  slug: string;
  url: string;
  tier?: number;
  dates?: number[];
  image?: string;
  info?: LichessBroadcastTourInfo;
}

export interface LichessBroadcastItem {
  tour: LichessBroadcastTour;
  rounds?: any[];
  round?: any;
  group?: string;
}
