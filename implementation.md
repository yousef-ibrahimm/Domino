# Dominoes 2v2 — Implementation Plan

## Project Context

You are building a real-time, session-based 2v2 dominoes game. Four players join a session via a 6-character code, are split into two teams (seats 0+2 = Team A, seats 1+3 = Team B), and play rounds of dominoes until one team accumulates 250+ points. The entire game state is server-authoritative, powered by Convex DB’s reactive subscriptions — no polling, no REST.

### Tech Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend/DB:** Convex (mutations, queries, real-time subscriptions)
- **Runtime:** Node.js 20+
- **Deployment:** Vercel (frontend) + Convex Cloud (backend)

### Core Game Rules Summary

- **Domino set:** Standard double-six (28 tiles, [0|0] through [6|6])
- **Deal:** All 28 tiles dealt evenly, 7 per player, no boneyard
- **Turn order:** Clockwise (seat 0 → 1 → 2 → 3 → 0)
- **Round 1 start:** Player holding [6|6] plays first
- **Subsequent round start:** The round winner starts with any tile
- **Round win (Domino):** A player empties their hand → their team wins the round
- **Round win (Block):** All 4 players consecutively pass → player with strictly lowest pip count wins for their team
- **Block tie:** If 2+ players share the lowest pip count, the round is a draw — zero points awarded, tiles reshuffled, [6|6] start rule applies (same as Round 1)
- **Scoring:** The 3 non-winning players’ remaining pip totals are summed and added to the winning team’s cumulative score
- **Match win:** First team to reach or exceed 250 cumulative points

-----

## Phase 1: Project Scaffolding & Convex Schema

### Goal

Set up the Next.js + Convex project and define all database tables, types, and indexes.

### Context for AI

This phase creates the foundation. Every subsequent phase depends on the schema being correct. Convex uses a `convex/schema.ts` file to define tables. Convex auto-generates TypeScript types from the schema. All game logic runs as Convex server functions (mutations/queries) — not in API routes.

### Tasks

#### 1.1 — Initialize Project

```bash
npx create-next-app@latest dominoes-2v2 --typescript --tailwind --app --src-dir
cd dominoes-2v2
npx convex dev --once  # initializes convex/ directory
```

Install dependencies:

```bash
npm install convex
```

#### 1.2 — Define Convex Schema

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    code: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("playing"),
      v.literal("finished")
    ),
    players: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        seat: v.number(),
        team: v.number(),
        connected: v.boolean(),
      })
    ),
    teamScores: v.array(v.number()), // [Team A score, Team B score]
    currentRoundId: v.optional(v.id("rounds")),
    winningTeam: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  rounds: defineTable({
    sessionId: v.id("sessions"),
    roundNumber: v.number(),
    hands: v.array(v.array(v.object({ high: v.number(), low: v.number() }))),
    chain: v.array(
      v.object({
        high: v.number(),
        low: v.number(),
        seat: v.number(),
        end: v.union(v.literal("left"), v.literal("right")),
        timestamp: v.number(),
      })
    ),
    openEnds: v.array(v.number()), // [leftEnd, rightEnd]
    currentTurn: v.number(),
    consecutivePasses: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("won"),
      v.literal("blocked"),
      v.literal("draw")
    ),
    winningSeat: v.optional(v.number()),
    winningTeam: v.optional(v.number()),
    pointsScored: v.optional(v.number()),
    startingSeat: v.number(),
  }).index("by_session", ["sessionId"]),
});
```

#### 1.3 — Define Shared Types

Create `convex/types.ts`:

```typescript
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
};

