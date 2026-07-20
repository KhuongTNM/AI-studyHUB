"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useApp, ChatSession, ChatMessage, ChatSource } from "@/lib/store"
import { askRagStream } from "@/services/api/chat"

import { ChatToolbar } from "./chat/chat-toolbar"
import { ChatMessageItem } from "./chat/chat-message"
import { ChatInputBar } from "./chat/chat-input-bar"

const MAX_QUESTION_LENGTH = 500

export function EnhancedChatInterface() {
  const {
    currentUser, documents, chatSessions, activeChatId,
    addChatSession, updateChatSession, setActiveChatId,
    createChatSession, persistChatMessage,
    pendingChatDocumentId, setPendingChatDocumentId,
    openAuthModal,
    setCurrentPage,
    language,
  } = useApp()

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const activeSession = chatSessions.find(s => s.id === activeChatId) ?? null
  const messages = activeSession?.messages ?? []
  const selectedDoc = documents.find(d => d.id === selectedDocId)
  const text = chatText[language]

  const openPackages = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("profile-tab", "packages")
      window.dispatchEvent(new Event("profile-tab-packages"))
    }
    setCurrentPage("profile")
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    // Hủy request stream đang chạy nếu component unmount
    return () => abortControllerRef.current?.abort()
  }, [])

  // ── Đồng bộ tài liệu đang chọn với session / nút "Chat AI" trên từng file ──
  // Ưu tiên: 1) tài liệu vừa chọn từ nút "Chat AI" của 1 file cụ thể
  //          2) tài liệu gắn với session đang mở (khi bấm vào lịch sử chat)
  //          3) không có tài liệu nào (chat chung)
  useEffect(() => {
    if (pendingChatDocumentId) {
      setSelectedDocId(pendingChatDocumentId)
      setPendingChatDocumentId(null)
      return
    }
    setSelectedDocId(activeSession?.documentId ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId])

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return
    if (!currentUser) { openAuthModal("login"); return }
    if (content.length > MAX_QUESTION_LENGTH) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    const aiMsgId = `msg-${Date.now()}-ai`
    const aiMsgPlaceholder: ChatMessage = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    }

    let sessionId = activeChatId
    let currentMessages: ChatMessage[]

    if (!sessionId) {
      // Tạo session thật trên backend (docs.chat_sessions), gắn kèm documentId
      // đang chọn để phục hồi đúng tài liệu khi mở lại session này sau này (A5).
      let newSession: ChatSession
      try {
        newSession = await createChatSession(selectedDocId)
      } catch {
        // Backend lỗi -> vẫn tạo session tạm ở client để không chặn trải nghiệm chat,
        // nhưng lịch sử sẽ không được lưu lại sau khi refresh.
        newSession = {
          id: `chat-${Date.now()}`,
          title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
          messages: [],
          documentId: selectedDocId ?? undefined,
          createdAt: new Date(),
        }
        addChatSession(newSession)
      }
      updateChatSession(newSession.id, {
        title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
        messages: [userMsg, aiMsgPlaceholder],
      })
      setActiveChatId(newSession.id)
      sessionId = newSession.id
      currentMessages = [userMsg, aiMsgPlaceholder]
    } else {
      currentMessages = [...messages, userMsg, aiMsgPlaceholder]
      updateChatSession(sessionId, { messages: currentMessages })
    }

    const finalSessionId = sessionId
    setInput("")
    setIsLoading(true)

    // Lưu tin nhắn của user vào backend (không chặn UI, chạy nền)
    void persistChatMessage(finalSessionId, "user", userMsg.content).catch(() => {
      // Nếu lưu thất bại, tin nhắn vẫn hiển thị trên UI trong phiên hiện tại
    })

    const updateAiMessage = (updates: Partial<ChatMessage>) => {
      currentMessages = currentMessages.map(m => (m.id === aiMsgId ? { ...m, ...updates } : m))
      updateChatSession(finalSessionId!, { messages: currentMessages })
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    await askRagStream(
      {
        query: content.trim(),
        userId: currentUser.id,
        documentId: selectedDocId,
      },
      {
        onToken: (_delta, fullText) => {
          updateAiMessage({ content: fullText, isStreaming: true })
        },
        onSources: (sources: ChatSource[]) => {
          updateAiMessage({ sources })
        },
        onDone: () => {
          updateAiMessage({ isStreaming: false })
          setIsLoading(false)
          const finalAiMsg = currentMessages.find(m => m.id === aiMsgId)
          if (finalAiMsg?.content) {
            void persistChatMessage(finalSessionId, "assistant", finalAiMsg.content).catch(() => {
              // Nếu lưu thất bại, câu trả lời vẫn hiển thị trên UI trong phiên hiện tại
            })
          }
        },
        onError: (error) => {
          const message = error.message || ""
          const isQuotaError = /chat\s*ai|lượt\s*chat|daily.*chat|limit/i.test(message)
          if (isQuotaError) {
            toast.error(message, {
              action: {
                label: language === "vi" ? "Nâng cấp gói" : "Upgrade plan",
                onClick: openPackages,
              },
            })
          }
          const existing = currentMessages.find(m => m.id === aiMsgId)
          updateAiMessage({
            content: existing?.content
              ? existing.content
              : isQuotaError
              ? message
              : "Xin lỗi, đã có lỗi xảy ra khi kết nối với AI. Vui lòng thử lại.",
            isStreaming: false,
            error: true,
          })
          setIsLoading(false)
        },
      },
      controller.signal
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
    }
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const suggestedQuestions = [
    text.suggestSummary,
    text.suggestFlashcards,
    text.suggestConcepts,
    text.suggestExplain,
  ]

  return (
    <div className="flex h-full flex-col">
      <ChatToolbar
        onNewChat={() => { setActiveChatId(null); setInput("") }}
        documents={documents}
        selectedDocId={selectedDocId}
        onSelectDoc={setSelectedDocId}
        showDocPicker={showDocPicker}
        setShowDocPicker={setShowDocPicker}
        language={language}
      />

      <div className="flex-1 flex overflow-hidden relative" onClick={() => { setShowDocPicker(false); }}>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  {selectedDoc ? `${text.chatWith} "${selectedDoc.name.slice(0, 30)}"` : text.emptyTitle}
                </h3>
                <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
                  {currentUser
                    ? text.emptySignedIn
                    : text.emptySignedOut}
                </p>
                <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map(message => (
                  <ChatMessageItem
                    key={message.id}
                    message={message}
                    copiedId={copiedId}
                    onCopy={handleCopy}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <ChatInputBar
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            currentUser={currentUser}
            openAuthModal={openAuthModal}
            maxLength={MAX_QUESTION_LENGTH}
            language={language}
          />
        </div>
      </div>
    </div>
  )
}

const chatText = {
  vi: {
    sharedDocument: "Tài liệu được chia sẻ",
    documentName: "Tên tài liệu",
    subject: "Môn học",
    visibility: "Quyền xem",
    publicVisibility: "Public",
    noSubject: "Chưa đặt môn",
    suggestSummary: "Tóm tắt nội dung chính của tài liệu này",
    suggestFlashcards: "Tạo flashcard từ tài liệu để ôn tập",
    suggestConcepts: "Các khái niệm quan trọng nhất là gì?",
    suggestExplain: "Giải thích chi tiết phần khó nhất",
    chatWith: "Chat với",
    emptyTitle: "Bắt đầu cuộc trò chuyện",
    emptySignedIn: "Hỏi bất kỳ điều gì - AI sẽ trả lời dựa trên tài liệu bạn chọn.",
    emptySignedOut: "Đăng nhập để lưu lịch sử chat và sử dụng đầy đủ tính năng AI.",
  },
  en: {
    sharedDocument: "Shared document",
    documentName: "Document",
    subject: "Subject",
    visibility: "Visibility",
    publicVisibility: "Public",
    noSubject: "No subject",
    suggestSummary: "Summarize the main ideas in this document",
    suggestFlashcards: "Create flashcards from this document",
    suggestConcepts: "What are the most important concepts?",
    suggestExplain: "Explain the hardest part in detail",
    chatWith: "Chat with",
    emptyTitle: "Start a conversation",
    emptySignedIn: "Ask anything - AI will answer based on the document you choose.",
    emptySignedOut: "Log in to save chat history and use all AI features.",
  },
} as const
