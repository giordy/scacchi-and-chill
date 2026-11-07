# Scacchi & Chill

Sito per organizzare un torneo di scacchi per corrispondenza tra amici: gli accoppiamenti si creano su Lichess, i risultati si sincronizzano su Firebase e tutti i partecipanti seguono classifica, calendario e storico delle stagioni da una pagina pubblica. Il sito è statico (React + Vite + Firebase) e viene servito da GitHub Pages.

## Cosa c'è

### Parte pubblica
- **Intestazione**: torneo, stagione, turno in corso e capolista. Una striscia di caselle mostra l'avanzamento della stagione: una casella per partita, piena se conclusa, a metà se in corso.
- **Classifica** con punti, V/N/P e spareggio Sonneborn-Berger, podio in oro/argento/bronzo. L'ordine è punti, poi Sonneborn-Berger, poi vittorie; chi è pari su tutti e tre condivide la posizione (due 2° e poi un 4°, entrambi in argento) e l'intestazione li nomina insieme («In testa a pari merito…»). La stessa regola vale per la pagina giocatore («pari merito»), le stagioni passate, il CSV e il podio salvato nell'Albo. Prima della prima partita al posto della posizione c'è un trattino. La colonna del giocatore resta fissa durante lo scroll orizzontale su mobile.
- **Partite**, filtrabili per turno, con link a Lichess; toccando il nome di un giocatore si apre il suo profilo. Le partite concluse mostrano la posizione finale su una mini scacchiera (quelle in corso no: Lichess nasconde le ultime mosse).
- **Tabellone** incrociato con tutti i risultati.
- **Torneo**: il maestro della stagione (con il periodo: «Da novembre 2026»), il regolamento, l'Albo d'Oro e le stagioni passate con la classifica finale, ciascuna con mese e anno di inizio e fine.
- **Pagina giocatore** (`#/giocatore/<handle>`): ultimo accesso a Lichess, posizione, grafico dei punti turno per turno, scontri diretti con ogni avversario (risultati, punteggio e partite ancora da giocare, con turno e colore se sono in calendario), partite giocate. Si apre cliccando un nome in classifica. Dalla prima stagione archiviata ha anche la **carriera** (ogni stagione giocata con posizione, punti e V/N/P, e in cima stagioni, partite, punti totali e miglior piazzamento) e gli **scontri diretti di sempre** (V/N/P e punteggio contro ogni avversario mai incontrato, dalle stagioni archiviate con le partite più quella in corso). Funziona anche per chi non gioca più: basta che compaia in una classifica archiviata o nell'Albo.
- **Albo**: oltre all'Albo d'Oro e alle stagioni passate, la **classifica di sempre** (tutte le stagioni sommate, compresa quella in corso: punti, media punti a partita, stagioni, V/N/P, titoli) e i **record** (vittorie di fila, partite senza perdere, partita più lunga, vittoria più rapida, colpaccio più grosso), che compaiono dopo la prima stagione archiviata.
- **Risultati live**: la pagina pubblica legge da Lichess le partite non ancora concluse su Firestore (all'apertura, poi ogni 5 minuti finché resta aperta), così classifica e tabellone sono aggiornati anche senza sincronizzazione. Non scrive nulla: il salvataggio su Firestore resta la sincronizzazione dell'organizzatore.
- **Swipe tra le sezioni** (telefono): scorrendo col dito in un punto qualsiasi della pagina (piè di pagina e spazio vuoto sotto le sezioni corte compresi) verso sinistra si passa alla sezione successiva (Classifica → Partite → Stagione → Albo), verso destra alla precedente, con una breve animazione; se la barra delle sezioni era già in cima allo schermo, la nuova sezione si apre dall'inizio. Lo swipe non scatta sulle tabelle che scorrono di lato (classifica e tabellone su telefono), vicino ai bordi dello schermo (lì c'è il «indietro» del browser), sui gesti lenti o diagonali, dentro la finestra di replay di una partita e oltre la prima o l'ultima sezione.
- **Ultimo accesso a Lichess**: nelle partite in corso il cerchio bianco o nero di ogni giocatore porta un piccolo badge: verde se è passato da Lichess nell'ultima ora, giallo nelle ultime 24 ore, grigio oltre. Toccandolo si legge il tempo; nella pagina giocatore è scritto accanto a «@handle su Lichess». Il dato viene dal profilo Lichess (`seenAt`), non dalle partite, quindi il ritardo con cui Lichess mostra le ultime mosse non lo tocca; però non dice se il giocatore ha mosso nella partita del torneo. Se Lichess non risponde, il badge non compare.
- **Chiamate a Lichess dalla pagina pubblica**: al massimo due ogni 5 minuti, e solo con la pagina in primo piano: una per le partite non concluse e una per i profili di tutti i giocatori (ultimo accesso e flair). Tornare sulla scheda del browser non ne fa partire altre se le ultime hanno meno di 5 minuti.
- **Anteprima del link** (WhatsApp, Linktree): logo del torneo e nome della stagione (vedi sotto).