// All 28 domino tiles, normalized so high >= low
export const ALL_TILES: Tile[] = [];
for (let i = 0; i <= 6; i++) {
  for (let j = i; j <= 6; j++) {
    ALL_TILES.push({ high: j, low: i });
  }
}
```

#### 1.4 — Create Game Logic Helpers

Create `convex/gameLogic.ts`. This is a pure-function module with zero Convex dependencies — it handles shuffling, validation, and scoring so mutations stay thin.

```typescript
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
```

### Acceptance Criteria

- `npx convex dev` runs without schema errors
- All types are auto-generated
- `gameLogic.ts` is importable from mutations with zero side effects
- Unit test: `shuffleTiles` with same seed produces same output
- Unit test: `resolveBlock` returns `null` when two players tie for lowest
- Unit test: `findDoubleSixHolder` finds correct seat
- Unit test: `calculateDominoPoints` sums all 3 non-winner hands correctly

-----

## Phase 2: Core Mutations (Server-Side Game Engine)

### Goal

Implement all Convex mutations that drive the game. These are the write operations that modify game state. Every mutation validates inputs and is the single source of truth.

### Context for AI

Convex mutations are defined in files inside `convex/`. They use `mutation({ args, handler })` from `convex/server`. The `ctx` object gives access to `ctx.db` for reads/writes. Mutations are transactional and serialized — no race conditions. Import all game logic from `convex/gameLogic.ts`. Never put game logic inline in mutations; keep mutations as thin orchestrators.

### Tasks

#### 2.1 — `createSession` Mutation

File: `convex/mutations/sessions.ts`

**Behavior:**

- Generate a unique 6-character alphanumeric code (uppercase, retry on collision)
- Create a session document with `status: "waiting"`, empty `players` array, `teamScores: [0, 0]`
- Return the session ID and code

**Validation:**

- None (any client can create a session)

**Code generation hint:**

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    let code: string;
    let existing;
    do {
      code = generateCode(); // 6-char alphanumeric
      existing = await ctx.db
        .query("sessions")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    } while (existing);

    const sessionId = await ctx.db.insert("sessions", {
      code,
      status: "waiting",
      players: [],
      teamScores: [0, 0],
      createdAt: Date.now(),
    });
    return { sessionId, code };
  },
});
```

#### 2.2 — `joinSession` Mutation

File: `convex/mutations/sessions.ts`

**Behavior:**

- Look up session by code (index: `by_code`)
- Add player to the `players` array with auto-assigned seat (0–3) and team (`seat % 2`)
- If a player with the same `id` already exists, update their `connected` to `true` (reconnect)
- When the 4th player joins: set `status: "playing"`, call the internal `startRound` logic

**Validation:**

- Session must exist → error `SESSION_NOT_FOUND`
- Session status must be `"waiting"` (unless reconnecting) → error `SESSION_FULL`
- Max 4 players → error `SESSION_FULL`
- Player name must be 1–16 characters

**Args:** `{ code: string, playerId: string, name: string }`

#### 2.3 — `startRound` Internal Function

File: `convex/mutations/rounds.ts`

**Behavior:**

- Shuffle tiles using `Date.now()` as seed
- Deal 7 tiles per player via `dealHands()`
- Determine starting seat:
  - If `previousWinningSeat` is provided (non-null) → that seat starts
  - If `null` (Round 1 or block draw reset) → `findDoubleSixHolder(hands)`
- Create a `rounds` document:
  - `chain: []`, `openEnds: []` (empty until first tile played)
  - `currentTurn: startingSeat`
  - `consecutivePasses: 0`
  - `status: "active"`
- Update session’s `currentRoundId`

**This should be an `internalMutation`** (callable only from other server functions, not from clients).

**Args:** `{ sessionId, roundNumber, previousWinningSeat: number | null }`

#### 2.4 — `playTile` Mutation

File: `convex/mutations/rounds.ts`

**This is the most complex mutation. It is the core game loop.**

**Behavior:**

1. Validate (see below)
1. Remove the tile from the player’s hand
1. Append tile to the chain with placement metadata
1. Update `openEnds`:
- If chain was empty (first tile): `openEnds = [tile.high, tile.low]`
- If placed on left end: the new left open end is the tile’s other value
- If placed on right end: the new right open end is the tile’s other value
1. Reset `consecutivePasses` to 0
1. Check if the player’s hand is now empty:
- **Yes → Round won:** Set `status: "won"`, `winningSeat`, calculate points via `calculateDominoPoints()`, call `resolveRoundEnd` logic
- **No → Advance turn:** Set `currentTurn = nextSeat(currentTurn)`. Then check if the next player has any valid moves (`hasPlayableMove`). If not, auto-pass logic is handled client-side (or via a scheduled function).

**Validation pipeline (in order):**

1. Round `status === "active"` → error `ROUND_NOT_ACTIVE`
1. `currentTurn === player.seat` → error `NOT_YOUR_TURN`
1. Tile exists in player’s hand (`tilesEqual`) → error `TILE_NOT_IN_HAND`
1. If chain is empty: any tile is valid (first move). If chain is not empty: `tileMatchesEnd(tile, openEnds[chosenEnd])` → error `INVALID_PLACEMENT`

**Args:** `{ roundId, playerId, tile: { high, low }, end: "left" | "right" }`

**Critical detail on openEnds update:**

```typescript
// Playing tile {high: 5, low: 3} on the left end where openEnds[0] === 3
// The tile's "3" side connects to the chain, so the new left open end is "5"
// New openEnds = [5, openEnds[1]]

// If the tile is a double (e.g., {high: 3, low: 3}), the open end stays 3
```

#### 2.5 — `passTurn` Mutation

File: `convex/mutations/rounds.ts`

**Behavior:**

