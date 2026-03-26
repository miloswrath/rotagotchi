"use client";

import { createContext, useContext, useState } from "react";
import {
  clampHealth,
  HEALTH_DEFAULT,
  initialTamagotchiState,
  TamagotchiState,
} from "./tamagotchi";

interface TamagotchiContextValue {
  state: Readonly<TamagotchiState>;
  updateHealth: (delta: number) => void;
  resetHealth: () => void;
}

const TamagotchiContext = createContext<TamagotchiContextValue | null>(null);

export function TamagotchiProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<TamagotchiState>(initialTamagotchiState);

  function updateHealth(delta: number) {
    setState((prev) => ({ ...prev, health: clampHealth(prev.health + delta) }));
  }

  function resetHealth() {
    setState((prev) => ({ ...prev, health: HEALTH_DEFAULT }));
  }

  return (
    <TamagotchiContext.Provider value={{ state, updateHealth, resetHealth }}>
      {children}
    </TamagotchiContext.Provider>
  );
}

export function useTamagotchi(): TamagotchiContextValue {
  const ctx = useContext(TamagotchiContext);
  if (ctx === null) {
    throw new Error("useTamagotchi must be used within TamagotchiProvider");
  }
  return ctx;
}
