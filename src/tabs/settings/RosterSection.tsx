import React, { useEffect, useState } from 'react';
import { HistoryGame, Player, ScheduledMatch, SeasonArchive, TournamentMeta } from '../../types';
import { duplicateNames, fullRoster, hasSeasonGames, newPlayerError, renamePlayer, RosterEntry, storedRoster } from '../../lib/roster';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// The name field of a player: saved when it loses focus or on Enter, if it changed
function NameField({ entry, onRename }: { entry: RosterEntry; onRename: (name: string) => void }) {
  const [value, setValue] = useState(entry.name);
  useEffect(() => setValue(entry.name), [entry.name]);
  const commit = () => {
    if (value.trim() && value.trim() !== entry.name) onRename(value);
    else setValue(entry.name);
  };
  return (
    <input
      type="text"
      className="roster-name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setValue(entry.name);
      }}
      aria-label={`Nome di @${entry.handle}`}
    />
  );
}

// Every player who ever took part, keyed by the Lichess username. The name is shown everywhere on
// the site, past seasons included; the active ones play the current season. A player who appears
// in the history (archived seasons, hall of fame) can be renamed but never deleted.
export function RosterSection({
  meta,
  players,
  seasons,
  history,
  schedule,
  flash,
  onUpdateTournamentMeta,
  onUpdatePlayers,
}: {
  meta?: TournamentMeta;
  players: Player[];
  seasons: SeasonArchive[];
  history: HistoryGame[];
  schedule: ScheduledMatch[];
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
  onUpdatePlayers: (players: Player[]) => void;
}) {
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [joins, setJoins] = useState(true);

  const roster = fullRoster({ roster: meta?.roster, players, seasons, winners: meta?.winners });
  const duplicates = duplicateNames(roster);
  const groups: Array<{ title: string; note: string; entries: RosterEntry[] }> = [
    { title: `In questa stagione (${roster.filter((e) => e.active).length})`, note: '', entries: roster.filter((e) => e.active) },
    { title: 'Nello storico', note: 'Hanno giocato stagioni passate: si possono rinominare, non eliminare.', entries: roster.filter((e) => !e.active && e.inHistory) },
    { title: 'Registrati, senza partite', note: '', entries: roster.filter((e) => !e.active && !e.inHistory) },
  ];

  const rename = (entry: RosterEntry, newName: string) => {
    const out = renamePlayer(roster, players, entry.handle, newName);
    onUpdateTournamentMeta({ roster: out.roster });
    if (entry.active) onUpdatePlayers(out.players);
    flash('ok', `@${entry.handle} ora è «${newName.trim()}», anche nelle stagioni passate.`);
  };

  const setActive = (entry: RosterEntry, active: boolean) => {
    if (active) {
      onUpdatePlayers([...players, { handle: entry.handle, name: entry.name }]);
      flash('ok', `${entry.name} gioca questa stagione.`);
      return;
    }
    if (hasSeasonGames(entry.handle, history, schedule)) {
      flash('err', `${entry.name} ha già partite in questa stagione (create o in calendario): per toglierlo usa «Ritiri» qui sotto.`);
      return;
    }
    if (!window.confirm(`Togliere ${entry.name} da questa stagione? Resta nel registro e si può riaggiungere.`)) return;
    onUpdatePlayers(players.filter((p) => p.handle.toLowerCase() !== entry.handle.toLowerCase()));
    flash('ok', `${entry.name} non gioca più questa stagione; resta nel registro.`);
  };

  const remove = (entry: RosterEntry) => {
    if (!window.confirm(`Eliminare ${entry.name} (@${entry.handle}) dal registro?`)) return;
    onUpdateTournamentMeta({ roster: storedRoster(roster).filter((p) => p.handle.toLowerCase() !== entry.handle.toLowerCase()) });
    flash('ok', `${entry.name} eliminato dal registro.`);
  };

  const add = () => {
    const problem = newPlayerError(roster, handle, name);
    if (problem) {
      flash('err', problem);
      return;
    }
    const player = { handle: handle.trim(), name: name.trim() };
    onUpdateTournamentMeta({ roster: [...storedRoster(roster), player] });
    if (joins) onUpdatePlayers([...players, player]);
    flash('ok', `${player.name} registrato${joins ? ' e aggiunto a questa stagione' : ''}.`);
    setName('');
    setHandle('');
  };

  return (
    <div className="roster">
      <p className="note note-flush">
        Tutti i giocatori passati dal torneo. Il nome utente Lichess li distingue; il nome è quello mostrato sul sito, anche nelle
        stagioni passate, e si cambia qui (salva quando esci dal campo).
      </p>
      {duplicates.size > 0 && (
        <p className="notice warning">
          Alcuni giocatori hanno lo stesso nome: aggiungi un'iniziale o un soprannome per distinguerli.
        </p>
      )}

      {groups
        .filter((g) => g.entries.length > 0)
        .map((g) => (
          <section key={g.title} className="roster-group">
            <h3 className="rules-heading">{g.title}</h3>
            {g.note && <p className="note note-sm">{g.note}</p>}
            <ul className="roster-list">
              {g.entries.map((e) => (
                <li key={e.handle} className={`roster-row${duplicates.has(e.handle.toLowerCase()) ? ' is-duplicate' : ''}`}>
                  <NameField entry={e} onRename={(n) => rename(e, n)} />
                  <span className="roster-meta">
                    <a href={`https://lichess.org/@/${e.handle}`} target="_blank" rel="noopener noreferrer">@{e.handle}</a>
                    {e.seasons.length > 0 && ` · ${e.seasons.length === 1 ? '1 stagione' : `${e.seasons.length} stagioni`}`}
                    {duplicates.has(e.handle.toLowerCase()) && <span className="roster-dup"> · nome doppio</span>}
                  </span>
                  <span className="roster-actions">
                    {e.active && hasSeasonGames(e.handle, history, schedule) ? (
                      <span className="roster-locked">Ha partite: per toglierlo, Ritiri</span>
                    ) : (
                      <button type="button" className="secondary btn-mini btn-mini-edit" onClick={() => setActive(e, !e.active)}>
                        {e.active ? 'Togli dalla stagione' : 'Aggiungi alla stagione'}
                      </button>
                    )}
                    {!e.active && !e.inHistory && (
                      <button type="button" className="secondary btn-mini" onClick={() => remove(e)}>
                        Elimina
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <h3 className="rules-heading">Nuovo giocatore</h3>
      <div className="add-form add-form-player">
        <div>
          <label htmlFor="new-p-name">Nome sul sito</label>
          <input id="new-p-name" type="text" placeholder="es. Marco R." value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="new-p-handle">Nome utente Lichess</label>
          <input id="new-p-handle" type="text" placeholder="es. marco_chess" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </div>
        <button type="button" className="secondary btn-add" onClick={add}>
          + Aggiungi
        </button>
      </div>
      <label className="checkbox-line">
        <input type="checkbox" checked={joins} onChange={(e) => setJoins(e.target.checked)} /> Gioca questa stagione
      </label>
    </div>
  );
}
