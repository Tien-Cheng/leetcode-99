"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import { useAudio, type MusicTrack, type SFXType } from "../hooks/use-audio";

interface AudioContextValue {
  isMuted: boolean;
  musicVolume: number;
  sfxVolume: number;
  currentTrack: MusicTrack;
  isPlaying: boolean;
  playMusic: (track: MusicTrack) => Promise<void>;
  playSFX: (type: SFXType) => void;
  toggleMute: () => void;
  setMusicVolume: (volume: number) => void;
  setSFXVolume: (volume: number) => void;
}

const AudioContext = createContext<AudioContextValue | undefined>(undefined);

interface AudioProviderProps {
  children: ReactNode;
}

export function AudioProvider({ children }: AudioProviderProps) {
  const audio = useAudio();

  return (
    <AudioContext.Provider value={audio}>{children}</AudioContext.Provider>
  );
}

export function useAudioContext() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error("useAudioContext must be used within an AudioProvider");
  }
  return context;
}
