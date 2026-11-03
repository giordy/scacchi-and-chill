// Builds the link preview image (dist/og.png) with the current standings and adds the
// og:image tags to dist/index.html. Runs after `vite build`; reads only public data
// (Firestore public documents and the Lichess game export), so it needs no credentials.
// It never fails the build: without data it draws a preview with just the tournament name.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Resvg } from '@resvg/resvg-js';
import firebaseConfig from '../firebase-applet-config.json';
import rawConfig from '../config.json';
import { HistoryGame, LichessExportGame, Player, ScheduledMatch } from '../src/types';
import { computeStandings, PlayerStanding } from '../src/lib/standings';
import { computeSeasonProgress, gameProgress, mergeGameStates } from '../src/lib/progress';
import { normalizeSchedule } from '../src/lib/config';
import { extractGameId } from '../src/lib/utils';
import { fetchGameStates } from '../src/lib/lichess';
import { DEFAULT_TOURNAMENT } from '../src/lib/tournament';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const FONTS = path.join(ROOT, 'scripts', 'fonts');
const TOURNAMENT_DOC_ID = 'scacchi-and-chill-official';
const W = 1200;
const H = 630;

// ---------- Firestore REST (public read) ----------

type FsValue = Record<string, unknown>;

function decode(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return ((v.arrayValue as { values?: FsValue[] }).values ?? []).map(decode);
  if ('mapValue' in v) return decodeFields((v.mapValue as { fields?: Record<string, FsValue> }).fields);
  return undefined;
}

function decodeFields(fields: Record<string, FsValue> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, decode(v)]));
}

