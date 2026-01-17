/**
 * @leet99/ui - Pure UI components
 *
 * These components are props-only with no direct networking or state management.
 * They receive data as props and render UI.
 */

// Primitive components
export * from "./button";
export * from "./input";
export * from "./panel";
export * from "./tile";
export * from "./dropdown";

// Game-specific components
export * from "./minimap";
export * from "./stack-panel";
export * from "./terminal-log";
export * from "./problem-display";
export * from "./shop-modal";
export * from "./timer";

// Editor wrapper
export * from "./editor-wrapper";

export const UI_VERSION = "0.1.0";
