"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { usePlayerId } from "../../../../hooks/usePlayerId";

export default function ResultsPage() {
    const { code } = useParams();
    const router = useRouter();
    const { isLoaded } = usePlayerId();

    const session = useQuery(api.queries.sessions.getSessionByCode, { code: code as string });
    const history = useQuery(api.queries.rounds.getRoundHistory, session ? { sessionId: session._id } : "skip");

    if (!isLoaded || session === undefined || history === undefined) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading Results...</div>;
    }

    if (!session || session.status !== "finished") {
        router.push(`/game/${code}`);
        return null;
    }

    const isBlueWin = session.winningTeam === 0;
    const titleText = isBlueWin ? "Team Blue Wins!" : "Team Orange Wins!";
    const titleColor = isBlueWin ? "text-blue-500" : "text-orange-500";
    const titleGlow = isBlueWin ? "drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]" : "drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]";

    return (
        <main className="min-h-screen p-6 md:p-12 bg-slate-900 text-slate-100 flex flex-col items-center">
            <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-slate-800 to-transparent opacity-50 pointer-events-none" />
            
            <h1 className={`text-5xl md:text-8xl font-black mb-8 z-10 ${titleColor} ${titleGlow} animate-in zoom-in spin-in-2 duration-700`}>
                {titleText}
            </h1>
            
            <div className="flex gap-8 lg:gap-16 my-8 z-10 animate-in slide-in-from-bottom-12">
               <div className="flex flex-col items-center bg-slate-800/80 p-8 rounded-3xl border-t-8 border-blue-500 shadow-2xl">
                  <span className="text-blue-400 font-bold uppercase tracking-widest text-lg md:text-xl mb-4">Team Blue</span>
                  <span className="text-7xl md:text-8xl font-black text-white">{session.teamScores[0]}</span>
               </div>
               <div className="flex flex-col items-center bg-slate-800/80 p-8 rounded-3xl border-t-8 border-orange-500 shadow-2xl">
                  <span className="text-orange-400 font-bold uppercase tracking-widest text-lg md:text-xl mb-4">Team Orange</span>
                  <span className="text-7xl md:text-8xl font-black text-white">{session.teamScores[1]}</span>
               </div>
            </div>

            <div className="w-full max-w-3xl bg-slate-800 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl mt-12 z-10 animate-in fade-in duration-1000">
                <div className="bg-slate-900/80 px-8 py-6 border-b border-slate-700 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-300">Round Breakdown</h2>
                    <span className="text-slate-500 font-mono text-sm">{history.length} Rounds Played</span>
                </div>
                <div className="divide-y divide-slate-700/50 max-h-[400px] overflow-y-auto custom-scrollbar">
                    {history.map((r, i) => {
                        const rowWinner = r.winningTeam === 0 ? "Team Blue" : "Team Orange";
                        const rowColor = r.winningTeam === 0 ? "text-blue-400" : "text-orange-400";
                        return (
                            <div key={i} className="px-8 py-5 flex justify-between items-center hover:bg-slate-700/30 transition-colors">
                                <div className="flex items-center gap-6">
                                    <span className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center font-bold text-sm border border-slate-600">#{r.roundNumber}</span>
                                    <div>
                                        <div className={`font-bold text-lg ${rowColor}`}>
                                            {r.status === "draw" ? "DRAW" : rowWinner}
                                        </div>
                                        <div className="text-sm text-slate-400 capitalize">
                                            {r.status}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-2xl font-black tracking-wider">
                                    {r.status === "draw" ? "0" : `+${r.pointsScored}`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <button 
                onClick={() => router.push("/")} 
                className="mt-16 z-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-2xl px-16 py-6 rounded-full transition-all duration-300 hover:scale-[1.05] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-95"
            >
                Return to Home
            </button>
        </main>
    );
}
