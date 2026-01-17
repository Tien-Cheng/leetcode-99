import React, { useEffect, useState, useRef } from "react";

export interface ScoreDisplayProps {
    score: number;
    streak: number;
    className?: string;
}

interface FloatingScore {
    id: string;
    value: number;
    x: number;
}

/**
 * Animated Score Display - shows score with flying points animation
 * Includes streak fire effect and counter roll-up
 */
export function ScoreDisplay({
    score,
    streak,
    className = "",
}: ScoreDisplayProps) {
    const [displayScore, setDisplayScore] = useState(score);
    const [floatingScores, setFloatingScores] = useState<FloatingScore[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const prevScoreRef = useRef(score);

    // Animate score changes
    useEffect(() => {
        const prevScore = prevScoreRef.current;
        const diff = score - prevScore;

        if (diff > 0) {
            // Add floating score indicator
            const floatId = `float_${Date.now()}`;
            setFloatingScores((prev) => [
                ...prev,
                { id: floatId, value: diff, x: Math.random() * 40 - 20 },
            ]);

            // Clean up after animation
            setTimeout(() => {
                setFloatingScores((prev) => prev.filter((f) => f.id !== floatId));
            }, 1000);

            // Animate counter roll-up
            setIsAnimating(true);
            const steps = 10;
            const stepValue = diff / steps;
            let current = prevScore;

            const interval = setInterval(() => {
                current += stepValue;
                if (current >= score) {
                    setDisplayScore(score);
                    setIsAnimating(false);
                    clearInterval(interval);
                } else {
                    setDisplayScore(Math.floor(current));
                }
            }, 30);

            return () => clearInterval(interval);
        } else {
            setDisplayScore(score);
        }

        prevScoreRef.current = score;
    }, [score]);

    const showFireEffect = streak >= 3;

    return (
        <div className={`relative inline-flex items-center gap-4 ${className}`}>
            {/* Score Display */}
            <div className="relative">
                <div className="font-mono text-sm">
                    Score:{" "}
                    <span
                        className={`
              text-accent font-bold
              ${isAnimating ? "animate-score-pop" : ""}
            `}
                    >
                        {displayScore}
                    </span>
                </div>

                {/* Floating score indicators */}
                {floatingScores.map((float) => (
                    <div
                        key={float.id}
                        className="absolute -top-2 left-1/2 font-mono text-sm font-bold text-success animate-fly-up pointer-events-none"
                        style={{ marginLeft: `${float.x}px` }}
                    >
                        +{float.value}
                    </div>
                ))}
            </div>

            {/* Streak Display */}
            <div className="font-mono text-sm">
                Streak:{" "}
                <span
                    className={`
            font-bold
            ${showFireEffect ? "animate-fire" : "text-warning"}
          `}
                    data-text={streak}
                >
                    {streak}
                    {showFireEffect && <span className="ml-1">🔥</span>}
                </span>
            </div>
        </div>
    );
}
