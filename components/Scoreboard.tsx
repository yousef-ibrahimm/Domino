"use client";

import { useGame } from "./GameProvider";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function Scoreboard() {
    const { session, roundState } = useGame();
    
    // Fetch History
    const history = useQuery(api.queries.rounds.getRoundHistory, { sessionId: session._id });

    // Team 0 vs Team 1
    const t0Score = session.teamScores[0];
    const t1Score = session.teamScores[1];

    return (
        <div className="flex flex-col h-full w-full p-6 space-y-8 font-sans">
            <div>
                <h2 className="text-2xl font-bold mb-4 uppercase tracking-widest text-slate-300">Match Score</h2>
                
                <div className="space-y-4">
                    {/* Team Blue */}
                    <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-blue-500 shadow-md">
                        <div className="text-sm font-bold text-blue-400 uppercase">Team Blue</div>
                        <div className="text-4xl font-black text-white">{t0Score} <span className="text-sm font-normal text-slate-400">/ 250</span></div>
                        <div className="w-full bg-slate-700 h-2 mt-2 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full transition-all" style={{ width: `${Math.min(100, (t0Score/250)*100)}%` }} />
                        </div>
                    </div>

                    {/* Team Orange */}
                    <div className="bg-slate-800 p-4 rounded-xl border-l-4 border-orange-500 shadow-md">
                        <div className="text-sm font-bold text-orange-400 uppercase">Team Orange</div>
                        <div className="text-4xl font-black text-white">{t1Score} <span className="text-sm font-normal text-slate-400">/ 250</span></div>
                        <div className="w-full bg-slate-700 h-2 mt-2 rounded-full overflow-hidden">
                            <div className="bg-orange-500 h-full transition-all" style={{ width: `${Math.min(100, (t1Score/250)*100)}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <h3 className="font-bold text-slate-400 uppercase text-sm mb-3">Round History</h3>
                {(!history || history.length === 0) ? (
                    <div className="text-slate-500 text-sm italic">No completed rounds yet.</div>
                ) : (
                    <div className="space-y-2">
                        {history.map((r, i) => {
                            const isBlue = r.winningTeam === 0;
                            const tColor = isBlue ? "text-blue-400" : "text-orange-400";
                            return (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded border border-slate-700">
                                    <div className="text-xs font-mono text-slate-400">#{r.roundNumber}</div>
                                    <div className={`text-sm font-bold ${tColor}`}>
                                        {r.status === "draw" ? "DRAW" : "+"+r.pointsScored}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            {/* Meta info block at the bottom */}
            <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-1">
               <div className="flex justify-between"><span>Current Round:</span> <span className="font-bold text-slate-300">#{roundState?.roundNumber || 1}</span></div>
               <div className="flex justify-between"><span>Consecutive Passes:</span> <span className="font-bold text-slate-300">{roundState?.consecutivePasses || 0}/4</span></div>
            </div>
        </div>
    );
}
