"use client";

import { GameProvider, useGame } from "../../../components/GameProvider";
import { Scoreboard } from "../../../components/Scoreboard";
import { PlayerHand } from "../../../components/PlayerHand";
import { OpponentHand } from "../../../components/OpponentHand";
import { BoardCanvas } from "../../../components/BoardCanvas";
import { TurnIndicator } from "../../../components/TurnIndicator";
import { ActionBar } from "../../../components/ActionBar";
import { RoundEndOverlay } from "../../../components/RoundEndOverlay";

function GameView() {
  const { session, roundState, playerId } = useGame();

  const myPlayer = session.players.find((p: any) => p.id === playerId);
  if (!myPlayer) return null;

  const mySeat = myPlayer.seat;
  
  // Predict opponent seats relative to mine
  const partnerSeat = (mySeat + 2) % 4;
  const leftSeat = (mySeat + 1) % 4;
  const rightSeat = (mySeat + 3) % 4;

  const partnerPlayer = session.players.find((p: any) => p.seat === partnerSeat);
  const leftPlayer = session.players.find((p: any) => p.seat === leftSeat);
  const rightPlayer = session.players.find((p: any) => p.seat === rightSeat);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-900 text-slate-100 overflow-hidden relative font-sans">
      <div className="flex-1 flex flex-col relative w-full h-full">
        
        {/* Opponent Top (Partner) */}
        {partnerPlayer && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
            <OpponentHand player={partnerPlayer} tileCount={roundState.tileCounts[partnerSeat]} isCurrentTurn={roundState.currentTurn === partnerSeat} position="top" />
          </div>
        )}

        {/* Opponent Left */}
        {leftPlayer && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 hidden md:block">
            <OpponentHand player={leftPlayer} tileCount={roundState.tileCounts[leftSeat]} isCurrentTurn={roundState.currentTurn === leftSeat} position="left" />
          </div>
        )}

        {/* Opponent Right */}
        {rightPlayer && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 hidden md:block">
            <OpponentHand player={rightPlayer} tileCount={roundState.tileCounts[rightSeat]} isCurrentTurn={roundState.currentTurn === rightSeat} position="right" />
          </div>
        )}

        {/* Board Canvas (Center) */}
        <div className="flex-1 relative overflow-hidden bg-emerald-900/60 mt-[100px] mb-[180px] md:mb-[220px] md:mx-[140px] border-4 border-emerald-950 rounded-[40px] shadow-inner flex items-center justify-center isolate">
           <BoardCanvas chain={roundState.chain} openEnds={roundState.openEnds} />
           <TurnIndicator currentTurn={roundState.currentTurn} mySeat={mySeat} />
        </div>

        {/* My Hand (Bottom) */}
        <div className="absolute bottom-0 w-full h-[180px] md:h-[220px] z-20 flex flex-col justify-end pointer-events-none">
          <div className="pointer-events-auto px-4 w-full">
            <ActionBar />
          </div>
          <div className="bg-slate-800 border-t-2 border-slate-700 w-full pt-4 pb-6 px-4 pointer-events-auto">
            <PlayerHand />
          </div>
        </div>

        {/* Interstitial Round End */}
        <RoundEndOverlay />
      </div>
      
      {/* Sidebar Scoreboard (Right side on desktop) */}
      <div className="w-full md:w-80 border-l border-slate-800 bg-slate-900/90 hidden md:block z-30 shadow-2xl overflow-y-auto">
        <Scoreboard />
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <GameProvider>
      <GameView />
    </GameProvider>
  );
}
