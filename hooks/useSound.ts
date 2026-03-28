"use client";

import { useEffect, useRef, useState } from "react";

// Global mute state across all hooks
let globalMuted = false;
if (typeof window !== "undefined") {
  globalMuted = localStorage.getItem("domino_muted") === "true";
}

export function useSound(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(globalMuted);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio(src);
      audioRef.current.muted = globalMuted;
    }
    
    // Listen for custom global mute event
    const handleMuteChange = () => {
       const muted = localStorage.getItem("domino_muted") === "true";
       setIsMuted(muted);
       if (audioRef.current) audioRef.current.muted = muted;
    };
    
    window.addEventListener("domino_mute_changed", handleMuteChange);
    return () => window.removeEventListener("domino_mute_changed", handleMuteChange);
  }, [src]);

  const play = () => {
    if (audioRef.current && !isMuted) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
         // Browser Auto-play security policies usually block this on first load
      });
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    globalMuted = next;
    localStorage.setItem("domino_muted", next.toString());
    if (audioRef.current) audioRef.current.muted = next;
    window.dispatchEvent(new Event("domino_mute_changed"));
  };

  return { play, isMuted, toggleMute };
}
