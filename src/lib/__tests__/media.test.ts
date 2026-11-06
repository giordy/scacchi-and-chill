import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitWithin, isMediaRef, isStorableImage, MAX_DATA_URL, MAX_SIDE, mediaIdOf, mediaRef } from '../media';

describe('media references', () => {
  it('tells an uploaded photo from a link or a path', () => {
    expect(mediaRef('stagione-3')).toBe('media:stagione-3');
    expect(isMediaRef('media:stagione-3')).toBe(true);
    expect(mediaIdOf('media:stagione-3')).toBe('stagione-3');
    expect(isMediaRef('assets/capablanca.jpg')).toBe(false);
    expect(isMediaRef('https://upload.wikimedia.org/x.jpg')).toBe(false);
    expect(isMediaRef('')).toBe(false);
    expect(isMediaRef(undefined)).toBe(false);
  });
});

describe('fitWithin', () => {
  it('shrinks the longest side to the limit, keeping the proportions', () => {
    expect(fitWithin(3000, 2000)).toEqual({ width: MAX_SIDE, height: 400 });
    expect(fitWithin(1200, 1800)).toEqual({ width: 400, height: MAX_SIDE });
  });
  it('never enlarges a small photo', () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
  });
});

describe('isStorableImage', () => {
  const jpeg = (size: number) => 'data:image/jpeg;base64,' + 'A'.repeat(size);
  it('accepts an image data URL below the document limit', () => {
    expect(isStorableImage(jpeg(1000))).toBe(true);
    expect(isStorableImage('data:image/png;base64,AAAA')).toBe(true);
  });
  it('refuses anything else, or too big', () => {
    expect(isStorableImage(jpeg(MAX_DATA_URL))).toBe(false);
    expect(isStorableImage('data:text/html;base64,AAAA')).toBe(false);
    expect(isStorableImage('https://example.com/x.jpg')).toBe(false);
    expect(isStorableImage('')).toBe(false);
  });
  it('matches what the Firestore rules accept', () => {
    const rules = fs.readFileSync(path.join(__dirname, '../../../firestore.rules'), 'utf8');
    expect(rules).toContain(`dataUrl.size() < ${MAX_DATA_URL}`);
    expect(rules).toContain("matches('data:image/(jpeg|png|webp);base64,.*')");
  });
});
