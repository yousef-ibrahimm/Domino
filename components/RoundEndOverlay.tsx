"use client";

import { useGame } from "./GameProvider";

export function RoundEndOverlay() {
    const { session, roundState } = useGame();

    if (roundState.status === "active") return null;

    let message = "";
    let subMessage = "";

    const winningPlayer = session.players.find((p: any) => p.seat === roundState.winningSeat);
    const winningTeamName = roundState.winningTeam === 0 ? "Team Blue" : "Team Orange";

    if (roundState.status === "won") {
        message = `${winningPlayer ? winningPlayer.name : winningTeamName} dominoed!`;
        subMessage = `+${roundState.pointsScored} points to ${winningTeamName}`;
    } else if (roundState.status === "blocked") {
        message = "Game Blocked!";
        subMessage = `${winningPlayer ? winningPlayer.name : "Someone"} had the lowest pip count. +${roundState.pointsScored} points to ${winningTeamName}`;
    } else if (roundState.status === "draw") {
        message = "Draw!";
        subMessage = "Players tied for lowest pip count. No points awarded.";
    }

    return (
        <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500 font-sans p-6 text-center">
            <h2 className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-2xl scale-in-center animate-in zoom-in spin-in-2 duration-700">{message}</h2>
            <p className="text-xl md:text-3xl font-bold text-amber-400 drop-shadow-lg mb-12 animate-in slide-in-from-bottom-6">{subMessage}</p>
            
            <div className="flex gap-8 md:gap-16 mb-16 animate-in slide-in-from-bottom-12">
               <div className="flex flex-col items-center bg-slate-800/80 p-6 md:p-8 rounded-2xl border-t-4 border-blue-500 shadow-2xl">
                  <span className="text-blue-400 font-bold uppercase tracking-widest text-sm md:text-base mb-2">Team Blue Total</span>
                  <span className="text-6xl md:text-7xl font-black text-white">{session.teamScores[0]}</span>
               </div>
               <div className="flex flex-col items-center bg-slate-800/80 p-6 md:p-8 rounded-2xl border-t-4 border-orange-500 shadow-2xl">
                  <span className="text-orange-400 font-bold uppercase tracking-widest text-sm md:text-base mb-2">Team Orange Total</span>
                  <span className="text-6xl md:text-7xl font-black text-white">{session.teamScores[1]}</span>
               </div>
            </div>

            <div className="text-slate-400 font-medium animate-pulse text-lg tracking-wide bg-slate-800 px-6 py-3 rounded-full shadow-inner">
                Next round starting shortly...
            </div>
        </div>
    );
}
