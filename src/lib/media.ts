// Photos uploaded from the organizer area live in Firestore, one document per season in
// tournaments/<id>/media/<seasonId>, as a compressed JPEG data URL. The tournament (and each archived
// season) points to it with imageUrl "media:<seasonId>"; a plain URL or a path in the code
// (assets/capablanca.jpg) keeps working as before.

export const MEDIA_PREFIX = 'media:';

export const mediaRef = (id: string) => `${MEDIA_PREFIX}${id}`;
export const isMediaRef = (url: string | undefined): url is string => !!url && url.startsWith(MEDIA_PREFIX);
export const mediaIdOf = (url: string) => url.slice(MEDIA_PREFIX.length);

// Longest side of an uploaded photo: the site shows it at most a few hundred pixels wide
export const MAX_SIDE = 600;
// A Firestore document holds up to 1 MiB; the rules accept a data URL up to this size
export const MAX_DATA_URL = 900_000;
// Aim for photos well below the limit: quick to download for every visitor
export const TARGET_DATA_URL = 250_000;

// Size that fits the photo within max x max, keeping its proportions, never enlarging it
export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// What the Firestore rules accept: an image data URL, not too big (the same check, before writing)
export const isStorableImage = (dataUrl: string) =>
  dataUrl.length > 0 && dataUrl.length < MAX_DATA_URL && /^data:image\/(jpeg|png|webp);base64,/.test(dataUrl);

// Draws the photo smaller and as JPEG, lowering the quality until it is light enough
export async function compressImage(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Il browser non riesce a elaborare l’immagine.');
  // White behind transparent PNGs, which JPEG cannot keep
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  let dataUrl = '';
  for (const quality of [0.85, 0.75, 0.65, 0.5]) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= TARGET_DATA_URL) break;
  }
  if (!isStorableImage(dataUrl)) throw new Error('L’immagine resta troppo pesante anche ridotta: prova con un’altra foto.');
  return dataUrl;
}
