"use client";

import { useGame } from "./GameProvider";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { hasPlayableMove } from "../convex/gameLogic";
import { useSound } from "../hooks/useSound";

export function ActionBar() {
    const { session, roundState, myHand, playerId, playerName } = useGame();
    const passTurn = useMutation(api.mutations.rounds.passTurn);
    const { isMuted, toggleMute } = useSound("");

    const isMyTurn = myHand?.canPlay;
    const canForcePass = isMyTurn && !hasPlayableMove(myHand.tiles, roundState.openEnds);

    const handlePass = async () => {
        if (!canForcePass) return;
        try {
            await passTurn({ roundId: session.currentRoundId, playerId });
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="flex items-center justify-between w-full h-12 bg-slate-900 rounded-lg px-4 shadow-md font-sans">
            
            <div className="flex items-center gap-4">
                <div className="text-slate-300 font-bold text-sm truncate max-w-[150px] sm:max-w-xs">
                     {playerName} {roundState?.consecutivePasses > 0 && <span className="text-slate-500 ml-2 text-xs">({roundState.consecutivePasses} passes)</span>}
                </div>
                
                <button 
                  onClick={toggleMute} 
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                  title={isMuted ? "Unmute Sound" : "Mute Sound"}
                >
                    {isMuted ? "🔇" : "🔊"}
                </button>
            </div>
            
            <div>
               {canForcePass ? (
                   <button 
                      onClick={handlePass} 
                      className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-4 rounded text-sm transition-all shadow-[0_0_10px_rgba(220,38,38,0.6)] animate-pulse"
                   >
                     Pass (No valid moves)
                   </button>
               ) : (
                   <div className="text-xs text-slate-500 italic">
                       {isMyTurn ? "Select a valid tile to play" : "Waiting for turn..."}
                   </div>
               )}
            </div>

        </div>
    );
}
