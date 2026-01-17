import React, { useState, useEffect } from "react";

export interface TimerProps {
  endsAt: string; // ISO timestamp
  serverTime?: string; // ISO timestamp for sync
  className?: string;
}

/**
 * Timer component - countdown display with color-coded urgency
 * Normal (white) > 2min, Warning (amber) < 2min, Critical (red pulsing) < 30s
 */
export function Timer({ endsAt, serverTime, className = "" }: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    // Calculate drift between server time and local time
    const serverTimeMs = serverTime ? new Date(serverTime).getTime() : Date.now();
    const drift = Date.now() - serverTimeMs;

    const calculateRemaining = () => {
      // Current estimated server time
      const now = Date.now() - drift;
      const end = new Date(endsAt).getTime();
      const remaining = Math.max(0, end - now);
      setTimeRemaining(remaining);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 100); // 100ms for smoother updates

    return () => clearInterval(interval);
  }, [endsAt, serverTime]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getColorClass = () => {
    const seconds = timeRemaining / 1000;
    if (seconds < 30) {
      return "text-error animate-pulse-red";
    } else if (seconds < 120) {
      return "text-warning";
    }
    return "text-base-content";
  };

  return (
    <div className={`font-mono text-lg ${getColorClass()} ${className}`}>
      ⏱ {formatTime(timeRemaining)}
    </div>
  );
}