const docsBase = () =>
  `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/` +
  `${encodeURIComponent(firebaseConfig.firestoreDatabaseId || '(default)')}/documents/tournaments/${TOURNAMENT_DOC_ID}`;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} da ${url.split('?')[0]}`);
  return res.json();
}

async function loadTournament() {
  const key = `key=${firebaseConfig.apiKey}`;
  const docJson = await getJson(`${docsBase()}?${key}`);
  const doc = decodeFields(docJson.fields) as Record<string, any>;

  // A query, not the plain list endpoint: the security rules let anyone query the games
  const res = await fetch(`${docsBase()}:runQuery?${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'games' }] } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} leggendo le partite`);
  const rows: { document?: { fields?: Record<string, FsValue> } }[] = await res.json();
  const history: HistoryGame[] = [];
  rows.forEach((row) => {
    if (!row.document) return;
    const g = decodeFields(row.document.fields) as Record<string, any>;
    if (g.round && g.white && g.black) {
      history.push({
        round: String(g.round),
        white: String(g.white),
        black: String(g.black),
        url: String(g.url || ''),
        lichess: g.lichess || undefined,
      });
    }
  });

  const players: Player[] =
    Array.isArray(doc.players) && doc.players.length > 0 ? doc.players : ((rawConfig as any).players ?? []);
  const schedule: ScheduledMatch[] = Array.isArray(doc.schedule) ? normalizeSchedule(doc.schedule) : [];
  return {
    title: String(doc.title || DEFAULT_TOURNAMENT.title),
    season: String(doc.season || DEFAULT_TOURNAMENT.season),
    imageUrl: String(doc.imageUrl || DEFAULT_TOURNAMENT.imageUrl || ''),
    players,
    schedule,
    history,
  };
}

// Same rule as the public page: Firestore results plus the open games read live from Lichess
async function loadGameStates(history: HistoryGame[]) {
  const stored: Record<string, LichessExportGame> = {};
  history.forEach((g) => {
    const id = extractGameId(g.url);
    if (id && g.lichess) stored[id] = g.lichess;
  });
  const open = history
    .map((g) => extractGameId(g.url))
    .filter((id): id is string => Boolean(id) && gameProgress(stored[id as string]) !== 'finished');
  if (open.length === 0) return stored;
  try {
    return mergeGameStates(stored, await fetchGameStates([...new Set(open)]));
  } catch (e) {
    console.warn('og-image: Lichess non raggiungibile, uso solo i risultati salvati.', e);
    return stored;
  }
}

// ---------- Drawing ----------

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const C = {
  felt: '#1f3a34',
  feltDeep: '#132520',
  ink: '#f4f1e8',
  muted: '#b8cbc1',
  brass: '#e2c07a',
  gold: '#c9973a',
  silver: '#9aa5aa',
  bronze: '#b87347',
  card: 'rgba(255,255,255,0.07)',
  cardLine: 'rgba(255,255,255,0.14)',
};

// Faint chessboard fading out from the top-right corner
function checkerTexture() {
  const size = 54;
  let out = '';
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 11; c++) {
      if ((r + c) % 2) continue;
      const dist = Math.hypot(r, c) / 9;
      const alpha = Math.max(0, 0.08 * (1 - dist));
      if (alpha <= 0.004) continue;
      out += `<rect x="${W - (c + 1) * size}" y="${r * size}" width="${size}" height="${size}" fill="#fff" fill-opacity="${alpha.toFixed(3)}"/>`;
    }
  }
  return out;
}

function portrait(imageUrl: string) {
  // Only images shipped with the site: an external URL would make the build depend on another host
  if (!imageUrl || /^https?:/i.test(imageUrl)) return '';
  const file = path.join(ROOT, 'public', imageUrl.replace(/^\.?\//, ''));
  if (!fs.existsSync(file)) return '';
  const ext = path.extname(file).slice(1).toLowerCase() === 'png' ? 'png' : 'jpeg';
  const data = fs.readFileSync(file).toString('base64');
  return `
    <clipPath id="pc"><rect x="70" y="64" width="188" height="230" rx="12"/></clipPath>
    <image href="data:image/${ext};base64,${data}" x="70" y="64" width="188" height="230" preserveAspectRatio="xMidYMid slice" clip-path="url(#pc)"/>
    <rect x="70" y="64" width="188" height="230" rx="12" fill="none" stroke="${C.brass}" stroke-width="4"/>`;
}

// Truncate to fit roughly `max` characters (resvg has no text measuring)
const fit = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
const pts = (n: number) => `${String(n).replace('.5', '½').replace(/^0½/, '½')} ${n === 1 ? 'punto' : 'punti'}`;

function podium(top: PlayerStanding[]) {
  const medal = [C.gold, C.silver, C.bronze];
  const cardW = 338;
  const gap = 23;
  return top
    .map((p, i) => {
      const x = 70 + i * (cardW + gap);
      const y = 380;
      return `
      <g>
        <rect x="${x}" y="${y}" width="${cardW}" height="150" rx="16" fill="${C.card}" stroke="${i === 0 ? C.brass : C.cardLine}" stroke-width="${i === 0 ? 3 : 2}"/>
        <circle cx="${x + 52}" cy="${y + 75}" r="30" fill="${medal[i]}"/>
        <text x="${x + 52}" y="${y + 87}" text-anchor="middle" font-family="Alegreya Sans ExtraBold" font-size="34" fill="${C.feltDeep}">${i + 1}</text>
        <text x="${x + 100}" y="${y + 70}" font-family="Alegreya" font-weight="700" font-size="36" fill="${C.ink}">${esc(fit(p.name, 13))}</text>
        <text x="${x + 100}" y="${y + 110}" font-family="Alegreya Sans Medium" font-size="28" fill="${C.brass}">${pts(p.points)}</text>
      </g>`;
    })
    .join('');
}

function seasonStrip(games: ('finished' | 'ongoing' | 'pending')[]) {
  if (games.length === 0) return '';
  const size = Math.min(22, Math.floor((W - 140 - (games.length - 1) * 5) / games.length));
  return games
    .map((s, i) => {
      const x = 70 + i * (size + 5);
      const fill = s === 'finished' ? C.ink : s === 'ongoing' ? C.brass : 'none';
      return `<rect x="${x}" y="566" width="${size}" height="${size}" rx="3" fill="${fill}" stroke="${s === 'pending' ? 'rgba(255,255,255,0.35)' : 'none'}" stroke-width="2"/>`;
    })
    .join('');
}

function render(data: Awaited<ReturnType<typeof loadTournament>> | null, states: Record<string, LichessExportGame>) {
  let status = 'Torneo di scacchi tra amici su Lichess';
  let body = '';
  let strip = '';
  if (data) {
    const { standings } = computeStandings(data.players, data.history, states);
    const progress = computeSeasonProgress(data.history, states, data.schedule);
    if (progress.currentRound) {
      status =
        progress.finished === progress.total && progress.total > 0
          ? 'Stagione conclusa'
          : `Turno ${progress.currentRound} in corso · ${progress.finished} di ${progress.total} partite giocate`;
    } else {
      status = 'La stagione sta per cominciare';
    }
    const top = standings.filter((s) => s.points > 0).slice(0, 3);
    body =
      top.length > 0
        ? podium(top)
        : `<text x="70" y="470" font-family="Alegreya" font-weight="700" font-size="40" fill="${C.ink}">${data.players.length} giocatori ai blocchi di partenza</text>`;
    strip = seasonStrip(progress.games);
  }

  const title = data?.title ?? DEFAULT_TOURNAMENT.title;
  const season = data?.season ?? DEFAULT_TOURNAMENT.season;
  const photo = portrait(data?.imageUrl ?? DEFAULT_TOURNAMENT.imageUrl ?? '');
  const textX = photo ? 300 : 70;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.felt}"/>
      <stop offset="1" stop-color="${C.feltDeep}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${checkerTexture()}
  ${photo}
  <text x="${textX}" y="150" font-family="Alegreya" font-weight="700" font-size="86" fill="${C.ink}">${esc(fit(title, 22))}</text>
  <text x="${textX}" y="205" font-family="Alegreya Sans Medium" font-size="36" fill="${C.brass}">${esc(fit(season, 40))}</text>
  <text x="${textX}" y="270" font-family="Alegreya Sans Medium" font-size="30" fill="${C.muted}">${esc(fit(status, 52))}</text>
  ${body}
  ${strip}
</svg>`;
}

