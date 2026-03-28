"use client";

import { DominoTile } from "./DominoTile";
import { useEffect, useRef } from "react";

export function BoardCanvas({ chain, openEnds }: { chain: any[], openEnds: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to center/right
  useEffect(() => {
    if (containerRef.current) {
        containerRef.current.scrollLeft = containerRef.current.scrollWidth / 2;
    }
  }, [chain]);

  if (!chain || chain.length === 0) {
    return <div className="text-emerald-100/30 font-bold text-2xl tracking-widest uppercase">Awaiting First Move...</div>;
  }

  const visualChain: any[] = [];
  let leftOpen = -1;
  let rightOpen = -1;

  // Reconstruct an array representing the visual horizontal line
  chain.forEach((played, idx) => {
     if (idx === 0) {
         visualChain.push({ ...played, reversed: false, isDouble: played.high === played.low });
         leftOpen = played.high; // visual left
         rightOpen = played.low; // visual right
     } else {
         const isDouble = played.high === played.low;
         if (played.end === "left") {
             // attach to leftOpen
             let reversed = false;
             if (played.low === leftOpen) {
                 // low side connects to leftOpen. High side goes on far left.
                 reversed = false;
                 leftOpen = played.high;
             } else {
                 // high side connects.
                 reversed = true;
                 leftOpen = played.low;
             }
             visualChain.unshift({ ...played, reversed, isDouble });
         } else {
             // attach to rightOpen
             let reversed = false;
             if (played.high === rightOpen) {
                 // high connects to rightOpen. High goes on the left.
                 reversed = false;
                 rightOpen = played.low;
             } else {
                 reversed = true;
                 rightOpen = played.high;
             }
             visualChain.push({ ...played, reversed, isDouble });
         }
     }
  });

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center overflow-x-auto overflow-y-hidden px-12 sm:px-[50vw] hide-scrollbar scroll-smooth"
    >
        <div className="flex items-center justify-center min-w-max gap-[2px]">
            {visualChain.map((vt, i) => {
               // Flip high/low visually if reversed so the ends touch beautifully
               const tileData = vt.reversed 
                  ? { high: vt.low, low: vt.high } 
                  : { high: vt.high, low: vt.low };
                  
               return (
                   <div key={`${tileData.high}-${tileData.low}-${i}`} className="flex-shrink-0 animate-in zoom-in spin-in-12 duration-300">
                      <DominoTile 
                         tile={tileData} 
                         orientation={vt.isDouble ? "vertical" : "horizontal"} 
                      />
                   </div>
               );
            })}
        </div>
    </div>
  );
}
