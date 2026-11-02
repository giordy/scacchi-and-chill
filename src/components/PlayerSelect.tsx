import { useState } from 'react';
import {
  Player,
} from '../types';

export function PlayerSelect({
  color,
  label,
  value,
  players,
  disabled,
  onChange,
}: {
  color: 'white' | 'black';
  label: string;
  value: string;
  players: Player[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedPlayer = players.find((p) => p.handle === value);

  return (
    <div className="side-container">
      <div className="side">
        <span className={"dot " + (color === "white" ? "w" : "b")} title={color} />
        
        {/* Quick Chip Button that opens the visual player picker grid */}
        <div className="player-select-row">
          <button
            type="button"
            className={`player-chip-btn ${value ? "filled" : "empty"}`}
            disabled={disabled}
            onClick={() => setShowPicker(!showPicker)}
            aria-label={label}
          >
            <span className={value ? "fw-600" : undefined}>
              {selectedPlayer ? selectedPlayer.name : (color === "white" ? "Seleziona Bianco…" : "Seleziona Nero…")}
            </span>
            <span className="chevron">▼</span>
          </button>
          {value && !disabled && (
            <button
              type="button"
              className="chip-clear-btn"
              title="Rimuovi giocatore"
              onClick={() => onChange("")}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Visual Chip Grid Modal/Dropdown */}
      {showPicker && !disabled && (
        <div className="player-chips-popover">
          <div className="player-chips-header">
            <span>Scegli giocatore per il {color === "white" ? "⚪ Bianco" : "⚫ Nero"}:</span>
            <button type="button" className="close-chips-btn" onClick={() => setShowPicker(false)}>✕</button>
          </div>
          <div className="player-chips-grid">
            {players.map((p) => {
              const isCurrent = p.handle === value;
              return (
                <button
                  key={p.handle}
                  type="button"
                  className={`player-chip ${isCurrent ? "current" : ""}`}
                  onClick={() => {
                    onChange(p.handle);
                    setShowPicker(false);
                  }}
                >
                  <span className="chip-name">{p.name}</span>
                  <span className="chip-handle">@{p.handle}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
