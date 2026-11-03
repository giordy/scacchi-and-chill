import React from 'react';
import { HistoryGame, Player, ScheduledMatch } from '../types';
import { ScheduleSection } from './calendar/ScheduleSection';
import { SavedRoundsSection } from './calendar/SavedRoundsSection';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Planned pairings (official schedule) and rounds already created
export function CalendarTab({
  players,
  schedule,
  history,
  setHistory,
  onUpdateSchedule,
  onLoadIntoActivePairs,
  flash,
}: {
  players: Player[];
  schedule?: ScheduledMatch[];
  history: HistoryGame[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryGame[]>>;
  onUpdateSchedule: (schedule: ScheduledMatch[]) => void;
  onLoadIntoActivePairs: (round: string, games: HistoryGame[]) => void;
  flash: Flash;
}) {
  return (
    <div className="settings-stack">
      <section className="panel">
        <h2 className="panel-title">Turni creati</h2>
        <SavedRoundsSection
          history={history}
          setHistory={setHistory}
          onLoadIntoActivePairs={onLoadIntoActivePairs}
          flash={flash}
        />
      </section>
      <section className="panel">
        <h2 className="panel-title">
          Calendario ufficiale <span className="muted-normal">· {(schedule ?? []).length} partite</span>
        </h2>
        <ScheduleSection
          players={players}
          schedule={schedule}
          hasGames={history.length > 0}
          flash={flash}
          onUpdateSchedule={onUpdateSchedule}
        />
      </section>
    </div>
  );
}