1. Validate the player has no playable moves (server re-checks — don’t trust the client)
1. Increment `consecutivePasses`
1. If `consecutivePasses === 4`:
- Call `resolveBlock(hands)`
- If result is `null` (draw): set `status: "draw"`, no points, call `startRound` with `previousWinningSeat: null` (triggers [6|6] start)
- If result has a winner: set `status: "blocked"`, `winningSeat`, call `resolveRoundEnd`
1. Else: advance turn to `nextSeat(currentTurn)`

**Validation:**

1. Round `status === "active"`
1. `currentTurn === player.seat`
1. `!hasPlayableMove(hand, openEnds)` → error `HAS_PLAYABLE_MOVE` (prevents intentional passing)

**Args:** `{ roundId, playerId }`

#### 2.6 — `resolveRoundEnd` Internal Logic

This runs inside `playTile` (when hand empties) or `passTurn` (when block with a winner). It can be a helper function, not a separate mutation.

**Behavior:**

1. Calculate `pointsScored` (already computed by caller)
1. Determine winning team: `session.players[winningSeat].team`
1. Update `session.teamScores[winningTeam] += pointsScored`
1. Check if `teamScores[winningTeam] >= 250`:
- **Yes:** Set `session.status = "finished"`, `session.winningTeam = winningTeam`
- **No:** Call `startRound` with `previousWinningSeat: winningSeat` (winner starts next round), increment round number
1. Update the round document: `winningSeat`, `winningTeam`, `pointsScored`, `status`

### Acceptance Criteria

- Creating and joining a session works end-to-end (4 players auto-starts a round)
- Playing a tile updates chain, openEnds, hand, and turn correctly
- Playing last tile triggers round win → scoring → next round (or match end)
- 4 consecutive passes trigger block resolution
- Block with a tie triggers draw → round reset with [6|6] start
- Invalid moves are rejected with typed errors
- Points accumulate across rounds; match ends at 250+

-----

## Phase 3: Queries (Client Data Layer)

### Goal

Implement all Convex queries that clients subscribe to. These define what each player can see. The critical invariant: **no client ever receives another player’s tile values.**

### Context for AI

Convex queries use `query({ args, handler })`. Clients subscribe to queries using the `useQuery` hook from `convex/react`. When underlying data changes, subscriptions automatically re-fire and the component re-renders. Design queries for minimal data transfer — return only what the component needs.

### Tasks

#### 3.1 — `getSession` Query

File: `convex/queries/sessions.ts`

**Returns:** Full session document (players, teamScores, status, winningTeam). This is safe because it contains no tile data.

**Args:** `{ sessionId }`

#### 3.2 — `getSessionByCode` Query

File: `convex/queries/sessions.ts`

**Returns:** Session document looked up by code. Used during the join flow.

**Args:** `{ code: string }`

#### 3.3 — `getMyHand` Query

**This is the security-critical query.**

**Returns:** Only the requesting player’s tiles from `round.hands[playerSeat]`. Never exposes any other player’s tiles.

**Implementation:**

```typescript
export const getMyHand = query({
  args: { roundId: v.id("rounds"), playerId: v.string() },
  handler: async (ctx, { roundId, playerId }) => {
    const round = await ctx.db.get(roundId);
    if (!round) return null;
    const session = await ctx.db.get(round.sessionId);
    if (!session) return null;

    const player = session.players.find((p) => p.id === playerId);
    if (!player) return null;

    return {
      tiles: round.hands[player.seat],
      canPlay: round.currentTurn === player.seat && round.status === "active",
    };
  },
});
```

**Args:** `{ roundId, playerId }`

#### 3.4 — `getRoundState` Query

**Returns:** Public round state visible to all players:

- `chain` (all played tiles — public information)
- `openEnds`
- `currentTurn`
- `consecutivePasses`
- `status`, `winningSeat`, `winningTeam`, `pointsScored`
- `tileCounts`: array of 4 numbers (how many tiles each player holds — NOT tile values)
- `roundNumber`

**Implementation detail:** Compute `tileCounts` from `round.hands.map(h => h.length)` inside the query.

**Args:** `{ roundId }`

#### 3.5 — `getRoundHistory` Query

**Returns:** Array of past completed rounds for the session, with `roundNumber`, `status`, `winningSeat`, `winningTeam`, `pointsScored`. Used for the scoreboard.

**Args:** `{ sessionId }`

### Acceptance Criteria

- `getMyHand` returns only 1 player’s tiles; returns `null` for invalid playerId
- `getRoundState` never includes raw `hands` data
- `getRoundHistory` returns rounds in ascending order
- All queries update reactively when mutations modify the underlying data

-----

## Phase 4: Player Identity & Session Join Flow

