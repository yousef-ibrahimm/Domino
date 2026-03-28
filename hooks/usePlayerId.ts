import { useState, useEffect } from "react";

export function usePlayerId() {
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Generate or fetch UUID
    let id = localStorage.getItem("domino_playerId");
    if (!id) {
      if (typeof crypto.randomUUID === "function") {
        id = crypto.randomUUID();
      } else {
        id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }
      localStorage.setItem("domino_playerId", id);
    }
    setPlayerId(id);

    // Fetch existing name
    const name = localStorage.getItem("domino_playerName");
    if (name) {
      setPlayerName(name);
    }
    
    setIsLoaded(true);
  }, []);

  const updatePlayerName = (name: string) => {
    setPlayerName(name);
    localStorage.setItem("domino_playerName", name);
  };

  return { playerId, playerName, setPlayerName: updatePlayerName, isLoaded };
}
