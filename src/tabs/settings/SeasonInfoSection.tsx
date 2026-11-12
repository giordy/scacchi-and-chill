import React, { useEffect, useRef, useState } from 'react';
import { SeasonArchive, TournamentMeta } from '../../types';
import { DEFAULT_TOURNAMENT } from '../../lib/tournament';
import { compressImage, isMediaRef, mediaRef } from '../../lib/media';
import { seasonId } from '../../lib/seasons';
import { MASTER_OPENING_TITLE, masterSurname, OPENING_FAMILIES, scudettoTitle } from '../../lib/masterOpening';
import { replayGifFor } from '../../components/GameReplay';
import { saveMediaImage } from '../../firebaseService';
import { primeImage, useImageSrc } from '../../hooks/useImageSrc';
import { currentScudetto, SCUDETTO_COLORS, scudettoColorName, scudettoTwins } from '../../lib/scudetto';
import { ScudettoIcon } from '../../components/ScudettoIcon';

type Flash = (kind: 'ok' | 'err', text: string, items?: string[]) => void;

// Name of the tournament and of the current season, with the master it is dedicated to
export function SeasonInfoSection({
  meta,
  seasons = [],
  flash,
  onUpdateTournamentMeta,
}: {
  meta?: TournamentMeta;
  seasons?: SeasonArchive[]; // archived seasons, to keep the scudetto apart from the earlier ones
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
    masterOpening: meta?.masterOpening ?? "",
    masterColor: meta?.masterColor ?? "",
    famousUrl: meta?.famousGame?.url ?? "",
    famousTitle: meta?.famousGame?.title ?? "",
    famousNote: meta?.famousGame?.note ?? "",
  });
  const [form, setForm] = useState(fromMeta);
  // A new season (started from "Fine stagione") changes these fields from outside
  useEffect(() => setForm(fromMeta()), [meta?.title, meta?.season, meta?.masterName, meta?.subtitle, meta?.imageUrl, meta?.description, meta?.masterOpening, meta?.masterColor, meta?.famousGame]);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
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

  // The scudetto of the season as it will be once archived, and the earlier ones it would look the same as
  const seasonName = form.season.trim() || meta?.season || DEFAULT_TOURNAMENT.season;
  const scudetto = currentScudetto(seasonName, form.masterName, form.masterColor, seasons);
  const twinsOf = (color: string) => scudettoTwins(seasonName, form.masterName, color, seasons);
  const twins = twinsOf(scudetto.color);
  const seasonsOfTwins = (list: typeof twins) => list.map((t) => `${t.title} (${t.season})`).join(", ");

  const save = () => {
    if (!form.title.trim() || !form.season.trim()) {
      flash("err", "Nome del torneo e stagione sono obbligatori.");
      return;
    }
    const famousUrl = form.famousUrl.trim();
    if (famousUrl && !(famousUrl.startsWith("https://lichess.org/") && replayGifFor(famousUrl))) {
      flash("err", "La partita del maestro va indicata con il link di una partita o di un capitolo di studio su Lichess (https://lichess.org/…).");
      return;
    }
    if (famousUrl && !form.famousTitle.trim()) {
      flash("err", "Dai un titolo alla partita del maestro, es. «Capablanca – Marshall, New York 1918».");
      return;
    }
    onUpdateTournamentMeta({
      title: form.title.trim(),
      season: form.season.trim(),
      masterName: form.masterName.trim(),
      subtitle: form.subtitle.trim(),
      imageUrl: form.imageUrl.trim(),
      description: form.description.trim(),
      masterOpening: form.masterOpening,
      masterColor: form.masterColor,
      // Without a link the title and note are kept (e.g. from the AI reply), but nothing shows on the site
      famousGame: { url: famousUrl, title: form.famousTitle.trim(), ...(form.famousNote.trim() ? { note: form.famousNote.trim() } : {}) },
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
          {/* The master names the main trophy; Pillsbury would make two trophies with one name */}
          <p className="note">
            Dà il nome al trofeo: <strong>{scudettoTitle(form.masterName)}</strong>.
            {/pillsbury/i.test(masterSurname(form.masterName)) && " Attenzione: c'è già il Trofeo Pillsbury, i due trofei avrebbero lo stesso nome."}
          </p>
        </div>
        <div>
          <label htmlFor="cfg-sub">Motto</label>
          <input id="cfg-sub" type="text" placeholder="es. La macchina degli scacchi" {...field("subtitle")} />
        </div>
      </div>
      <fieldset className="scudetto-field">
        <legend>Colore dello scudetto</legend>
        <div className="scudetto-field-body">
          <span className="scudetto-preview">
            <ScudettoIcon scudetto={scudetto} size={56} />
          </span>
          {scudetto.letter ? (
            <div className="scudetto-swatches">
              <input
                type="radio"
                name="cfg-color"
                id="cfg-color-auto"
                className="sr-only"
                checked={form.masterColor === ""}
                onChange={() => setForm((f) => ({ ...f, masterColor: "" }))}
              />
              <label htmlFor="cfg-color-auto" className="scudetto-swatch is-auto" title="Lo sceglie il sito">
                Auto
              </label>
              {SCUDETTO_COLORS.map((c, i) => {
                const taken = twinsOf(c.color);
                const tip = taken.length > 0 ? `${c.name}: già usato con la «${scudetto.letter}» (${seasonsOfTwins(taken)})` : c.name;
                return (
                  <React.Fragment key={c.color}>
                    <input
                      type="radio"
                      name="cfg-color"
                      id={`cfg-color-${i}`}
                      className="sr-only"
                      checked={form.masterColor === c.color}
                      onChange={() => setForm((f) => ({ ...f, masterColor: c.color }))}
                    />
                    <label
                      htmlFor={`cfg-color-${i}`}
                      className={`scudetto-swatch${taken.length > 0 ? " is-taken" : ""}`}
                      style={{ background: c.color }}
                      title={tip}
                    >
                      <span className="sr-only">{tip}</span>
                    </label>
                  </React.Fragment>
                );
              })}
            </div>
          ) : null}
        </div>
        <p className="note">
          {!scudetto.letter
            ? "Senza maestro la stagione vale lo Scudetto Chill: verde, con il cavallo."
            : scudetto.auto
            ? `Lo sceglie il sito: ${scudettoColorName(scudetto.color)}, mai usato prima con la «${scudetto.letter}». `
            : `Lo scudo che riceve il campione: la «${scudetto.letter}» del maestro su questo colore. `}
          {scudetto.letter && !scudetto.auto && twins.length > 0 && (
            <strong className="scudetto-warning">
              Attenzione: {twins.length === 1 ? "c'è già" : "ci sono già"} {seasonsOfTwins(twins)} con la stessa iniziale e lo stesso colore, e
              gli scudetti sarebbero uguali.
            </strong>
          )}
          {scudetto.letter && SCUDETTO_COLORS.some((c) => twinsOf(c.color).length > 0) && " I colori con il punto bianco sono già stati usati con questa iniziale."}
        </p>
      </fieldset>
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
      <div>
        <label htmlFor="cfg-desc">Presentazione della stagione</label>
        <textarea id="cfg-desc" rows={4} className="ta-md" {...field("description")} />
      </div>
      <div>
        <label htmlFor="cfg-opening">Apertura del maestro</label>
        <select id="cfg-opening" {...field("masterOpening")}>
          <option value="">Nessuna</option>
          {OPENING_FAMILIES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label} ({f.side === "white" ? "bianco" : "nero"})
            </option>
          ))}
        </select>
        <p className="note">
          Le partite che la giocano hanno un'etichetta, e a fine stagione il premio «{MASTER_OPENING_TITLE}» va a chi l'ha
          giocata di più, dal lato indicato. Conta tutta la famiglia: per la Siciliana, anche Najdorf, Dragone e le altre varianti.
        </p>
      </div>
      <div className="grid2">
        <div>
          <label htmlFor="cfg-famous-url">Partita celebre del maestro</label>
          <input id="cfg-famous-url" type="url" placeholder="https://lichess.org/…" {...field("famousUrl")} />
        </div>
        <div>
          <label htmlFor="cfg-famous-title">Titolo della partita</label>
          <input id="cfg-famous-title" type="text" placeholder="es. Capablanca – Marshall, New York 1918" {...field("famousTitle")} />
          <p className="note">Prima il bianco, poi il nero: i nomi compaiono sotto la scacchiera.</p>
        </div>
      </div>
      <div>
        <label htmlFor="cfg-famous-note">Due righe sulla partita (facoltative)</label>
        <textarea id="cfg-famous-note" rows={2} {...field("famousNote")} />
        <p className="note">
          Una partita su Lichess, oppure il capitolo di uno studio pubblico (lichess.org/study/…/…). Se non la trovi,
          incolla la sua notazione (PGN) in lichess.org/paste e copia qui il link che ottieni. Nella sezione Stagione si
          rivede mossa per mossa.
        </p>
      </div>
      <button className="primary" type="button" onClick={save}>
        Salva stagione
      </button>
    </>
  );
}