// ---------- Main ----------

async function main() {
  const indexFile = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexFile)) {
    console.warn('og-image: dist/index.html non trovato, esegui prima vite build.');
    return;
  }

  let data: Awaited<ReturnType<typeof loadTournament>> | null = null;
  let states: Record<string, LichessExportGame> = {};
  try {
    data = await loadTournament();
    states = await loadGameStates(data.history);
  } catch (e) {
    console.warn('og-image: dati del torneo non disponibili, anteprima generica.', e);
  }

  const svg = render(data, states);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: {
      loadSystemFonts: false,
      fontFiles: fs.readdirSync(FONTS).filter((f) => f.endsWith('.ttf')).map((f) => path.join(FONTS, f)),
      defaultFontFamily: 'Alegreya Sans Medium',
    },
  })
    .render()
    .asPng();
  fs.writeFileSync(path.join(DIST, 'og.png'), png);

  // Absolute URL required by WhatsApp and the other link previews; the hash busts their cache
  const site = (process.env.SITE_URL ?? '').replace(/\/?$/, '/');
  if (site === '/') {
    console.log('og-image: dist/og.png creato (SITE_URL non impostato, meta tag non aggiunti).');
    return;
  }
  const version = crypto.createHash('sha1').update(png).digest('hex').slice(0, 10);
  const imageUrl = `${site}og.png?v=${version}`;
  const tags = [
    `<meta property="og:url" content="${esc(site)}">`,
    `<meta property="og:image" content="${esc(imageUrl)}">`,
    `<meta property="og:image:width" content="${W}">`,
    `<meta property="og:image:height" content="${H}">`,
    `<meta property="og:image:alt" content="Classifica e turno in corso del torneo">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join('\n  ');
  const html = fs.readFileSync(indexFile, 'utf8').replace('</head>', `  ${tags}\n</head>`);
  fs.writeFileSync(indexFile, html);
  console.log(`og-image: anteprima creata, ${imageUrl}`);
}

main().catch((e) => {
  // Never block the deploy for the preview image
  console.warn('og-image: anteprima non generata.', e);
});
