"use client"

import { useState, useRef, useEffect } from "react"
import {
  Send, Sparkles, User, Copy, ThumbsUp, ThumbsDown,
  RotateCcw, FileText, Plus, Clock, ChevronDown, AlertCircle,
  Users, Lock, LogOut, Share2, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, getAIMockResponse, ChatSession, ChatMessage, type PackageTier } from "@/lib/store"

const MAX_QUESTION_LENGTH = 500

export function EnhancedChatInterface() {
  const {
    currentUser, documents, chatSessions, activeChatId,
    addChatSession, updateChatSession, setActiveChatId,
    openAuthModal, setCurrentPage,
    rooms, currentRoomId, createRoom, joinRoom, leaveRoom, closeRoom, sendRoomMessage
  } = useApp()

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [showRoomPanel, setShowRoomPanel] = useState(false)
  const [showRoomSidebar, setShowRoomSidebar] = useState(false)
  const [roomActionTab, setRoomActionTab] = useState<"join" | "create">("join")
  const [roomIdInput, setRoomIdInput] = useState("")
  const [roomPasswordInput, setRoomPasswordInput] = useState("")
  const [roomError, setRoomError] = useState("")
  const [roomInput, setRoomInput] = useState("")
  const roomMessagesEndRef = useRef<HTMLDivElement>(null)

  const activeSession = chatSessions.find(s => s.id === activeChatId) ?? null
  const messages = activeSession?.messages ?? []
  const availableDocs = documents.filter(d => d.status === "ready")
  const selectedDoc = availableDocs.find(d => d.id === selectedDocId)

  const activeRoom = rooms.find(r => r.id === currentRoomId) ?? null
  const roomMessages = activeRoom?.messages ?? []
  const roomMembers = activeRoom?.members ?? []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    if (currentRoomId) {
      setShowRoomSidebar(true)
    } else {
      setShowRoomSidebar(false)
    }
  }, [currentRoomId])

  useEffect(() => {
    roomMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [roomMessages])

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

  const handleNewChat = () => {
    setActiveChatId(null)
    setInput("")
  }

  const suggestedQuestions = [
    "Tóm tắt nội dung chính của tài liệu này",
    "Tạo flashcard từ tài liệu để ôn tập",
    "Các khái niệm quan trọng nhất là gì?",
    "Giải thích chi tiết phần khó nhất",
  ]

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="flex h-full flex-col">
      {/* Chat Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        <Button
          id="new-chat-btn-chat"
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="gap-1.5"
        >
          <Plus className="h-3 w-3" />
          Chat mới
        </Button>

        {/* Document Selector */}
        <div className="relative">
          <Button
            id="doc-picker-btn"
            variant="outline"
            size="sm"
            onClick={() => setShowDocPicker(!showDocPicker)}
            className={cn("gap-1.5", selectedDoc && "border-primary/50 bg-primary/5 text-primary")}
          >
            <FileText className="h-3 w-3" />
            {selectedDoc ? selectedDoc.name.slice(0, 20) + "..." : "Chọn tài liệu"}
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showDocPicker && (
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-card shadow-xl">
              <div className="max-h-48 overflow-y-auto p-1">
                <button
                  onClick={() => { setSelectedDocId(null); setShowDocPicker(false) }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Không chọn tài liệu
                </button>
                {availableDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedDocId(doc.id); setShowDocPicker(false) }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                      selectedDocId === doc.id ? "bg-primary/10 text-primary" : "text-foreground"
                    )}
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Study Room Toggle Button */}
        <div className="relative">
          <Button
            id="room-toggle-btn"
            variant="outline"
            size="sm"
            onClick={() => {
              if (currentRoomId) {
                setShowRoomSidebar(!showRoomSidebar)
              } else {
                setShowRoomPanel(!showRoomPanel)
              }
            }}
            className={cn(
              "gap-1.5",
              currentRoomId
                ? "border-green-500/50 bg-green-500/5 text-green-600 dark:text-green-400 font-semibold"
                : "text-muted-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {currentRoomId ? `Phòng: ${currentRoomId}` : "Học nhóm (Room)"}
            <ChevronDown className="h-3 w-3" />
          </Button>

          {showRoomPanel && !currentRoomId && (
            <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded-xl border border-border bg-card p-4 shadow-xl animate-in fade-in slide-in-from-top-1">
              <div className="flex border-b border-border mb-3">
                <button
                  onClick={() => { setRoomActionTab("join"); setRoomError(""); }}
                  className={cn(
                    "flex-1 pb-2 text-sm font-semibold text-center transition-colors",
                    roomActionTab === "join" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tham gia phòng
                </button>
                <button
                  onClick={() => { setRoomActionTab("create"); setRoomError(""); }}
                  className={cn(
                    "flex-1 pb-2 text-sm font-semibold text-center transition-colors",
                    roomActionTab === "create" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Mở phòng mới
                </button>
              </div>

              {roomError && (
                <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{roomError}</span>
                </div>
              )}

              <div className="space-y-3">
                {roomActionTab === "create" && currentUser && currentUser.subscriptionTier === "free" && currentUser.role !== "admin" && currentUser.role !== "sub-admin" ? (
                  <div className="text-center py-2">
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Bạn đang sử dụng gói <span className="font-semibold text-foreground">Free</span>. Vui lòng nâng cấp lên gói 2-4 người hoặc 5+ người để mở phòng học nhóm.
                    </p>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setShowRoomPanel(false)
                        setCurrentPage("profile")
                      }}
                    >
                      Nâng cấp ngay
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Mã phòng học</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: ROOM101"
                        value={roomIdInput}
                        onChange={e => setRoomIdInput(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Mật khẩu phòng</label>
                      <input
                        type="password"
                        placeholder="Mật khẩu"
                        value={roomPasswordInput}
                        onChange={e => setRoomPasswordInput(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => {
                        setRoomError("")
                        if (!currentUser) {
                          openAuthModal("login")
                          return
                        }
                        if (roomActionTab === "join") {
                          const res = joinRoom(roomIdInput, roomPasswordInput)
                          if (res.success) {
                            setShowRoomPanel(false)
                            setShowRoomSidebar(true)
                            setRoomIdInput("")
                            setRoomPasswordInput("")
                          } else {
                            setRoomError(res.error || "Không thể tham gia phòng.")
                          }
                        } else {
                          const res = createRoom(roomIdInput, roomPasswordInput)
                          if (res.success) {
                            setShowRoomPanel(false)
                            setShowRoomSidebar(true)
                            setRoomIdInput("")
                            setRoomPasswordInput("")
                          } else {
                            setRoomError(res.error || "Không thể tạo phòng.")
                          }
                        }
                      }}
                    >
                      {roomActionTab === "join" ? "Tham gia ngay" : "Tạo phòng"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {selectedDoc && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            <FileText className="h-3 w-3" />
            Đang chat về: {selectedDoc.name.slice(0, 25)}
          </span>
        )}
      </div>

      {/* Main Container: AI Chat + Room Sidebar */}
      <div className="flex-1 flex overflow-hidden relative" onClick={() => { setShowDocPicker(false); setShowRoomPanel(false); }}>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  {selectedDoc ? `Chat về "${selectedDoc.name.slice(0, 30)}"` : "Bắt đầu cuộc trò chuyện"}
                </h3>
                <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
                  {currentUser
                    ? "Hỏi bất kỳ điều gì — AI sẽ trả lời dựa trên tài liệu bạn chọn."
                    : "Đăng nhập để lưu lịch sử chat và sử dụng đầy đủ tính năng AI."}
                </p>
                {/* Suggested questions */}
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
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70">
                        <Sparkles className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <div className={cn("max-w-[80%]")}>
                      <div className={cn(
                        "rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      </div>
                      <div className={cn(
                        "mt-1 flex items-center gap-1",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}>
                        <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
                        {message.role === "assistant" && (
                          <>
                            <Button
                              variant="ghost" size="icon" className="h-5 w-5"
                              onClick={() => handleCopy(message.id, message.content)}
                              title="Sao chép"
                            >
                              <Copy className={cn("h-3 w-3", copiedId === message.id ? "text-green-500" : "")} />
                            </Button>
                            {currentRoomId && (
                              <Button
                                variant="ghost" size="icon" className="h-5 w-5 text-primary hover:text-primary/80"
                                onClick={() => {
                                  sendRoomMessage(`[Chia sẻ từ AI]:\n${message.content.slice(0, 150)}${message.content.length > 150 ? "..." : ""}`)
                                  alert("Đã chia sẻ phản hồi của AI vào phòng học nhóm!")
                                }}
                                title="Chia sẻ vào phòng chat nhóm"
                              >
                                <Share2 className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-5 w-5" title="Hữu ích">
                              <ThumbsUp className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5" title="Không hữu ích">
                              <ThumbsDown className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {message.role === "user" && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <User className="h-4 w-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
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

          {/* Input Area */}
          <div className="border-t border-border bg-background p-4">
            {!currentUser && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  <button onClick={() => openAuthModal("login")} className="font-medium underline">Đăng nhập</button>
                  {" "}để lưu lịch sử chat (BR-63)
                </span>
              </div>
            )}
            <form
              onSubmit={e => { e.preventDefault(); handleSend(input) }}
              className="mx-auto max-w-3xl"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={currentUser ? "Nhập câu hỏi của bạn... (Enter để gửi)" : "Đăng nhập để sử dụng AI Chatbot"}
                  rows={1}
                  maxLength={MAX_QUESTION_LENGTH}
                  disabled={!currentUser}
                  className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-end gap-1">
                  {input.length > MAX_QUESTION_LENGTH * 0.8 && (
                    <span className={cn("text-xs", input.length >= MAX_QUESTION_LENGTH ? "text-destructive" : "text-muted-foreground")}>
                      {input.length}/{MAX_QUESTION_LENGTH}
                    </span>
                  )}
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isLoading || !currentUser || input.length > MAX_QUESTION_LENGTH}
                    className="shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                AI có thể mắc lỗi. Hãy kiểm tra lại thông tin quan trọng.
              </p>
            </form>
          </div>
        </div>

        {/* Room Sidebar */}
        {currentRoomId && activeRoom && showRoomSidebar && (
          <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Room Header */}
            <div className="flex items-center justify-between border-b border-border bg-background/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-foreground">{activeRoom.id}</span>
                  {activeRoom.password && <Lock className="h-3 w-3 text-muted-foreground" title="Phòng có mật khẩu" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  Thành viên: {roomMembers.length}/{activeRoom.capacity}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  title={activeRoom.hostId === currentUser?.id ? "Đóng phòng học" : "Rời phòng học"}
                  onClick={() => {
                    if (activeRoom.hostId === currentUser?.id) {
                      if (confirm("Bạn có chắc chắn muốn đóng phòng học này? Tất cả thành viên sẽ bị rời ra.")) {
                        closeRoom()
                      }
                    } else {
                      leaveRoom()
                    }
                  }}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setShowRoomSidebar(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Room Details & Member list */}
            <div className="border-b border-border bg-muted/30 p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chủ phòng:</span>
                <span className="font-medium text-foreground">{activeRoom.hostName}</span>
              </div>
              {activeRoom.password && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Mật khẩu phòng:</span>
                  <span className="font-mono font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                    {activeRoom.password}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground block mb-1">Đang online ({roomMembers.length}):</span>
                <div className="flex flex-wrap gap-1.5">
                  {roomMembers.map((m) => (
                    <span
                      key={m.userId}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium border",
                        m.userId === activeRoom.hostId
                          ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50"
                          : "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground"
                      )}
                    >
                      <User className="h-2.5 w-2.5" />
                      {m.displayName}
                      {m.userId === activeRoom.hostId && <span className="text-[9px] font-bold">(Host)</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Room Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/10">
              {roomMessages.map((msg) => {
                const isSystem = msg.senderId === "system";
                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[10px] text-muted-foreground">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                const isSelf = msg.senderId === currentUser?.id;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-0.5 max-w-[85%] animate-in fade-in slide-in-from-bottom-2",
                      isSelf ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground px-1">
                      {msg.senderName}
                    </span>
                    <div
                      className={cn(
                        "rounded-xl px-3 py-2 text-xs",
                        isSelf
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : "bg-muted text-foreground rounded-tl-none"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
              <div ref={roomMessagesEndRef} />
            </div>

            {/* Room Message Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (roomInput.trim()) {
                  sendRoomMessage(roomInput);
                  setRoomInput("");
                }
              }}
              className="border-t border-border p-3 flex gap-2 bg-background"
            >
              <input
                type="text"
                placeholder="Nhắn cho nhóm..."
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button type="submit" size="icon" className="h-7 w-7" disabled={!roomInput.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
