import { AppConfig } from './types';

export const defaultConfig: AppConfig = {
  players: [
    { handle: "matepaco", name: "Francesco Spa" },
    { handle: "frasal", name: "Francesco Sal" },
    { handle: "scarsoforteh", name: "Stefano" },
    { handle: "drake097", name: "Alessandro" },
    { handle: "fsgach", name: "Fabio" },
    { handle: "luca_sgarbossa", name: "Luca" },
    { handle: "giords", name: "Giordano" },
    { handle: "battimat", name: "Matteo" }
  ],
  defaults: {
    days: 2,
    expiry: 2,
    rated: true,
    rules: {
      noRematch: true,
      noGiveTime: true,
      noClaimWin: false,
      noEarlyDraw: true
    }
  },
  messageTemplates: {
    header: "♟️ Turno {round} – {days} giorni a mossa, partite {type}",
    game: "{n} {white} ⚪ vs {black} ⚫\n{url}",
    bye: "😴 Riposa in questo turno: {bye}",
    footer: "Cliccate sul vostro link e accettate la sfida. I link restano validi {expiry} giorni."
  },
  typeLabels: {
    rated: "classificate",
    casual: "amichevoli"
  },
  challengeName: "Turno {round}",
  numberEmojis: ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"],
  statusPhrases: {
    header: [
      "♟️ Aggiornamento Turno {round}",
      "♟️ Turno {round}: la situazione sulle scacchiere",
      "♟️ Turno {round}: come siamo messi?",
      "♟️ Turno {round}: il punto della settimana",
      "♟️ Turno {round}: scacchiere sotto la lente",
      "♟️ Turno {round}: cosa si muove?",
      "♟️ Il bollettino del Turno {round}",
      "♟️ Turno {round}: un'occhiata alle partite",
      "♟️ Turno {round}: facciamo il punto",
      "♟️ Turno {round}: stato dei lavori",
      "♟️ Turno {round}: cronaca della settimana",
      "♟️ Turno {round}: aggiornamenti dal campo di battaglia",
      "♟️ Turno {round}: chi la spunterà questa volta?",
      "♟️ Turno {round}: resoconto delle ostilità"
    ],
    ongoing: [
      "In corso ♟️ ({approxMoves})",
      "Partita in pieno svolgimento 🎯 ({approxMoves})",
      "Si sta giocando 🙂 – {approxMoves}",
      "La partita prosegue 🔄 ({approxMoves})",
      "Ancora in corso, si va avanti ♟️ – {approxMoves}",
      "Partita aperta, la sfida continua ⚔️ ({approxMoves})",
      "In pieno svolgimento 🧠 ({approxMoves})",
      "Sulla scacchiera si combatte ancora ♞ – {approxMoves}",
      "Partita aperta e combattuta 📂 ({approxMoves})",
      "Si va avanti, la partita non è finita 🔜 ({approxMoves})",
      "Manovre sul centro scacchiera ♟️ ({approxMoves})",
      "Lotta serrata, posizioni tese ⚔️ ({approxMoves})",
      "Fase di riflessione profonda ⏳ ({approxMoves})",
      "Partita accesa: i due maestri continuano a muovere 🛡️ ({approxMoves})",
      "Nessun passo indietro: la contesa prosegue ⚡ ({approxMoves})",
      "Posizione in evoluzione ({approxMoves}) 🏹",
      "Fronte caldissimo sulla scacchiera 🔥 ({approxMoves})",
      "I due contendenti studiano le mosse ({approxMoves}) 🧐"
    ],
    win: [
      "Finita! Ha vinto {winner} {details} ({result}) 🎉\n{openingNote}",
      "{winner} porta a casa il punto pieno {details} ({result}) 👏\n{openingNote}",
      "Partita chiusa: vittoria di {winner} {details} ({result}) ✅\n{openingNote}",
      "Punto pieno per {winner} {details} ({result}) 🏆",
      "{winner} la spunta su {loser} {details} ({result}) 🙌\n{openingNote}",
      "Fine dei giochi: vince {winner} {details} ({result}) 🔔",
      "Si chiude con la vittoria di {winner} {details} ({result}) 📌\n{openingNote}",
      "{winner} incassa il punto {details} ({result}) 💪",
      "Verdetto: {winner} vince {details} ({result}) ⚖️\n{openingNote}",
      "Partita archiviata: vince {winner} {details} ({result}) 🗂️",
      "Stoccata vincente di {winner} {details} ({result}) ⚔️\n{openingNote}",
      "{winner} supera la difesa di {loser} {details} ({result}) 🎯\n{openingNote}",
      "Trionfo di {winner} sul tabellone {details} ({result}) 🥇\n{openingNote}",
      "Niente da fare per {loser}: vittoria netta di {winner} {details} ({result}) ♟️"
    ],
    draw: [
      "Finita in patta {details} ({result}) 🤝\n{openingNote}",
      "Mezzo punto a testa {details} ({result}) 🤝",
      "Pace firmata: patta {details} ({result}) 🕊️\n{openingNote}",
      "Si divide la posta {details} ({result}) ⚖️",
      "Niente vincitori, niente vinti: patta {details} ({result}) 🤝\n{openingNote}",
      "Un pareggio {details} ({result}) e ognuno si prende mezzo punto ➗",
      "Patta! Il punto si divide {details} ({result}) ✌️\n{openingNote}",
      "Chiusa alla pari {details} ({result}) 🟰",
      "Partita finita in parità {details} ({result}) ⚪⚫\n{openingNote}",
      "Armistizio sulla scacchiera {details} ({result}) 🕊️",
      "Equilibrio perfetto fino all'ultimo {details} ({result}) ⚖️\n{openingNote}",
      "Nessuno sfonda: stretta di mano e parità {details} ({result}) 🤝"
    ],
    aborted: [
      "Partita annullata 🚫",
      "Questa partita è stata annullata ❌",
      "Partita annullata su Lichess 🚫",
      "Annullata: se serve ne parliamo nel gruppo 💬",
      "Partita non disputata, risulta annullata 🚫",
      "Qui la partita è stata annullata ❌",
      "Stop: partita annullata 🛑",
      "Partita annullata, da vedere come procedere 🤔",
      "Risulta annullata 🚫",
      "Partita interrotta e annullata ❌"
    ],
    pending: [
      "Non ancora iniziata ⏳",
      "Ancora ai blocchi di partenza 🏁",
      "Scacchiera ancora chiusa 📦",
      "Il link aspetta ancora di essere aperto 🔗",
      "Ancora da avviare ⏳",
      "Si parte appena la partita viene accettata 🚦",
      "Non è ancora partita 🕐",
      "Pezzi ancora in scatola 🎲",
      "In attesa del via 🏁",
      "Partita ancora da cominciare ♟️",
      "In attesa che entrambi accettino la sfida 📩",
      "L'orologio non è ancora partito ⏱️"
    ],
    footer: [
      "📊 {finished} finite, {ongoing} in corso, {pending} da avviare.",
      "📊 Riepilogo: {finished} concluse, {ongoing} in corso, {pending} da iniziare.",
      "📊 In numeri: {finished} finite · {ongoing} in corso · {pending} da avviare.",
      "📈 Il quadro: {finished} chiuse, {ongoing} aperte, {pending} ferme al via.",
      "📊 Conteggio: {ongoing} partite in corso, {finished} finite, {pending} non partite.",
      "📊 Totale: {finished} concluse, {ongoing} ancora in gioco, {pending} da avviare.",
      "🧮 Facendo i conti: {finished} finite, {ongoing} in corso, {pending} da far partire.",
      "📊 Stato generale: {ongoing} in corso, {finished} chiuse, {pending} in attesa.",
      "📋 Riassunto: {finished} finite, {ongoing} in corso, {pending} da avviare.",
      "📊 {ongoing} partite aperte, {finished} concluse, {pending} da avviare."
    ],
    closing: [
      "Buona settimana e buone mosse a tutti!",
      "Ci aggiorniamo lunedì prossimo. Buone mosse! ♞",
      "Pensateci bene e buona settimana! ♟️",
      "Buon proseguimento a tutti, e buone mosse! 🙌",
      "Alla prossima settimana, che vinca il migliore!",
      "Prendetevi il tempo che serve e buon divertimento! 🙂",
      "Buona settimana, e ricordate: l'alfiere va in diagonale! ♝",
      "Muovete con calma e buon divertimento! 😄",
      "Buone partite a tutti, ci sentiamo lunedì! 👋",
      "Che sia una settimana di buone mosse! ♟️",
      "Che la tattica sia con voi e niente arrocchi avventati! 🏰",
      "Meno fretta e più arrocco per tutti! 👑",
      "Occhio ai cavalli al centro! Buone partite a tutti! 🐴"
    ],
    highlight: [
      "🏁 La più lunga del turno: {longest}. La più rapida: {shortest}.",
      "⏱️ Maratona del turno: {longest}. Sprint: {shortest}.",
      "📏 Partita più lunga: {longest}. Più breve: {shortest}.",
      "🏃 La più veloce a chiudersi: {shortest}. La più combattuta: {longest}.",
      "🐢 Più lunga: {longest} · 🐇 Più rapida: {shortest}",
      "📌 Da segnare: la più lunga è {longest}, la più rapida {shortest}.",
      "🎖️ Resistenza: {longest}. Velocità: {shortest}.",
      "🧮 Facendo i conti, la partita più lunga è {longest} e la più breve {shortest}.",
      "📊 Più mosse: {longest}. Meno mosse: {shortest}.",
      "🔎 Curiosità del turno: più lunga {longest}, più corta {shortest}."
    ]
  }
};
