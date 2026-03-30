"use client";

import { useState, useCallback } from "react";
import { useGame } from "./GameProvider";
import { DominoTile } from "./DominoTile";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useSound } from "../hooks/useSound";

function tileMatchesEnd(tile: {high: number, low: number}, endValue: number) {
  return tile.high === endValue || tile.low === endValue;
}

export function PlayerHand() {
  const { session, roundState, myHand, playerId } = useGame();
  const playTile = useMutation(api.mutations.rounds.playTile);
  
  const [selectedTile, setSelectedTile] = useState<{high: number, low: number} | null>(null);
  const [pendingTiles, setPendingTiles] = useState<Set<string>>(new Set());
  const { play: playSfx } = useSound("/place.mp3");

  if (!myHand || !myHand.tiles) {
    return <div className="h-full flex items-center justify-center text-slate-500">Waiting for tiles...</div>;
  }

  const isMyTurn = myHand.canPlay;
  const openEnds = roundState.openEnds || [];
  
  const getPlayableEnds = (tile: {high: number, low: number}) => {
    if (openEnds.length === 0) return ["left"]; // first tile
    const ends = [];
    if (tileMatchesEnd(tile, openEnds[0])) ends.push("left");
    if (tileMatchesEnd(tile, openEnds[1])) ends.push("right");
    return ends;
  };

  const handleTileClick = async (tile: {high: number, low: number}) => {
    if (!isMyTurn) return;

    const playableEnds = getPlayableEnds(tile);
    if (playableEnds.length === 0) return;

    // If it can only play on one end (or it's the first move), play it immediately
    if (playableEnds.length === 1 || openEnds.length === 0 || openEnds[0] === openEnds[1]) {
        const tileKey = `${tile.high}-${tile.low}`;
        setPendingTiles(prev => new Set(prev).add(tileKey));
        playSfx();
        
        try {
          await playTile({ 
            roundId: session.currentRoundId, 
            playerId, 
            tile, 
            end: playableEnds[0] as "left" | "right" 
          });
          setSelectedTile(null);
        } catch (err) {
          console.error(err);
          setPendingTiles(prev => {
             const next = new Set(prev);
             next.delete(tileKey);
             return next;
          });
        }
    } else {
        // Can be played on either end
        if (selectedTile && selectedTile.high === tile.high && selectedTile.low === tile.low) {
            // Unselect
            setSelectedTile(null);
        } else {
            setSelectedTile(tile);
        }
    }
  };

  const forcePlayEnd = async (end: "left" | "right") => {
      if (!selectedTile) return;
      
      const tileKey = `${selectedTile.high}-${selectedTile.low}`;
      setPendingTiles(prev => new Set(prev).add(tileKey));
      playSfx();
      
      try {
        await playTile({ 
          roundId: session.currentRoundId, 
          playerId, 
          tile: selectedTile, 
          end 
        });
        setSelectedTile(null);
      } catch (err) {
        console.error(err);
        setPendingTiles(prev => {
           const next = new Set(prev);
           next.delete(tileKey);
           return next;
        });
        setSelectedTile(null);
      }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center h-full gap-4 relative z-50">
       {/* If a bidirectional tile is selected, show floating left/right option buttons */}
       {selectedTile && (
         <div className="absolute -top-16 bg-slate-800 p-2 rounded-lg border border-slate-600 shadow-xl flex gap-4 transition-all duration-200">
            <span className="text-sm font-semibold text-slate-300 self-center px-2">Place on:</span>
            <button onClick={() => forcePlayEnd("left")} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-bold transition-colors">Left End ({openEnds[0]})</button>
            <button onClick={() => forcePlayEnd("right")} className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded font-bold transition-colors">Right End ({openEnds[1]})</button>
         </div>
       )}

      <div className="flex gap-2 sm:gap-4 justify-center items-end flex-wrap h-full pb-2 overflow-y-visible">
        {myHand.tiles.filter((tile: any) => !pendingTiles.has(`${tile.high}-${tile.low}`)).map((tile: any, idx: number) => {
          const playable = isMyTurn && getPlayableEnds(tile).length > 0;
          const isSelected = selectedTile?.high === tile.high && selectedTile?.low === tile.low;
          return (
            <DominoTile 
              key={`${tile.high}-${tile.low}-${idx}`}
              tile={tile} 
              isPlayable={playable} 
              isSelected={isSelected}
              onClick={() => handleTileClick(tile)}
            />
          );
        })}
      </div>
    </div>
  );
}