### Goal

Implement client-side player identity (no auth required) and the create/join UI.

### Context for AI

Players are identified by a randomly generated UUID stored in `localStorage`. No user accounts. The join flow is: host creates a session → gets a 6-char code → shares it → other players enter the code → once 4 players join, the game auto-starts. Use the Convex React provider (`ConvexProvider`) in the root layout.

### Tasks

#### 4.1 — Convex Provider Setup

File: `src/app/providers.tsx`

Wrap the app in `ConvexReactClient` and `ConvexProvider`. The Convex URL comes from `NEXT_PUBLIC_CONVEX_URL` env variable (set automatically by `npx convex dev`).

#### 4.2 — Player Identity Hook

File: `src/hooks/usePlayerId.ts`

```typescript
// Generate a UUID on first visit, persist in localStorage
// Return { playerId: string, playerName: string, setPlayerName: (name: string) => void }
```

**Important:** This is the ONLY identity mechanism. The `playerId` is passed to every mutation and query that needs to know who the caller is.

#### 4.3 — Landing Page (`/`)

File: `src/app/page.tsx`

**UI elements:**

- Name input field (persisted to localStorage via the hook)
- “Create Game” button → calls `createSession` mutation → navigates to `/game/[code]/lobby`
- “Join Game” section: 6-character code input → calls `joinSession` mutation → navigates to `/game/[code]/lobby`
- Error handling: show toast for SESSION_NOT_FOUND, SESSION_FULL

#### 4.4 — Lobby Page (`/game/[code]/lobby`)

File: `src/app/game/[code]/lobby/page.tsx`

**Subscribes to:** `getSession` (by code)

**UI elements:**

- Session code displayed prominently (with copy button)
- 4 player slots showing: name, team assignment (color-coded), connected status
- Seating visualization: show partners across from each other (seats 0+2, seats 1+3)
- Auto-redirect to `/game/[code]` when `session.status` changes to `"playing"`

### Acceptance Criteria

- Player ID persists across refreshes
- Creating a game produces a 6-char code and shows the lobby
- Joining with valid code adds the player and shows them in the lobby
- When 4th player joins, all 4 clients auto-navigate to the game page
- Invalid/full session codes show appropriate errors

-----

## Phase 5: Game Board UI

### Goal

Build the main game view — the board where tiles are played, the player’s hand, opponent indicators, and the turn system.

### Context for AI

This is the most visually complex component. The game board shows a chain of dominoes growing from the center. Each player’s hand is interactive (only when it’s their turn). Opponents’ hands show face-down tile counts. Use Tailwind CSS for layout. The board itself should use SVG or CSS grid — SVG gives more control over tile rotation and positioning. All data comes from Convex subscriptions (`useQuery`).

### Tasks

#### 5.1 — Game Page Layout

File: `src/app/game/[code]/page.tsx`

**Component tree:**

```
GamePage
├── GameProvider (context: session, round subscriptions)
│   ├── Scoreboard (sidebar or top bar)
│   ├── BoardArea
│   │   ├── OpponentHand (top — partner's teammate)
│   │   ├── OpponentHand (left — opponent)
│   │   ├── OpponentHand (right — opponent)
│   │   ├── BoardCanvas (center — the chain)
│   │   └── TurnIndicator (highlights active seat)
│   ├── PlayerHand (bottom — current player's tiles)
│   └── ActionBar (pass button, timer, game info)
```

**Subscriptions in GameProvider:**

```typescript
const session = useQuery(api.queries.sessions.getSession, { sessionId });
const roundState = useQuery(api.queries.rounds.getRoundState, {
  roundId: session?.currentRoundId,
});
const myHand = useQuery(api.queries.rounds.getMyHand, {
  roundId: session?.currentRoundId,
  playerId,
});
```

#### 5.2 — Domino Tile Component

File: `src/components/DominoTile.tsx`

**A single domino tile rendered as SVG or styled div.**

Props:

- `tile: { high: number, low: number }` — or `null` for face-down
- `orientation: "horizontal" | "vertical"` — doubles are perpendicular
- `isPlayable: boolean` — highlights when it can be placed
- `isSelected: boolean` — visual selection state
- `onClick: () => void`
- `faceDown: boolean` — for opponent hands

**Visual details:**

- Pip dots rendered as circles in standard domino positions
- Divider line between the two halves
- Rounded rectangle background
- Glow/highlight when playable

#### 5.3 — Board Canvas (Chain Rendering)

File: `src/components/BoardCanvas.tsx`

**This is the hardest UI component.** It renders the chain of played tiles.

**Layout algorithm:**

