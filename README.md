# Scacchi & Chill

Sito per organizzare un torneo di scacchi per corrispondenza tra amici: gli accoppiamenti si creano su Lichess, i risultati si sincronizzano su Firebase e tutti i partecipanti seguono classifica, calendario e storico delle stagioni da una pagina pubblica. Il sito è statico (React + Vite + Firebase) e viene servito da GitHub Pages.

## Cosa c'è

### Parte pubblica
- **Intestazione**: torneo, stagione, turno in corso e capolista. Una striscia di caselle mostra l'avanzamento della stagione: una casella per partita, piena se conclusa, a metà se in corso.
- **Classifica** con punti, V/N/P e spareggio Sonneborn-Berger. La colonna del giocatore resta fissa durante lo scroll orizzontale su mobile.
- **Partite**, filtrabili per turno, con link a Lichess.
- **Tabellone** incrociato con tutti i risultati.
- **Torneo**: il maestro della stagione, il regolamento, l'Albo d'Oro e le stagioni passate con la classifica finale.
- **Pagina giocatore** (`#/giocatore/<handle>`): posizione, partite giocate, avversari ancora da affrontare. Si apre cliccando un nome in classifica.

### Area organizzatore (`#admin`)
Accesso con login Google, riservato a un solo account.
- **♞ Turno**: il lavoro del turno in corso, in due passi.
  1. *Accoppiamenti*: bianco/nero (precompilati dal calendario ufficiale), creazione delle sfide su Lichess, messaggio WhatsApp con i link.
  2. *Bollettino*: andamento delle partite del turno e messaggio WhatsApp di aggiornamento.
- **▦ Calendario**: turni già creati (riapri o elimina, anche da Firestore) e calendario ufficiale degli accoppiamenti. Il girone all'italiana si genera da zero oppure si completa: *Completa i turni mancanti* tiene i turni già presenti e le partite già create e aggiunge solo quelle che mancano (se non è possibile lo dice). Il calendario non contiene link Lichess: le sfide si creano solo quando si avvia il turno.
- **✎ Recensione**: statistiche, aneddoti ed Elo dei giocatori per costruire il prompt da incollare in Claude o ChatGPT; il testo ottenuto si incolla poi nella scheda per l'anteprima WhatsApp.
- **♛ Torneo** (sezioni richiudibili): stagione corrente, giocatori, regolamento (con giorni per mossa e rated, mostrati anche in pubblico), fine stagione e storico con Albo d'Oro, token Lichess e testi dei messaggi, copia dei dati in JSON.
- **↻ Sincronizza risultati**: scarica gli esiti da Lichess e li salva su Firestore. Parte da sola ogni volta che l'organizzatore apre l'area admin, e si può rilanciare a mano. La vista pubblica legge da Firestore, quindi i nuovi risultati compaiono solo dopo una sincronizzazione.

### Stagioni
Da *Torneo → Fine stagione e storico*:
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
npm run build    # build di produzione in dist/
```

### Struttura di `src/`
- `views/`: pagine (pubblica, giocatore, login, console admin).
- `tabs/`: schede dell'area admin; `tabs/settings/` ha le sezioni di *Torneo*, `tabs/calendar/` quelle di *Calendario*.
- `hooks/`: login, sincronizzazione con Firestore e Lichess, dati dell'organizzatore, stagioni.
- `lib/`: logica pura e testata (`standings`, `playerProfile`, `seasons`, `routes`, `parse`).
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
