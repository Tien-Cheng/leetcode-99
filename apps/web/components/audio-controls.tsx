"use client";

import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useAudioContext } from "../contexts/audio-context";

export function AudioControls() {
  const {
    isMuted,
    musicVolume,
    sfxVolume,
    toggleMute,
    setMusicVolume,
    setSFXVolume,
  } = useAudioContext();

  const [showSliders, setShowSliders] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fix hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-4 z-[1000] flex items-center gap-2"
      onMouseEnter={() => setShowSliders(true)}
      onMouseLeave={() => setShowSliders(false)}
    >
      {/* Volume Sliders (show on hover) */}
      {showSliders && (
        <div className="flex flex-col gap-2 bg-base-200 border border-secondary p-3 rounded shadow-lg animate-fade-in absolute bottom-full left-0 mb-2">
          {/* Music Volume */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted w-12">Music</span>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume * 100}
              onChange={(e) => setMusicVolume(parseInt(e.target.value) / 100)}
              className="w-24 h-1 bg-secondary rounded-lg appearance-none cursor-pointer slider"
              disabled={isMuted}
            />
            <span className="font-mono text-xs text-muted w-8 text-right">
              {Math.round(musicVolume * 100)}
            </span>
          </div>

          {/* SFX Volume */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted w-12">SFX</span>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVolume * 100}
              onChange={(e) => setSFXVolume(parseInt(e.target.value) / 100)}
              className="w-24 h-1 bg-secondary rounded-lg appearance-none cursor-pointer slider"
              disabled={isMuted}
            />
            <span className="font-mono text-xs text-muted w-8 text-right">
              {Math.round(sfxVolume * 100)}
            </span>
          </div>
        </div>
      )}

      {/* Mute Toggle Button */}
      <button
        onClick={() => {
          toggleMute();
        }}
        className="p-2 border border-secondary bg-base-200 hover:bg-base-300 hover:border-primary transition-all rounded shadow-md"
        title={isMuted ? "Unmute (Audio is muted)" : "Mute"}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-error" strokeWidth={2} />
        ) : (
          <Volume2 className="w-5 h-5 text-primary" strokeWidth={2} />
        )}
      </button>

      {/* Unmute Prompt (shown on first load if muted) */}
      {isMuted && (
        <div className="absolute bottom-full left-0 mb-2 bg-warning/90 text-warning-content px-3 py-2 rounded shadow-lg font-mono text-xs whitespace-nowrap animate-bounce">
          Click to enable audio 🔊
        </div>
      )}
    </div>
  );
}
