"use client";

import React, { useRef, useEffect, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

export interface EditorWrapperProps {
  code: string;
  onChange: (code: string) => void;
  language?: string;
  readOnly?: boolean;
  vimMode?: boolean;
  vimLocked?: boolean;
  onVimModeChange?: (enabled: boolean) => void;
  className?: string;
}

/**
 * Monaco Editor wrapper with custom dark theme and Vim mode support
 * Features lazy-loading, IBM Plex Mono font, and Vim Lock debuff state
 */
export function EditorWrapper({
  code,
  onChange,
  language = "python",
  readOnly = false,
  vimMode = false,
  vimLocked = false,
  onVimModeChange,
  className = "",
}: EditorWrapperProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const vimAdapterRef = useRef<any>(null);
  const [isVimActive, setIsVimActive] = useState(vimMode || vimLocked);

  // Define custom theme before editor mounts
  const handleEditorWillMount = (monaco: typeof Monaco): void => {
    monaco.editor.defineTheme("leet99-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "e0e0e0", background: "1a1a1a" },
        { token: "comment", foreground: "6a6a6a", fontStyle: "italic" },
        { token: "keyword", foreground: "00ffd5" },
        { token: "string", foreground: "50fa7b" },
        { token: "number", foreground: "ffb000" },
        { token: "function", foreground: "00ffd5" },
      ],
      colors: {
        "editor.background": "#1a1a1a",
        "editor.foreground": "#e0e0e0",
        "editorCursor.foreground": "#00ffd5",
        "editor.lineHighlightBackground": "#222222",
        "editorLineNumber.foreground": "#6a6a6a",
        "editorLineNumber.activeForeground": "#00ffd5",
        "editor.selectionBackground": "#00ffd533",
        "editor.inactiveSelectionBackground": "#00ffd520",
        "editorWhitespace.foreground": "#404040",
      },
    });
  };

  // Handle editor mount
  const handleEditorDidMount: OnMount = async (editor, monaco) => {
    editorRef.current = editor;

    // Enable Vim mode if requested
    if (vimMode || vimLocked) {
      await enableVimMode(editor);
    }

    // Focus the editor
    if (!readOnly) {
      editor.focus();
    }
  };

  // Enable Vim mode
  const enableVimMode = async (editor: Monaco.editor.IStandaloneCodeEditor): Promise<void> => {
    try {
      // Dynamically import monaco-vim to avoid SSR issues
      const { initVimMode } = await import("monaco-vim");

      if (!vimAdapterRef.current) {
        const statusNode = document.createElement("div");
        statusNode.style.display = "none"; // We handle status in parent component

        vimAdapterRef.current = initVimMode(editor, statusNode);
        setIsVimActive(true);
        onVimModeChange?.(true);
      }
    } catch (error) {
      console.error("Failed to initialize Vim mode:", error);
    }
  };

  // Disable Vim mode
  const disableVimMode = () => {
    if (vimAdapterRef.current) {
      vimAdapterRef.current.dispose();
      vimAdapterRef.current = null;
      setIsVimActive(false);
      onVimModeChange?.(false);
    }
  };

  // Handle Vim mode toggle
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // If Vim Lock is active, force Vim on
    if (vimLocked) {
      if (!vimAdapterRef.current) {
        enableVimMode(editor);
      }
      return;
    }

    // Otherwise, follow the vimMode prop
    if (vimMode && !vimAdapterRef.current) {
      enableVimMode(editor);
    } else if (!vimMode && vimAdapterRef.current) {
      disableVimMode();
    }
  }, [vimMode, vimLocked, onVimModeChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vimAdapterRef.current) {
        vimAdapterRef.current.dispose();
      }
    };
  }, []);

  const editorClassName = `
    ${className}
    ${vimLocked ? "ring-2 ring-primary shadow-[0_0_10px_rgba(0,255,213,0.5)]" : ""}
  `.trim();

  return (
    <div className={editorClassName}>
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={(value: string | undefined) => onChange(value || "")}
        theme="leet99-dark"
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 16,
          fontFamily: "'IBM Plex Mono', monospace",
          lineHeight: 24,
          fontWeight: "400",
          lineNumbers: "on",
          minimap: { enabled: false },
          wordWrap: "off",
          scrollBeyondLastLine: false,
          readOnly,
          renderWhitespace: "selection",
          scrollbar: {
            vertical: "auto",
            horizontal: "auto",
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          padding: { top: 16, bottom: 16 },
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
        }}
      />
    </div>
  );
}
