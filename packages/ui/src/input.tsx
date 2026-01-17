import React, { forwardRef } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

/**
 * Input component with sharp borders, focus glow, and error states
 * Supports monospace font option for code-like inputs
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, mono = false, className = "", ...props }, ref) => {
    const inputStyles = `
    w-full px-3 py-2 border
    bg-base-200 text-base-content
    border-secondary
    focus:border-primary focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
    ${mono ? "font-mono" : "font-sans"}
    ${error ? "border-error" : ""}
    ${className}
  `
      .trim()
      .replace(/\s+/g, " ");

    return (
      <div className="flex flex-col gap-1">
        {label && <label className="font-mono text-sm text-muted">{label}</label>}
        <input ref={ref} className={inputStyles} {...props} />
        {error && (
          <span className="text-sm text-error flex items-center gap-1">
            <span>✗</span> {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
