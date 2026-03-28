"use client";

import { DominoTile } from "./DominoTile";

export function OpponentHand({ player, tileCount, isCurrentTurn, position }: { player: any, tileCount: number, isCurrentTurn: boolean, position: "top" | "left" | "right" }) {
    
    const isTop = position === "top";
    const teamColors = player.team === 0 ? "text-blue-400" : "text-orange-400";
    
    const containerClasses = isTop 
        ? "flex flex-col items-center" 
        : "flex flex-col items-center";
    
    const tileContainerClass = isTop
        ? "flex gap-1 sm:gap-2 justify-center"
        : "flex flex-col gap-1 sm:gap-2 justify-center -space-y-4 sm:-space-y-6";

    return (
        <div className={`${containerClasses} p-2 sm:p-4 rounded-xl transition-colors duration-300 ${isCurrentTurn ? "bg-slate-800/80 border border-slate-600 shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "opacity-80 scale-90"}`}>
            
            {!isTop && <div className={`font-bold text-sm mb-4 ${teamColors} truncate w-24 text-center ${isCurrentTurn ? "animate-pulse" : ""}`}>{player.name} {isCurrentTurn && "⏳"}</div>}

            <div className={tileContainerClass}>
                {Array.from({ length: tileCount }).map((_, i) => (
                    <div key={i} className={!isTop ? "transform rotate-90" : ""}>
                       <div style={{ scale: isTop ? 0.7 : 0.6 }}>
                          <DominoTile tile={null} faceDown={true} orientation="vertical" />
                       </div>
                    </div>
                ))}
            </div>

            {isTop && <div className={`font-bold mt-2 ${teamColors} ${isCurrentTurn ? "animate-pulse" : ""}`}>{player.name} (Partner) {isCurrentTurn && "⏳"}</div>}

        </div>
    );
}
