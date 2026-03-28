import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import {
  shuffleTiles,
  dealHands,
  findDoubleSixHolder,
  tileMatchesEnd,
  hasPlayableMove,
  resolveBlock,
  calculateDominoPoints,
  tilesEqual,
  nextSeat
} from "../gameLogic";

export const startRound = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    roundNumber: v.number(),
    previousWinningSeat: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("SESSION_NOT_FOUND");

    // Shuffle and deal
    const shuffled = shuffleTiles(Date.now());
    const hands = dealHands(shuffled);

    // Determine starter
    const startingSeat =
      args.previousWinningSeat !== null
        ? args.previousWinningSeat
        : findDoubleSixHolder(hands);

    const roundId = await ctx.db.insert("rounds", {
      sessionId: args.sessionId,
      roundNumber: args.roundNumber,
      hands,
      chain: [],
      openEnds: [],
      currentTurn: startingSeat,
      consecutivePasses: 0,
      status: "active",
      startingSeat,
    });

    await ctx.db.patch(args.sessionId, { currentRoundId: roundId });

    // Start 15s turn timeout
    await ctx.scheduler.runAfter(15000, internal.mutations.rounds.autoPass, {
      roundId,
      expectedTurn: startingSeat,
    });
  },
});

async function resolveRoundEnd(ctx: any, round: any, session: any, points: number) {
  const winningTeam = session.players.find((p: any) => p.seat === round.winningSeat)?.team;
  if (winningTeam === undefined) throw new Error("WINNING_TEAM_NOT_FOUND");

  const newScores = [...session.teamScores];
  newScores[winningTeam] += points;

  await ctx.db.patch(round._id, {
    status: round.status,
    winningSeat: round.winningSeat,
    winningTeam: winningTeam,
    pointsScored: points,
    hands: round.hands,
    chain: round.chain,
    openEnds: round.openEnds,
    consecutivePasses: round.consecutivePasses,
  });

  if (newScores[winningTeam] >= 250) {
    await ctx.db.patch(session._id, {
      status: "finished",
      teamScores: newScores,
      winningTeam: winningTeam,
    });
  } else {
    await ctx.db.patch(session._id, {
      teamScores: newScores,
    });
    
    // Auto start next round after 5 seconds to show interstitial
    await ctx.scheduler.runAfter(5000, internal.mutations.rounds.startRound, {
      sessionId: session._id,
      roundNumber: round.roundNumber + 1,
      previousWinningSeat: round.winningSeat,
    });
  }
}

