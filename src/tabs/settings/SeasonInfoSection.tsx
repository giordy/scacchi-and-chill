import React, { useEffect, useRef, useState } from 'react';
import { TournamentMeta } from '../../types';
import { DEFAULT_TOURNAMENT } from '../../lib/tournament';
import { compressImage, isMediaRef, mediaRef } from '../../lib/media';
import { seasonId } from '../../lib/seasons';
import { DEFAULT_SEASON_COLOR, SEASON_COLORS, SeasonColor } from '../../lib/seasonColor';
import { saveMediaImage } from '../../firebaseService';
import { primeImage, useImageSrc } from '../../hooks/useImageSrc';

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
    color: (meta?.color ?? DEFAULT_SEASON_COLOR) as SeasonColor,
  });
  const [form, setForm] = useState(fromMeta);
  // A new season (started from "Fine stagione") changes these fields from outside
  useEffect(() => setForm(fromMeta()), [meta?.title, meta?.season, meta?.masterName, meta?.subtitle, meta?.imageUrl, meta?.description, meta?.color]);

  const field = (key: Exclude<keyof typeof form, 'color'>) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  // Photo uploaded from this device: made smaller, saved in Firestore for this season and used at once
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const preview = useImageSrc(form.imageUrl.trim());
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      const id = seasonId(form.season.trim() || meta?.season || DEFAULT_TOURNAMENT.season);
      await saveMediaImage(id, dataUrl);
      primeImage(id, dataUrl);
      setForm((f) => ({ ...f, imageUrl: mediaRef(id) }));
      onUpdateTournamentMeta({ imageUrl: mediaRef(id) });
      flash("ok", `Foto caricata (${Math.round((dataUrl.length * 3) / 4 / 1024)} KB).`);
    } catch (e) {
      flash("err", `Foto non caricata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removePhoto = () => {
    if (!window.confirm("Togliere la foto del maestro? Sul sito non comparirà più.")) return;
    setForm((f) => ({ ...f, imageUrl: "" }));
    onUpdateTournamentMeta({ imageUrl: "" });
    flash("ok", "Foto tolta.");
  };

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
      color: form.color,
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
        <label htmlFor={isMediaRef(form.imageUrl) ? "cfg-img-file" : "cfg-img"}>Foto del maestro</label>
        <div className="photo-field">
          {preview && <img className="photo-preview" src={preview} alt="" />}
          <div className="photo-field-body">
            {isMediaRef(form.imageUrl) ? (
              <p className="note m-0">Foto caricata dall'area organizzatore.</p>
            ) : (
              <input id="cfg-img" type="text" placeholder="Link a un'immagine, oppure caricala" {...field("imageUrl")} />
            )}
            <div className="photo-actions">
              <input
                ref={fileRef}
                id="cfg-img-file"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <button type="button" className="secondary btn-compact" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Caricamento…" : isMediaRef(form.imageUrl) ? "📷 Cambia foto" : "📷 Carica foto"}
              </button>
              {form.imageUrl.trim() && (
                <button type="button" className="link-muted" onClick={removePhoto}>
                  Togli foto
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="note">La foto viene ridotta e salvata nel database del torneo: non serve modificare il codice.</p>
      </div>
      <fieldset className="color-field">
        <legend>Colore della stagione</legend>
        <div className="color-options">
          {SEASON_COLORS.map((c) => (
            <label key={c.key} className={`color-option${form.color === c.key ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="cfg-color"
                value={c.key}
                checked={form.color === c.key}
                onChange={() => setForm((f) => ({ ...f, color: c.key }))}
              />
              <span className="color-swatch" data-color={c.key} aria-hidden="true" />
              {c.label}
            </label>
          ))}
        </div>
        <p className="note">La fascia in alto nella pagina pubblica. Il verde panno è il colore del logo.</p>
      </fieldset>
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
