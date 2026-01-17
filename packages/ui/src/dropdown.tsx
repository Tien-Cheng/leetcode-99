import React from "react";

export interface DropdownProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

/**
 * Dropdown/Select component with sharp borders and focus glow
 * Styled consistently with Input component
 */
export function Dropdown({
  label,
  error,
  options,
  className = "",
  ...props
}: DropdownProps) {
  const selectStyles = `
    w-full px-3 py-2 border
    bg-base-200 text-base-content
    border-secondary
    focus:border-primary focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed
    font-sans
    ${error ? "border-error" : ""}
    ${className}
  `.trim().replace(/\s+/g, " ");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="font-mono text-sm text-muted">
          {label}
        </label>
      )}
      <select
        className={selectStyles}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-sm text-error flex items-center gap-1">
          <span>✗</span> {error}
        </span>
      )}
    </div>
  );
}
