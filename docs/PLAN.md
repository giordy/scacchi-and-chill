# Open-source refactor plan

Working document for the refactor that turns this site into a generic, translatable project that
other chess groups can install. It is removed (or rewritten as `CONTRIBUTING.md`) before the public
release. Every agent working on the refactor reads it first.

## Goals

1. All code, comments, tests and documentation in English.
2. Every user-facing string in one translation file per language: site texts (public and organizer
   area), WhatsApp messages, push notifications, link-preview meta tags, AI prompts.
3. Languages: English (reference), Italian, German, Spanish, French, Portuguese (pt-BR), Hindi,
   Simplified Chinese (zh-Hans).
4. Viewers can switch language; the tournament has its own language for group messages.
5. Peculiar features become optional: Pillsbury trophy, master of the season, fun awards, fair play,
   rule pledges, push notifications, seasonal logos.
6. A setup guide plus a Claude Code skill to install one's own instance.
7. Public release as a **new repository** with a single English commit, licensed **GPL-3.0**.
8. **The current site (Scacchi & Chill) keeps working throughout, with exactly the same Italian texts.**

## Decisions taken

| Topic | Decision |
|---|---|
| History | New public repository, single initial commit; this repository becomes a downstream instance |
| License | GPL-3.0-or-later for the code; third-party assets keep their own licenses |
| AI prompts | One English prompt per use, with "write every text in {language}" |
| Languages | en, it, de, es, fr, pt-BR, hi, zh-Hans from the start |
| Project name | Open: a generic name that evokes correspondence chess (see the end of this file) |

## Non-negotiable rules for the live site

- **Italian output is byte-for-byte unchanged.** Phase 0 records golden outputs; with locale `it` every
  one of them must match after each phase. A diff is a bug unless the organizer approves it.
- **No Firestore migration.** New fields are optional, with defaults equal to today's behaviour
  (all features on, language `it`, time zone `Europe/Rome`, trophy name "Scudetto").
- **Old addresses keep working**: `#/giocatore/<handle>`, `#/classifica`, `#/albo`… stay as aliases of
  the new English slugs, because links are already shared in the group.
- **Firestore rules first**: any rules change (e.g. `locale` on `pushSubscriptions`, which today is
  `hasOnly([...])`) is published and tested in the emulator before the site that needs it is deployed,
  and stays compatible with the site already online.
- Work happens on the branch; `main` is touched only after the full verification (phase 5).

## Architecture

### i18n core (`src/i18n/`)

- No dependency: the public page must stay light (it does not even load the Firebase SDK).
- `locales/en.ts` is the reference and defines the type; every other locale is
  `satisfies Messages`, so a missing or extra key is a compile error. One file per language, so a
  translator works on a single file.
- Each file is split into fixed sections, created in phase 0 so parallel agents never edit the same
  lines: `common`, `public`, `player`, `admin`, `messages` (WhatsApp), `chronicle`, `awards`,
  `notifications`, `prompts`, `meta`.
- Values are strings with `{param}` placeholders, or plural objects
  `{ one: '…', other: '…' }` resolved with `Intl.PluralRules` (Hindi, Chinese and the others have
  different categories). Lists of variants (the rotating bulletin phrases) are arrays.
- API: `t(key, params)` for plain code (lib/, scripts), `useT()` in React, plus `formatDate`,
  `formatTime`, `formatNumber`, `formatList` (`Intl.ListFormat`) bound to the current locale and to
  the tournament time zone. Every `'it-IT'`, `'it'` and `'Europe/Rome'` in the code goes through these.
- Pure functions in `lib/` that build sentences take a `t` (or a locale) argument instead of reading a
  global, so they stay pure and testable in any language.
- Loading: the tournament's language is bundled; the others are separate chunks loaded on demand.
- Fonts: Alegreya covers Latin scripts. Hindi gets Noto Sans Devanagari (self-hosted subset, loaded
  only for `hi`); Chinese falls back to system fonts (a CJK web font is several MB).
- `<html lang>` follows the current locale.

### Two languages

- **Viewer language**: chosen in a language switcher; default = saved choice, else
  `navigator.languages`, else the tournament language. Saved in `localStorage`.
- **Tournament language** (`tournament.locale`): used for WhatsApp messages, AI prompt output,
  link-preview meta tags, default season/round labels, and as the fallback for viewers.
- **Push notifications**: in the subscriber's language: the subscription stores `locale`
  (rules change), `scripts/push.mjs` formats each one with it.
- Texts written by the organizer (rules, anecdotes, master presentation, season names) are data:
  shown as written, never translated.
- `config.json` message templates become optional overrides on top of the locale file; the current
  Italian templates move into `it.ts` verbatim, so the current instance needs no override.

### Instance vs code

Everything that belongs to one tournament lives in `instance/`, which the upstream repository never
contains (it ships `instance.example/`; the build uses `instance/` when present, else the example):

- `instance/site.json`: tournament name, short name, default locale, time zone, site URL, info link
  (today linktr.ee), robots policy, theme colours.
