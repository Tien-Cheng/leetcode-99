import React, { useEffect, useRef } from "react";

export interface TerminalMessage {
  type: "info" | "success" | "warning" | "danger" | "system";
  content: string;
  timestamp?: string;
}

export interface TerminalLogProps {
  messages: TerminalMessage[];
  maxMessages?: number;
  autoScroll?: boolean;
  className?: string;
}

/**
 * Terminal Log component - scrolling feed with color-coded messages
 * Styled for the terminal aesthetic with > prefix and monospace font
 */
export function TerminalLog({
  messages,
  maxMessages = 50,
  autoScroll = true,
  className = "",
}: TerminalLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Limit messages to maxMessages
  const displayMessages = messages.slice(-maxMessages);

  const getMessageColor = (type: TerminalMessage["type"]) => {
    switch (type) {
      case "success":
        return "text-success";
      case "warning":
        return "text-warning";
      case "danger":
        return "text-error";
      case "system":
        return "text-muted";
      case "info":
      default:
        return "text-base-content";
    }
  };

  return (
    <div
      ref={logRef}
      className={`h-full overflow-y-auto p-2 space-y-1 font-mono text-sm ${className}`}
    >
      {displayMessages.map((message, index) => (
        <div
          key={index}
          className={`${getMessageColor(message.type)} flex items-start gap-2`}
        >
          <span className="text-muted">&gt;</span>
          <span className="flex-1">{message.content}</span>
          {message.timestamp && (
            <span className="text-muted text-xs">{message.timestamp}</span>
          )}
        </div>
      ))}
    </div>
  );
}
