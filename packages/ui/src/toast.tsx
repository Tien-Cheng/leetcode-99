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
    success: "bg-base-300 border-success text-success border-l-4",
    error: "bg-base-300 border-error text-error border-l-4",
    info: "bg-base-300 border-primary text-primary border-l-4",
  }[type];

  return (
    <div
      className={`fixed top-4 right-4 z-50 p-3 border ${bgColor} font-mono text-sm animate-fade-in`}
    >
      {message}
    </div>
  );
}
