# Scacchi & Chill

Sito per organizzare un torneo di scacchi per corrispondenza tra amici: gli accoppiamenti si creano su Lichess, i risultati si sincronizzano su Firebase e tutti i partecipanti seguono classifica, calendario e storico delle stagioni da una pagina pubblica. Il sito è statico (React + Vite + Firebase) e viene servito da GitHub Pages.

## Cosa c'è

### Parte pubblica
- **Intestazione**: torneo, stagione, turno in corso e capolista. Una striscia di caselle mostra l'avanzamento della stagione: una casella per partita, piena se conclusa, a metà se in corso.
- **Classifica** con punti, V/N/P e spareggio Sonneborn-Berger, podio in oro/argento/bronzo. La colonna del giocatore resta fissa durante lo scroll orizzontale su mobile.
- **Partite**, filtrabili per turno, con link a Lichess. Le partite concluse mostrano la posizione finale su una mini scacchiera (quelle in corso no: Lichess nasconde le ultime mosse).
- **Tabellone** incrociato con tutti i risultati.
- **Torneo**: il maestro della stagione, il regolamento, l'Albo d'Oro e le stagioni passate con la classifica finale.
- **Pagina giocatore** (`#/giocatore/<handle>`): ultimo accesso a Lichess, posizione, grafico dei punti turno per turno, scontri diretti con ogni avversario (risultati, punteggio e partite ancora da giocare, con turno e colore se sono in calendario), partite giocate. Si apre cliccando un nome in classifica.
- **Risultati live**: la pagina pubblica legge da Lichess le partite non ancora concluse su Firestore (all'apertura, poi ogni 5 minuti finché resta aperta), così classifica e tabellone sono aggiornati anche senza sincronizzazione. Non scrive nulla: il salvataggio su Firestore resta la sincronizzazione dell'organizzatore.
- **Ultimo accesso a Lichess**: nelle partite in corso un pallino accanto a ogni giocatore dice quando è passato da Lichess l'ultima volta: verde entro un'ora, giallo entro 24 ore, grigio oltre. Toccandolo si legge il tempo esatto. Il dato viene dal profilo Lichess (`seenAt`, una sola chiamata per tutti i giocatori, ripetuta ogni 5 minuti), non dalle partite, quindi il ritardo con cui Lichess mostra le ultime mosse non lo tocca; però non dice se il giocatore ha mosso nella partita del torneo. Se Lichess non risponde, il pallino non compare.
- **Anteprima del link** (WhatsApp, Linktree): logo del torneo e nome della stagione (vedi sotto).

### Area organizzatore (`#admin`)
Accesso con login Google, riservato a un solo account.
- **♞ Turni**: l'unico posto dove nascono e si gestiscono turni e partite.
  - *Elenco dei turni*, pianificati e avviati, con lo stato (da avviare, link creati in parte, in corso, concluso); il turno su cui lavorare è evidenziato. *+ Nuovo turno* ne apre uno vuoto.
  - *Genera i turni in automatico*: girone all'italiana da zero, oppure *Completa i turni mancanti*, che tiene i turni già presenti e le partite già create e aggiunge solo quelle che mancano (se non è possibile lo dice).
  - *Dentro un turno*: aggiungi, togli o inverti i colori delle partite; **Crea link Lichess** crea le sfide che non hanno ancora un link e le salva nel torneo; **Messaggio con i link** e **Bollettino** preparano i testi WhatsApp da condividere o copiare (la scadenza dei link è calcolata da quando sono state create le sfide; a fine turno il bollettino aggiunge chi è in testa e gli studi sulle aperture giocate); *Elimina turno* lo cancella (anche da Firestore; su Lichess le sfide restano aperte).
- **✎ Recensione**: statistiche, aneddoti ed Elo dei giocatori per costruire il prompt da incollare in Claude o ChatGPT; il testo ottenuto si incolla poi nella scheda per l'anteprima WhatsApp. Il prompt chiede un racconto sobrio e affettuoso: due o tre frasi per giocatore nell'ordine della classifica del sito, il simbolo di un pezzo accanto al nome, niente voti, l'Elo solo come contesto (mai citato) e gli aneddoti solo dalle note.
- **♛ Torneo** (sezioni richiudibili): stagione corrente, giocatori, regolamento (con giorni per mossa e rated, mostrati anche in pubblico), fine stagione e storico con Albo d'Oro, token Lichess e testi dei messaggi, copia dei dati in JSON.
- **↻ Sincronizza risultati**: scarica gli esiti da Lichess e li salva su Firestore. Parte da sola ogni volta che l'organizzatore apre l'area admin, e si può rilanciare a mano. La vista pubblica legge da Firestore, quindi i nuovi risultati compaiono solo dopo una sincronizzazione.

### Stagioni
Da *Torneo → Fine stagione e storico*:
- **Chiudi la stagione e inizia la prossima** salva la classifica finale nello storico pubblico, mette il primo in classifica nell'Albo d'Oro, poi **cancella tutte le partite** della stagione, imposta il nuovo nome e maestro e, se vuoi, svuota il calendario. Prima della cancellazione chiede conferma e non cancella nulla se l'archiviazione fallisce.
- Se la stagione era già nell'Albo d'Oro con un altro giocatore, la voce viene aggiornata con il campione effettivo.
- **Scaricala come file (CSV)**, sotto il pulsante, scarica una copia della classifica di oggi da aprire con Excel o Numbers. Non tocca lo storico né l'Albo d'Oro.

## Configurazione Firebase

1. **Authentication → Sign-in method**: attiva Google.
2. **Authentication → Settings → Authorized domains**: aggiungi il dominio di GitHub Pages (`<utente>.github.io`) e `localhost`.
3. **Firestore → Rules**: pubblica il contenuto di [`firestore.rules`](firestore.rules). Ripubblicalo ogni volta che il file cambia.
4. La chiave web in `firebase-applet-config.json` è pubblica per natura. Limitala in Google Cloud ai referrer `<utente>.github.io/*` e `localhost`.

L'email dell'organizzatore compare in **due** posti, da tenere allineati:
- `firestore.rules` (`isAdmin()`), che è la protezione vera;
- `ADMIN_EMAILS` in `src/firebaseService.ts`, che regola solo l'interfaccia.

### Dati su Firestore
| Percorso | Lettura | Contenuto |
|---|---|---|
| `tournaments/<id>` | pubblica | titolo, stagione, giocatori, calendario, regolamento (giorni per mossa, rated), Albo d'Oro |
| `tournaments/<id>/games/*` | pubblica | partite e stato Lichess |
| `tournaments/<id>/seasons/*` | pubblica | classifiche finali delle stagioni archiviate |
| `tournaments/<id>/private/organizer` | solo admin | aneddoti sui giocatori, Elo, token Lichess (permesso Challenge), opzioni delle sfide e testi dei messaggi |

Gli aneddoti e il token sono privati di proposito: non vanno mai nella parte pubblica. Le regole Firestore permettono di leggere `private/*` solo all'account dell'organizzatore.

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo su http://localhost:3000
npm test         # test con vitest
npm run lint     # controllo dei tipi (tsc --noEmit)
npm run build    # build di produzione in dist/, con i meta tag dell'anteprima
```

### Anteprima dei link
Quando il link del sito viene condiviso (WhatsApp, Linktree…) l'anteprima mostra il logo `public/og-image.png` (1200×630: il cavallo sul pouf con i colori del sito e il nome del torneo, tutto nel quadrato centrale, così regge anche il ritaglio quadrato di Linktree) e come titolo il nome del torneo con la stagione. `public/logo-square.png` (1024×1024) è l'illustrazione da sola, per l'immagine del canale WhatsApp o una miniatura caricata a mano su Linktree.

Dopo `vite build`, `scripts/meta-tags.mjs` legge titolo e stagione dal documento pubblico su Firestore e li scrive nel titolo della pagina; aggiunge poi i meta tag `og:image`, che richiedono l'indirizzo assoluto del sito nella variabile `SITE_URL` (il workflow di deploy la prende da GitHub Pages). Il titolo si aggiorna a ogni deploy: dopo un cambio di stagione, rilancia il deploy dalla scheda Actions (*Run workflow*) o fai un push. WhatsApp conserva a lungo l'anteprima di un link già condiviso.

### Struttura di `src/`
- `views/`: pagine (pubblica, giocatore, login, console admin).
- `tabs/`: schede dell'area admin; `tabs/settings/` ha le sezioni di *Torneo*, `tabs/rounds/` quelle di *Turni*.
- `hooks/`: login, sincronizzazione con Firestore e Lichess, dati dell'organizzatore, stagioni.
- `lib/`: logica pura e testata (`standings`, `playerProfile`, `seasons`, `rounds`, `routes`, `parse`).
- `components/`: elementi condivisi.

Le funzioni di calcolo (classifica, spareggi, profilo giocatore, stagioni, lettura dei messaggi dei turni) stanno in `lib/` e hanno test in `lib/__tests__/`.

## Pubblicazione su GitHub Pages

Il workflow `.github/workflows/deploy.yml` esegue test e build a ogni push su `main` e pubblica `dist/`.
1. Su GitHub vai in **Settings → Pages**.
2. Sotto **Build and deployment** scegli **Source: GitHub Actions**.

## Configurazione iniziale del torneo
`config.json` contiene i valori predefiniti (giocatori, calendario, testi dei messaggi). Dopo il primo avvio i dati vivono su Firestore e si modificano dall'area organizzatore.

## Limiti noti
- Il pubblico vede i nuovi risultati solo dopo una sincronizzazione, cioè quando l'organizzatore apre l'area admin o preme **Sincronizza**.
- Per le partite in corso Lichess restituisce via API la posizione con 3 semimosse di ritardo (misura anti-cheat). Per questo il sito non dice di chi è il turno né quando scade il tempo: il dato sarebbe spesso sbagliato. Il bollettino indica solo una fascia di mosse approssimativa.
- Il login usa `signInWithPopup`: se un browser mobile blocca i popup, serve passare a `signInWithRedirect`.
