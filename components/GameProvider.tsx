"use client";

import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { usePlayerId } from "../../hooks/usePlayerId";
import { useParams, useRouter } from "next/navigation";

type GameContextType = {
  session: any;
  roundState: any;
  myHand: any;
  playerId: string;
  playerName: string;
};

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { code } = useParams();
  const router = useRouter();
  const { playerId, playerName, isLoaded } = usePlayerId();

  const session = useQuery(api.queries.sessions.getSessionByCode, 
    { code: code as string }
  );

  const roundState = useQuery(api.queries.rounds.getRoundState, 
    session?.currentRoundId ? { roundId: session.currentRoundId } : "skip"
  );

  const myHand = useQuery(api.queries.rounds.getMyHand, 
    session?.currentRoundId && playerId ? { roundId: session.currentRoundId, playerId } : "skip"
  );

  const heartbeat = useMutation(api.mutations.presence.heartbeat);

  useEffect(() => {
    if (!session || !playerId || session.status === "finished") return;

    const interval = setInterval(() => {
      heartbeat({ sessionId: session._id, playerId }).catch(e => console.error(e));
    }, 5000);

    return () => clearInterval(interval);
  }, [session, playerId, heartbeat]);

  const prevRoundId = useRef(session?.currentRoundId);

  useEffect(() => {
    if (!isLoaded || session === undefined) return;
    
    // Auth guard
    if (session === null) {
      router.push("/");
      return;
    }
    const playerInSession = session.players.find((p: any) => p.id === playerId);
    if (!playerInSession) {
      router.push("/");
      return;
    }

    // Match finished guard
    if (session.status === "finished") {
      router.push(`/game/${code}/results`);
      return;
    }

    // Round transition logic (we'll expand this in Phase 6 for interstitials)
    if (session.currentRoundId !== prevRoundId.current) {
      prevRoundId.current = session.currentRoundId;
    }
  }, [session, isLoaded, playerId, router, code]);

  if (!isLoaded || typeof session === "undefined" || typeof roundState === "undefined" || typeof myHand === "undefined") {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading Game State...</div>;
  }

  if (!session) return null; // will redirect in useEffect

  return (
    <GameContext.Provider value={{ session, roundState, myHand, playerId, playerName }}>
      {children}
    </GameContext.Provider>
  );
}
