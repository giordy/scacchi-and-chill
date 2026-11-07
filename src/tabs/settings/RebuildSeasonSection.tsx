import React, { useMemo, useState } from 'react';
import { AppConfig, LichessExportGame, Player, SeasonArchive } from '../../types';
import { fetchGameStates } from '../../lib/lichess';
import { isTournamentCandidate, lastMoveOf, lichessIdsFromText, ManualGame, playersOfGames, rebuiltHistory } from '../../lib/rebuild';
import { buildSeasonArchive, seasonId } from '../../lib/seasons';
import { computeStandings, isTied, seasonStarted, sharedRanks } from '../../lib/standings';
import { fullPodium } from '../../lib/honours';
import { saveSeasonArchive } from '../../firebaseService';
import { errorMessage } from '../../lib/utils';
import { periodLabel } from '../../lib/period';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

const fmt = (n: number) => String(n).replace('.5', '½').replace(/^0½/, '½');
const day = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: '2-digit' }) : '–');
const resultOf = (g: LichessExportGame) =>
  ['created', 'started'].includes(g.status) ? 'in corso' : g.winner === 'white' ? '1-0' : g.winner === 'black' ? '0-1' : '½-½';

// Rebuilds a season closed before its games were archived, from the Lichess links shared in the
// group chat: the games are read from Lichess, the standings recomputed and, once they match the
// final table, saved as that season's archive. Nothing is saved before "Salva".
export function RebuildSeasonSection({ config, seasons, flash }: { config: AppConfig; seasons: SeasonArchive[]; flash: Flash }) {
  const winners = config.tournament?.winners ?? [];
  // The first season of the hall of fame without an archive is the likely one to rebuild
  const suggested = winners.find((w) => !seasons.some((s) => s.id === seasonId(w.season)))?.season ?? '';
  const [season, setSeason] = useState(suggested);
  const [master, setMaster] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<LichessExportGame[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [manual, setManual] = useState<ManualGame[]>([]);
  const [forfeit, setForfeit] = useState<ManualGame>({ white: '', black: '', winner: 'white' });

  // Names already known: current players and the hall of fame
  const knownNames = useMemo(() => {
    const map: Record<string, string> = {};
    winners.flatMap(fullPodium).forEach((p) => (map[p.handle.toLowerCase()] = p.name));
    config.players.forEach((p) => (map[p.handle.toLowerCase()] = p.name));
    return map;
  }, [winners, config.players]);

  const readFile = async (file?: File) => {
    if (file) setText(await file.text());
  };

  const readGames = async () => {
    const ids = lichessIdsFromText(text);
    if (ids.length === 0) {
      flash('err', 'Nel testo non ci sono link a partite Lichess.');
      return;
    }
    setBusy(true);
    try {
      const states = Object.values(await fetchGameStates(ids));
      const candidates = states.filter(isTournamentCandidate).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      setFound(candidates);
      setSkipped(ids.length - candidates.length);
      setExcluded(new Set());
      // Players known to the tournament, or with several games, start ticked
      const people = playersOfGames(candidates);
      setChosen(new Set(people.filter((p) => knownNames[p.handle.toLowerCase()] || p.games >= 3).map((p) => p.handle.toLowerCase())));
      setNames(Object.fromEntries(people.map((p) => [p.handle.toLowerCase(), knownNames[p.handle.toLowerCase()] ?? p.handle])));
      flash('ok', `Lette ${candidates.length} partite per corrispondenza su ${ids.length} link.`);
    } catch (e) {
      flash('err', 'Lettura da Lichess non riuscita: ' + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const foundPlayers = useMemo(() => (found ? playersOfGames(found) : []), [found]);
  const players: Player[] = foundPlayers
    .filter((p) => chosen.has(p.handle.toLowerCase()))
    .map((p) => ({ handle: p.handle, name: (names[p.handle.toLowerCase()] ?? '').trim() || p.handle }));
  const kept = (found ?? []).filter((g) => !excluded.has(g.id));
  const history = rebuiltHistory(kept, players, manual);
  const states = Object.fromEntries(kept.map((g) => [g.id, g]));
  const { standings } = computeStandings(players, history, states);
  const ranks = sharedRanks(standings);
  const started = seasonStarted(standings);
  const inSeason = (g: LichessExportGame) =>
    players.some((p) => same(p.handle, g.players?.white?.user?.name)) && players.some((p) => same(p.handle, g.players?.black?.user?.name));
  const unfinished = history.filter((h) => h.lichess && ['created', 'started'].includes(h.lichess.status)).length;

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const addForfeit = () => {
    if (!forfeit.white || !forfeit.black || forfeit.white === forfeit.black) {
      flash('err', 'Scegli due giocatori diversi.');
      return;
    }
    setManual([...manual, forfeit]);
    setForfeit({ white: '', black: '', winner: 'white' });
  };

  const save = async () => {
    const name = season.trim();
    if (!name) {
      flash('err', 'Scrivi il nome della stagione, uguale a quello nell\'Albo d\'Oro.');
      return;
    }
    if (config.tournament && seasonId(name) === seasonId(config.tournament.season)) {
      flash('err', 'È il nome della stagione in corso: questa si archivia da «Chiudi la stagione».');
      return;
    }
    const exists = seasons.some((s) => s.id === seasonId(name));
    const ok = window.confirm(
      `Salvare «${name}» nello storico con ${players.length} giocatori e ${history.length} partite?` +
        (exists ? '\n\nEsiste già un archivio con questo nome: viene sostituito.' : '') +
        "\n\nL'Albo d'Oro non viene toccato."
    );
    if (!ok) return;
    setBusy(true);
    try {
      const meta = { title: config.tournament?.title ?? '', season: name, description: '', ...(master.trim() ? { masterName: master.trim() } : {}) };
      const archive = buildSeasonArchive(meta, players, history, states, lastMoveOf(kept) ?? new Date());
      await saveSeasonArchive(archive);
      flash('ok', `«${name}» salvata nello storico: ora conta nella classifica di sempre, nelle carriere e nei record.`);
    } catch (e) {
      flash('err', 'Salvataggio non riuscito: ' + errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const period = periodLabel({
    start: kept[0]?.createdAt ? new Date(kept[0].createdAt).toISOString().slice(0, 7) : undefined,
    end: lastMoveOf(kept)?.toISOString().slice(0, 7),
  });

  return (
    <div className="rebuild-season">
      <h3 className="rules-heading">Ricostruisci una stagione passata</h3>
      <p className="note">
        Per una stagione chiusa senza le partite: incolla l'export della chat WhatsApp (o solo i link alle partite). Il sito legge
        le partite da Lichess e ricalcola la classifica; confrontala con quella finale e salva solo quando torna.
      </p>

      <div className="rebuild-fields">
        <label>
          Stagione
          <input type="text" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="es. Scacchi & Chill - Stagione 1" />
        </label>
        <label>
          Maestro (facoltativo)
          <input type="text" value={master} onChange={(e) => setMaster(e.target.value)} />
        </label>
      </div>
      <textarea
        className="rebuild-text"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Incolla qui la chat esportata o i link lichess.org/…"
      />
      <div className="rebuild-actions">
        <label className="chip-link">
          Apri file .txt
          <input type="file" accept=".txt,text/plain" hidden onChange={(e) => readFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="primary" onClick={readGames} disabled={busy || !text.trim()}>
          {busy ? 'Lettura…' : `Leggi le partite (${lichessIdsFromText(text).length} link)`}
        </button>
      </div>

      {found && (
        <>
          <p className="note note-sm">
            {found.length} partite per corrispondenza{skipped > 0 ? `; ${skipped} link scartati (altre cadenze, pagine non di partite o duplicati)` : ''}.
          </p>

          <h4 className="rebuild-heading">Giocatori del torneo</h4>
          <p className="note note-sm">Spunta chi ha giocato la stagione e controlla il nome con cui appare sul sito.</p>
          <ul className="rebuild-players">
            {foundPlayers.map((p) => {
              const key = p.handle.toLowerCase();
              return (
                <li key={key}>
                  <input type="checkbox" checked={chosen.has(key)} onChange={() => setChosen(toggle(chosen, key))} aria-label={`Includi ${p.handle}`} />
                  <span className="rebuild-handle">@{p.handle} <span className="note-sm">({p.games})</span></span>
                  <input type="text" value={names[key] ?? ''} onChange={(e) => setNames({ ...names, [key]: e.target.value })} aria-label={`Nome di ${p.handle}`} />
                </li>
              );
            })}
          </ul>

          <h4 className="rebuild-heading">Classifica ricostruita{period ? ` · ${period}` : ''}</h4>
          <div className="table-responsive">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="col-rank" scope="col"><span className="sr-only">Posizione</span></th>
                  <th className="sticky-col">Giocatore</th>
                  <th className="col-center">Punti</th>
                  <th className="col-center">G</th>
                  <th className="col-center">V</th>
                  <th className="col-center">N</th>
                  <th className="col-center">P</th>
                  <th className="col-center">SB</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr key={s.handle}>
                    <td className="col-rank">{started ? `${ranks[i]}${isTied(ranks, i) ? '=' : ''}` : '–'}</td>
                    <td className="sticky-col">{s.name}</td>
                    <td className="col-points">{fmt(s.points)}</td>
                    <td className="col-center">{s.played}</td>
                    <td className="col-center">{s.won}</td>
                    <td className="col-center">{s.drawn}</td>
                    <td className="col-center">{s.lost}</td>
                    <td className="col-center">{s.sb.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unfinished > 0 && <p className="notice warning">{unfinished} partite risultano ancora in corso su Lichess: non contano in classifica.</p>}

          <details className="rebuild-games">
            <summary>Partite ({found.length}, escluse {excluded.size}): togli quelle fuori torneo</summary>
            <ul>
              {found.map((g) => (
                <li key={g.id} className={inSeason(g) ? '' : 'is-out'}>
                  <input type="checkbox" checked={!excluded.has(g.id)} onChange={() => setExcluded(toggle(excluded, g.id))} aria-label={`Includi la partita ${g.id}`} />
                  <span className="rebuild-date">{day(g.createdAt)}</span>
                  <span>
                    {g.players?.white?.user?.name} – {g.players?.black?.user?.name}
                  </span>
                  <span className="rebuild-result">{resultOf(g)}</span>
                  <a href={`https://lichess.org/${g.id}`} target="_blank" rel="noopener noreferrer">↗</a>
                </li>
              ))}
            </ul>
            <p className="note note-sm">In grigio le partite con un giocatore non spuntato: non contano comunque.</p>
          </details>

          <details className="rebuild-games">
            <summary>Partite a tavolino ({manual.length})</summary>
            <p className="note note-sm">Per le vittorie a tavolino (ritiri), che non hanno un link Lichess.</p>
            {manual.length > 0 && (
              <ul>
                {manual.map((m, i) => (
                  <li key={i} className="rebuild-manual">
                    <span>
                      {m.white} – {m.black}: {m.winner === 'white' ? '1-0' : '0-1'}
                    </span>
                    <button type="button" className="chip-link" onClick={() => setManual(manual.filter((_, j) => j !== i))}>
                      Togli
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="rebuild-forfeit">
              {(['white', 'black'] as const).map((c) => (
                <select key={c} value={forfeit[c]} onChange={(e) => setForfeit({ ...forfeit, [c]: e.target.value })} aria-label={c === 'white' ? 'Bianco' : 'Nero'}>
                  <option value="">{c === 'white' ? 'Bianco' : 'Nero'}</option>
                  {players.map((p) => (
                    <option key={p.handle} value={p.handle}>{p.name}</option>
                  ))}
                </select>
              ))}
              <select value={forfeit.winner} onChange={(e) => setForfeit({ ...forfeit, winner: e.target.value as 'white' | 'black' })} aria-label="Vincitore">
                <option value="white">vince il bianco</option>
                <option value="black">vince il nero</option>
              </select>
              <button type="button" className="chip-link" onClick={addForfeit}>Aggiungi</button>
            </div>
          </details>

          <button type="button" className="primary btn-block" onClick={save} disabled={busy || players.length < 2}>
            Salva «{season.trim() || '…'}» nello storico
          </button>
        </>
      )}
    </div>
  );
}

const same = (a: string, b?: string) => !!b && a.toLowerCase() === b.toLowerCase();
