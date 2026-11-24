import { TournamentMeta } from '../../types';
import { DaysField } from '../../components/DaysField';
import { OrganizerPushToggle } from '../../components/OrganizerPushToggle';
import { DEFAULT_OVERDUE_DAYS, MAX_OVERDUE_DAYS, MIN_OVERDUE_DAYS, overdueDaysOf } from '../../lib/overdue';

// The organizer's notices: the notifications on this device (lib/organizerPush.ts) and the games that
// go on too long (lib/overdue.ts). Nothing of it shows on the public page.
export function AlertsSection({
  meta,
  onUpdateTournamentMeta,
}: {
  meta?: TournamentMeta;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
}) {
  const days = overdueDaysOf(meta);
  return (
    <>
      <div>
        <div className="inline">
          <input
            id="overdue-games"
            type="checkbox"
            checked={days > 0}
            onChange={(e) => onUpdateTournamentMeta({ overdueDays: e.target.checked ? DEFAULT_OVERDUE_DAYS : 0 })}
          />
          <label htmlFor="overdue-games">Partite troppo lunghe</label>
        </div>
        {days > 0 && (
          <DaysField
            id="overdue-days"
            label="Giorni dall'inizio del turno"
            value={days}
            fallback={DEFAULT_OVERDUE_DAYS}
            min={MIN_OVERDUE_DAYS}
            max={MAX_OVERDUE_DAYS}
            onCommit={(n) => onUpdateTournamentMeta({ overdueDays: n })}
          />
        )}
        <p className="note">
          {days > 0
            ? `Una partita non finita ${days} giorni dopo l'inizio del suo turno compare in Turni, e se hai acceso le notifiche ti arriva un avviso, una volta per partita. Senza un accordo tra i giocatori puoi registrare tu il risultato dalla partita (⚖️). I giocatori non vedono niente.`
            : "Spenta. Accesa, ti avvisa delle partite non finite entro un numero di giorni dall'inizio del turno, anche senza i Turni con scadenza."}
        </p>
      </div>
      <OrganizerPushToggle />
    </>
  );
}
