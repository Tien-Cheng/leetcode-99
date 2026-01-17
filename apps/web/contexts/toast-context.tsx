"use client";

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    type ReactNode,
} from "react";

export type ToastType = "info" | "success" | "warning" | "error" | "attack";

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    icon?: string;
}

interface ToastContextValue {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, "id">) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, "id">) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const newToast: Toast = {
            id,
            duration: 4000,
            ...toast,
        };

        setToasts((prev) => [...prev, newToast]);

        // Auto-dismiss
        if (newToast.duration && newToast.duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, newToast.duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

// Toast Container that renders the stack of toasts
function ToastContainer({
    toasts,
    onRemove,
}: {
    toasts: Toast[];
    onRemove: (id: string) => void;
}) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

// Individual toast item
function ToastItem({
    toast,
    onRemove,
}: {
    toast: Toast;
    onRemove: (id: string) => void;
}) {
    const [isExiting, setIsExiting] = useState(false);

    const handleRemove = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    const getTypeStyles = () => {
        switch (toast.type) {
            case "success":
                return "border-success bg-success/10";
            case "warning":
                return "border-warning bg-warning/10";
            case "error":
                return "border-error bg-error/10";
            case "attack":
                return "border-error bg-error/20 animate-shake";
            case "info":
            default:
                return "border-primary bg-primary/10";
        }
    };

    const getIcon = () => {
        if (toast.icon) return toast.icon;
        switch (toast.type) {
            case "success":
                return "✓";
            case "warning":
                return "⚠";
            case "error":
                return "✗";
            case "attack":
                return "⚔";
            case "info":
            default:
                return "ℹ";
        }
    };

    return (
        <div
            className={`
        pointer-events-auto
        border-2 px-4 py-3 font-mono text-sm
        backdrop-blur-sm
        ${getTypeStyles()}
        ${isExiting ? "animate-toast-out" : "animate-toast-in"}
      `}
        >
            <div className="flex items-start gap-3">
                <span className="text-lg">{getIcon()}</span>
                <div className="flex-1 min-w-0">
                    <div className="font-bold">{toast.title}</div>
                    {toast.message && (
                        <div className="text-xs text-muted mt-1">{toast.message}</div>
                    )}
                </div>
                <button
                    onClick={handleRemove}
                    className="text-muted hover:text-base-content transition-colors"
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
            {/* Progress bar */}
            {toast.duration && toast.duration > 0 && (
                <div className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 animate-progress"
                    style={{ "--duration": `${toast.duration}ms` } as React.CSSProperties}
                />
            )}
        </div>
    );
}
