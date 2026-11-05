import { useEffect, useState } from 'react';
import { SeasonArchive } from '../types';
import { sortSeasons } from '../lib/seasons';
import { subscribeToSeasons } from '../firebaseService';

// Archived seasons, newest first, kept in sync in real time
export function useSeasons(): SeasonArchive[] {
  const [seasons, setSeasons] = useState<SeasonArchive[]>([]);
  useEffect(() => subscribeToSeasons((list) => setSeasons(sortSeasons(list))), []);
  return seasons;
}
