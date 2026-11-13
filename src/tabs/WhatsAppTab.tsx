import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame, SeasonArchive } from '../types';
import type { OrganizerStore } from '../hooks/useOrganizerData';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { ReviewsTab } from '../ReviewsTab';
import { awardEmoji, awardsMessage, awardTitle, awardWinnersLine, computeSeasonAwards } from '../lib/awards';
import { errorMessage } from '../lib/utils';
import { computeStandings, leadersOf, pointsText } from '../lib/standings';
import { scudettoTitle } from '../lib/masterOpening';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// The season's end-of-season awards, with the message for the group
function AwardsSection({ season, config, history, gameStates, flash, seasons }: {
  season: string;
  seasons: SeasonArchive[];
  config: AppConfig;
  history: HistoryGame[];
  gameStates: Record<string, LichessExportGame>;
  flash: Flash;
}) {
  const awards = computeSeasonAwards(config.players, history, gameStates, seasons, config.tournament?.seeds, config.tournament?.withdrawals, { name: config.tournament?.masterName, opening: config.tournament?.masterOpening }, config.tournament?.fairPlayAwardsBan);
  if (awards.length === 0) return <p className="note note-flush">I premi compaiono quando ci sono partite concluse.</p>;
  // The Scudetto first: who leads the table now, the first place shared on a full tie
  const leaders = leadersOf(computeStandings(config.players, history, gameStates).standings);
  const scudetto = { title: scudettoTitle(config.tournament?.masterName), names: leaders.map((l) => l.name), points: leaders[0]?.points ?? 0 };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(awardsMessage(season, awards, scudetto));
      flash('ok', 'Premi copiati: incollali nel gruppo WhatsApp.');
    } catch (e) {
      flash('err', 'Copia non riuscita: ' + errorMessage(e));
    }
  };
  return (
    <div>
      <p className="note note-flush">Calcolati sulle partite concluse finora. Sul sito compaiono sotto la classifica a stagione conclusa.</p>
      <ul className="note note-sm season-steps">
        {leaders.length > 0 && (
          <li>
            🏆 <strong>{scudetto.title}</strong>: {scudetto.names.join(", ")} ({pointsText(scudetto.points)})
          </li>
        )}
        {awards.map((a) => (
          <li key={a.id}>
            {awardEmoji(a)} <strong>{awardTitle(a)}</strong>: {awardWinnersLine(a)}
          </li>
        ))}
      </ul>
      <p className="note note-sm">
        È un'anteprima: finché la stagione non è conclusa i premi possono cambiare, il Trofeo Pillsbury più di tutti.
      </p>
      <button type="button" className="secondary" onClick={copy}>
        Copia il messaggio per WhatsApp
      </button>
    </div>
  );
}

// Everything written for the WhatsApp group that is not tied to a single round (the link message
// and the bulletin of a round are in Turni, inside the round): the season's review and the awards;
// nothing else: the message texts are in config.json.
export function WhatsAppTab({
  config,
  history,
  gameStates,
  nameOf,
  organizer,
  flash,
  triggerToast,
  seasons = [],
}: {
  config: AppConfig;
  history: HistoryGame[]; // as the standings see it (withdrawals applied)
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  organizer: OrganizerStore;
  flash: Flash;
  triggerToast?: (msg: string) => void;
  seasons?: SeasonArchive[]; // archived seasons, for the Trofeo Pillsbury
}) {
  return (
    <div className="settings-stack">
      <CollapsibleSection title="✨ Il racconto della stagione" defaultOpen>
        <ReviewsTab history={history} gameStates={gameStates} config={config} nameOf={nameOf} triggerToast={triggerToast} organizer={organizer} seasons={seasons} />
      </CollapsibleSection>

      <CollapsibleSection title="🏆 Premi della stagione">
        <AwardsSection season={config.tournament?.season ?? ''} config={config} history={history} gameStates={gameStates} flash={flash} seasons={seasons} />
      </CollapsibleSection>
    </div>
  );
}
