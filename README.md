# Scacchi & Chill

Sito di un torneo di scacchi per corrispondenza tra amici: sfide su Lichess, dati su Firebase, pagina pubblica statica (React + Vite) su GitHub Pages.

## Parte pubblica
- **Scudetto** (il trofeo principale, col nome del maestro della stagione: «Scudetto Capablanca»; «Scudetto Chill» senza maestro). **Classifica** (punti, poi Sonneborn-Berger, poi vittorie; a pari su tutti e tre la posizione è condivisa), **Tabellone**, **Partite** per turno con mini scacchiera, **Pillsbury** (la corsa al trofeo).
- **Cronaca** (`#/cronaca`, con un tab suo): cosa è successo, giorno per giorno: inizio e fine dei turni (con l'aneddoto del maestro e chi è in testa), risultati (con scontri al vertice, colpacci e apertura del maestro), la prima vittoria della stagione (dopo partite senza) o nel torneo, serie di vittorie dalla terza, cambi di capolista, chi raggiunge il proprio obiettivo, ritiri e sostituti, la vittoria matematica, chi vince lo Scudetto e il Trofeo Pillsbury. Sotto la classifica, «Dalla cronaca» mostra le ultime tre notizie; il tab Cronaca ha un pallino quando ci sono novità dall'ultima visita. Si ricava dai dati che il sito ha già, senza salvare nulla; per le stagioni archiviate restano risultati, capolista e campione. Le novità dall'ultima visita sono evidenziate (data salvata nel browser).
- **Cosa serve per vincere**: nelle ultime giornate, quando qualcuno è già fuori dalla corsa al titolo, sotto la classifica cosa serve a ognuno di quelli ancora in corsa (i punti che bastano nelle sue partite, oppure che servono passi falsi degli altri).
- **Stagione**: maestro, regolamento, numeri. **Albo**: Albo d'Oro, classifica di sempre, record.
- **Pagina giocatore** (`#/giocatore/<handle>`): posizione, punti turno per turno, scontri diretti (della stagione e di sempre), carriera, Elo del torneo, obiettivo, trofei.
- **La stagione in breve**: a fine stagione, nella pagina giocatore, il suo riepilogo: posto e punti, premi, serie, colpacci, l'avversario preferito e quello più duro, la vittoria più rapida, la partita più lunga, l'apertura più giocata e l'Elo del torneo. Resta visibile, per l'ultima stagione archiviata, finché il giocatore non chiude una partita della nuova.
- **Risultati live**: le partite non concluse si leggono da Lichess all'apertura e ogni 5 minuti a pagina visibile (al massimo due chiamate: partite e profili).
- **Leggera**: la pagina pubblica legge Firestore con semplici richieste HTTP (`src/lib/firestoreRest.ts`), senza l'SDK Firebase, e ogni 5 minuti a pagina visibile rilegge torneo e partite (le stagioni archiviate solo all'apertura e quando cambia la stagione). Se la lettura non riesce lo dice, senza mostrare un torneo vuoto, e riprova da sé dopo pochi secondi. L'SDK si scarica solo con l'area organizzatore.
- Su telefono si cambia sezione con uno swipe.
- **Senza rete**: i file del sito restano nel browser (`public/sw.js`), così la pagina e l'app installata si aprono lo stesso; al posto dei dati mostra l'ultimo torneo letto da quel browser, dicendo di quando è (`src/lib/publicCache.ts`), e riprova da sé.
- I caratteri (Alegreya e Alegreya Sans) sono serviti dal sito, senza richieste a Google Fonts (`src/fonts.css`).

## Area organizzatore (`#admin`)
Login Google; organizzatore è chi ha un documento in `admins/<email>`. Ogni azione distruttiva chiede conferma. All'apertura sincronizza i risultati da Lichess su Firestore.
- **Turni**: crea le sfide su Lichess, ricrea o sostituisce un link, prepara messaggio e bollettino per WhatsApp.
- **WhatsApp**: prompt per il racconto della stagione, premi. I testi dei messaggi e le frasi del bollettino stanno in `config.json`: si cambiano lì, con un nuovo deploy.
- **Giocatori**: registro (il nome vale anche per le stagioni passate), chi gioca la stagione, ritiri (regola della metà o sostituto).
- **Stagioni**: stagione corrente, foto del maestro, la sua apertura e la sua partita celebre (con un prompt per un'AI che prepara motto, presentazione, aneddoti, apertura e partita: si incolla la risposta e i campi si compilano), regolamento, Elo di partenza, calendario (girone all'italiana), chiusura della stagione e Albo d'Oro.
- **Impostazioni**: token Lichess (serve per le sfide e gli Elo di partenza), copia e ripristino dei dati.

