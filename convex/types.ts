export type Tile = { high: number; low: number };

export type PlayedTile = Tile & {
  seat: number;
  end: "left" | "right";
  timestamp: number;
};

export type Player = {
  id: string;
  name: string;
  seat: number;
  team: number; // seat % 2
  connected: boolean;
  lastSeen?: number;
};

// All 28 domino tiles, normalized so high >= low
export const ALL_TILES: Tile[] = [];
for (let i = 0; i <= 6; i++) {
  for (let j = i; j <= 6; j++) {
    ALL_TILES.push({ high: j, low: i });
  }
}
