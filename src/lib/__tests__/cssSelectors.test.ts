// A selector list (`button.primary,` on one line, `a.primary {` on the next) must not be cut by a
// comment or another rule inserted in between: the first selector would silently lose its style,
// as happened to every primary button when the rule for plain links landed there.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(__dirname, '../../index.css'), 'utf8');

describe('index.css selector lists', () => {
  it('continue on the next line with another selector', () => {
    const lines = css.split('\n');
    const broken: string[] = [];
    lines.forEach((line, i) => {
      if (!/^\s*[^\s/*{}][^{}]*,\s*$/.test(line)) return; // a selector ending with a comma
      const next = lines.slice(i + 1).find((l) => l.trim() !== '') ?? '';
      if (/^\s*(\/\*|\})/.test(next) || /\{[^}]*\}/.test(next)) broken.push(`${i + 1}: ${line.trim()} → ${next.trim()}`);
    });
    expect(broken).toEqual([]);
  });
});
