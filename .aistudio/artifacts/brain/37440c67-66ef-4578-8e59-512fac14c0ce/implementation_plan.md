# Piano di Sviluppo: Recensione Irriverente & Volata Finale AI

Questo piano definisce l'architettura e l'esperienza utente per la nuova funzionalità di **generazione assistita da AI** dei resoconti del torneo: le celebri pagelle satiriche di metà/fine torneo (*Gran Galà*) e i bollettini di *Volata Finale* per le ultime sfide decisive.

---

### Decisioni Chiave e Scelte di Prodotto

> [!IMPORTANT]
> **Scelte confermate con l'utente**:
> 1. **Doppia modalità di generazione**: 
>    - Pulsante **"✨ Genera con AI"** per ottenere la recensione direttamente nell'app senza uscire.
>    - Pulsante **"📋 Copia Prompt Completo"** per incollare il prompt con tutti i dati (formattato per bene in Markdown) su Claude o ChatGPT quando si preferisce usare un modello esterno.
>    - Pulsante **"💾 Scarica Dati (JSON)"** per avere l'archivio grezzo di risultati e classifica.
> 2. **Due tipologie di resoconto**:
>    - **Pagelle Gran Galà (Fine Andata / Fine Torneo)**: Titolo comico, voti da 1 a 10 con lode, nomignoli e bilancio della prestazione.
>    - **Volata Finale (Penultimo turno)**: Anteprima ad alta tensione delle ultime partite in ballo per il 1° posto, podio e orgoglio.
> 3. **Gestione Dati & Aneddoti Extra-scacchistici**:
>    - Scheda dedicata con griglia giocatori: per ciascuno è possibile scrivere/aggiornare una **nota aneddotica personale** (es. *"diventato papà di Zaccaria"*, *"non dorme da mesi"*), salvata nel browser.
>    - Recupero automatico via API Lichess dell'**Elo corrispondenza** (`perfs.correspondence.rating`) per permettere all'AI di valorizzare gli upset o le sorprese del torneo.

---

## 1. Esperienza Utente & Nuova Scheda "Recensione AI"

Nel menu principale delle schede dell'applicazione (Partite, Stato, Configurazione) viene aggiunta la nuova scheda:
👉 **Recensione AI** (o *Gran Galà & Volata*)

### Flusso di Lavoro dell'Utente:
1. **Selezione Tipo di Messaggio**:
   - 🏆 *Pagelle Gran Galà* (Fine Andata o Fine Campionato)
   - 🔥 *Volata Finale* (Anteprima sfide decisive quando mancano poche partite)
2. **Quadro Dati Automatico**:
   - L'app aggrega in automatico tutte le partite finite e la classifica a punti calcolata dallo storico dei turni salvati.
   - Pulsante opzionale *"Aggiorna Elo Lichess da API"* per scaricare il rating di corrispondenza attuale dei profili.
3. **Aneddoti & Note Personali**:
   - Una sezione a schede o lista espandibile dove accanto a ciascun giocatore è possibile inserire una breve nota extra (es. *«Diventato papà durante il torneo»*, *«Fidanzata ritirata al turno 6»*).
4. **Azioni Rapide**:
   - **✨ Genera Recensione**: Chiama l'endpoint server-side con Gemini (`gemini-3.8-flash`) con un prompt appositamente calibrato sul tono di voce del torneo (irriverente, affettuoso, da amici al bar, con emoji e battute scacchistiche). Il risultato appare in un'area modificabile con conteggio parole e tasto *"Rigenera"*.
   - **📋 Copia Prompt per Claude/ChatGPT**: Copia negli appunti il mega-prompt completo di istruzioni di stile, classifica, risultati di ogni giocatore, elo e aneddoti, pronto da incollare altrove.
   - **📲 Condividi su WhatsApp**: Invia il testo finale generato direttamente al gruppo.

---

## 2. Architettura Tecnica & Modifiche al Progetto

### Backend Full-Stack (`server.ts`)
Attualmente l'app è un client Vite puro. Per integrare Gemini nel pieno rispetto delle linee guida (chiamate server-side, segretezza della chiave API):
- Creazione di un `server.ts` Express montato con `vite.middlewares` in sviluppo.
- Integrazione dell'SDK `@google/genai` con il modello **`gemini-3.8-flash`** lato server.
- Endpoint POST `/api/generate-review` che riceve il contesto del torneo e restituisce il testo formattato in streaming o risposta unaria.

### Struttura Dati
```
┌─────────────────────────────────────────────────────────┐
│                    Scheda Recensione AI                │
├──────────────────────────┬──────────────────────────────┤
│ 1. Dati Torneo           │ 2. Aneddoti Giocatori       │
│  • Partite giocate       │  • Note personali (Zaccaria, │
│  • Classifica punti      │    insonnia, sostituzioni)   │
│  • Elo corrispondenza    │  • Persistenti in Storage    │
├──────────────────────────┴──────────────────────────────┤
│                      Generatore Prompt                  │
│  [✨ Genera con Gemini]   [📋 Copia Prompt]  [💾 JSON]   │
├─────────────────────────────────────────────────────────┤
│                    Area Testo WhatsApp                  │
│  • Anteprima formattata in grassetto WhatsApp           │
│  • Modificabile prima dell'invio                        │
│  • Tasto "Condividi su WhatsApp"                        │
└─────────────────────────────────────────────────────────┘
```

### Struttura del Prompt Generato (System Prompt & Dati)
Il prompt sintetizza fedelmente lo stile mostrato nei tuoi esempi:
- **Tono**: Goliardico, pungente ma rispettoso, con battute su aperture, mosse, orari, biberon e vita reale.
- **Formato Output**: Grassetto WhatsApp (`*...*`), corsivo (`_..._`), emoji scacchistiche e citazioni dei nickname Lichess.
- **Sezioni**:
  - Introduzione epica e teatrale.
  - Pagelle individuali ordinate per classifica con voto e soprannome d'onore.
  - Chiusura con brindisi e prospettiva sul prossimo turno/edizione.

---

## 3. Piano di Esecuzione (Passi Successivi all'Approvazione)

1. **Installazione dipendenze server**:
   - `express`, `@google/genai`, `tsx`.
   - Aggiornamento script in `package.json` (`"dev": "tsx server.ts"`).
2. **Creazione Server Express (`server.ts`)**:
   - Route `/api/generate-review` e `/api/lichess/ratings` (proxy per evitare rate-limit CORS).
3. **Logica di calcolo classifica & statistiche giocatori**:
   - Conteggio punti (1 vittoria, 0.5 patta), vittorie/sconfitte e performance per ciascun giocatore salvato nello storico.
4. **Interfaccia Grafica**:
   - Nuova scheda nel menu di navigazione in `src/App.tsx`.
   - Editor delle note/aneddoti per giocatore.
   - Pulsanti di generazione, copia prompt, copia testo e condivisione WhatsApp.
5. **Verifica & Collaudo**:
   - Test con i dati reali del torneo e simulazione della generazione sia con Gemini che con esportazione prompt.
