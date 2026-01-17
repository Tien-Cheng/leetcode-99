"use client";

import React, { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

interface HotkeyContextType {
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  vimMode: boolean;
  setVimMode: (enabled: boolean) => void;
}

const HotkeyContext = createContext<HotkeyContextType | undefined>(undefined);

export function HotkeyProvider({ children }: { children: ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [vimMode, setVimMode] = useState(false);

  return (
    <HotkeyContext.Provider
      value={{
        modalOpen,
        setModalOpen,
        inputFocused,
        setInputFocused,
        vimMode,
        setVimMode,
      }}
    >
      {children}
    </HotkeyContext.Provider>
  );
}

export function useHotkeys() {
  const context = useContext(HotkeyContext);
  if (context === undefined) {
    throw new Error("useHotkeys must be used within a HotkeyProvider");
  }
  return context;
}
