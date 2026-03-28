import { query } from "../_generated/server";
import { v } from "convex/values";

export const getMyHand = query({
  args: { roundId: v.id("rounds"), playerId: v.string() },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) return null;
    const session = await ctx.db.get(round.sessionId);
    if (!session) return null;

    const player = session.players.find((p) => p.id === args.playerId);
    if (!player) return null;

    return {
      tiles: round.hands[player.seat],
      canPlay: round.currentTurn === player.seat && round.status === "active",
    };
  },
});

export const getRoundState = query({
  args: { roundId: v.id("rounds") },
  handler: async (ctx, args) => {
    const round = await ctx.db.get(args.roundId);
    if (!round) return null;

    return {
      chain: round.chain,
      openEnds: round.openEnds,
      currentTurn: round.currentTurn,
      consecutivePasses: round.consecutivePasses,
      status: round.status,
      winningSeat: round.winningSeat,
      winningTeam: round.winningTeam,
      pointsScored: round.pointsScored,
      tileCounts: round.hands.map((h) => h.length),
      roundNumber: round.roundNumber,
    };
  },
});

export const getRoundHistory = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const rounds = await ctx.db
      .query("rounds")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Only return completed rounds, sorted by roundNumber ascending
    return rounds
      .filter((r) => r.status !== "active")
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((r) => ({
        roundNumber: r.roundNumber,
        status: r.status,
        winningSeat: r.winningSeat,
        winningTeam: r.winningTeam,
        pointsScored: r.pointsScored,
      }));
  },
});
