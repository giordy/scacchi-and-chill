import React, { useEffect, useState } from 'react';
import { TournamentMeta } from '../../types';
import { DEFAULT_TOURNAMENT } from '../../lib/tournament';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Name of the tournament and of the current season, with the master it is dedicated to
export function SeasonInfoSection({
  meta,
  flash,
  onUpdateTournamentMeta,
}: {
  meta?: TournamentMeta;
  flash: Flash;
  onUpdateTournamentMeta: (patch: Partial<TournamentMeta>) => void;
}) {
  const fromMeta = () => ({
    title: meta?.title || DEFAULT_TOURNAMENT.title,
    season: meta?.season || DEFAULT_TOURNAMENT.season,
    masterName: meta?.masterName ?? "",
    subtitle: meta?.subtitle ?? "",
    imageUrl: meta?.imageUrl ?? "",
    description: meta?.description || DEFAULT_TOURNAMENT.description,
  });
  const [form, setForm] = useState(fromMeta);
  // A new season (started from "Fine stagione") changes these fields from outside
  useEffect(() => setForm(fromMeta()), [meta?.title, meta?.season, meta?.masterName, meta?.subtitle, meta?.imageUrl, meta?.description]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const save = () => {
    if (!form.title.trim() || !form.season.trim()) {
      flash("err", "Nome del torneo e stagione sono obbligatori.");
      return;
    }
    onUpdateTournamentMeta({
      title: form.title.trim(),
      season: form.season.trim(),
      masterName: form.masterName.trim(),
      subtitle: form.subtitle.trim(),
      imageUrl: form.imageUrl.trim(),
      description: form.description.trim(),
    });
    flash("ok", "Stagione aggiornata.");
  };

  return (
    <>
      <div className="grid2">
        <div>
          <label htmlFor="cfg-title">Nome del torneo</label>
          <input id="cfg-title" type="text" placeholder="es. Scacchi & Chill" {...field("title")} />
        </div>
        <div>
          <label htmlFor="cfg-season">Stagione</label>
          <input id="cfg-season" type="text" placeholder="es. Stagione 2 - Capablanca" {...field("season")} />
        </div>
        <div>
          <label htmlFor="cfg-master">Maestro della stagione</label>
          <input id="cfg-master" type="text" placeholder="es. José Raúl Capablanca" {...field("masterName")} />
        </div>
        <div>
          <label htmlFor="cfg-sub">Motto</label>
          <input id="cfg-sub" type="text" placeholder="es. La macchina degli scacchi" {...field("subtitle")} />
        </div>
      </div>
      <div>
        <label htmlFor="cfg-img">Foto del maestro (URL)</label>
        <input id="cfg-img" type="text" placeholder="es. assets/capablanca.jpg" {...field("imageUrl")} />
      </div>
      <div>
        <label htmlFor="cfg-desc">Presentazione della stagione</label>
        <textarea id="cfg-desc" rows={4} className="ta-md" {...field("description")} />
      </div>
      <button className="primary" type="button" onClick={save}>
        Salva stagione
      </button>
    </>
  );
}
