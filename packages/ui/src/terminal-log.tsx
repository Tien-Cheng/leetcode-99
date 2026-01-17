import React, { useEffect, useRef, useState } from "react";

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
 * Terminal Log component - scrolling feed with animated entry effects
 * Messages slide in with color-coded styling and glow effects
 */
export function TerminalLog({
  messages,
  maxMessages = 50,
  autoScroll = true,
  className = "",
}: TerminalLogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const prevMessageCount = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  // Track new messages for animation
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      const newIds = new Set<string>();
      messages.slice(prevMessageCount.current).forEach((_, i) => {
        newIds.add(`msg_${prevMessageCount.current + i}`);
      });
      setNewMessageIds(newIds);

      // Clear animation state after animation completes
      setTimeout(() => {
        setNewMessageIds(new Set());
      }, 300);
    }
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Limit messages to maxMessages
  const displayMessages = messages.slice(-maxMessages);

  const getMessageStyles = (type: TerminalMessage["type"], index: number) => {
    const isNew = newMessageIds.has(`msg_${messages.length - maxMessages + index}`);

    const baseStyles = {
      info: "text-base-content border-l-2 border-transparent",
      success: "text-success border-l-2 border-success bg-success/5",
      warning: "text-warning border-l-2 border-warning bg-warning/5",
      danger: "text-error border-l-2 border-error bg-error/5 font-bold",
      system: "text-muted italic border-l-2 border-transparent",
    };

    return `${baseStyles[type]} ${isNew ? "animate-slide-in-left" : ""} ${type === "danger" ? "animate-pulse" : ""
      }`;
  };

  const getIcon = (type: TerminalMessage["type"]) => {
    switch (type) {
      case "success":
        return <span className="text-success">✓</span>;
      case "warning":
        return <span className="text-warning">⚠</span>;
      case "danger":
        return <span className="text-error">✗</span>;
      case "system":
        return <span className="text-muted">◈</span>;
      case "info":
      default:
        return <span className="text-muted">&gt;</span>;
    }
  };

  return (
    <div
      ref={logRef}
      className={`h-full overflow-y-auto p-2 space-y-1 font-mono text-sm ${className}`}
    >
      {displayMessages.length === 0 ? (
        <div className="text-muted text-center py-4 animate-pulse">
          Waiting for events...
        </div>
      ) : (
        displayMessages.map((message, index) => (
          <div
            key={index}
            className={`
              ${getMessageStyles(message.type, index)}
              flex items-start gap-2 px-2 py-1 transition-all duration-150
            `}
          >
            {getIcon(message.type)}
            <span className="flex-1 break-words">{message.content}</span>
            {message.timestamp && (
              <span className="text-muted text-xs flex-shrink-0 opacity-60">
                {message.timestamp}
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}
