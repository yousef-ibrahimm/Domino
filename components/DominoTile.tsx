"use client";

import React, from "react";

type DominoTileProps = {
  tile: { high: number; low: number } | null;
  orientation?: "horizontal" | "vertical";
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  faceDown?: boolean;
};

const Pip = () => <div className="w-[6px] h-[6px] sm:w-[8px] sm:h-[8px] bg-slate-900 rounded-full" />;

const PIP_MAP: Record<number, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};

export function DominoTile({ 
  tile, 
  orientation = "vertical", 
  isPlayable = false, 
  isSelected = false, 
  onClick, 
  faceDown = false 
}: DominoTileProps) {
  
  const rotateClass = orientation === "horizontal" ? "rotate-90" : "";
  const highlightClass = isPlayable && !isSelected ? "ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900 cursor-pointer hover:-translate-y-2 z-10" : "";
  const selectedClass = isSelected ? "ring-4 ring-orange-500 scale-110 -translate-y-4 z-20 cursor-pointer" : "";
  
  const styleStr = `transition-all duration-200 ease-out bg-amber-50 rounded-md shadow-[2px_2px_6px_rgba(0,0,0,0.6)] border border-amber-200 flex flex-col items-center justify-between p-[2px] w-[36px] h-[72px] sm:w-[46px] sm:h-[92px] ${rotateClass} ${highlightClass} ${selectedClass} shrink-0`;

  if (faceDown || !tile) {
    return (
      <div className={`bg-blue-800 border-2 border-blue-900 rounded-md shadow-md w-[36px] h-[72px] sm:w-[46px] sm:h-[92px] flex items-center justify-center shrink-0 ${rotateClass}`}>
        <div className="w-3/4 h-3/4 border border-blue-700/50 rounded-sm opacity-50 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-700 to-blue-900 bg-opacity-30"></div>
      </div>
    );
  }

  const renderPips = (val: number) => {
    let pips: React.ReactNode[] = Array(9).fill(null).map((_, i) => <div key={i} className="w-full h-full" />);
    const active = PIP_MAP[val] || [];
    active.forEach(i => pips[i] = <div key={i} className="w-full h-full flex items-center justify-center"><Pip /></div>);
    
    return (
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1">
         {pips}
      </div>
    );
  };

  return (
    <div className={styleStr} onClick={onClick}>
      <div className="h-[48%] w-full flex items-center justify-center">
        {renderPips(tile.high)}
      </div>
      <div className="h-[2px] w-[90%] bg-slate-300 rounded-full" />
      <div className="h-[48%] w-full flex items-center justify-center">
        {renderPips(tile.low)}
      </div>
    </div>
  );
}
