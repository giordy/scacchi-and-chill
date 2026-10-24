# Round Pairings (Scacchi & Chill)

Applicazione web per organizzare i turni di un torneo di scacchi tra amici, generare le sfide su Lichess e condividere gli aggiornamenti su WhatsApp.

## Novità e Funzionalità Principali

### 1. Interfaccia a Schede (Ottimizzata per Smartphone)
- **♟️ Partite**: selezione rapida degli accoppiamenti bianco/nero, inversione colori con pulsante `⇅`, conteggio giocatori assegnati, creazione automatica sfide su Lichess, e messaggio WhatsApp con link di invito pronti per la condivisione.
- **📊 Stato**: monitoraggio dell'andamento delle partite con Lichess, bollettino settimanale WhatsApp con stima mosse, dettagli tecnici, gestione dei turni salvati e recupero protetto.
- **⚙️ Impostazioni**: gestione del token API Lichess, giorni per mossa, validità link, partite classificate/amichevoli, regole speciali e personalizzazione dei testi dei messaggi.

### 2. Stima Mosse & Varietà Messaggi
- Poiché Lichess omette le ultimissime mosse nelle partite in corso per prevenire aiuti esterni, l'app include una stima per fasce (*"meno di 10 mosse"*, *"tra 10 e 20 mosse"*, *"oltre 20 mosse"*, *"oltre 35 mosse"*, *"oltre 50 mosse"*).
- Ampia varietà di frasi in italiano colloquiale e divertente per partite in corso, vittorie, patte, aperture e partite maratona/sprint.

### 3. Supporto Completo URL Lichess (Vecchi e Nuovi)
- Riconosce automaticamente sia il formato classico `lichess.org/AbCdEfGh` sia i formati recenti come `lichess.org/challenge/AbCdEfGh`, URL a 12 caratteri per giocatore, link abbreviati o link con prefissi `www.`/`https`.

### 4. Gestione Turni e Protezione Ripristino Messaggi
- **Anteprima interattiva prima del ripristino**: incollando il messaggio WhatsApp, l'app analizza e mostra l'elenco delle partite e dei giocatori identificati prima di salvare.
- **Protezione sovrascrittura**: se il turno esiste già, puoi scegliere esplicitamente se *Sostituire completamente il turno*, *Unire solo le partite mancanti* o *Annullare*.
- **Gestione turni salvati**: visualizza tutte le partite di ogni turno, elimina singoli turni errati o ricaricali direttamente nella schermata Partite.

---

## Hosting Gratuito su GitHub Pages

L'app è pronta per essere ospitata gratuitamente su GitHub Pages con due modalità a scelta:

### Metodo 1: Senza compilazione (Cartella `/docs`)
1. Su GitHub vai su **Settings** > **Pages**.
2. Sotto **Build and deployment** seleziona **Source**: `Deploy from a branch`.
3. Seleziona il branch `main` e la cartella **/docs**, quindi clicca **Save**.
4. Il sito sarà online al tuo indirizzo GitHub Pages senza necessità di eseguire build sul server!

### Metodo 2: Compilazione Automatica (GitHub Actions)
Nel repository è già configurato il workflow `.github/workflows/deploy.yml`.
1. Su GitHub vai su **Settings** > **Pages**.
2. Sotto **Build and deployment** seleziona **Source**: `GitHub Actions`.
3. A ogni push su `main`, GitHub compilerà e pubblicherà automaticamente l'applicazione.

---

## Sviluppo Locale

```bash
npm install
npm run dev
```

Per compilare la versione di produzione (aggiorna sia `dist/` che `docs/`):
```bash
npm run build
```
