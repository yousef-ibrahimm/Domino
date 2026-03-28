import { Tile, PlayedTile, ALL_TILES } from "./types";

/** Fisher-Yates shuffle with a seed-derived sequence */
export function shuffleTiles(seed: number): Tile[] {
  const tiles = [...ALL_TILES];
  let m = tiles.length;
  let s = seed;
  while (m) {
    // Simple LCG for deterministic shuffle
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const i = ((s >>> 0) % m--);
    [tiles[m], tiles[i]] = [tiles[i], tiles[m]];
  }
  return tiles;
}

/** Deal 7 tiles to each of 4 players */
export function dealHands(shuffled: Tile[]): Tile[][] {
  return [
    shuffled.slice(0, 7),
    shuffled.slice(7, 14),
    shuffled.slice(14, 21),
    shuffled.slice(21, 28),
  ];
}

/** Find the starting seat for Round 1 ([6|6] holder) */
export function findDoubleSixHolder(hands: Tile[][]): number {
  for (let seat = 0; seat < 4; seat++) {
    if (hands[seat].some((t) => t.high === 6 && t.low === 6)) return seat;
  }
  // Fallback (should never happen with standard set)
  for (let val = 5; val >= 0; val--) {
    for (let seat = 0; seat < 4; seat++) {
      if (hands[seat].some((t) => t.high === val && t.low === val)) return seat;
    }
  }
  return 0;
}

/** Check if a tile can be played on a given open end value */
export function tileMatchesEnd(tile: Tile, endValue: number): boolean {
  return tile.high === endValue || tile.low === endValue;
}

/** Check if a player has any playable tile */
export function hasPlayableMove(hand: Tile[], openEnds: number[]): boolean {
  if (openEnds.length === 0) return true; // first move
  return hand.some(
    (t) => tileMatchesEnd(t, openEnds[0]) || tileMatchesEnd(t, openEnds[1])
  );
}

/** Calculate pip total of a hand */
export function pipCount(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + t.high + t.low, 0);
}

/** Resolve a block: returns { winningSeat, points } or null for a draw */
export function resolveBlock(
  hands: Tile[][]
): { winningSeat: number; points: number } | null {
  const counts = hands.map((h, i) => ({ seat: i, pips: pipCount(h) }));
  counts.sort((a, b) => a.pips - b.pips);

  // Check for tie at the lowest count
  const lowestPips = counts[0].pips;
  const tied = counts.filter((c) => c.pips === lowestPips);

  if (tied.length > 1) {
    // Draw: no winner, no points
    return null;
  }

  const winningSeat = counts[0].seat;
  const points = counts
    .filter((c) => c.seat !== winningSeat)
    .reduce((sum, c) => sum + c.pips, 0);

  return { winningSeat, points };
}

/** Calculate round points when a player goes out (empties hand) */
export function calculateDominoPoints(
  hands: Tile[][],
  winningSeat: number
): number {
  return hands.reduce((sum, hand, seat) => {
    if (seat === winningSeat) return sum;
    return sum + pipCount(hand);
  }, 0);
}

/** Tiles are equal if both ends match (already normalized high >= low) */
export function tilesEqual(a: Tile, b: Tile): boolean {
  return a.high === b.high && a.low === b.low;
}

/** Advance turn clockwise */
export function nextSeat(current: number): number {
  return (current + 1) % 4;
}
