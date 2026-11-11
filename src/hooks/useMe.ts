import { ME_STORAGE_KEY } from '../lib/me';
import { usePersistentState } from './usePersistentState';

// Which player the visitor said they are (lib/me.ts): a handle, empty when nobody
export function useMe(): [string, (handle: string) => void] {
  return usePersistentState<string>(ME_STORAGE_KEY, '', (v) => typeof v === 'string');
}
