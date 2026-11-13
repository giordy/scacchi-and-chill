import { HistoryGame, LichessExportGame, Player, ScheduledMatch, TournamentMeta } from '../types';
import { computeSeasonProgress } from './progress';
import { PledgeStatus } from './pledges';
import { seasonId } from './seasons';

// The steps between two seasons, in the organizer area: closing the one that ended, then preparing
// the next until its first round. Most are read from the data (a photo is there, the calendar is
// generated); the few the site cannot see (the final messages were sent, the rules were read again)
// are ticked by the organizer and kept in the private document, per season. Shown only between two
// seasons: once the last game is over, until the games of the new one are created.

export type ChecklistTab = 'rounds' | 'whatsapp' | 'players' | 'seasons' | 'settings';
// Ids of the sections the steps open (CollapsibleSection id)
export type ChecklistSection =
  | 'racconto'
  | 'premi'
  | 'copia-dati'
  | 'fine-stagione'
  | 'registro'
  | 'stagione-corrente'
  | 'regolamento'
  | 'calendario';

export interface ChecklistStep {
  key: string;
  label: string;
  detail?: string;
  done: boolean;
  manual?: boolean; // ticked by the organizer
  optional?: boolean;
  tab: ChecklistTab;
  section?: ChecklistSection;
  link?: { href: string; label: string }; // a page elsewhere (the photo search)
}

export interface SeasonChecklist {
  phase: 'end' | 'prepare';
  season: string; // the season the steps are about: the one ending, or the new one
  key: string; // seasonId of it: the ticks are kept under it
  steps: ChecklistStep[];
}

export interface ChecklistInput {
  meta?: TournamentMeta;
  players: Player[];
  schedule: ScheduledMatch[];
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  pledges?: PledgeStatus; // undefined until read
  ticks: Record<string, string[]>; // OrganizerData.checklist: the steps ticked, by season key
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Wikimedia Commons, where historical photos are free to use: a search with the master's name
export const photoSearchUrl = (name: string) =>
  `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(name)}&title=Special:MediaSearch&type=image`;

export function seasonChecklist(input: ChecklistInput): SeasonChecklist | null {
  const { meta, players, schedule, history, gameStates, pledges, ticks } = input;
  if (!meta?.season) return null;
  const key = seasonId(meta.season);
  const ticked = new Set(ticks[key] ?? []);
  const manual = (step: Omit<ChecklistStep, 'done' | 'manual'>): ChecklistStep => ({ ...step, manual: true, done: ticked.has(step.key) });

  // The season is over: every game of the calendar is finished
  const progress = computeSeasonProgress(history, gameStates, schedule);
  if (history.length > 0) {
    if (progress.total === 0 || progress.finished < progress.total) return null;
    return {
      phase: 'end',
      season: meta.season,
      key,
      steps: [
        { key: 'games', label: 'Tutte le partite concluse', detail: plural(progress.total, 'partita', 'partite'), done: true, tab: 'rounds' },
        manual({ key: 'review', label: 'Racconto finale mandato nel gruppo', detail: 'WhatsApp → Il racconto della stagione, «fine stagione»', tab: 'whatsapp', section: 'racconto' }),
        manual({ key: 'awards', label: 'Premi mandati nel gruppo', tab: 'whatsapp', section: 'premi' }),
        manual({ key: 'backup', label: 'Copia dei dati scaricata', detail: 'facoltativa: c’è anche il backup di ogni notte', optional: true, tab: 'settings', section: 'copia-dati' }),
        { key: 'close', label: 'Chiudi la stagione e scegli la prossima', detail: 'archivio, Albo d’Oro, premi: il resto lo fa il sito', done: false, tab: 'seasons', section: 'fine-stagione' },
      ],
    };
  }

  // No game yet: the new season is being prepared
  const master = meta.masterName?.trim();
  const anecdotes = meta.masterAnecdotes?.length ?? 0;
  const rounds = new Set(schedule.map((m) => m.round)).size;
  return {
    phase: 'prepare',
    season: meta.season,
    key,
    steps: [
      manual({ key: 'players', label: 'Chi gioca la stagione', detail: plural(players.length, 'giocatore', 'giocatori'), tab: 'players', section: 'registro' }),
      {
        key: 'master',
        label: master ? `${master}, preparato con l’AI` : 'Il maestro, preparato con l’AI',
        detail: anecdotes > 0 ? `motto e ${plural(anecdotes, 'aneddoto', 'aneddoti')}` : 'motto, presentazione, aneddoti, apertura e partita',
        done: anecdotes > 0 && !!meta.subtitle,
        tab: 'seasons',
        section: 'stagione-corrente',
      },
      {
        key: 'famous',
        label: 'La partita celebre, con il link Lichess',
        detail: meta.famousGame?.title || undefined,
        done: !!meta.famousGame?.url,
        tab: 'seasons',
        section: 'stagione-corrente',
      },
      {
        key: 'photo',
        label: 'La foto del maestro',
        done: !!meta.imageUrl,
        tab: 'seasons',
        section: 'stagione-corrente',
        ...(master && !meta.imageUrl ? { link: { href: photoSearchUrl(master), label: 'Cerca su Wikimedia' } } : {}),
      },
      manual({ key: 'rules', label: 'Regolamento riletto', detail: 'testi, giorni per mossa, partite classificate', tab: 'seasons', section: 'regolamento' }),
      {
        key: 'calendar',
        label: 'Calendario generato',
        detail: rounds > 0 ? plural(rounds, 'turno', 'turni') : 'dopo aver scelto i giocatori',
        done: rounds > 0,
        tab: 'seasons',
        section: 'calendario',
      },
      {
        key: 'pledges',
        label: 'Regolamento accettato da tutti',
        detail: pledges ? `${pledges.accepted.length} su ${players.length}: il link è in Stagioni → Regolamento` : undefined,
        done: !!pledges?.all,
        tab: 'seasons',
        section: 'regolamento',
      },
      { key: 'round1', label: 'Sfide del Turno 1 create e messaggio mandato', done: false, tab: 'rounds' },
    ],
  };
}

// The manual steps of the ending season not ticked yet, and the games not finished: said before closing
export function closeReminders(input: ChecklistInput): string[] {
  const { meta, history, gameStates, schedule, ticks } = input;
  if (!meta?.season) return [];
  const out: string[] = [];
  const progress = computeSeasonProgress(history, gameStates, schedule);
  const open = progress.total - progress.finished;
  if (open > 0) out.push(`${plural(open, 'partita', 'partite')} non ancora ${open === 1 ? 'conclusa' : 'concluse'}`);
  const ticked = new Set(ticks[seasonId(meta.season)] ?? []);
  if (!ticked.has('review')) out.push('il racconto finale non risulta mandato');
  if (!ticked.has('awards')) out.push('i premi non risultano mandati');
  return out;
}

// Ticks or unticks a step of a season
export function toggleTick(ticks: Record<string, string[]>, key: string, step: string): Record<string, string[]> {
  const list = new Set(ticks[key] ?? []);
  if (list.has(step)) list.delete(step);
  else list.add(step);
  return { ...ticks, [key]: [...list] };
}