export const playTile = mutation({
  args: {
    roundId: v.id("rounds"),
    playerId: v.string(),
    tile: v.object({ high: v.number(), low: v.number() }),
    end: v.union(v.literal("left"), v.literal("right")),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("ROUND_NOT_FOUND");
    if (round.status !== "active") throw new Error("ROUND_NOT_ACTIVE");

    const session = await ctx.db.get(round.sessionId);
    if (!session || session.status !== "playing") throw new Error("SESSION_NOT_ACTIVE");

    const player = session.players.find(p => p.id === args.playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");

    if (round.currentTurn !== player.seat) throw new Error("NOT_YOUR_TURN");

    // Validate tile in hand
    const hand = round.hands[player.seat];
    const tileIndex = hand.findIndex(t => tilesEqual(t, args.tile));
    if (tileIndex === -1) throw new Error("TILE_NOT_IN_HAND");

    // Validate placement and calculate new open ends
    let newOpenEnds = [...round.openEnds];
    if (round.chain.length === 0) {
      newOpenEnds = [args.tile.high, args.tile.low];
    } else {
      if (args.end === "left") {
        if (!tileMatchesEnd(args.tile, newOpenEnds[0])) {
          throw new Error("INVALID_PLACEMENT");
        }
        // The tile's matching side connects; the new open side is the other one
        newOpenEnds[0] = args.tile.high === newOpenEnds[0] ? args.tile.low : args.tile.high;
      } else {
        if (!tileMatchesEnd(args.tile, newOpenEnds[1])) {
          throw new Error("INVALID_PLACEMENT");
        }
        newOpenEnds[1] = args.tile.high === newOpenEnds[1] ? args.tile.low : args.tile.high;
      }
    }

    // Apply the played tile
    hand.splice(tileIndex, 1);
    round.hands[player.seat] = hand;
    
    round.chain.push({
      high: args.tile.high,
      low: args.tile.low,
      seat: player.seat,
      end: args.end,
      timestamp: Date.now(),
    });

    round.openEnds = newOpenEnds;
    round.consecutivePasses = 0;

    // Check win condition
    if (hand.length === 0) {
      round.status = "won";
      round.winningSeat = player.seat;
      const points = calculateDominoPoints(round.hands, round.winningSeat);
      
      await resolveRoundEnd(ctx, round, session, points);
    } else {
      round.currentTurn = nextSeat(round.currentTurn);
      await ctx.db.patch(round._id, {
        hands: round.hands,
        chain: round.chain,
        openEnds: round.openEnds,
        consecutivePasses: round.consecutivePasses,
        currentTurn: round.currentTurn,
      });

      // Schedule timeout for next player
      await ctx.scheduler.runAfter(15000, internal.mutations.rounds.autoPass, {
        roundId: round._id,
        expectedTurn: round.currentTurn,
      });
    }
  },
});

export const passTurn = mutation({
  args: {
    roundId: v.id("rounds"),
    playerId: v.string(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) throw new Error("ROUND_NOT_FOUND");
    if (round.status !== "active") throw new Error("ROUND_NOT_ACTIVE");

    const session = await ctx.db.get(round.sessionId);
    if (!session || session.status !== "playing") throw new Error("SESSION_NOT_ACTIVE");

    const player = session.players.find(p => p.id === args.playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");

    if (round.currentTurn !== player.seat) throw new Error("NOT_YOUR_TURN");

    const hand = round.hands[player.seat];
    if (hasPlayableMove(hand, round.openEnds)) {
      throw new Error("HAS_PLAYABLE_MOVE");
    }

    round.consecutivePasses += 1;

    if (round.consecutivePasses >= 4) {
      const blockResult = resolveBlock(round.hands);
      
      if (blockResult === null) {
        // Draw
        round.status = "draw";
        await ctx.db.patch(round._id, {
          status: round.status,
          consecutivePasses: round.consecutivePasses,
        });
        
        await ctx.scheduler.runAfter(5000, internal.mutations.rounds.startRound, {
          sessionId: session._id,
          roundNumber: round.roundNumber + 1,
          previousWinningSeat: null, // Reset with [6|6] start
        });
      } else {
        // Winner
        round.status = "blocked";
        round.winningSeat = blockResult.winningSeat;
        await resolveRoundEnd(ctx, round, session, blockResult.points);
      }
    } else {
      // Advance turn
      round.currentTurn = nextSeat(round.currentTurn);
      await ctx.db.patch(round._id, {
        consecutivePasses: round.consecutivePasses,
        currentTurn: round.currentTurn,
      });

      await ctx.scheduler.runAfter(15000, internal.mutations.rounds.autoPass, {
        roundId: round._id,
        expectedTurn: round.currentTurn,
      });
    }
  },
});

export const autoPass = internalMutation({
  args: {
    roundId: v.id("rounds"),
    expectedTurn: v.number(),
  },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round || round.status !== "active" || round.currentTurn !== args.expectedTurn) return;

    const session = await ctx.db.get(round.sessionId);
    if (!session || session.status !== "playing") return;

    round.consecutivePasses += 1;

    if (round.consecutivePasses >= 4) {
      const blockResult = resolveBlock(round.hands);
      
      if (blockResult === null) {
        round.status = "draw";
        await ctx.db.patch(round._id, {
          status: round.status,
          consecutivePasses: round.consecutivePasses,
        });
        
        await ctx.scheduler.runAfter(5000, internal.mutations.rounds.startRound, {
          sessionId: session._id,
          roundNumber: round.roundNumber + 1,
          previousWinningSeat: null,
        });
      } else {
        round.status = "blocked";
        round.winningSeat = blockResult.winningSeat;
        const points = calculateDominoPoints(round.hands, blockResult.winningSeat);
        await resolveRoundEnd(ctx, round, session, points);
      }
    } else {
      round.currentTurn = nextSeat(round.currentTurn);
      await ctx.db.patch(round._id, {
        consecutivePasses: round.consecutivePasses,
        currentTurn: round.currentTurn,
      });

      await ctx.scheduler.runAfter(15000, internal.mutations.rounds.autoPass, {
        roundId: round._id,
        expectedTurn: round.currentTurn,
      });
    }
  },
});
