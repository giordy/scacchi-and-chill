import { useCallback, useEffect, useState } from 'react';
import { readPledges } from '../lib/firestoreRest';
import { Pledge } from '../lib/pledges';

// Organizer area: who accepted the rules (public documents, read as the public page does), read
// again on demand
export function usePledges() {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    try {
      setPledges(await readPledges());
      setLoaded(true);
    } catch (e) {
      console.warn('Lettura delle accettazioni del regolamento non riuscita:', e);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { pledges, loaded, reload };
}
