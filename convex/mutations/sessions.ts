import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

function generateCode() {
  // Simple 6-char alphanumeric code
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    let code: string;
    let existing;
    do {
      code = generateCode();
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

export const joinSession = mutation({
  args: { code: v.string(), playerId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();

    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (args.name.length < 1 || args.name.length > 16) throw new Error("INVALID_NAME");

    const existingPlayerIndex = session.players.findIndex(p => p.id === args.playerId);
    
    if (existingPlayerIndex >= 0) {
      // Reconnect existing player
      session.players[existingPlayerIndex].connected = true;
      session.players[existingPlayerIndex].name = args.name;
      await ctx.db.replace(session._id, session);
      return { sessionId: session._id };
    }

    if (session.status !== "waiting" || session.players.length >= 4) {
      throw new Error("SESSION_FULL");
    }

    const seat = session.players.length;
    session.players.push({
      id: args.playerId,
      name: args.name,
      seat: seat,
      team: seat % 2,
      connected: true,
    });

    if (session.players.length === 4) {
      session.status = "playing";
      await ctx.db.replace(session._id, session);
      
      // Auto-start the first round
      await ctx.scheduler.runAfter(0, internal.mutations.rounds.startRound, {
        sessionId: session._id,
        roundNumber: 1,
        previousWinningSeat: null,
      });

      // Start presence check loop
      await ctx.scheduler.runAfter(10000, internal.mutations.presence.checkPresence, {
        sessionId: session._id,
      });
    } else {
      await ctx.db.replace(session._id, session);
    }
    
    return { sessionId: session._id };
  },
});
