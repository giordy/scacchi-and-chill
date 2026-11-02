import {
  Player,
  GamePair,
} from '../types';
import { PlayerSelect } from './PlayerSelect';

export function GameCard({
  index,
  pair,
  available,
  onChange,
  onSwap,
}: {
  index: number;
  pair: GamePair;
  available: (current: string) => Player[];
  onChange: (patch: Partial<GamePair>) => void;
  onSwap: () => void;
}) {
  const locked = !!pair.url;
  return (
    <div className="game">
      <h2>
        <span>Partita {index + 1}</span>
        <span className="state">{locked ? "Creata" : ""}</span>
      </h2>
      <div className="pair">
        <div className="selects">
          <PlayerSelect
            color="white"
            label={`Partita ${index + 1} bianco`}
            value={pair.white}
            players={available(pair.white)}
            disabled={locked}
            onChange={(v) => onChange({ white: v })}
          />
          <PlayerSelect
            color="black"
            label={`Partita ${index + 1} nero`}
            value={pair.black}
            players={available(pair.black)}
            disabled={locked}
            onChange={(v) => onChange({ black: v })}
          />
        </div>
        <button
          className="swap"
          type="button"
          disabled={locked}
          onClick={onSwap}
          aria-label={`Scambia colori partita ${index + 1}`}
        >
          ⇅
        </button>
      </div>
    </div>
  );
}
