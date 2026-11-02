# Scacchi & Chill

Sito per organizzare un torneo di scacchi per corrispondenza tra amici: gli accoppiamenti si creano su Lichess, i risultati si sincronizzano su Firebase e tutti i partecipanti seguono classifica, calendario e storico delle stagioni da una pagina pubblica. Il sito è statico (React + Vite + Firebase) e viene servito da GitHub Pages.

## Cosa c'è

### Parte pubblica
- **📊 Classifica** con punti, V/N/P e spareggio Sonneborn-Berger. La colonna del giocatore resta fissa durante lo scroll orizzontale su mobile.
- **🔲 Tabellone incrociato** con tutti i risultati.
- **♟️ Calendario partite**, filtrabile per turno, con link a Lichess.
- **📜 Regolamento** e Albo d'Oro dei vincitori.
- **🏛️ Storico** delle stagioni passate con la classifica finale (compare dopo la prima stagione archiviata).
- **Pagina giocatore** (`#/giocatore/<handle>`): posizione, partite giocate, avversari ancora da affrontare. Si apre cliccando un nome in classifica.

### Area organizzatore (`#admin`)
Accesso con login Google, riservato a un solo account.
- **♟️ Partite**: accoppiamenti bianco/nero, creazione delle sfide su Lichess, messaggio WhatsApp con i link.
- **📊 Stato**: andamento delle partite, bollettino WhatsApp, gestione dei turni salvati.
- **✨ Recensione**: statistiche, aneddoti ed Elo dei giocatori per costruire il prompt da incollare in Claude o ChatGPT; il testo ottenuto si incolla poi nella scheda per l'anteprima WhatsApp.
- **⚙️ Opzioni** (sezioni richiudibili): informazioni del torneo e Albo d'Oro, archivio stagioni, giocatori, calendario ufficiale, token Lichess e testi dei messaggi, backup.
- **🔄 Sincronizza risultati**: scarica gli esiti da Lichess e li salva su Firestore. La vista pubblica legge da Firestore, quindi i nuovi risultati compaiono solo dopo la sincronizzazione.

### Stagioni
Da *Opzioni → Archivio stagioni*:
- **Archivia stagione corrente** salva la classifica finale nello storico pubblico e aggiunge il campione all'Albo d'Oro.
- **Archivia e inizia nuova stagione** archivia, poi **cancella tutte le partite** dalla stagione corrente, imposta il nuovo nome e maestro e, se vuoi, svuota il calendario. Prima della cancellazione chiede conferma e non cancella nulla se l'archiviazione fallisce.

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
| `tournaments/<id>` | pubblica | titolo, stagione, giocatori, calendario, Albo d'Oro |
| `tournaments/<id>/games/*` | pubblica | partite e stato Lichess |
| `tournaments/<id>/seasons/*` | pubblica | classifiche finali delle stagioni archiviate |
| `tournaments/<id>/private/organizer` | solo admin | aneddoti sui giocatori ed Elo |

Gli aneddoti sono privati di proposito: non vanno mai nella parte pubblica.

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo su http://localhost:3000
npm test         # test con vitest
npm run lint     # controllo dei tipi (tsc --noEmit)
npm run build    # build di produzione in dist/
```

### Struttura di `src/`
- `views/`: pagine (pubblica, giocatore, login, console admin).
- `tabs/`: schede dell'area admin; `tabs/settings/` ha le sezioni delle impostazioni.
- `hooks/`: login, sincronizzazione con Firestore e Lichess, dati dell'organizzatore, stagioni.
- `lib/`: logica pura e testata (`standings`, `playerProfile`, `seasons`, `routes`, `parse`).
- `components/`: elementi condivisi.

Le funzioni di calcolo (classifica, spareggi, profilo giocatore, stagioni, lettura dei messaggi dei turni) stanno in `lib/` e hanno test in `lib/__tests__/`.

## Pubblicazione su GitHub Pages

Il workflow `.github/workflows/deploy.yml` esegue test e build a ogni push su `main` e pubblica `dist/`.
1. Su GitHub vai in **Settings → Pages**.
2. Sotto **Build and deployment** scegli **Source: GitHub Actions**.

## Configurazione iniziale del torneo
`config.json` contiene i valori predefiniti (giocatori, calendario, testi dei messaggi). Dopo il primo avvio i dati vivono su Firestore e si modificano dall'area organizzatore. *Opzioni → Informazioni torneo → Esporta config.json* scarica una copia aggiornata.

## Limiti noti
- Finché l'organizzatore non preme **Sincronizza**, il pubblico non vede i nuovi risultati.
- Il login usa `signInWithPopup`: se un browser mobile blocca i popup, serve passare a `signInWithRedirect`.
