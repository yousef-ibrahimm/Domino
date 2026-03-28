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
        lastSeen: v.optional(v.number()),
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