- Start from center of the board
- First tile placed at center
- Subsequent tiles extend left or right from the open ends
- Doubles are placed perpendicular (rotated 90°)
- When the chain reaches the edge of the viewport, it wraps (turns a corner) — this is the classic dominoes L-shape
- The board should be pannable/zoomable on mobile

**Input:** `chain: PlayedTile[]` from `getRoundState`

**Simplified approach for v1:** Render tiles in a horizontal flex/grid that scrolls, with doubles rotated. Defer the L-shaped wrapping to a polish phase.

#### 5.4 — Player Hand Component

File: `src/components/PlayerHand.tsx`

**Renders the current player’s 7 (or fewer) tiles at the bottom of the screen.**

**Interaction flow:**

1. On the player’s turn, tiles that match an open end are highlighted as playable
1. Tap a playable tile → it becomes selected
1. If the tile matches BOTH open ends, show two placement options (left/right)
1. If the tile matches only ONE end, auto-place on that end
1. Call `playTile` mutation with the tile and chosen end
1. Optimistic update: immediately remove tile from hand and append to chain

**When NOT the player’s turn:** Tiles are visible but dimmed and non-interactive.

#### 5.5 — Opponent Hand Indicators

File: `src/components/OpponentHand.tsx`

**Shows face-down tiles for each opponent.**

Props:

- `tileCount: number` — from `roundState.tileCounts[seat]`
- `playerName: string`
- `isCurrentTurn: boolean` — highlight when it’s their turn
- `position: "top" | "left" | "right"` — determines layout orientation

Render `tileCount` face-down domino tile components.

#### 5.6 — Turn Indicator & Auto-Pass

File: `src/components/TurnIndicator.tsx`

**Visual indicator of whose turn it is.** Highlights the active player’s area.

**Auto-pass logic (in PlayerHand or ActionBar):**

- When it becomes the player’s turn AND `hasPlayableMove` returns false (computed client-side from `myHand.tiles` and `roundState.openEnds`)
- Show a 3-second countdown: “No valid moves — passing in 3… 2… 1…”
- After countdown, call `passTurn` mutation
- The server re-validates that no moves exist (prevents cheating)

#### 5.7 — Scoreboard Component

File: `src/components/Scoreboard.tsx`

**Persistent display of:**

- Team A cumulative score and Team B cumulative score (from `session.teamScores`)
- Progress bar toward 250
- Round history list (from `getRoundHistory` query): each round shows winner and points

### Acceptance Criteria

- Board renders the chain correctly as tiles are played
- Player hand shows only their tiles, with correct playable highlighting
- Tile placement calls the mutation and updates optimistically
- Auto-pass fires when player has no valid moves
- Opponents’ tile counts update in real time
- Scoreboard reflects cumulative scores and round history

-----

## Phase 6: Round Transitions & Match End

### Goal

Handle the transitions between rounds (scoring interstitial) and the match end screen.

### Context for AI

When a round ends (status changes to `"won"`, `"blocked"`, or `"draw"`), the UI should show a brief interstitial overlay summarizing the round result before the next round begins. When the match ends (`session.status === "finished"`), navigate to a results page. All transitions are driven by reactive subscription updates — when the server sets `round.status` to `"won"`, every subscribed client sees it simultaneously.

### Tasks

#### 6.1 — Round End Interstitial

File: `src/components/RoundEndOverlay.tsx`

**Triggers when:** `roundState.status !== "active"`

**Displays based on status:**

- `"won"`: “[Player Name]’s team wins the round! +[X] points”
- `"blocked"`: “Blocked! [Player Name] had the lowest count. +[X] points to [Team]”
- `"draw"`: “Block is a draw! No points awarded. Reshuffling…”

**Shows:**

- Round points scored
- Updated cumulative team scores (with animation counting up)
- 5-second countdown before next round auto-starts

**The server already starts the next round in the mutation.** The client detects the new `currentRoundId` on the session and transitions its subscriptions to the new round data.

#### 6.2 — Match End Screen

File: `src/app/game/[code]/results/page.tsx`

**Triggers when:** `session.status === "finished"`

**Displays:**

- Winning team announcement with celebration animation
- Final scores
- Round-by-round breakdown table: round number, winner, points, running totals
- “Play Again” button → creates a new session with the same players (calls `createSession` then auto-joins all 4)

#### 6.3 — Subscription Transition Logic

In `GameProvider`, handle the round ID changing:

```typescript
// When session.currentRoundId changes, the getRoundState and getMyHand
// subscriptions automatically re-fire with the new roundId.
// No manual cleanup needed — Convex handles subscription lifecycle.

// Detect round transition:
const prevRoundId = useRef(session?.currentRoundId);
useEffect(() => {
  if (session?.currentRoundId !== prevRoundId.current) {
    // New round started — show/hide interstitial
    prevRoundId.current = session?.currentRoundId;
  }
}, [session?.currentRoundId]);
```