### Area organizzatore (`#admin`)
Accesso con login Google, riservato a un solo account.
- **♞ Turni**: il lavoro di ogni turno, con i suoi messaggi.
  - *Elenco dei turni*, pianificati e avviati, con lo stato (da avviare, link creati in parte, in corso, concluso); il turno su cui lavorare è evidenziato. *+ Nuovo turno* ne apre uno vuoto.
  - *Dentro un turno*: aggiungi, togli o inverti i colori delle partite; **Crea link Lichess** crea le sfide che non hanno ancora un link e le salva nel torneo; **Messaggio con i link** e **Bollettino** preparano i testi WhatsApp da condividere o copiare (la scadenza dei link è calcolata da quando sono state create le sfide). Il bollettino scrive la scadenza una volta sola, sotto le partite, con l'elenco di quelle ancora da accettare, e chiude sempre con il link al sito; a fine turno, al posto del riepilogo, mette chi è in testa e la classifica dopo il turno (posizioni condivise come sul sito, 👑 accanto al campione in carica: solo lì, non sulle righe delle partite), poi gli studi sulle aperture giocate; *Elimina turno* lo cancella (anche da Firestore; su Lichess le sfide restano aperte).
- **💬 WhatsApp**: quello che si scrive nel gruppo e non riguarda un solo turno (messaggio con i link e bollettino sono dentro il turno, in *Turni*).
  - *Il racconto della stagione*: partite, aneddoti ed Elo dei giocatori (scaricabile da Lichess con un solo pulsante) per costruire il prompt da incollare in Claude o ChatGPT; il testo ottenuto si incolla poi nella scheda per l'anteprima WhatsApp. Usa i risultati portati dalla sincronizzazione in cima all'area, senza chiamate a Lichess in più; il momento (fine andata, volata, fine torneo) parte da quello rilevato dalle partite, segnato come «consigliato». Il prompt chiede un racconto sobrio e affettuoso: due o tre frasi per giocatore nell'ordine della classifica del sito, il simbolo di un pezzo accanto al nome, niente voti, l'Elo solo come contesto (mai citato) e gli aneddoti solo dalle note.
  - *Premi della stagione*: i premi calcolati sulle partite concluse, con **Copia il messaggio per WhatsApp**.
  - *Testi dei messaggi*: le frasi del messaggio con i link e del bollettino, modificabili.
