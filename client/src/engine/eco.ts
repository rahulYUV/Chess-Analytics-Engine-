/**
 * ECO opening lookup. A small, hand-curated table of the most common
 * chess openings, keyed by the first few moves in SAN.
 *
 * This is intentionally a flat list rather than a full ECO database —
 * for an "opening_deviation" hint, we only need to detect that the
 * user's first few moves don't match any of the popular lines.
 *
 * Move keys use a space-separated sequence like "e4 e5 Nf3 Nc6".
 * The longest matching prefix wins.
 */

export interface EcoEntry {
    /** Space-separated SAN moves from the start, e.g. "e4 e5 Nf3 Nc6". */
    moves: string;
    name: string;
    eco: string; // e.g. "C42"
}

export const ECO_OPENINGS: EcoEntry[] = [
    // King's Pawn (1.e4 e5)
    { moves: "e4 e5 Nf3 Nc6 Bb5", name: "Ruy López", eco: "C70" },
    { moves: "e4 e5 Nf3 Nc6 Bc4", name: "Italian Game", eco: "C50" },
    { moves: "e4 e5 Nf3 Nc6 Bc4 Bc5", name: "Giuoco Piano", eco: "C53" },
    { moves: "e4 e5 Nf3 Nc6 Bc4 Nf6", name: "Two Knights Defense", eco: "C55" },
    { moves: "e4 e5 Nf3 Nc6 d4", name: "Scotch Game", eco: "C45" },
    { moves: "e4 e5 Nf3 Nf6", name: "Petrov's Defense", eco: "C42" },
    { moves: "e4 e5 f4", name: "King's Gambit", eco: "C30" },
    { moves: "e4 e5 Nc3", name: "Vienna Game", eco: "C25" },
    { moves: "e4 e5 Nc3 Nf6", name: "Vienna Game: Falkbeer Variation", eco: "C26" },
    { moves: "e4 e5 Nc3 Nf6 Bc4", name: "Vienna Gambit", eco: "C29" },

    // Sicilian (1.e4 c5)
    { moves: "e4 c5 Nf3 d6", name: "Sicilian Defense: Open", eco: "B50" },
    { moves: "e4 c5 Nf3 d6 d4", name: "Sicilian Defense: Open", eco: "B51" },
    { moves: "e4 c5 Nf3 Nc6", name: "Sicilian Defense: Old Sicilian", eco: "B30" },
    { moves: "e4 c5 Nf3 e6", name: "Sicilian Defense: Taimanov", eco: "B40" },
    { moves: "e4 c5 Nf3 a6", name: "Sicilian Defense: Najdorf", eco: "B90" },
    { moves: "e4 c5 Nf3 a6 d4", name: "Sicilian Defense: Najdorf", eco: "B90" },
    { moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", name: "Sicilian Defense: Najdorf Variation", eco: "B99" },
    { moves: "e4 c5 Nf3 d6 d4 cxd4 Qxd4", name: "Sicilian Defense: Smith-Morra Gambit", eco: "B21" },

    // French (1.e4 e6)
    { moves: "e4 e6", name: "French Defense", eco: "C00" },
    { moves: "e4 e6 d4 d5", name: "French Defense", eco: "C00" },
    { moves: "e4 e6 d4 d5 Nc3", name: "French Defense: Classical", eco: "C11" },
    { moves: "e4 e6 d4 d5 Nc3 Nf6", name: "French Defense: Classical Variation", eco: "C13" },
    { moves: "e4 e6 d4 d5 e5", name: "French Defense: Advance", eco: "C02" },

    // Caro-Kann (1.e4 c6)
    { moves: "e4 c6", name: "Caro-Kann Defense", eco: "B10" },
    { moves: "e4 c6 d4 d5", name: "Caro-Kann Defense: Advance", eco: "B12" },
    { moves: "e4 c6 d4 d5 e5", name: "Caro-Kann Defense: Advance Variation", eco: "B12" },
    { moves: "e4 c6 d4 d5 Nc3 dxe4", name: "Caro-Kann Defense: Exchange Variation", eco: "B13" },

    // Pirc / Modern (1.e4 d6 / g6)
    { moves: "e4 d6", name: "Pirc Defense", eco: "B07" },
    { moves: "e4 g6", name: "Modern Defense", eco: "B06" },
    { moves: "e4 g6 d4", name: "Modern Defense", eco: "B06" },

    // King's Indian / Queen's Pawn (1.d4)
    { moves: "d4 d5", name: "Queen's Pawn Game", eco: "D00" },
    { moves: "d4 d5 c4", name: "Queen's Gambit", eco: "D06" },
    { moves: "d4 d5 c4 e6", name: "Queen's Gambit Declined", eco: "D30" },
    { moves: "d4 d5 c4 e6 Nc3", name: "Queen's Gambit Declined: Orthodox", eco: "D60" },
    { moves: "d4 d5 c4 c6", name: "Slav Defense", eco: "D10" },
    { moves: "d4 Nf6", name: "Indian Defense", eco: "A45" },
    { moves: "d4 Nf6 c4 g6", name: "King's Indian Defense", eco: "E60" },
    { moves: "d4 Nf6 c4 g6 Nc3 Bg7", name: "King's Indian Defense: Classical", eco: "E90" },
    { moves: "d4 Nf6 c4 e6", name: "Indian Defense: Nimzo-Indian Setup", eco: "A48" },
    { moves: "d4 f5", name: "Dutch Defense", eco: "A80" },

    // Reti / English (1.Nf3 / 1.c4)
    { moves: "Nf3 d5", name: "Reti Opening", eco: "A05" },
    { moves: "Nf3 d5 c4", name: "Reti Opening", eco: "A05" },
    { moves: "c4", name: "English Opening", eco: "A10" },
    { moves: "c4 e5", name: "English Opening: King's English", eco: "A20" },
    { moves: "c4 Nf6", name: "English Opening: Symmetrical", eco: "A30" },
];

/**
 * Find the longest ECO entry whose move sequence is a prefix of `moves`.
 * Returns `null` if the opening isn't recognized.
 */
export function identifyOpening(movesSan: string[]): EcoEntry | null {
    const joined = movesSan.join(" ");
    let best: EcoEntry | null = null;
    for (const entry of ECO_OPENINGS) {
        if (joined.startsWith(entry.moves) && (!best || entry.moves.length > best.moves.length)) {
            best = entry;
        }
    }
    return best;
}