### Acceptance Criteria

- Round end overlay appears for all 4 players simultaneously
- Correct message shown for domino, block, and draw outcomes
- Scores animate up correctly
- New round starts after interstitial with correct starting player
- Match end navigates to results page
- Results show full round-by-round history

-----

## Phase 7: Presence, Reconnection & Error Handling

### Goal

Make the game resilient to disconnections, tab closures, and network issues.

### Context for AI

Convex doesn’t have built-in presence, but you can implement it with a heartbeat mutation that updates a `lastSeen` timestamp. Convex subscriptions automatically reconnect when the WebSocket re-establishes. The key challenge is handling turns when a player is disconnected — their turns should auto-pass after a timeout. Use Convex `scheduledFunctions` (cron-like) for server-side timeouts.

### Tasks

#### 7.1 — Heartbeat System

Create `convex/mutations/presence.ts`:

**`heartbeat` mutation:**

- Args: `{ sessionId, playerId }`
- Updates the player’s `connected: true` and a `lastSeen` field (add to schema if needed, or use a separate `presence` table)
- Called every 5 seconds from the client

**`checkPresence` scheduled function:**

- Runs every 10 seconds per active session
- If a player’s `lastSeen` is > 15 seconds ago, set `connected: false`
- If it’s that player’s turn, auto-call `passTurn` for them

#### 7.2 — Turn Timeout

In `convex/mutations/rounds.ts`, when `currentTurn` changes (in `playTile` or `passTurn`), schedule a delayed function:

```typescript
// Schedule auto-pass 15 seconds from now
await ctx.scheduler.runAfter(15000, internal.mutations.rounds.autoPass, {
  roundId,
  expectedTurn: nextTurn,
});
```

In `autoPass`:

```typescript
// Only execute if the turn hasn't advanced (player didn't move in time)
const round = await ctx.db.get(roundId);
if (round.currentTurn === expectedTurn && round.status === "active") {
  // Force pass
  await passTurnLogic(ctx, round, expectedTurn);
}
```

#### 7.3 — Reconnection Flow

Client-side in `GameProvider`:

- On mount, check if `playerId` exists in `localStorage`
- Query session by code from URL
- If player is in the session’s player list → restore state (subscriptions auto-fire)
- If not found → redirect to landing page

#### 7.4 — Error Boundaries

File: `src/components/ErrorBoundary.tsx`

- Wrap `GamePage` in a React error boundary
- On Convex mutation errors, show toast notifications (not full-page errors):
  - `NOT_YOUR_TURN` → “It’s not your turn”
  - `INVALID_PLACEMENT` → “That tile doesn’t fit there” (with shake animation)
  - `ROUND_NOT_ACTIVE` → (silently ignore, round is transitioning)
- On subscription disconnection, show a “Reconnecting…” banner

#### 7.5 — Forfeit Logic

In `checkPresence` scheduled function:

- If both players on a team have `connected: false` for > 60 seconds:
  - Set `session.status = "finished"`
  - Set `session.winningTeam` to the other team
  - Set a `forfeit: true` flag for the results screen

### Acceptance Criteria

- Player refreshing the page rejoins seamlessly (same seat, same hand)
- Disconnected player’s turns auto-pass after 15 seconds
- All 4 clients see the disconnection indicator on the disconnected player
- Team forfeit triggers after 60s of both teammates disconnected
- Mutation errors show user-friendly toasts, not crashes

-----

## Phase 8: Optimistic Updates & Animations

### Goal

Make the game feel instant and alive with optimistic mutations and polished animations.

### Context for AI

Convex supports optimistic updates via the `optimisticUpdate` option on `useMutation`. When a player plays a tile, the UI should immediately reflect the change before the server confirms. If the server rejects the mutation, the optimistic state is rolled back automatically. For animations, use CSS transitions/animations and Framer Motion (or CSS-only for simpler effects).

### Tasks

#### 8.1 — Optimistic Tile Placement

In the `playTile` mutation call:

```typescript
const playTile = useMutation(api.mutations.rounds.playTile).withOptimisticUpdate(
  (localStore, args) => {
    // Get current round state from local cache
    const roundState = localStore.getQuery(api.queries.rounds.getRoundState, {
      roundId: args.roundId,
    });
    if (!roundState) return;

    // Optimistically remove tile from hand
    const myHand = localStore.getQuery(api.queries.rounds.getMyHand, {
      roundId: args.roundId,
      playerId: args.playerId,
    });
    if (!myHand) return;

    localStore.setQuery(api.queries.rounds.getMyHand, {
      roundId: args.roundId,
      playerId: args.playerId,
    }, {
      ...myHand,
      tiles: myHand.tiles.filter(
        (t) => !(t.high === args.tile.high && t.low === args.tile.low)
      ),
    });
  }
);
```