- **♟ Giocatori**:
  - *Registro dei giocatori*: tutti quelli passati dal torneo, distinti dal nome utente Lichess. Il nome è quello mostrato sul sito ovunque, **anche nelle stagioni passate** (classifiche archiviate, Albo d'Oro, premi, record, carriere): si cambia direttamente nell'elenco e si salva uscendo dal campo. Due giocatori con lo stesso nome sono segnalati, per aggiungere un'iniziale. I giocatori sono divisi in *in questa stagione*, *nello storico* (hanno giocato stagioni passate: si rinominano ma non si eliminano) e *registrati senza partite* (gli unici che si possono eliminare). *Aggiungi alla stagione* / *Togli dalla stagione* decide chi gioca la stagione corrente; chi ha già partite (create o in calendario) si toglie solo con *Ritiri*. Un nuovo giocatore si registra con nome e nome utente Lichess, e se serve entra subito nella stagione.
  - *Ritiri*: ritiro durante la stagione, con la regola della metà o con un sostituto.
- **♛ Stagioni** (sezioni richiudibili): stagione corrente (con la foto del maestro: un link, oppure **📷 Carica foto**, che la riduce a 600 px e la salva su Firestore, senza toccare il codice), regolamento (giorni per mossa e rated, mostrati anche in pubblico, con accanto validità del link e regole della sfida su Lichess), **calendario** (girone all'italiana da zero, oppure *Completa i turni mancanti*, che tiene i turni già presenti e le partite già create e aggiunge solo quelle che mancano; aperto quando non ci sono ancora turni), fine stagione e storico con Albo d'Oro.
- **⚙ Impostazioni**, da configurare una volta: token Lichess e copia dei dati in JSON.
- **↻ Sincronizza risultati**: scarica gli esiti da Lichess e li salva su Firestore. Parte da sola ogni volta che l'organizzatore apre l'area admin, e si può rilanciare a mano. La vista pubblica legge da Firestore, quindi i nuovi risultati compaiono solo dopo una sincronizzazione.

### Stagioni
Il periodo di ogni stagione (mese e anno di inizio e fine) si calcola dalle partite: dalla prima sfida creata all'ultima mossa dell'ultima partita conclusa. Chiudendo la stagione viene salvato nell'archivio e nell'Albo d'Oro; per le stagioni chiuse prima si aggiunge o si corregge a mano dall'Albo d'Oro (*Dal mese* / *Al mese*).

Da *Stagioni → Fine stagione e storico*:
- **Chiudi la stagione e inizia la prossima** salva la classifica finale nello storico pubblico, insieme alle partite con un risultato in forma compatta (giocatori, risultato, esito, numero di mosse, Elo, apertura, ID Lichess: niente mosse né posizioni), che servono a scontri diretti di sempre e record; mette il primo in classifica nell'Albo d'Oro, poi **cancella tutte le partite** della stagione, imposta il nuovo nome e maestro e, se vuoi, svuota il calendario. Prima della cancellazione chiede conferma e non cancella nulla se l'archiviazione fallisce.
- Se la stagione era già nell'Albo d'Oro con un altro giocatore, la voce viene aggiornata con il campione effettivo.
- **Scaricala come file (CSV)**, sotto il pulsante, scarica una copia della classifica di oggi da aprire con Excel o Numbers. Non tocca lo storico né l'Albo d'Oro.

## Configurazione Firebase

1. **Authentication → Sign-in method**: attiva Google.
2. **Authentication → Settings → Authorized domains**: aggiungi il dominio di GitHub Pages (`<utente>.github.io`) e `localhost`.
3. **Firestore → Rules**: pubblica il contenuto di [`firestore.rules`](firestore.rules). Ripubblicalo ogni volta che il file cambia. Le regole sono provate da `tests/firestore.rules.test.ts` sull'emulatore Firestore (`npm run test:rules`, anche nel deploy): chi non è l'organizzatore legge solo i dati pubblici e non scrive nulla, i dati privati restano privati, le partite accettano solo link Lichess, le foto solo immagini piccole. Un test controlla anche che l'email in `firestore.rules` sia la stessa di `ADMIN_EMAILS`.
4. La chiave web in `firebase-applet-config.json` è pubblica per natura. Limitala in Google Cloud ai referrer `<utente>.github.io/*` e `localhost`.

L'email dell'organizzatore compare in **due** posti, da tenere allineati:
- `firestore.rules` (`isAdmin()`), che è la protezione vera;
- `ADMIN_EMAILS` in `src/firebaseAuth.ts`, che regola solo l'interfaccia.

### Dati su Firestore
| Percorso | Lettura | Contenuto |
|---|---|---|
| `tournaments/<id>` | pubblica | titolo, stagione, giocatori, calendario, regolamento (giorni per mossa, rated), Albo d'Oro, registro dei giocatori (nome utente Lichess e nome mostrato) |
| `tournaments/<id>/games/*` | pubblica | partite e stato Lichess |
| `tournaments/<id>/seasons/*` | pubblica | classifiche finali delle stagioni archiviate |
| `tournaments/<id>/media/*` | pubblica | foto del maestro caricate dall'area organizzatore, una per stagione (JPEG ridotto, scritto solo dall'organizzatore, sotto i 900 KB) |
| `tournaments/<id>/private/organizer` | solo admin | aneddoti sui giocatori, Elo, token Lichess (permesso Challenge), opzioni delle sfide e testi dei messaggi |

Gli aneddoti e il token sono privati di proposito: non vanno mai nella parte pubblica. Le regole Firestore permettono di leggere `private/*` solo all'account dell'organizzatore.

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo su http://localhost:3000
npm test         # test con vitest
npm run test:rules  # test di firestore.rules sull'emulatore Firestore (serve Java 21)
npm run lint     # controllo dei tipi (tsc --noEmit)
npm run build    # build di produzione in dist/, con i meta tag dell'anteprima
```

### Anteprima dei link
Quando il link del sito viene condiviso (WhatsApp, Linktree…) l'anteprima mostra il logo `public/og-image.png` (1200×630: il cavallo sul pouf con i colori del sito e il nome del torneo, tutto nel quadrato centrale, così regge anche il ritaglio quadrato di Linktree) e come titolo il nome del torneo con la stagione. `public/logo-square.png` (1024×1024) è l'illustrazione da sola, per l'immagine del canale WhatsApp o una miniatura caricata a mano su Linktree. Dalla stessa illustrazione, su fondo crema, vengono anche le icone dell'app installata e del browser (`icon-192/512.png`, `icon-maskable-512.png` con margine per il ritaglio circolare di Android, `apple-touch-icon.png`; per `favicon-32.png` e `favicon.ico` solo la testa del cavallo, che a 16–32 px resta leggibile), così sito, app e anteprime hanno la stessa immagine.

Dopo `vite build`, `scripts/meta-tags.mjs` legge titolo e stagione dal documento pubblico su Firestore e li scrive nel titolo della pagina; aggiunge poi i meta tag `og:image`, che richiedono l'indirizzo assoluto del sito nella variabile `SITE_URL` (il workflow di deploy la prende da GitHub Pages). Il titolo si aggiorna a ogni deploy: dopo un cambio di stagione, rilancia il deploy dalla scheda Actions (*Run workflow*) o fai un push. WhatsApp conserva a lungo l'anteprima di un link già condiviso.

### Struttura di `src/`
- `views/`: pagine (pubblica, giocatore, login, console admin).
- `tabs/`: schede dell'area admin; `tabs/settings/` ha le sezioni di *Giocatori*, *Stagioni*, *WhatsApp* e *Impostazioni*, `tabs/rounds/` quelle di *Turni*.
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
