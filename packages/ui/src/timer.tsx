import React, { useState, useEffect } from "react";

export interface TimerProps {
  endsAt: string; // ISO timestamp
  serverTime?: string; // ISO timestamp for sync
  className?: string;
}

/**
 * Timer component - countdown display with dynamic urgency effects
 * Normal (white) > 60s, Warning (amber pulse) < 60s, Critical (red shake) < 15s
 */
export function Timer({ endsAt, serverTime, className = "" }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [prevSeconds, setPrevSeconds] = useState<number | null>(null);

  useEffect(() => {
    // Calculate offset between server and client time to keep timer synced
    const serverTimestamp = serverTime ? new Date(serverTime).getTime() : null;
    const clientTimestamp = Date.now();
    const offset = serverTimestamp ? serverTimestamp - clientTimestamp : 0;

    const calculateRemaining = () => {
      const now = Date.now() + offset;
      const end = new Date(endsAt).getTime();
      const remaining = Math.max(0, end - now);
      setTimeRemaining(remaining);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 100); // More frequent updates for smoother animation

    return () => clearInterval(interval);
  }, [endsAt, serverTime]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const seconds = Math.floor(timeRemaining / 1000);

  // Detect second change for tick animation
  useEffect(() => {
    if (prevSeconds !== null && seconds !== prevSeconds && seconds <= 10) {
      // Could trigger tick sound or visual pulse here
    }
    setPrevSeconds(seconds);
  }, [seconds, prevSeconds]);

  const getUrgencyClasses = () => {
    if (seconds <= 10) {
      return "timer-critical animate-shake";
    } else if (seconds <= 30) {
      return "timer-critical";
    } else if (seconds <= 60) {
      return "timer-warning";
    }
    return "text-base-content";
  };

  const getGlowClass = () => {
    if (seconds <= 10) {
      return "glow-danger";
    } else if (seconds <= 30) {
      return "glow-warning";
    }
    return "";
  };

  // Progress ring percentage - circumference = 2 * PI * 14 ≈ 88
  const circumference = 2 * Math.PI * 14;
  const maxTime = 600; // 10 min max for visual purposes
  const progressPercent = Math.min(1, seconds / maxTime);
  const strokeLength = progressPercent * circumference;

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {/* Circular progress indicator */}
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-secondary opacity-30"
          />
          {/* Progress circle */}
          <circle
            cx="16"
            cy="16"
            r="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${strokeLength} ${circumference}`}
            strokeLinecap="round"
            className={`transition-all duration-1000 ${seconds <= 30 ? "text-error" : seconds <= 60 ? "text-warning" : "text-primary"
              }`}
          />
        </svg>
      </div>

      {/* Time display */}
      <div
        className={`
          font-mono text-lg font-bold
          transition-all duration-300
          ${getUrgencyClasses()}
          ${getGlowClass()}
          ${seconds <= 10 ? "text-2xl" : ""}
        `}
      >
        {formatTime(timeRemaining)}
      </div>

      {/* Danger indicator */}
      {seconds <= 30 && seconds > 0 && (
        <span className={`text-xs font-mono ${seconds <= 10 ? "animate-fire" : "text-error"}`}>
          {seconds <= 10 ? "⚠ HURRY!" : "LOW TIME"}
        </span>
      )}
    </div>
  );
}
