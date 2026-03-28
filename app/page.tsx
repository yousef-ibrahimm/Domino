"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { usePlayerId } from "../hooks/usePlayerId";

export default function LandingPage() {
  const router = useRouter();
  const { playerId, playerName, setPlayerName, isLoaded } = usePlayerId();
  
  const createSession = useMutation(api.mutations.sessions.createSession);
  const joinSession = useMutation(api.mutations.sessions.joinSession);
  
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError("Please enter your name first!");
      return;
    }
    setLoading(true);
    try {
      const { code } = await createSession();
      // Auto-join the creator
      await joinSession({ code, playerId, name: playerName.trim() });
      router.push(`/game/${code}/lobby`);
    } catch (err: any) {
      setError(err.message || "Failed to create game");
      setLoading(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      setError("Please enter your name first!");
      return;
    }
    if (joinCode.length !== 6) {
      setError("Game code must be 6 characters");
      return;
    }
    
    setLoading(true);
    try {
      await joinSession({ code: joinCode.toUpperCase(), playerId, name: playerName.trim() });
      router.push(`/game/${joinCode.toUpperCase()}/lobby`);
    } catch (err: any) {
      setError(err.message || "Failed to join game");
      setLoading(false);
    }
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-slate-100">
      <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">Dominoes 2v2</h1>
          <p className="text-slate-400">Real-time team dominoes</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                setError("");
              }}
              maxLength={16}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-white"
              placeholder="e.g. DominoKing"
            />
          </div>

          {error && <div className="text-red-400 text-sm font-medium">{error}</div>}

          <div className="pt-4 space-y-4">
            <button
              onClick={handleCreateGame}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create New Game"}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-800 text-slate-400">Or join existing</span>
              </div>
            </div>

            <form onSubmit={handleJoinGame} className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="6-LETTER CODE"
                maxLength={6}
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-white uppercase tracking-widest text-center"
              />
              <button
                type="submit"
                disabled={loading || joinCode.length !== 6}
                className="bg-slate-700 hover:bg-slate-600 px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
