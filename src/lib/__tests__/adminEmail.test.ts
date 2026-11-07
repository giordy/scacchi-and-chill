// The organizer's email is written twice: in firestore.rules (the real protection) and in
// ADMIN_EMAILS (the interface). They must match, or the organizer sees the area but cannot save.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

describe('organizer email', () => {
  it('is the same in firestore.rules and in src/firebaseAuth.ts', () => {
    const rules = [...read('firestore.rules').matchAll(/request\.auth\.token\.email == '([^']+)'/g)].map((m) => m[1].toLowerCase());
    const ui = read('src/firebaseAuth.ts').match(/ADMIN_EMAILS = \[([^\]]*)\]/)![1];
    const listed = [...ui.matchAll(/"([^"]+)"|'([^']+)'/g)].map((m) => (m[1] ?? m[2]).toLowerCase());
    expect(rules.length).toBeGreaterThan(0);
    expect(listed.sort()).toEqual(rules.sort());
  });
});
