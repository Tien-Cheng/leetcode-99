import React, { useEffect } from "react";

export interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
}

/**
 * Toast notification component for brief feedback messages
 * Auto-dismisses after duration (default 2 seconds)
 */
export function Toast({
  message,
  type = "info",
  duration = 2000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    success: "bg-success/10 border-success",
    error: "bg-error/10 border-error",
    info: "bg-primary/10 border-primary",
  }[type];

  return (
    <div
      className={`fixed top-4 right-4 z-50 p-3 border ${bgColor} font-mono text-sm animate-fade-in`}
    >
      {message}
    </div>
  );
}
