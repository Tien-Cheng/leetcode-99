import { useCallback, useEffect, useRef, useState } from "react";

export type MusicTrack =
  | "lobby"
  | "game-normal"
  | "game-tension"
  | "results"
  | null;

export type SFXType =
  | "attack-general"
  | "attack-ddos"
  | "test-pass"
  | "test-fail"
  | "submit-success"
  | "submit-fail"
  | "stack-push"
  | "purchase"
  | "ui-click";

interface AudioState {
  isMuted: boolean;
  musicVolume: number;
  sfxVolume: number;
  currentTrack: MusicTrack;
  isPlaying: boolean;
}

const MUSIC_FILES: Record<Exclude<MusicTrack, null>, string> = {
  lobby: "/ost/connected-science-electronica-283955.mp3",
  "game-normal": "/ost/lean-on-inspiring-future-beat-283957.mp3",
  "game-tension": "/ost/morax-unlocked-hacker-mode-142916.mp3",
  results: "/ost/pulsewidth-science-electronica-283952.mp3",
};

const SFX_FILES: Record<SFXType, string> = {
  "attack-general": "/ost/hacker-alarm-124960.mp3",
  "attack-ddos": "/ost/denial-of-service-sci-fi-hacker-instrumental-267766.mp3",
  "test-pass": "/sfx/success.mp3",
  "test-fail": "/sfx/error.wav",
  "submit-success": "/sfx/success.mp3",
  "submit-fail": "/sfx/error.wav",
  "stack-push": "/sfx/thud.wav",
  purchase: "/sfx/kaching_sound_purchase.wav",
  "ui-click": "/sfx/mech_keyboard_press.ogg",
};

const STORAGE_KEY = "leet99-audio-settings";
const FADE_DURATION = 500; // ms

