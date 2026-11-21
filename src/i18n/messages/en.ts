// English: the reference translation. Every key of the site is here first; the other languages
// have the same keys (see docs/I18N.md). Sections are owned by areas of the code, so that parallel
// work never touches the same lines: add keys inside your section only.
import type { MessageTree, Widen } from '../types.ts';

export const en = {
  // ---- common: words and formats shared by every area ----
  common: {
    language: 'Language',
  },

  // ---- public: the public pages (standings, matches, season, hall of fame…) ----
  public: {
  },

  // ---- player: the player page ----
  player: {
  },

  // ---- admin: the organizer area ----
  admin: {
  },

  // ---- season: the season's lifecycle in the organizer area (checklist, closing, backups, Lichess sync, Elo seeds, withdrawals) ----
  season: {
  },

  // ---- messages: the group chat messages (round launch, status bulletin, season texts) ----
  messages: {
  },

  // ---- chronicle: the events of the Cronaca ----
  chronicle: {
  },

  // ---- awards: trophies and fun awards ----
  awards: {
  },

  // ---- notifications: push notifications ----
  notifications: {
  },

  // ---- prompts: the AI prompts. English only, in no other file: each prompt asks the AI to write in
  // the tournament's language, and models follow English instructions best ----
  prompts: {
  },

  // ---- meta: page title, link preview, app manifest ----
  meta: {
  },
} as const satisfies MessageTree;

// What every other language translates: everything but the prompts
export type Messages = Widen<Omit<typeof en, 'prompts'>>;