#### 8.2 — Tile Animations

- **Tile play:** Animate tile from hand to its position on the chain (translate + scale)
- **Pass indicator:** Flash a “PASS” badge on the passing player’s area
- **Score increment:** Animate the number counting up when points are awarded
- **Turn highlight:** Pulse/glow effect on the active player’s zone
- **Round transition:** Fade overlay in, display results, fade out, new tiles deal in (fan animation)

#### 8.3 — Sound Effects (Optional)

- Tile click/place sound
- Pass sound
- Round win fanfare
- Match win celebration

### Acceptance Criteria

- Playing a tile feels instant (< 50ms to visual update)
- If server rejects a move, the tile animates back to the hand
- Animations don’t block interaction
- Score changes animate smoothly

-----

## Phase 9: Responsive Design & Polish

### Goal

Make the game playable on mobile and desktop with a polished, professional UI.

### Context for AI

The primary play context is mobile (phones held in portrait). The board should fill the screen. The player’s hand should be at the bottom, easily tappable. Desktop should use the extra space for a better scoreboard layout. Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`) and test at 375px (iPhone SE), 390px (iPhone 14), and 1440px (desktop).

### Tasks

#### 9.1 — Mobile Layout

- Player hand at bottom: tiles in a horizontal scrollable row, 48–56px per tile
- Board in center: scrollable/pannable
- Opponent hands: compact indicators at top, left, right
- Scoreboard: collapsible drawer or minimal top bar
- Touch targets: minimum 44x44px for all interactive elements

#### 9.2 — Desktop Layout

- Player hand at bottom: tiles larger, with hover states
- Board in center with more visible area
- Scoreboard as a persistent sidebar (right side)
- Opponent hands with more detail (show tile backs)

#### 9.3 — Visual Polish

- Domino tile design: cream/ivory colored tiles with dark pips, subtle shadow
- Board surface: green felt texture or dark wood grain
- Team colors: consistent throughout (e.g., blue vs orange)
- Typography: clear player names and scores
- Loading states: skeleton UI for subscriptions
- Empty states: “Waiting for players…” in lobby

#### 9.4 — Accessibility

- All interactive elements focusable and keyboard-navigable
- Aria labels on tiles (“Double six”, “Five-three”)
- High contrast mode support via Tailwind `dark:` variants
- Screen reader announcements for turn changes and game events

### Acceptance Criteria

- Game is fully playable on iPhone SE (375px width)
- Desktop layout uses space efficiently
- All tiles are tappable without mis-taps on mobile
- Loading/empty states are shown appropriately

-----

## Phase 10: Testing & Deployment

### Goal

Verify the entire game works end-to-end and deploy to production.

### Tasks

#### 10.1 — Game Logic Unit Tests

File: `convex/__tests__/gameLogic.test.ts`

Test every function in `gameLogic.ts`:

- `shuffleTiles`: deterministic with same seed, all 28 tiles present, no duplicates
- `dealHands`: 4 arrays of 7, no tile appears twice
- `findDoubleSixHolder`: correct seat for all possible deals
- `tileMatchesEnd`: all valid/invalid combos
- `hasPlayableMove`: true/false cases
- `pipCount`: various hands
- `resolveBlock`: clear winner, tie (returns null), edge cases
- `calculateDominoPoints`: winner excluded from sum
- `tilesEqual`: same tile, different tile, reversed (already normalized)

#### 10.2 — Mutation Integration Tests

Use Convex’s testing utilities (`convex-test`):

- Full game flow: create → join × 4 → play tiles → round ends → scores update → next round → match ends
- Block scenario: force a blocked board, verify resolution
- Draw scenario: force tied pip counts, verify round reset with [6|6] start
- Error cases: play out of turn, play invalid tile, play after round ends
- Reconnection: player leaves and rejoins mid-round

#### 10.3 — End-to-End Testing

Use Playwright or Cypress with 4 browser contexts:

- Full match simulation: 4 tabs, each playing as a different player
- Verify all 4 UIs stay in sync
- Verify turn enforcement (can’t click tiles when not your turn)
- Verify score accumulation across multiple rounds
- Verify match end at 250+

#### 10.4 — Deploy

1. Deploy Convex backend: `npx convex deploy`
1. Deploy Next.js frontend to Vercel:
- Set `NEXT_PUBLIC_CONVEX_URL` to production Convex URL
- `vercel --prod`
1. Smoke test in production: create a session, play a full round with 4 devices

### Acceptance Criteria

- All unit tests pass
- Integration tests cover the happy path and all edge cases
- E2E test confirms 4-player sync works
- Production deployment is functional with < 200ms sync latency

-----

## Appendix A: File Structure

```
dominoes-2v2/
├── convex/
│   ├── schema.ts                    # Table definitions
│   ├── types.ts                     # Shared types (Tile, Player, etc.)
│   ├── gameLogic.ts                 # Pure game logic functions
│   ├── mutations/
│   │   ├── sessions.ts              # createSession, joinSession
│   │   ├── rounds.ts                # startRound, playTile, passTurn, autoPass
│   │   └── presence.ts              # heartbeat, checkPresence
│   ├── queries/
│   │   ├── sessions.ts              # getSession, getSessionByCode
│   │   └── rounds.ts                # getMyHand, getRoundState, getRoundHistory
│   └── __tests__/
│       ├── gameLogic.test.ts
│       └── mutations.test.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout with ConvexProvider
│   │   ├── providers.tsx            # ConvexReactClient setup
│   │   ├── page.tsx                 # Landing: create/join
│   │   └── game/
│   │       └── [code]/
│   │           ├── page.tsx         # Main game view
│   │           ├── lobby/
│   │           │   └── page.tsx     # Pre-game lobby
│   │           └── results/
│   │               └── page.tsx     # Match results
│   ├── components/
│   │   ├── DominoTile.tsx           # Single tile SVG
│   │   ├── BoardCanvas.tsx          # Chain rendering
│   │   ├── PlayerHand.tsx           # Current player's interactive hand
│   │   ├── OpponentHand.tsx         # Face-down tile indicators
│   │   ├── TurnIndicator.tsx        # Active turn highlight
│   │   ├── Scoreboard.tsx           # Team scores + round history
│   │   ├── ActionBar.tsx            # Pass button, timer, controls
│   │   ├── RoundEndOverlay.tsx      # Round result interstitial
│   │   ├── GameProvider.tsx         # Subscription context
│   │   └── ErrorBoundary.tsx        # Error handling wrapper
│   └── hooks/
│       ├── usePlayerId.ts           # localStorage player identity
│       └── useGameState.ts          # Aggregated game state hook
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

