import React, { useEffect, useState, useCallback } from "react";

export type EffectType =
    | "attack"
    | "success"
    | "elimination"
    | "ddos"
    | "memoryLeak"
    | "confetti";

interface Effect {
    id: string;
    type: EffectType;
    timestamp: number;
}

export interface EffectsOverlayProps {
    ddosActive?: boolean;
    memoryLeakActive?: boolean;
    className?: string;
}

/**
 * Effects Overlay - renders full-screen visual effects
 * Manages attack shakes, success flashes, debuff overlays
 */
export function EffectsOverlay({
    ddosActive = false,
    memoryLeakActive = false,
    className = "",
}: EffectsOverlayProps) {
    const [effects, setEffects] = useState<Effect[]>([]);
    const [confettiParticles, setConfettiParticles] = useState<Array<{
        id: string;
        x: number;
        color: string;
        delay: number;
    }>>([]);

    // Clean up expired effects
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setEffects((prev) => prev.filter((e) => now - e.timestamp < 1000));
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Trigger effect function (can be called from parent via ref)
    const triggerEffect = useCallback((type: EffectType) => {
        const id = `effect_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setEffects((prev) => [...prev, { id, type, timestamp: Date.now() }]);

        if (type === "confetti") {
            const colors = ["#00ffd5", "#50fa7b", "#ffb000", "#ff4444", "#3b82f6"];
            const particles = Array.from({ length: 30 }, (_, i) => ({
                id: `confetti_${Date.now()}_${i}`,
                x: Math.random() * 100,
                color: colors[Math.floor(Math.random() * colors.length)] as string,
                delay: Math.random() * 0.5,
            }));
            setConfettiParticles(particles);
            setTimeout(() => setConfettiParticles([]), 2500);
        }
    }, []);

    // Expose triggerEffect on window for easy access from game context
    useEffect(() => {
        (window as any).__triggerGameEffect = triggerEffect;
        return () => {
            delete (window as any).__triggerGameEffect;
        };
    }, [triggerEffect]);

    const hasAttack = effects.some((e) => e.type === "attack");
    const hasSuccess = effects.some((e) => e.type === "success");
    const hasElimination = effects.some((e) => e.type === "elimination");

    return (
        <>
            {/* Attack vignette overlay */}
            {hasAttack && (
                <div className="fixed inset-0 pointer-events-none z-[999] animate-attack-vignette" />
            )}

            {/* Success flash overlay */}
            {hasSuccess && (
                <div className="fixed inset-0 pointer-events-none z-[999] animate-success-flash border-4 border-transparent" />
            )}

            {/* DDOS static noise overlay */}
            {ddosActive && <div className="ddos-static-overlay" />}

            {/* Main container for shake effect */}
            <div
                className={`
          ${hasAttack || hasElimination ? "animate-shake-intense" : ""}
          ${className}
        `}
            >
                {/* This is where children would go if wrapping */}
            </div>

            {/* Confetti particles */}
            {confettiParticles.length > 0 && (
                <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
                    {confettiParticles.map((particle) => (
                        <div
                            key={particle.id}
                            className="absolute w-3 h-3 animate-confetti"
                            style={{
                                left: `${particle.x}%`,
                                backgroundColor: particle.color,
                                animationDelay: `${particle.delay}s`,
                                borderRadius: Math.random() > 0.5 ? "50%" : "0",
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Memory leak glitch overlay */}
            {memoryLeakActive && (
                <div className="fixed inset-0 pointer-events-none z-[998]">
                    <div
                        className="absolute inset-0 opacity-10"
                        style={{
                            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,176,0,0.1) 2px, rgba(255,176,0,0.1) 4px)",
                        }}
                    />
                </div>
            )}
        </>
    );
}

// Helper hook for triggering effects from game context
export function useGameEffects() {
    const triggerEffect = useCallback((type: EffectType) => {
        if (typeof window !== "undefined" && (window as any).__triggerGameEffect) {
            (window as any).__triggerGameEffect(type);
        }
    }, []);

    return { triggerEffect };
}
