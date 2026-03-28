"use client";

import { useGame } from "./GameProvider";

export function TurnIndicator({ currentTurn, mySeat }: { currentTurn: number, mySeat: number }) {
    const { session } = useGame();
    
    if (session.status !== "playing") return null;

    const player = session.players.find((p: any) => p.seat === currentTurn);
    if (!player) return null;

    const isMe = currentTurn === mySeat;

    return (
        <div className="absolute inset-x-0 bottom-4 sm:bottom-6 flex justify-center pointer-events-none z-10">
            <div className={`px-8 py-3 rounded-full font-bold shadow-2xl transition-all duration-300 ${isMe ? "bg-amber-400 text-amber-950 scale-110 shadow-amber-400/50" : "bg-slate-800 text-slate-200 border border-slate-600 opacity-80"}`}>
                {isMe ? "It's Your Turn!" : `Waiting on ${player.name}...`}
            </div>
        </div>
    );
}