Chiudere la stagione archivia classifica, premi e partite in forma compatta, aggiorna l'Albo d'Oro e poi cancella le partite: se l'archiviazione fallisce non cancella nulla. Ogni notte il workflow `backup.yml` salva i dati pubblici sul branch `backups`.

## Sincronizzazione automatica dei risultati
Ogni ora il workflow `sync-results.yml` legge da Lichess le partite non ancora concluse su Firestore e ne salva lo stato, come fa l'area organizzatore quando si apre. Per scrivere serve un account di servizio del progetto Firebase; senza, il workflow non fa nulla. Si configura una volta:
1. Google Cloud Console, progetto di Firebase → **IAM e amministrazione → Account di servizio** → crea un account (per esempio `sync-risultati`) con il ruolo **Utente Cloud Datastore**.
2. Nell'account → **Chiavi → Aggiungi chiave → JSON**: si scarica un file.
3. GitHub, repository → **Settings → Secrets and variables → Actions** → nuovo secret `FIREBASE_SERVICE_ACCOUNT` con tutto il contenuto del file. Poi il file va cancellato dal computer.
4. **Actions → Sincronizza risultati → Run workflow** per provarlo: nel log, quante partite ha aggiornato.

L'account scrive solo i campi `lichess` e `syncedAt` delle partite che esistono già. GitHub sospende i workflow programmati dopo 60 giorni senza attività nel repository: per evitarlo, ogni notte il backup chiede di tenere attivi sé stesso e la sincronizzazione (senza commit). Se fossero sospesi lo stesso, si riattivano dalla pagina Actions.

## Elo del torneo e Trofeo Pillsbury
- **Elo del torneo**: formula Elo (K = 32) sulle sole partite del torneo, nell'ordine in cui sono finite. A fine prima stagione l'Elo di un giocatore diventa la sua prestazione, con 2 patte virtuali contro il suo Elo di partenza (o contro la media dei veterani, o 1500 nella prima stagione del torneo): con 14 partite la sola prestazione esagera le distanze. Ogni Elo ha anche un'incertezza (±), dalla prestazione o dall'Elo di partenza, che si riduce partita dopo partita. Le partite decise a tavolino (forfeit, «cheat detected») contano per la classifica ma non per l'Elo.
- **Elo di partenza** (prima stagione): l'Elo Lichess di 30 giorni prima della prima partita, del primo tipo affidabile tra corrispondenza, classical, rapid e blitz (almeno 10 giorni con partite, l'ultima entro un anno). Si porta sulla scala del torneo con la differenza media dei veterani (almeno 3) sullo stesso tipo, poi a metà strada verso la loro media, al massimo 200 punti oltre il più debole e il più forte. L'incertezza viene da quanto variano tra i veterani la differenza tra i due Elo (almeno ±150) e il loro Elo. Si fissa da sé all'apertura dell'area organizzatore e si archivia con la stagione; si ricalcola, con lo stesso giorno, solo quando cambia la regola.
- **Esordiente**: al primo anno senza Elo Lichess affidabile. Parte da 1500 e le partite con lui contano solo per la classifica. Chi torna dopo una pausa riparte dal suo Elo.
- **Colpaccio**: vittoria contro chi aveva almeno 200 punti di Elo in più, o patta con almeno 400.
- **Obiettivo**: i punti previsti dall'Elo a inizio stagione contro il calendario, fisso per la stagione.
- **Trofeo Pillsbury**: a chi supera di più il proprio obiettivo, di almeno mezzo punto rispetto all'obiettivo mostrato in tabella (le frecce ▲ = ▼ confrontano i numeri come si vedono, al mezzo punto). Lo scarto si misura rispetto a quanto potrebbe venire dal caso: la fortuna delle partite e l'incertezza degli Elo, il proprio e quelli degli avversari. Così chi ha un obiettivo meno sicuro (un Elo di partenza da Lichess) non è favorito. Fuori dalla corsa esordienti e ritirati; sospeso con meno di 4 giocatori in corsa.
- **Fair play**: dalla stagione dopo la Stagione 2, chi ha una partita chiusa da Lichess per scorrettezza («cheat detected») è fuori anche dal Trofeo Pillsbury e dagli altri premi della stagione (lo Scudetto resta della classifica); i premi vanno a chi viene dopo. Senza dire nulla sul sito: sparisce dalla corsa come chi si ritira. La regola si accende da sé chiudendo la stagione (`fairPlayAwardsBan` sul torneo), e la stessa chiusura aggiunge la frase al regolamento.
- **Apertura del maestro**: una famiglia di aperture scelta per la stagione (nomi di Lichess, `src/lib/masterOpening.ts`). Le partite che la giocano hanno un'etichetta; il premio simpatico **L'allievo** va a chi l'ha giocata di più dal lato che la sceglie (bianco per aperture e gambetti, nero per le difese). Nessuna partita, nessun premio. Le stagioni archiviate come «Premio <maestro>» mostrano il nome nuovo.
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
