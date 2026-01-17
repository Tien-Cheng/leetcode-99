import React from "react";

export interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  noPadding?: boolean;
}

/**
 * Panel component with sharp borders and optional title bar
 * Styled for the riced workstation aesthetic with 1px borders and dark surface
 */
export function Panel({
  title,
  children,
  className = "",
  titleClassName = "",
  noPadding = false,
}: PanelProps) {
  return (
    <div
      className={`bg-base-200 border border-secondary flex flex-col ${className}`}
    >
      {title && (
        <div
          className={`border-b border-secondary bg-base-300 px-4 py-2 font-mono text-sm text-base-content flex-shrink-0 ${titleClassName}`}
        >
          {title}
        </div>
      )}
      <div className={`${noPadding ? "" : "p-4"} flex-1 min-h-0 relative`}>{children}</div>
    </div>
  );
}