- `instance/firebase.json`: today's `firebase-applet-config.json` (including `firestoreDatabaseId`
  and the tournament document id).
- `instance/push.json`: VAPID public key.
- `instance/messages.json`: optional overrides of message templates (today's `config.json`).
- `instance/assets/`: logos, seasonal logos, icons, og-image, master photos.

Hard-coded instance values to remove: `BACKUPS_URL` in `BackupSection.tsx` (derive it from
`GITHUB_REPOSITORY` at build time), "Scacchi & Chill" in code and meta tags, the linktr.ee link,
`index.html` titles, manifests.

### Optional features

`tournament.features` on Firestore (editable in Impostazioni, no redeploy), with every flag on by
default:

| Flag | Covers | Depends on |
|---|---|---|
| `master` | master of the season, photo, anecdotes, master opening + "L'allievo" award, trophy named after the master, master AI prompt | — |
| `pillsbury` | Pillsbury tab, race, objective arrows, chronicle events, bulletin lines, player page, archive | Elo del torneo |
| `funAwards` | Fulmine, Il maratoneta, Il bradipo, Il muro | — |
| `fairPlay` | the fair-play awards ban | — |
| `pledges` | rule acceptance, its chronicle events and admin section | — |
| `push` | move notifications | VAPID keys |
| `seasonalLogos` | Christmas, Carnival, Easter, chess day, Halloween, season end | — |

A single `features.ts` module answers "is X on" and lists dependencies; components and lib functions
ask it instead of scattering checks. History-specific rules ("from the season after Stagione 2",
the award added to Stagione 1) become data on the tournament or the archive, not code.

The trophy name ("Scudetto") becomes `tournament.trophyName`, with a translated default
(en "Title", de "Meisterschale"…). "Albo d'Oro" is just a translation of "Hall of Fame".

## Upstream / downstream (how this site stays up to date)

- **Upstream**: the new public repository. Code, `instance.example/`, docs, workflows.
- **Downstream**: this repository (and every other group's copy). Upstream code + its own `instance/`.
  Since upstream never contains `instance/`, merging upstream never conflicts with instance files.
- Updating: `git fetch upstream && git merge upstream/main && git push`; the deploy workflow does the
  rest. Upstream also ships `update-from-upstream.yml`: when the repository variable `UPSTREAM_REPO`
  is set, once a week it opens a pull request with the upstream changes (tests run on it), so an
  organizer only reviews and merges.
- **One-time switch for this repository** (phase 5, needs explicit approval for the force-push):
  1. Fetch the full history (`git fetch --unshallow`) and save it as a `git bundle` outside GitHub,
     plus a `legacy-main` tag if the old history is to stay visible.
  2. `main` = upstream's initial commit + one commit adding `instance/` with today's configuration.
  3. Verify build and tests, force-push `main` once; the site is redeployed with the same tree
     content, so nothing changes for the players.
  4. The `backups` branch is untouched (it is an orphan branch and stays in this repository only).
  From then on the history of `main` is shared with upstream, and merges are ordinary.
- This repository is public today, so its history (with real names in tests and comments) is
  already visible; the switch removes it from `main`, but GitHub can keep old commits reachable for a
  while. The public tournament data in `backups` is the same data the site shows anyway.

## Privacy clean-up (before anything goes into the new repository)

- Real handles and names in tests and comments (`fsgach`, `matepaco`, `battimat`, `giords`,
  `luca_sgarbossa`, `scarsoforteh`, `gredip`, Fabio, Alessandro, Matteo…) and real ratings in
  `seeds.ts` comments: replace with invented ones (e.g. `alice_k`, `bob_r`) and keep test values
  coherent.
- Instance files (Firebase config, VAPID key, logos, master photos, config.json texts) only in this
  repository's `instance/`.
- The new repository never gets the `backups` branch.

## Licensing

- `LICENSE`: GPL-3.0-or-later, with a header note in the README.
- Staunty pieces (CC BY-NC-SA 4.0, non-commercial): not GPL-compatible as code, fine as a separately
  licensed asset; ship **cburnett** (GPL-2.0+, the Lichess default) as the default set and Staunty as
  an option with its license file, so a fork can be used commercially.
- Alegreya fonts (OFL) via @fontsource: fine. Master photos: Wikimedia attribution in the example
  instance only.

## Phases

### Phase 0 – Safety net and core (integrator, sequential)

1. `npm ci`, `npm test`, `npm run test:rules`, `npm run build`: record the baseline.
2. Anonymised fixture from the public Firestore data (`tests/fixtures/tournament.json`): real
   structure, invented names.
3. Golden outputs in Italian from the fixture (`tests/golden/it/`): rendered public views (classifica,
   tabellone, partite, pillsbury, cronaca, stagione, albo, regolamento, player page), round message,
   status bulletin, season-end texts, both AI prompts, push notification texts, meta tags, plus
   admin panels' static text. A `golden.test.ts` compares them.
4. i18n core as described above, with the empty sections in every locale file, the language
   switcher, the formatters, the slug aliases.
5. Conventions for agents (below) final; commit.

### Phase 1 – String extraction (5 agents in parallel, one worktree each)

| Agent | Files | Also |
|---|---|---|
| A – Public site | `PublicTournamentView.tsx`, `views/PublicPage.tsx`, `views/PlayerPage.tsx`, `components/` | sections `public`, `player`, `common` |
| B – Organizer area | `AdminApp.tsx`, `ReviewsTab.tsx`, `WhatsAppPreview.tsx`, `tabs/**`, `views/Admin*.tsx` | section `admin` |
| C – Text generators | `lib/activity.ts`, `bulletin.ts`, `standings.ts`, `awards.ts`, `titleRace.ts`, `seasonChecklist.ts`, `wrapped.ts`, `masterOpening.ts`, `config.ts`, `config.json` | sections `messages`, `chronicle`, `awards` |
| D – Prompts, scripts, shell | `lib/masterPrompt.ts`, the prompt in `ReviewsTab.tsx` (coordinate with B: D owns only the prompt builder, moved to `lib/reviewPrompt.ts`), `scripts/*.mjs`, `public/sw.js`, `index.html`, manifests | sections `prompts`, `notifications`, `meta`; `push.mjs` per-subscriber locale |
| E – Instance and privacy | `instance/` split, build reading it, hard-coded URLs, anonymised tests and comments, `LICENSE`, piece set | no strings |

Each agent: writes `en` and `it` for its keys (Italian = the exact current text), passes `t` into pure
functions, translates the remaining Italian comments and identifiers in its files, updates its
tests (Italian assertions stay, run with locale `it`, plus one English smoke test per area), and runs
`npm run lint && npm test` before handing over. The integrator merges A→E in order, runs the golden
tests after each merge, and fixes conflicts.

### Phase 2 – Features and configuration (1–2 agents, after phase 1)

`features.ts`, flags on the tournament document with a settings section, every flag wired through
views, chronicle, bulletin, archive and awards; trophy name, tournament locale and time zone in
settings; history-specific rules turned into data. Tests: every flag off renders without the feature
and without errors; all flags on = golden outputs.

### Phase 3 – Translations (one agent per language, in parallel, no conflicts)

de, es, fr, pt-BR, hi, zh-Hans from `en.ts`. Chess terms as Lichess uses them in that language
(lichess.org translations are a good reference). Each agent checks plurals, length in the narrow
mobile layout (screenshots at 375 px), and WhatsApp markup. Flag for native review on Reddit.

### Phase 4 – Docs and installation (1 agent, in parallel with phase 3)

- `README.md` in English: what it is, screenshots, demo link, features, license.
- `docs/SETUP.md`: fork/template, Firebase project, Firestore database, Google sign-in and OAuth
  client, rules, `admins/<email>`, `instance/`, GitHub Pages, secrets (`FIREBASE_SERVICE_ACCOUNT`,
  `VAPID_PRIVATE_KEY`), cron-job.org, updates from upstream.
- `docs/TRANSLATING.md`: add or fix a language.
- `.claude/skills/setup-tournament/SKILL.md`: guides a user through SETUP.md step by step, checking
  each step; `npm run setup` creates `instance/` interactively and generates VAPID keys.
- Demo mode (`?demo`): the anonymised fixture, no Firebase needed; used for the Reddit post and for
  screenshot tests in every language.

### Phase 5 – Verification and release (integrator)

1. Full tests, rules emulator, build, Playwright screenshots in every language, golden outputs.
2. Local run of the built site against the live Firestore data, read-only, in Italian.
3. Publish the updated Firestore rules, then merge to `main` here, check the live site.
4. Create the new public repository with one English commit (no `instance/`, no `backups`, no
   `docs/PLAN.md`).
5. The one-time switch of this repository onto upstream (see above), with explicit approval.

## Conventions for agents

- Keys: `section.area.name` in camelCase, by meaning not by wording
  (`public.standings.title`, not `public.classifica`). Reuse `common.*` for shared words.
- Never build a sentence by concatenating translated fragments: one key per sentence with
  `{params}`; word order differs between languages.
- Player names, handles, numbers and links are params. Markup that is part of the text
  (WhatsApp `*bold*`, emoji) stays inside the translation.
- JSX with links or bold inside a sentence: `t` returns parts, rendered with a small `<Trans>` helper
  (`{player}` placeholders become React nodes).
- Do not change behaviour in phase 1: the only allowed diff in Italian output is none.
- Do not touch another agent's files; if a shared file (`types.ts`, `index.css`) needs a change,
  keep it minimal and say so in the hand-over.
- Commit messages in English.

## Open: project name

A generic name that evokes correspondence chess. Candidates (availability on GitHub to be checked):
**Daily Knights**, **Slow Knights**, **Postal Gambit**, **Move by Move**, **Telechess** (the historic
word for chess by telegraph). "Scacchi & Chill" remains the name of this instance.
