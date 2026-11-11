// The opening of the season's master: a light-hearted tag on the games that play it, and the
// award to who played it most. Lichess names openings in English, from its public list
// (github.com/lichess-org/chess-openings, the names of lichess.org/opening): "Family: Variation,
// Subvariation". A family here is a set of those family names (the part before ":"), plus, for the
// systems that Lichess files under other families (the London as "Queen's Pawn Game: London System"),
// words to look for anywhere in the name.

export interface OpeningFamily {
  key: string;
  label: string; // Italian name, as shown on the site
  // The side whose choice the opening is: the award goes to who played it from this side
  side: 'white' | 'black';
  families: string[];
  contains?: string[];
}

export const OPENING_FAMILIES: OpeningFamily[] = [
  { key: 'queens-gambit', label: 'Gambetto di Donna', side: 'white', families: ["Queen's Gambit", "Queen's Gambit Declined", "Queen's Gambit Accepted"] },
  { key: 'slav', label: 'Difesa Slava', side: 'black', families: ['Slav Defense', 'Semi-Slav Defense', 'Semi-Slav Defense Accepted'] },
  { key: 'tarrasch', label: 'Difesa Tarrasch', side: 'black', families: ['Tarrasch Defense'] },
  { key: 'catalan', label: 'Catalana', side: 'white', families: ['Catalan Opening'] },
  { key: 'london', label: 'Sistema Londra', side: 'white', families: ['London System', 'London System, with Be2', 'London System, with Bd3'], contains: ['London System'] },
  { key: 'colle', label: 'Sistema Colle', side: 'white', families: ['Colle System'], contains: ['Colle System'] },
  { key: 'kings-indian', label: 'Est-Indiana', side: 'black', families: ["King's Indian Defense"] },
  { key: 'nimzo-indian', label: 'Nimzo-Indiana', side: 'black', families: ['Nimzo-Indian Defense'] },
  { key: 'queens-indian', label: 'Ovest-Indiana', side: 'black', families: ["Queen's Indian Defense", "Queen's Indian Defense, with e3", "Queen's Indian Accelerated"] },
  { key: 'grunfeld', label: 'Difesa Grünfeld', side: 'black', families: ['Grünfeld Defense', 'Neo-Grünfeld Defense'] },
  { key: 'benoni', label: 'Benoni', side: 'black', families: ['Benoni Defense'] },
  { key: 'dutch', label: 'Olandese', side: 'black', families: ['Dutch Defense'] },
  { key: 'english', label: 'Inglese', side: 'white', families: ['English Opening'] },
  { key: 'reti', label: 'Apertura Réti', side: 'white', families: ['Réti Opening'] },
  { key: 'bird', label: 'Apertura Bird', side: 'white', families: ['Bird Opening'] },
  { key: 'kings-indian-attack', label: 'Attacco Est-Indiano', side: 'white', families: ["King's Indian Attack", "King's Indian Attack, with Bf5", "King's Indian Attack, with e6"] },
  { key: 'ruy-lopez', label: 'Spagnola', side: 'white', families: ['Ruy Lopez'] },
  { key: 'italian', label: 'Italiana', side: 'white', families: ['Italian Game'] },
  { key: 'scotch', label: 'Scozzese', side: 'white', families: ['Scotch Game'] },
  { key: 'bishops-opening', label: "Apertura d'Alfiere", side: 'white', families: ["Bishop's Opening"] },
  { key: 'vienna', label: 'Viennese', side: 'white', families: ['Vienna Game', 'Vienna Gambit, with Max Lange Defense'] },
  { key: 'four-knights', label: 'Quattro Cavalli', side: 'white', families: ['Four Knights Game'] },
  { key: 'kings-gambit', label: 'Gambetto di Re', side: 'white', families: ["King's Gambit", "King's Gambit Accepted", "King's Gambit Declined"] },
  { key: 'sicilian', label: 'Siciliana', side: 'black', families: ['Sicilian Defense'] },
  { key: 'french', label: 'Francese', side: 'black', families: ['French Defense'] },
  { key: 'caro-kann', label: 'Caro-Kann', side: 'black', families: ['Caro-Kann Defense'] },
  { key: 'alekhine', label: 'Difesa Alekhine', side: 'black', families: ['Alekhine Defense'] },
  { key: 'scandinavian', label: 'Scandinava', side: 'black', families: ['Scandinavian Defense'] },
  { key: 'pirc-modern', label: 'Pirc e Moderna', side: 'black', families: ['Pirc Defense', 'Modern Defense'] },
  { key: 'petrov', label: 'Difesa Petrov', side: 'black', families: ["Petrov's Defense"] },
  { key: 'philidor', label: 'Difesa Philidor', side: 'black', families: ['Philidor Defense'] },
];

export const openingFamily = (key: string | undefined) => OPENING_FAMILIES.find((f) => f.key === key);

// Whether a Lichess opening name belongs to the family: by the family name before ":", or by one of
// the words looked for anywhere in it
export function playsFamily(openingName: string | undefined, family: OpeningFamily | undefined): boolean {
  const name = openingName?.trim();
  if (!name || !family) return false;
  const head = name.split(':')[0].trim();
  return family.families.includes(head) || (family.contains ?? []).some((w) => name.includes(w));
}

// "José Raúl Capablanca" -> "Capablanca": the award and the tag use the surname
export const masterSurname = (masterName: string | undefined) => masterName?.trim().split(/\s+/).pop() ?? '';
