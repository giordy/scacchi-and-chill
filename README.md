# Scacchi & Chill

Sito di un torneo di scacchi per corrispondenza tra amici: sfide su Lichess, dati su Firebase, pagina pubblica statica (React + Vite) su GitHub Pages.

## Parte pubblica
- **Classifica** (punti, poi Sonneborn-Berger, poi vittorie; a pari su tutti e tre la posizione è condivisa), **Tabellone**, **Partite** per turno con mini scacchiera, **Pillsbury** (la corsa al trofeo).
- **Stagione**: maestro, regolamento, numeri. **Albo**: Albo d'Oro, classifica di sempre, record.
- **Pagina giocatore** (`#/giocatore/<handle>`): posizione, punti turno per turno, scontri diretti, carriera, Elo del torneo, obiettivo, trofei.
- **Risultati live**: le partite non concluse si leggono da Lichess all'apertura e ogni 5 minuti a pagina visibile (al massimo due chiamate: partite e profili).
- Su telefono si cambia sezione con uno swipe.

## Area organizzatore (`#admin`)
Login Google; organizzatore è chi ha un documento in `admins/<email>`. Ogni azione distruttiva chiede conferma. All'apertura sincronizza i risultati da Lichess su Firestore.
- **Turni**: crea le sfide su Lichess, ricrea o sostituisce un link, prepara messaggio e bollettino per WhatsApp.
- **WhatsApp**: prompt per il racconto della stagione, premi. I testi dei messaggi e le frasi del bollettino stanno in `config.json`: si cambiano lì, con un nuovo deploy.
- **Giocatori**: registro (il nome vale anche per le stagioni passate), chi gioca la stagione, ritiri (regola della metà o sostituto).
- **Stagioni**: stagione corrente, colore della fascia in alto (verde panno, blu notte, bordeaux, noce) e foto del maestro, regolamento, Elo di partenza, calendario (girone all'italiana), chiusura della stagione e Albo d'Oro.
- **Impostazioni**: token Lichess (serve per le sfide e gli Elo di partenza), copia e ripristino dei dati.

Chiudere la stagione archivia classifica, premi e partite in forma compatta, aggiorna l'Albo d'Oro e poi cancella le partite: se l'archiviazione fallisce non cancella nulla. Ogni notte il workflow `backup.yml` salva i dati pubblici sul branch `backups`.

## Elo del torneo e Trofeo Pillsbury
- **Elo del torneo**: formula Elo (K = 32) sulle sole partite del torneo, nell'ordine in cui sono finite. A fine prima stagione l'Elo di un giocatore diventa la sua prestazione. Le partite decise a tavolino (forfeit, «cheat detected») contano per la classifica ma non per l'Elo.
- **Elo di partenza** (prima stagione): l'Elo Lichess di 30 giorni prima della prima partita, del primo tipo affidabile tra corrispondenza, classical, rapid e blitz (almeno 10 giorni con partite, l'ultima entro un anno). Si porta sulla scala del torneo con la differenza media dei veterani (almeno 3) sullo stesso tipo, poi a metà strada verso la loro media, tra il più debole e il più forte. Si fissa da sé all'apertura dell'area organizzatore e si archivia con la stagione.
- **Esordiente**: al primo anno senza Elo Lichess affidabile. Parte da 1500 e le partite con lui contano solo per la classifica. Chi torna dopo una pausa riparte dal suo Elo.
- **Colpaccio**: vittoria contro chi aveva almeno 200 punti di Elo in più, o patta con almeno 400.
- **Obiettivo**: i punti previsti dall'Elo a inizio stagione contro il calendario, fisso per la stagione.
- **Trofeo Pillsbury**: a chi supera di più il proprio obiettivo, di almeno mezzo punto. Fuori dalla corsa esordienti e ritirati; sospeso con meno di 4 giocatori in corsa.
- **Premi divertenti**: Fulmine (la vittoria più rapida), Il maratoneta (la più lunga), Il bradipo (il più lento a muovere), Il muro (più patte, almeno 2).

## Configurazione Firebase
1. **Authentication**: attiva Google e autorizza `<utente>.github.io` e `localhost`. Per l'app installata aggiungi in Google Cloud, nel client OAuth di `oAuthClientId`, l'origine `https://<utente>.github.io` e il redirect `https://<utente>.github.io/<repository>/`.
2. **Firestore → Data**: crea `admins/<email dell'organizzatore>` (documento vuoto), prima delle regole.
3. **Firestore → Rules**: pubblica [`firestore.rules`](firestore.rules) a ogni modifica.
4. Limita la chiave web di `firebase-applet-config.json` ai referrer del sito e `localhost`.

| Percorso | Lettura | Contenuto |
|---|---|---|
| `tournaments/<id>` | pubblica | torneo, giocatori, calendario, Albo d'Oro, Elo di partenza |
| `tournaments/<id>/games/*` | pubblica | partite e stato Lichess |
| `tournaments/<id>/seasons/*` | pubblica | stagioni archiviate |
| `tournaments/<id>/media/*` | pubblica | foto del maestro (sotto 900 KB) |
| `tournaments/<id>/private/organizer` | organizzatore | aneddoti, token Lichess, impostazioni |
| `admins/<email>` | il proprio | un documento vuoto per organizzatore |

## Sviluppo
```bash
npm install
npm run dev         # http://localhost:3000
npm test            # vitest
npm run test:rules  # emulatore Firestore (Java 21): regole, chiusura stagione, ripristino
npm run build       # dist/, con i meta tag dell'anteprima
```
Logica pura e testata in `src/lib/`, pagine in `src/views/`, area organizzatore in `src/tabs/`. Il deploy (`deploy.yml`) esegue i test e pubblica su GitHub Pages a ogni push su `main`; `scripts/meta-tags.mjs` scrive nel titolo e nell'anteprima del link la stagione letta da Firestore.

## Limiti noti
Lichess mostra le partite in corso con 3 semimosse di ritardo: il sito non dice di chi è il turno. Su Lichess lo storico Elo si legge solo con un token: senza, gli Elo di partenza non si fissano.
