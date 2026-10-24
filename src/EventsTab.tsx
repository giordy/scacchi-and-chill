import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, LichessBroadcastTour } from './types';

const WORLD_TOP_KEYWORDS = [
  "world championship",
  "candidates",
  "candidati",
  "olympiad",
  "olimpiadi",
  "tata steel",
  "world cup",
  "norway chess",
  "grand chess tour",
  "sinquefield",
  "wr chess",
  "grand swiss",
  "freestyle chess",
  "speed chess championship",
  "fide world blitz",
  "fide world rapid",
  "superbet",
  "fide circuit",
  "champions chess tour",
  "chess.com global",
];

const ITALIAN_KEYWORDS = [
  "campionato italiano",
  "italian",
  "italia",
  "italy",
  "spilimbergo",
  "arco",
  "cesenatico",
  "roma",
  "milano",
  "chianciano",
  "brusaporto",
  "montecatini",
  "bassano",
  "trieste",
  "padova",
  "verona",
];

const MONTH_NAMES_IT = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

function isItalianTour(tour: LichessBroadcastTour): boolean {
  const loc = (tour.info?.location || "").toLowerCase();
  const name = tour.name.toLowerCase();
  const slug = (tour.slug || "").toLowerCase();
  return (
    loc.includes("italy") ||
    loc.includes("italia") ||
    ITALIAN_KEYWORDS.some((k) => name.includes(k) || slug.includes(k))
  );
}

function isTopTierWorldTour(tour: LichessBroadcastTour): boolean {
  if (isItalianTour(tour)) return false;
  const name = tour.name.toLowerCase();
  const slug = (tour.slug || "").toLowerCase();

  // Tier 1 on Lichess is top tier
  if (tour.tier === 1) return true;

  // Key premier events worldwide
  if (WORLD_TOP_KEYWORDS.some((kw) => name.includes(kw) || slug.includes(kw))) {
    return true;
  }

  // Tier 2 with top players
  if (tour.tier === 2 && Boolean(tour.info?.players)) {
    return true;
  }

  return false;
}

function getTourDescription(tour: LichessBroadcastTour, descriptions: Record<string, string> = {}): string {
  const nameLower = tour.name.toLowerCase();
  const slugLower = (tour.slug || "").toLowerCase();

  for (const [key, desc] of Object.entries(descriptions)) {
    if (nameLower.includes(key.toLowerCase()) || slugLower.includes(key.toLowerCase())) {
      return desc;
    }
  }

  if (isItalianTour(tour)) {
    if (nameLower.includes("campionato") || nameLower.includes("cia")) {
      return "La massima competizione nazionale per il titolo di Campione d'Italia.";
    }
    return "Prestigioso torneo scacchistico sul territorio italiano con maestri e grandi maestri.";
  }

  if (nameLower.includes("championship") || nameLower.includes("campionato")) {
    return "Campionato ufficiale di vertice internazionale.";
  }
  if (tour.tier && tour.tier <= 2) {
    return "Super-torneo d'élite internazionale con i migliori scacchisti al mondo.";
  }
  return "Importante torneo internazionale con i Grandi Maestri della scena mondiale.";
}

function formatTourDates(dates?: number[]): string {
  if (!dates || dates.length === 0) return "Date in corso di definizione";
  const start = new Date(dates[0]);
  const end = dates.length > 1 ? new Date(dates[1]) : start;

  const startDay = start.getDate();
  const startMonth = MONTH_NAMES_IT[start.getMonth()];
  const startYear = start.getFullYear();

  const endDay = end.getDate();
  const endMonth = MONTH_NAMES_IT[end.getMonth()];
  const endYear = end.getFullYear();

  if (start.toDateString() === end.toDateString()) {
    return `${startDay} ${startMonth} ${startYear}`;
  }
  if (startMonth === endMonth && startYear === endYear) {
    return `Dal ${startDay} al ${endDay} ${startMonth} ${startYear}`;
  }
  if (startYear === endYear) {
    return `Dal ${startDay} ${startMonth} al ${endDay} ${endMonth} ${startYear}`;
  }
  return `Dal ${startDay} ${startMonth} ${startYear} al ${endDay} ${endMonth} ${endYear}`;
}

