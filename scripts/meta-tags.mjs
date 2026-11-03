// Runs after `vite build`: sets the link preview tags of dist/index.html.
// - title: tournament and current season from the public Firestore document
//   ("Scacchi & Chill – Stagione 2 - Capablanca"); the static title stays if it cannot be read
// - image: the static logo public/og-image.png, with the absolute URL that WhatsApp and
//   Linktree require (SITE_URL, set by the deploy workflow)
// It never fails the build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TOURNAMENT_DOC_ID = 'scacchi-and-chill-official';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function readSeason() {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-applet-config.json'), 'utf8'));
  const url =
    `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/` +
    `${encodeURIComponent(cfg.firestoreDatabaseId || '(default)')}/documents/tournaments/${TOURNAMENT_DOC_ID}` +
    `?key=${cfg.apiKey}&mask.fieldPaths=title&mask.fieldPaths=season`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const fields = (await res.json()).fields ?? {};
  const title = fields.title?.stringValue;
  const season = fields.season?.stringValue;
  return title && season ? `${title} – ${season}` : null;
}

async function main() {
  const indexFile = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexFile)) {
    console.warn('meta-tags: dist/index.html non trovato, esegui prima vite build.');
    return;
  }
  let html = fs.readFileSync(indexFile, 'utf8');

  try {
    const pageTitle = await readSeason();
    if (pageTitle) {
      html = html
        .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(pageTitle)}">`)
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(pageTitle)}</title>`);
      console.log(`meta-tags: titolo «${pageTitle}»`);
    }
  } catch (e) {
    console.warn('meta-tags: stagione non disponibile, resta il titolo statico.', e.message);
  }

  const site = (process.env.SITE_URL ?? '').replace(/\/?$/, '/');
  const image = path.join(DIST, 'og-image.png');
  if (site !== '/' && fs.existsSync(image)) {
    // The hash changes the URL when the logo changes, so previews do not keep an old copy
    const version = crypto.createHash('sha1').update(fs.readFileSync(image)).digest('hex').slice(0, 10);
    const tags = [
      `<meta property="og:url" content="${esc(site)}">`,
      `<meta property="og:image" content="${esc(`${site}og-image.png?v=${version}`)}">`,
      `<meta property="og:image:width" content="1200">`,
      `<meta property="og:image:height" content="630">`,
      `<meta property="og:image:alt" content="Logo di Scacchi &amp; Chill">`,
      `<meta name="twitter:card" content="summary_large_image">`,
    ].join('\n  ');
    html = html.replace('</head>', `  ${tags}\n</head>`);
  } else {
    console.log('meta-tags: SITE_URL non impostato, tag dell\'immagine non aggiunti.');
  }

  fs.writeFileSync(indexFile, html);
}

main().catch((e) => console.warn('meta-tags: non applicati.', e));
