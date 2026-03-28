"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { usePlayerId } from "../../../../hooks/usePlayerId";
import { useEffect, useState } from "react";

export default function LobbyPage() {
  const { code } = useParams();
  const router = useRouter();
  const { isLoaded } = usePlayerId();
  
  const session = useQuery(api.queries.sessions.getSessionByCode, 
    { code: code as string }
  );
  
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // If game started, redirect to game page
    if (session && session.status === "playing") {
      router.push(`/game/${code}`);
    }
  }, [session, router, code]);

  if (!isLoaded || session === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>;
  }

  if (session === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
        <h2 className="text-2xl font-bold mb-4">Session Not Found</h2>
        <button onClick={() => router.push("/")} className="text-blue-400 hover:underline">Return to Home</button>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code as string);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Team 0 = seats 0 & 2 (Blue)
  // Team 1 = seats 1 & 3 (Orange)
  const getTeamColor = (team: number) => team === 0 ? "bg-blue-600 text-blue-100 border-blue-500" : "bg-orange-600 text-orange-100 border-orange-500";
  const getTeamName = (team: number) => team === 0 ? "Team Blue" : "Team Orange";

  return (
    <main className="min-h-screen flex flex-col items-center p-6 bg-slate-900 text-slate-100">
      <div className="w-full max-w-3xl flex flex-col items-center pt-10">
        
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 shadow-2xl w-full text-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-white">Game Lobby</h1>
            <p className="text-slate-400">Waiting for players to join ({session.players.length}/4)</p>
          </div>

          <div className="py-6 px-8 bg-slate-900 rounded-lg inline-block border border-slate-700">
            <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Room Code</div>
            <div className="flex items-center gap-4">
              <span className="text-5xl font-extrabold tracking-widest font-mono text-white">{code}</span>
              <button 
                onClick={handleCopy}
                className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg transition-colors font-bold"
                title="Copy Room Code"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* List all 4 possible seats */}
            {[0, 1, 2, 3].map((seatNum) => {
              const player = session.players.find(p => p.seat === seatNum);
              const teamId = seatNum % 2;
              
              return (
                <div 
                  key={seatNum} 
                  className={`p-6 rounded-xl border-2 flex flex-col items-center justify-center min-h-[120px] transition-all
                    ${player ? getTeamColor(teamId) : "bg-slate-800 border-slate-700 border-dashed opacity-50"}
                  `}
                >
                  {player ? (
                    <>
                      <div className="font-bold text-xl mb-1">{player.name}</div>
                      <div className="text-sm opacity-80">{getTeamName(teamId)}</div>
                      {!player.connected && <div className="mt-2 text-xs bg-black/30 px-2 py-1 rounded">Disconnected</div>}
                    </>
                  ) : (
                    <div className="text-slate-500 font-medium">Waiting for player...</div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </main>
  );
}
