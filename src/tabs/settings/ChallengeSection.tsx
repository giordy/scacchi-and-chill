import React from 'react';
import { Settings } from '../../types';
import { RULES } from '../../lib/config';
import { DaysField } from '../../components/DaysField';

// How the challenges are created on Lichess: link validity and the extra rules. Next to the public
// rules (days per move, rated), since together they decide how a game is played.
export function ChallengeSection({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Partial<Settings>>>;
}) {
  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));
  return (
    <>
      <DaysField
        id="expiry"
        label="Validità del link di sfida (giorni)"
        value={settings.expiry}
        fallback={2}
        onCommit={(n) => set({ expiry: n })}
      />
      <div>
        <label>Regole della sfida su Lichess</label>
        {RULES.map(({ key, label }) => (
          <div className="inline" key={key}>
            <input
              id={"rule-" + key}
              type="checkbox"
              checked={!!settings.rules?.[key]}
              onChange={(e) => set({ rules: { ...settings.rules, [key]: e.target.checked } })}
            />
            <label htmlFor={"rule-" + key}>{label}</label>
          </div>
        ))}
      </div>
    </>
  );
}
