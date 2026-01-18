import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  hotkey?: string;
  children: React.ReactNode;
}

/**
 * Button component with sharp borders and optional hotkey hints
 * Supports glow effects on hover for the riced workstation aesthetic
 */
export function Button({
  variant = "primary",
  hotkey,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    "font-mono px-4 py-2 border transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent";

  const variantStyles = {
    primary:
      "border-primary bg-transparent text-primary hover-glow-primary hover:bg-primary/10",
    secondary:
      "border-secondary bg-transparent text-base-content hover:border-base-content hover:bg-base-200",
    danger:
      "border-error bg-transparent text-error hover-glow-danger hover:bg-error/10",
    ghost:
      "border-transparent bg-transparent text-base-content hover:bg-base-200",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {hotkey && <span className="hotkey-hint">[{hotkey}] </span>}
      {children}
    </button>
  );
}