export function useAudio() {
  // Load settings from localStorage
  const [state, setState] = useState<AudioState>(() => {
    if (typeof window === "undefined") {
      return {
        isMuted: true,
        musicVolume: 0.5,
        sfxVolume: 0.7,
        currentTrack: null,
        isPlaying: false,
      };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          isMuted: parsed.isMuted ?? true, // Start muted by default
          musicVolume: parsed.musicVolume ?? 0.5,
          sfxVolume: parsed.sfxVolume ?? 0.7,
          currentTrack: null,
          isPlaying: false,
        };
      }
    } catch (e) {
      console.error("[Audio] Failed to load settings:", e);
    }

    return {
      isMuted: true, // Start muted for auto-play compatibility
      musicVolume: 0.5,
      sfxVolume: 0.7,
      currentTrack: null,
      isPlaying: false,
    };
  });

  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const sfxAudioRefsRef = useRef<HTMLAudioElement[]>([]);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFadingRef = useRef(false);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          isMuted: state.isMuted,
          musicVolume: state.musicVolume,
          sfxVolume: state.sfxVolume,
        }),
      );
    } catch (e) {
      console.error("[Audio] Failed to save settings:", e);
    }
  }, [state.isMuted, state.musicVolume, state.sfxVolume]);

  // Initialize music audio element
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!musicAudioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = state.isMuted ? 0 : state.musicVolume;
      musicAudioRef.current = audio;
    }

    return () => {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
    };
  }, []);

  // Update music volume when settings change
  useEffect(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = state.isMuted ? 0 : state.musicVolume;
    }
  }, [state.isMuted, state.musicVolume]);

  // Fade helper function
  const fadeAudio = useCallback(
    (
      audio: HTMLAudioElement,
      fromVolume: number,
      toVolume: number,
      duration: number,
      onComplete?: () => void,
    ) => {
      const steps = 20;
      const stepDuration = duration / steps;
      const volumeStep = (toVolume - fromVolume) / steps;
      let currentStep = 0;

      isFadingRef.current = true;

      const interval = setInterval(() => {
        currentStep++;
        const newVolume = fromVolume + volumeStep * currentStep;
        audio.volume = Math.max(0, Math.min(1, newVolume));

        if (currentStep >= steps) {
          clearInterval(interval);
          audio.volume = toVolume;
          isFadingRef.current = false;
          onComplete?.();
        }
      }, stepDuration);
    },
    [],
  );

  // Play music with crossfade
  const playMusic = useCallback(
    async (track: MusicTrack) => {
      if (!musicAudioRef.current || track === state.currentTrack) return;

      // Clear any pending fade
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }

      const audio = musicAudioRef.current;
      const targetVolume = state.isMuted ? 0 : state.musicVolume;

      // Stop current track if playing
      if (state.currentTrack && state.isPlaying) {
        // Fade out current track
        fadeAudio(audio, audio.volume, 0, FADE_DURATION, () => {
          audio.pause();
          audio.currentTime = 0;

          // Start new track if not null
          if (track) {
            const newSrc = MUSIC_FILES[track];
            audio.src = newSrc;
            audio.volume = 0;
            audio
              .play()
              .then(() => {
                fadeAudio(audio, 0, targetVolume, FADE_DURATION);
              })
              .catch((err) => {
                console.error("[Audio] Failed to play music:", err);
              });
          }
        });
      } else if (track) {
        // No current track, just start the new one
        const newSrc = MUSIC_FILES[track];
        audio.src = newSrc;
        audio.volume = 0;

        try {
          await audio.play();
          fadeAudio(audio, 0, targetVolume, FADE_DURATION);
        } catch (err) {
          console.error("[Audio] Failed to play music:", err);
          // If autoplay is blocked, user will need to unmute manually
        }
      } else {
        // track is null, stop current track
        fadeAudio(audio, audio.volume, 0, FADE_DURATION, () => {
          audio.pause();
          audio.currentTime = 0;
        });
      }

      setState((prev) => ({
        ...prev,
        currentTrack: track,
        isPlaying: track !== null,
      }));
    },
    [
      state.currentTrack,
      state.isPlaying,
      state.isMuted,
      state.musicVolume,
      fadeAudio,
    ],
  );

  // Play SFX
  const playSFX = useCallback(
    (type: SFXType) => {
      if (state.isMuted) return;

      try {
        const audio = new Audio(SFX_FILES[type]);
        audio.volume = state.sfxVolume;

        // Clean up after playing
        audio.addEventListener("ended", () => {
          const index = sfxAudioRefsRef.current.indexOf(audio);
          if (index > -1) {
            sfxAudioRefsRef.current.splice(index, 1);
          }
        });

        // Limit concurrent SFX to prevent spam
        if (sfxAudioRefsRef.current.length >= 3) {
          const oldest = sfxAudioRefsRef.current.shift();
          oldest?.pause();
        }

        sfxAudioRefsRef.current.push(audio);
        audio.play().catch((err) => {
          console.error("[Audio] Failed to play SFX:", err);
        });
      } catch (err) {
        console.error("[Audio] Failed to create SFX:", err);
      }
    },
    [state.isMuted, state.sfxVolume],
  );

  // Toggle mute
  const toggleMute = useCallback(() => {
    setState((prev) => {
      const newMuted = !prev.isMuted;

      // Update music volume immediately
      if (musicAudioRef.current) {
        musicAudioRef.current.volume = newMuted ? 0 : prev.musicVolume;
      }

      // If unmuting and no track is playing, try to play current track
      if (!newMuted && prev.currentTrack && !prev.isPlaying) {
        const audio = musicAudioRef.current;
        if (audio && audio.src) {
          audio.play().catch((err) => {
            console.error("[Audio] Failed to resume music:", err);
          });
        }
      }

      return { ...prev, isMuted: newMuted };
    });
  }, []);

  // Set music volume
  const setMusicVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState((prev) => ({ ...prev, musicVolume: clampedVolume }));
  }, []);

  // Set SFX volume
  const setSFXVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    setState((prev) => ({ ...prev, sfxVolume: clampedVolume }));
  }, []);

  return {
    ...state,
    playMusic,
    playSFX,
    toggleMute,
    setMusicVolume,
    setSFXVolume,
  };
}
