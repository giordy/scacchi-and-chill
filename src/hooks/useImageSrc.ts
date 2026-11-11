import { useEffect, useState } from 'react';
import { isMediaRef, mediaIdOf } from '../lib/media';
import { readMediaImage } from '../lib/firestoreRest';

// Photos read once per page: switching tabs or seasons does not download them again
const cache = new Map<string, Promise<string | null>>();

// The src for an imageUrl: as it is for a link or a path, read from Firestore for an uploaded photo
// ("media:<id>"); empty while loading or when the photo is missing
export function useImageSrc(url: string | undefined): string {
  const media = isMediaRef(url);
  const [src, setSrc] = useState(media ? '' : url ?? '');

  useEffect(() => {
    if (!isMediaRef(url)) {
      setSrc(url ?? '');
      return;
    }
    setSrc('');
    let cancelled = false;
    const id = mediaIdOf(url);
    if (!cache.has(id)) {
      cache.set(
        id,
        readMediaImage(id).catch((e) => {
          console.warn('Foto non letta da Firestore:', e);
          cache.delete(id);
          return null;
        })
      );
    }
    cache.get(id)!.then((dataUrl) => !cancelled && setSrc(dataUrl ?? ''));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return src;
}

// After an upload, the new photo is shown at once without reading it back
export function primeImage(id: string, dataUrl: string) {
  cache.set(id, Promise.resolve(dataUrl));
}
