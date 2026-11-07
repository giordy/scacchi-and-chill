import React from 'react';
import { AppConfig, HistoryGame, LichessExportGame, MessageTemplates, SeasonArchive } from '../types';
import type { OrganizerStore } from '../hooks/useOrganizerData';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { ReviewsTab } from '../ReviewsTab';
import { LaunchMessageSection } from './settings/LaunchMessageSection';
import { StatusPhrasesSection } from './settings/StatusPhrasesSection';
import { awardEmoji, awardsMessage, awardWinnersLine, computeSeasonAwards } from '../lib/awards';
import { errorMessage } from '../lib/utils';

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
  const awards = computeSeasonAwards(config.players, history, gameStates, seasons);
  if (awards.length === 0) return <p className="note note-flush">I premi compaiono quando ci sono partite concluse.</p>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(awardsMessage(season, awards));
      flash('ok', 'Premi copiati: incollali nel gruppo WhatsApp.');
    } catch (e) {
      flash('err', 'Copia non riuscita: ' + errorMessage(e));
    }
  };
  return (
    <div>
      <p className="note note-flush">Calcolati sulle partite concluse finora. Sul sito compaiono sotto la classifica a stagione conclusa.</p>
      <ul className="note note-sm season-steps">
        {awards.map((a) => (
          <li key={a.id}>
            {awardEmoji(a)} <strong>{a.title}</strong>: {awardWinnersLine(a)}
          </li>
        ))}
      </ul>
      <button type="button" className="secondary" onClick={copy}>
        Copia il messaggio per WhatsApp
      </button>
    </div>
  );
}

// Everything written for the WhatsApp group that is not tied to a single round (the link message
// and the bulletin of a round are in Turni, inside the round): the season's review, the awards, and
// the texts of the messages.
export function WhatsAppTab({
  config,
  history,
  gameStates,
  nameOf,
  templates,
  setTemplates,
  organizer,
  flash,
  triggerToast,
  seasons = [],
}: {
  config: AppConfig;
  history: HistoryGame[]; // as the standings see it (withdrawals applied)
  gameStates: Record<string, LichessExportGame>;
  nameOf: (handle: string) => string;
  templates: MessageTemplates;
  setTemplates: React.Dispatch<React.SetStateAction<Partial<MessageTemplates> | null>>;
  organizer: OrganizerStore;
  flash: Flash;
  triggerToast?: (msg: string) => void;
  seasons?: SeasonArchive[]; // archived seasons, for the Premio Pillsbury
}) {
  return (
    <div className="settings-stack">
      <CollapsibleSection title="✨ Il racconto della stagione" defaultOpen>
        <ReviewsTab history={history} gameStates={gameStates} config={config} nameOf={nameOf} triggerToast={triggerToast} organizer={organizer} seasons={seasons} />
      </CollapsibleSection>

      <CollapsibleSection title="🏆 Premi della stagione">
        <AwardsSection season={config.tournament?.season ?? ''} config={config} history={history} gameStates={gameStates} flash={flash} seasons={seasons} />
      </CollapsibleSection>

      <CollapsibleSection title="Testi dei messaggi">
        <p className="note note-flush">
          Le frasi usate nel messaggio con i link e nel bollettino di ogni turno (in ♞ Turni, dentro il turno).
        </p>
        <LaunchMessageSection templates={templates} setTemplates={setTemplates} flash={flash} />
        <hr className="divider" />
        <StatusPhrasesSection
          defaults={config.statusPhrases}
          overrides={organizer.statusPhrases ?? null}
          setOverrides={organizer.setStatusPhrases}
          flash={flash}
        />
      </CollapsibleSection>
    </div>
  );
}
