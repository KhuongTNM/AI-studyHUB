"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import type { ChatMessage, ChatSession, User } from "@/states/types"
import {
  fetchChatSessionsApi,
  fetchChatMessagesApi,
  createChatSessionApi,
  saveChatMessageApi,
  deleteChatSessionApi,
} from "@/services/api/chat"

interface ChatStateDeps {
  currentUser: User | null
}

export function useChatState({ currentUser }: ChatStateDeps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const loadedMessageSessionIdsRef = useRef<Set<string>>(new Set())

  // ── Load danh sách session từ backend khi user đăng nhập ─────────────────
  // (giúp lịch sử chat không bị mất khi refresh trang — FR: BR-chat-history)
  useEffect(() => {
    if (!currentUser) {
      setChatSessions([])
      setActiveChatId(null)
      loadedMessageSessionIdsRef.current.clear()
      return
    }
    let cancelled = false
    fetchChatSessionsApi()
      .then(sessions => {
        if (cancelled) return
        // Chỉ đồng bộ metadata (title, documentId...) từ backend, GIỮ NGUYÊN
        // messages cục bộ của các session đã có sẵn (đặc biệt là session đang
        // chat / đang stream) — API danh sách session không trả kèm messages
        // (luôn là []), nếu ghi đè trực tiếp sẽ làm mất tin nhắn đang hiển thị
        // giữa chừng khi effect này chạy lại (vd: sau khi currentUser đổi
        // reference do refreshStorageUsage, đổi ngôn ngữ, v.v.).
        setChatSessions(prev => {
          const prevById = new Map(prev.map(s => [s.id, s]))
          return sessions.map(s => {
            const existing = prevById.get(s.id)
            return existing ? { ...s, messages: existing.messages } : s
          })
        })
      })
      .catch(() => {
        // Backend chưa sẵn sàng / lỗi mạng -> giữ nguyên state hiện có
      })
    return () => { cancelled = true }
    // Chỉ refetch khi ĐỔI USER thật sự (đăng nhập/đăng xuất/chuyển tài khoản),
    // không refetch khi currentUser chỉ đổi reference nhưng vẫn cùng 1 user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  const addChatSession = useCallback((session: ChatSession) => {
    setChatSessions(prev => [session, ...prev])
  }, [])

  const updateChatSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    setChatSessions(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)))
  }, [])

  const removeChatSession = useCallback((id: string) => {
    setChatSessions(prev => prev.filter(s => s.id !== id))
    setActiveChatId(current => (current === id ? null : current))
  }, [])

  /** Tạo session mới trên backend (docs.chat_sessions), gắn kèm documentId nếu có */
  const createChatSession = useCallback(async (documentId?: string | null): Promise<ChatSession> => {
    const session = await createChatSessionApi(documentId ?? null)
    setChatSessions(prev => [session, ...prev])
    loadedMessageSessionIdsRef.current.add(session.id)
    return session
  }, [])

  /** Lưu 1 message vào session hiện có trên backend (docs.chat_messages) */
  const persistChatMessage = useCallback(
    async (sessionId: string, role: "user" | "assistant", content: string): Promise<ChatMessage> => {
      return saveChatMessageApi(sessionId, role, content)
    },
    []
  )

  /**
   * Lazy-load message của 1 session khi user mở nó lần đầu (từ sidebar / lịch sử chat)
   * — tránh gọi API load hết message của mọi session ngay khi vào trang.
   */
  const ensureSessionMessagesLoaded = useCallback(
    async (sessionId: string) => {
      if (loadedMessageSessionIdsRef.current.has(sessionId)) return
      try {
        const messages = await fetchChatMessagesApi(sessionId)
        setChatSessions(prev =>
          prev.map(s => (s.id === sessionId ? { ...s, messages } : s))
        )
        loadedMessageSessionIdsRef.current.add(sessionId)
      } catch {
        // Nếu lỗi, để nguyên messages rỗng, người dùng có thể thử lại
      }
    },
    []
  )

  const selectChatSession = useCallback(
    (id: string | null) => {
      setActiveChatId(id)
      if (id) void ensureSessionMessagesLoaded(id)
    },
    [ensureSessionMessagesLoaded]
  )

  const deleteChatSession = useCallback(async (id: string) => {
    await deleteChatSessionApi(id)
    removeChatSession(id)
  }, [removeChatSession])

  return {
    chatSessions,
    activeChatId,
    setActiveChatId: selectChatSession,
    addChatSession,
    updateChatSession,
    createChatSession,
    persistChatMessage,
    deleteChatSession,
  }
}
