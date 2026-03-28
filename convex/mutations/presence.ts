import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const heartbeat = mutation({
  args: { sessionId: v.id("sessions"), playerId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status === "finished") return;

    const playerIndex = session.players.findIndex(p => p.id === args.playerId);
    if (playerIndex === -1) return;

    session.players[playerIndex].connected = true;
    session.players[playerIndex].lastSeen = Date.now();

    await ctx.db.patch(session._id, { players: session.players });
  },
});

export const checkPresence = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status === "finished") return;

    const now = Date.now();
    let modified = false;

    // Disconnect stale players (15 seconds without heartbeat)
    for (let i = 0; i < session.players.length; i++) {
        const p = session.players[i];
        if (p.connected && p.lastSeen && (now - p.lastSeen > 15000)) {
            session.players[i].connected = false;
            modified = true;
            
            // If it's this player's turn, auto-pass immediately so the game isn't stuck waiting for the 15s turn timer
            if (session.currentRoundId) {
                const round = await ctx.db.get(session.currentRoundId);
                if (round && round.status === "active" && round.currentTurn === p.seat) {
                    await ctx.scheduler.runAfter(0, internal.mutations.rounds.autoPass, {
                        roundId: round._id,
                        expectedTurn: p.seat,
                    });
                }
            }
        }
    }

    // Forfeit logic: if an entire team is disconnected for 60 seconds, end the game.
    let t0Forfeit = false;
    let t1Forfeit = false;
    
    const t0Players = session.players.filter(p => p.team === 0);
    const t1Players = session.players.filter(p => p.team === 1);

    const isTeamDisconnected = (team: any[]) => {
        return team.length > 0 && team.every((p: any) => !p.connected && p.lastSeen && (now - p.lastSeen > 60000));
    };

    if (t0Players.length === 2 && isTeamDisconnected(t0Players)) t0Forfeit = true;
    if (t1Players.length === 2 && isTeamDisconnected(t1Players)) t1Forfeit = true;

    if (t0Forfeit || t1Forfeit) {
        const winningTeam = t0Forfeit && t1Forfeit ? undefined : (t0Forfeit ? 1 : 0);
        await ctx.db.patch(session._id, {
            status: "finished",
            winningTeam: winningTeam,
        });
        modified = true;
    } else if (modified) {
        await ctx.db.patch(session._id, { players: session.players });
    }

    // Re-schedule this check if game is still active
    if (session.status === "playing" && !(t0Forfeit || t1Forfeit)) {
        await ctx.scheduler.runAfter(10000, internal.mutations.presence.checkPresence, {
            sessionId: session._id,
        });
    }
  },
});
