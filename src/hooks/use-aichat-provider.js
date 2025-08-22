import React, { createContext, useContext } from "react";
import { useChat } from "ai/react";

const AIChatContext = createContext(null);

export function AIChatProvider({ children }) {
  const chat = useChat(); // no options needed if using default /api/chat
  return (
    <AIChatContext.Provider value={chat}>{children}</AIChatContext.Provider>
  );
}

export function useAIChat() {
  const ctx = useContext(AIChatContext);
  if (!ctx) throw new Error("Wrap your app with <AIChatProvider>.");
  return ctx;
}