export function EventsTab({
  config,
  flash,
}: {
  config: AppConfig;
  flash: (kind: 'ok' | 'err' | 'warning', text: string, items?: string[]) => void;
}) {
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);
  const [allTours, setAllTours] = useState<LichessBroadcastTour[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTourIds, setSelectedTourIds] = useState<Set<string>>(new Set());
  const [editedText, setEditedText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate list of 6 selectable months
  const monthOptions = useMemo(() => {
    const list: Array<{ key: string; label: string }> = [];
    const base = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES_IT[d.getMonth()]} ${d.getFullYear()}${i === 0 ? " (Mese in corso)" : ""}`;
      list.push({ key, label });
    }
    return list;
  }, []);

  // Fetch broadcasts from Lichess
  const fetchBroadcasts = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch both top and recent broadcast list for comprehensive coverage
      const [resTop, resList] = await Promise.allSettled([
        fetch("https://lichess.org/api/broadcast/top"),
        fetch("https://lichess.org/api/broadcast?nb=80"),
      ]);

      const map = new Map<string, LichessBroadcastTour>();

      if (resTop.status === "fulfilled" && resTop.value.ok) {
        try {
          const topData = await resTop.value.json();
          const items = [...(topData.active || []), ...(topData.upcoming || [])];
          items.forEach((item: any) => {
            if (item.tour?.id) map.set(item.tour.id, item.tour);
          });
        } catch {
          // ignore
        }
      }

      if (resList.status === "fulfilled" && resList.value.ok) {
        try {
          const text = await resList.value.text();
          text
            .split("\n")
            .filter(Boolean)
            .forEach((line) => {
              try {
                const item = JSON.parse(line);
                if (item.tour?.id && !map.has(item.tour.id)) {
                  map.set(item.tour.id, item.tour);
                }
              } catch {
                // ignore
              }
            });
        } catch {
          // ignore
        }
      }

      const list = Array.from(map.values());
      setAllTours(list);
      setLoading(false);
      flash("ok", `Caricati ${list.length} tornei broadcast da Lichess.`);
    } catch (e: any) {
      setLoading(false);
      setError("Impossibile caricare i tornei da Lichess. Verifica la connessione.");
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, []);

  // Filter and pick premier tournaments for the chosen month
  const { worldTours, italianTour, eligibleTotal } = useMemo(() => {
    const [yearStr, monthStr] = selectedMonthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const monthStart = new Date(year, month, 1).getTime();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    const now = Date.now();

    // Tour must overlap with the chosen month and not be already completely finished
    const inMonth = allTours.filter((t) => {
      if (!t.dates || t.dates.length === 0) return false;
      const start = t.dates[0];
      const end = t.dates.length > 1 ? t.dates[1] : start;
      const overlaps = start <= monthEnd && end >= monthStart;
      const isOngoingOrFuture = end >= now;
      return overlaps && isOngoingOrFuture;
    });

    // 1. Italian premier tournament (max 1)
    const itCandidates = inMonth.filter(isItalianTour).sort((a, b) => {
      // Prefer tournaments with lower tier number or explicitly mentioning Campionato
      const aIsCIA = a.name.toLowerCase().includes("campionato") ? 1 : 0;
      const bIsCIA = b.name.toLowerCase().includes("campionato") ? 1 : 0;
      if (aIsCIA !== bIsCIA) return bIsCIA - aIsCIA;
      return (a.tier ?? 5) - (b.tier ?? 5);
    });
    const itPicked = itCandidates.length > 0 ? itCandidates[0] : null;

    // 2. World Top-Tier tournaments (max 2)
    // Only genuine top-tier events! If the 2nd is not top-tier, omit it!
    const worldCandidates = inMonth
      .filter((t) => isTopTierWorldTour(t) && t.id !== itPicked?.id)
      .sort((a, b) => {
        // Priority to Tier 1 and World Championship / Candidates / Olympiad / Tata Steel
        const aIsMajor = WORLD_TOP_KEYWORDS.some((k) => a.name.toLowerCase().includes(k)) ? 1 : 0;
        const bIsMajor = WORLD_TOP_KEYWORDS.some((k) => b.name.toLowerCase().includes(k)) ? 1 : 0;
        if (aIsMajor !== bIsMajor) return bIsMajor - aIsMajor;
        return (a.tier ?? 5) - (b.tier ?? 5);
      });

    // Take at most 2, but ensure the second is also top tier
    const worldPicked: LichessBroadcastTour[] = [];
    if (worldCandidates.length > 0) {
      worldPicked.push(worldCandidates[0]);
      if (worldCandidates.length > 1) {
        const second = worldCandidates[1];
        // Check if second is truly top tier (tier 1 or marquee keyword)
        const isSecondPremier =
          second.tier === 1 ||
          WORLD_TOP_KEYWORDS.some((k) => second.name.toLowerCase().includes(k));
        if (isSecondPremier) {
          worldPicked.push(second);
        }
      }
    }

    return {
      worldTours: worldPicked,
      italianTour: itPicked,
      eligibleTotal: worldPicked.length + (itPicked ? 1 : 0),
    };
  }, [allTours, selectedMonthKey]);

  // Sync selectedTourIds when worldTours or italianTour change
  useEffect(() => {
    const ids = new Set<string>();
    worldTours.forEach((t) => ids.add(t.id));
    if (italianTour) ids.add(italianTour.id);
    setSelectedTourIds(ids);
  }, [worldTours, italianTour]);

  // Generate WhatsApp message
  const generatedMessage = useMemo(() => {
    const activeWorld = worldTours.filter((t) => selectedTourIds.has(t.id));
    const activeIt = italianTour && selectedTourIds.has(italianTour.id) ? italianTour : null;

    if (activeWorld.length === 0 && !activeIt) {
      return "";
    }

    const [yearStr, monthStr] = selectedMonthKey.split('-');
    const month = parseInt(monthStr, 10) - 1;
    const monthName = MONTH_NAMES_IT[month];

    const lines: string[] = [];
    lines.push(`♟️ *I Grandi Tornei di Scacchi – ${monthName} ${yearStr}*`);
    lines.push(`Ecco i tornei imperdibili da seguire in diretta questo mese:`);

    // World top-tier tournaments
    activeWorld.forEach((t) => {
      const desc = getTourDescription(t, config.tournamentDescriptions);
      const datesStr = formatTourDates(t.dates);
      const loc = t.info?.location ? `📍 ${t.info.location}` : "";
      const players = t.info?.players ? `👥 *Protagonisti:* ${t.info.players}` : "";
      const website = t.info?.website ? `🌐 *Sito ufficiale:* ${t.info.website}` : "";
      const lichessUrl = `🔗 *Diretta Lichess:* ${t.url}`;

      const block = [
        `🏆 *${t.name}*`,
        loc,
        `📅 ${datesStr}`,
        players,
        `ℹ️ ${desc}`,
        website,
        lichessUrl,
      ]
        .filter(Boolean)
        .join("\n");

      lines.push(block);
    });

    // Italian tournament
    if (activeIt) {
      const desc = getTourDescription(activeIt, config.tournamentDescriptions);
      const datesStr = formatTourDates(activeIt.dates);
      const loc = activeIt.info?.location ? `📍 ${activeIt.info.location}` : "📍 Italia";
      const players = activeIt.info?.players ? `👥 *Protagonisti:* ${activeIt.info.players}` : "";
      const website = activeIt.info?.website ? `🌐 *Sito ufficiale:* ${activeIt.info.website}` : "";
      const lichessUrl = `🔗 *Diretta Lichess:* ${activeIt.url}`;

      const block = [
        `🇮🇹 *${activeIt.name}* (In Italia)`,
        loc,
        `📅 ${datesStr}`,
        players,
        `ℹ️ ${desc}`,
        website,
        lichessUrl,
      ]
        .filter(Boolean)
        .join("\n");

      lines.push(block);
    }

    lines.push(`🍿 *Tutte le partite sono visibili mossa dopo mossa gratuitamente sui link Lichess sopra!*`);

    return lines.join("\n\n");
  }, [worldTours, italianTour, selectedTourIds, selectedMonthKey, config.tournamentDescriptions]);

  useEffect(() => {
    setEditedText(null);
  }, [generatedMessage]);

  const messageText = editedText ?? generatedMessage;

  const toggleTour = (id: string) => {
    setSelectedTourIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyMessage = async () => {
    if (!messageText) return;
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      flash("ok", "Messaggio copiato negli appunti.");
    } catch {
      flash("err", "Impossibile copiare automaticamente. Seleziona il testo per copiarlo.");
    }
  };

  return (
    <section>
      <h2>Grandi Tornei su Lichess</h2>
      <p className="note" style={{ marginBottom: 14 }}>
        Genera un messaggio WhatsApp mensile con 1 o al massimo 2 eventi mondiali di prima fascia e l'eventuale torneo italiano di rilievo, con link al sito ufficiale e al broadcast Lichess.
      </p>

      {/* Month selector and refresh button */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
        <div>
          <label htmlFor="select-event-month">Seleziona Mese</label>
          <select
            id="select-event-month"
            value={selectedMonthKey}
            onChange={(e) => {
              setSelectedMonthKey(e.target.value);
              setEditedText(null);
            }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="secondary"
          type="button"
          disabled={loading}
          onClick={fetchBroadcasts}
          title="Ricarica i tornei dalle API di Lichess"
          style={{ minHeight: '48px' }}
        >
          {loading ? "Aggiornamento…" : "🔄 Aggiorna"}
        </button>
      </div>

      {error && <div className="notice err">{error}</div>}

      {/* Selected Events Overview */}
      {eligibleTotal === 0 ? (
        <div className="notice ok" style={{ margin: '14px 0' }}>
          ☕ <strong>Nessun torneo top-tier per questo mese</strong>
          <p style={{ margin: '6px 0 0', fontSize: '14px', lineHeight: 1.4 }}>
            Non sono presenti tornei mondiali di prima fascia (es. Mondiali, Candidati, Olimpiadi, Tata Steel) o eventi italiani di rilievo in corso o futuri per il mese selezionato.
            <br />
            <strong>Come da tua preferenza, il messaggio WhatsApp per questo mese può essere tranquillamente omesso</strong> per non inviare comunicazioni secondarie al gruppo.
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '16px', margin: '12px 0 8px' }}>
            Tornei selezionati ({eligibleTotal})
          </h3>

          {/* World tournaments */}
          {worldTours.map((tour) => {
            const isChecked = selectedTourIds.has(tour.id);
            const desc = getTourDescription(tour, config.tournamentDescriptions);
            return (
              <div key={tour.id} className="round-card" style={{ borderLeft: '4px solid #d4af37' }}>
                <div className="round-header">
                  <strong>🏆 {tour.name}</strong>
                  <span className="badge badge-gold">Mondiale Top-Tier</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'grid', gap: '3px', marginBottom: 8 }}>
                  {tour.info?.location && <div>📍 <strong>Sede:</strong> {tour.info.location}</div>}
                  <div>📅 <strong>Date:</strong> {formatTourDates(tour.dates)}</div>
                  {tour.info?.players && <div>👥 <strong>In gara:</strong> {tour.info.players}</div>}
                  <div>ℹ️ <em>{desc}</em></div>
                  {tour.info?.website && (
                    <div>
                      🌐 <a href={tour.info.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                        Sito ufficiale dell'evento
                      </a>
                    </div>
                  )}
                  <div>
                    🔗 <a href={tour.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      Guarda diretta su Lichess
                    </a>
                  </div>
                </div>
                <div className="inline" style={{ minHeight: 'auto', marginTop: 4 }}>
                  <input
                    id={`toggle-${tour.id}`}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleTour(tour.id)}
                  />
                  <label htmlFor={`toggle-${tour.id}`} style={{ fontSize: '13px' }}>
                    Includi nel messaggio WhatsApp
                  </label>
                </div>
              </div>
            );
          })}

          {/* Italian tournament */}
          {italianTour && (
            <div key={italianTour.id} className="round-card" style={{ borderLeft: '4px solid var(--ok)' }}>
              <div className="round-header">
                <strong>🇮🇹 {italianTour.name}</strong>
                <span className="badge badge-green">Torneo in Italia</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'grid', gap: '3px', marginBottom: 8 }}>
                {italianTour.info?.location && <div>📍 <strong>Sede:</strong> {italianTour.info.location}</div>}
                <div>📅 <strong>Date:</strong> {formatTourDates(italianTour.dates)}</div>
                {italianTour.info?.players && <div>👥 <strong>In gara:</strong> {italianTour.info.players}</div>}
                <div>ℹ️ <em>{getTourDescription(italianTour, config.tournamentDescriptions)}</em></div>
                {italianTour.info?.website && (
                  <div>
                    🌐 <a href={italianTour.info.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      Sito ufficiale dell'evento
                    </a>
                  </div>
                )}
                <div>
                  🔗 <a href={italianTour.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                    Guarda diretta su Lichess
                  </a>
                </div>
              </div>
              <div className="inline" style={{ minHeight: 'auto', marginTop: 4 }}>
                <input
                  id={`toggle-${italianTour.id}`}
                  type="checkbox"
                  checked={selectedTourIds.has(italianTour.id)}
                  onChange={() => toggleTour(italianTour.id)}
                />
                <label htmlFor={`toggle-${italianTour.id}`} style={{ fontSize: '13px' }}>
                  Includi nel messaggio WhatsApp
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generated WhatsApp message preview */}
      {messageText && (
        <div className="result" style={{ marginTop: 16 }}>
          <h2>Messaggio WhatsApp del Mese</h2>
          <textarea
            aria-label="Messaggio tornei WhatsApp"
            value={messageText}
            onChange={(e) => setEditedText(e.target.value)}
          />
          <div className="actions two">
            <a
              className="primary"
              target="_blank"
              rel="noopener noreferrer"
              href={"https://wa.me/?text=" + encodeURIComponent(messageText)}
            >
              Condividi su WhatsApp
            </a>
            <button className="secondary" type="button" onClick={copyMessage}>
              {copied ? "Copiato!" : "Copia testo"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default EventsTab;
