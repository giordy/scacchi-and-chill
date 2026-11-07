import { createContext, useContext } from 'react';
import { NameOf } from '../lib/roster';

// The names of the players register (lib/roster.ts), for the components that show names saved in
// the archives or the hall of fame: a player renamed by the organizer shows the new name there too.
// Without a provider, the saved name.
export const NamesContext = createContext<NameOf>((handle, fallback) => fallback ?? handle);
export const useNameOf = () => useContext(NamesContext);
