"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useApp, getAIMockResponse, ChatSession, ChatMessage } from "@/lib/store"

import { ChatToolbar } from "./chat/chat-toolbar"
import { ChatMessageItem } from "./chat/chat-message"
import { ChatInputBar } from "./chat/chat-input-bar"

const MAX_QUESTION_LENGTH = 500

export function EnhancedChatInterface() {
  const {
    currentUser, documents, chatSessions, activeChatId,
    addChatSession, updateChatSession, setActiveChatId,
    openAuthModal,
    language,
  } = useApp()

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession = chatSessions.find(s => s.id === activeChatId) ?? null
  const messages = activeSession?.messages ?? []
  const selectedDoc = documents.find(d => d.id === selectedDocId)
  const text = chatText[language]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

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

    let sessionId = activeChatId

    if (!sessionId) {
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
        messages: [userMsg],
        documentId: selectedDocId ?? undefined,
        createdAt: new Date(),
      }
      addChatSession(newSession)
      setActiveChatId(newSession.id)
      sessionId = newSession.id
    } else {
      updateChatSession(sessionId, { messages: [...messages, userMsg] })
    }

    setInput("")
    setIsLoading(true)

    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))

    const aiMsg: ChatMessage = {
      id: `msg-${Date.now()}-ai`,
      role: "assistant",
      content: getAIMockResponse(content, selectedDoc?.name),
      timestamp: new Date(),
    }

    const currentSession = chatSessions.find(s => s.id === sessionId)
    const updatedMessages = [...(currentSession?.messages ?? [userMsg]), aiMsg]
    updateChatSession(sessionId!, { messages: updatedMessages })
    setIsLoading(false)
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

                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70">
                      <Sparkles className="h-4 w-4 animate-pulse text-primary-foreground" />
                    </div>
                    <div className="rounded-2xl bg-muted px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
                      </div>
                    </div>
                  </div>
                )}
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
