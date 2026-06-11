import { useState, useRef, useEffect } from "react"
import { Users, Lock, LogOut, X, Send, AlertCircle, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getActiveHostPackageTier, getRoomCapacityForHost } from "@/utils/study-room-capacity"
import type { PackagePrice } from "@/states/types"

interface StudyRoomPanelProps {
  mode: "toggle" | "sidebar"
  rooms: any[]
  packagePrices: PackagePrice[]
  currentRoomId: string | null
  currentUser: any
  onJoinRoom: (id: string, pass: string) => { success: boolean, error?: string }
  onCreateRoom: (id: string, pass: string) => { success: boolean, error?: string }
  onLeaveRoom: () => void
  onCloseRoom: () => void
  onSendMessage: (msg: string) => void
  showRoomPanel: boolean
  setShowRoomPanel: (val: boolean) => void
  showRoomSidebar: boolean
  setShowRoomSidebar: (val: boolean) => void
  setCurrentPage: (page: string) => void
  openAuthModal: (mode: any) => void
}

export function StudyRoomPanel({
  mode, rooms, currentRoomId, currentUser, onJoinRoom, onCreateRoom,
  packagePrices,
  onLeaveRoom, onCloseRoom, onSendMessage,
  showRoomPanel, setShowRoomPanel, showRoomSidebar, setShowRoomSidebar,
  setCurrentPage, openAuthModal
}: StudyRoomPanelProps) {
  const [roomActionTab, setRoomActionTab] = useState<"join" | "create">("join")
  const [roomIdInput, setRoomIdInput] = useState("")
  const [roomPasswordInput, setRoomPasswordInput] = useState("")
  const [roomError, setRoomError] = useState("")
  const [roomInput, setRoomInput] = useState("")
  const roomMessagesEndRef = useRef<HTMLDivElement>(null)

  const activeRoom = rooms.find(r => r.id === currentRoomId) ?? null
  const roomMessages = activeRoom?.messages ?? []
  const roomMembers = activeRoom?.members ?? []
  const hostPackageTier = getActiveHostPackageTier(currentUser)
  const createRoomCapacity = getRoomCapacityForHost(currentUser, packagePrices)

  useEffect(() => {
    roomMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [roomMessages])

  if (mode === "sidebar") {
    if (!currentRoomId || !activeRoom || !showRoomSidebar) return null;

    return (
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
                    onCloseRoom()
                  }
                } else {
                  onLeaveRoom()
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
              {roomMembers.map((m: any) => (
                <span
                  key={m.userId}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium border",
                    m.userId === activeRoom.hostId
                      ? "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-900/50"
                      : "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:text-primary-foreground"
                  )}
                >
                  <Users className="h-2.5 w-2.5" />
                  {m.displayName}
                  {m.userId === activeRoom.hostId && <span className="text-[9px] font-bold">(Host)</span>}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Room Chat Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/10">
          {roomMessages.map((msg: any) => {
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
              onSendMessage(roomInput);
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
    )
  }

  return (
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
            {roomActionTab === "create" && currentUser && !createRoomCapacity ? (
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Bạn chưa có gói trả phí còn hiệu lực. Vui lòng nâng cấp lên gói 2-4 người hoặc 5+ người để mở phòng học nhóm.
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
                {roomActionTab === "create" && createRoomCapacity && (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                    Sức chứa theo gói host{" "}
                    <span className="font-semibold text-foreground">
                      {hostPackageTier === "2-4" ? "2-4 người" : "5+ người"}
                    </span>
                    : tối đa <span className="font-semibold text-foreground">{createRoomCapacity}</span> thành viên, kể cả host.
                  </div>
                )}
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
                      const res = onJoinRoom(roomIdInput, roomPasswordInput)
                      if (res.success) {
                        setShowRoomPanel(false)
                        setShowRoomSidebar(true)
                        setRoomIdInput("")
                        setRoomPasswordInput("")
                      } else {
                        setRoomError(res.error || "Không thể tham gia phòng.")
                      }
                    } else {
                      const res = onCreateRoom(roomIdInput, roomPasswordInput)
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
  )
}
