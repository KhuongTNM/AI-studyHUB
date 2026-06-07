"use client"

import { useCallback, useState } from "react"
import type { ChatSession } from "@/states/types"

export function useChatState() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const addChatSession = useCallback((session: ChatSession) => {
    setChatSessions(prev => [session, ...prev])
  }, [])

  const updateChatSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    setChatSessions(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)))
  }, [])

  return {
    chatSessions,
    activeChatId,
    setActiveChatId,
    addChatSession,
    updateChatSession,
  }
}
