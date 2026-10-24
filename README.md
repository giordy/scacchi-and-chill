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
### 5. Grandi Eventi su Lichess (Messaggio WhatsApp Mensile)
- **Filtro automatico per mese**: seleziona il mese desiderato (preimpostato su quello in corso) e scarica i broadcast ufficiali in corso o futuri da Lichess.
- **Solo il meglio**: seleziona 1 o al massimo 2 tornei mondiali di prima fascia (es. Mondiali, Candidati, Olimpiadi, Tata Steel) e 1 eventuale torneo italiano di rilievo.
- **Niente spam**: se non ci sono tornei di primo piano nel mese, l'app lo segnala e permette di omettere il messaggio.
- **Schede complete con link ufficiali**: include nome, sede, date formattate in italiano, top player in gara, breve spiegazione in italiano, link al sito ufficiale del torneo (se disponibile) e link alla diretta su Lichess.
- **Anteprima e condivisione 1-click**: area di testo modificabile con pulsanti *Condividi su WhatsApp* e *Copia testo*.

---

## Hosting Gratuito su GitHub Pages

L'app è pronta per essere ospitata gratuitamente su GitHub Pages con due modalità a scelta:

### Pubblicazione Automatica (GitHub Actions)
Nel repository è configurato il workflow `.github/workflows/deploy.yml`.
1. Su GitHub vai su **Settings** > **Pages**.
2. Sotto **Build and deployment** seleziona **Source**: `GitHub Actions`.
3. A ogni push su `main`, GitHub compilerà l'app ed eseguirà il deploy in automatico!

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