## Appendix B: Convex Function Reference

|Function          |Type            |File                 |Args                                             |
|------------------|----------------|---------------------|-------------------------------------------------|
|`createSession`   |mutation        |mutations/sessions.ts|`{}`                                             |
|`joinSession`     |mutation        |mutations/sessions.ts|`{ code, playerId, name }`                       |
|`startRound`      |internalMutation|mutations/rounds.ts  |`{ sessionId, roundNumber, previousWinningSeat }`|
|`playTile`        |mutation        |mutations/rounds.ts  |`{ roundId, playerId, tile, end }`               |
|`passTurn`        |mutation        |mutations/rounds.ts  |`{ roundId, playerId }`                          |
|`autoPass`        |internalMutation|mutations/rounds.ts  |`{ roundId, expectedTurn }`                      |
|`heartbeat`       |mutation        |mutations/presence.ts|`{ sessionId, playerId }`                        |
|`checkPresence`   |scheduled       |mutations/presence.ts|`{ sessionId }`                                  |
|`getSession`      |query           |queries/sessions.ts  |`{ sessionId }`                                  |
|`getSessionByCode`|query           |queries/sessions.ts  |`{ code }`                                       |
|`getMyHand`       |query           |queries/rounds.ts    |`{ roundId, playerId }`                          |
|`getRoundState`   |query           |queries/rounds.ts    |`{ roundId }`                                    |
|`getRoundHistory` |query           |queries/rounds.ts    |`{ sessionId }`                                  |

## Appendix C: Error Codes

|Code                |Thrown By         |Meaning                               |
|--------------------|------------------|--------------------------------------|
|`SESSION_NOT_FOUND` |joinSession       |No session with that code             |
|`SESSION_FULL`      |joinSession       |Already 4 players or game started     |
|`INVALID_NAME`      |joinSession       |Name empty or > 16 chars              |
|`NOT_YOUR_TURN`     |playTile, passTurn|currentTurn !== player.seat           |
|`TILE_NOT_IN_HAND`  |playTile          |Player doesn’t hold that tile         |
|`INVALID_PLACEMENT` |playTile          |Tile doesn’t match the chosen open end|
|`ROUND_NOT_ACTIVE`  |playTile, passTurn|Round already ended                   |
|`HAS_PLAYABLE_MOVE` |passTurn          |Player tried to pass with valid moves |
|`SESSION_NOT_ACTIVE`|playTile, passTurn|Match already finished                |