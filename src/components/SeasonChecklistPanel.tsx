import React from 'react';
import { ChecklistSection, ChecklistTab, SeasonChecklist } from '../lib/seasonChecklist';

// Organizer area, on top of every tab between two seasons: what to do to close the season that
// ended, then to prepare the next one (lib/seasonChecklist.ts). Each step leads to its section.
export function SeasonChecklistPanel({
  checklist,
  onGo,
  onTick,
}: {
  checklist: SeasonChecklist;
  onGo: (tab: ChecklistTab, section?: ChecklistSection) => void;
  onTick: (step: string) => void;
}) {
  const required = checklist.steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const title = checklist.phase === 'end' ? `🏁 Fine della ${checklist.season}` : `🌱 Prepara la ${checklist.season}`;

  return (
    <details className="panel season-checklist" open>
      <summary className="panel-title">
        {title} <span className="muted-normal">· {done} su {required.length}</span>
      </summary>
      <ol className="checklist">
        {checklist.steps.map((s) => (
          <li key={s.key} className={s.done ? 'is-done' : ''}>
            {s.manual ? (
              <input
                type="checkbox"
                className="checklist-box"
                checked={s.done}
                onChange={() => onTick(s.key)}
                aria-label={`${s.label}: ${s.done ? 'fatto' : 'da fare'}`}
              />
            ) : (
              <span className="checklist-mark" aria-label={s.done ? 'fatto' : 'da fare'}>
                {s.done ? '✓' : '○'}
              </span>
            )}
            <span className="checklist-text">
              <span className="checklist-label">{s.label}</span>
              {s.detail && <span className="checklist-detail">{s.detail}</span>}
            </span>
            <span className="checklist-actions">
              {s.link && (
                <a href={s.link.href} target="_blank" rel="noopener noreferrer" className="link-muted">
                  {s.link.label}
                </a>
              )}
              {!(s.key === 'games' && s.done) && (
                <button type="button" className="secondary btn-mini btn-go" onClick={() => onGo(s.tab, s.section)}>
                  Vai
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>
      {checklist.phase === 'end' ? (
        <p className="note note-flush">
          Le caselle sono per quello che il sito non può vedere: le spunti tu. Il resto si aggiorna da solo.
        </p>
      ) : (
        <p className="note note-flush">Si aggiorna da solo; le caselle le spunti tu. Sparisce quando crei le sfide del Turno 1.</p>
      )}
    </details>
  );
}
