import { Sparkles, Copy, Share2, ThumbsUp, ThumbsDown, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type ChatMessage } from "@/lib/store"

interface ChatMessageProps {
  message: ChatMessage
  copiedId: string | null
  onCopy: (id: string, content: string) => void
  onShare?: (content: string) => void
  currentRoomId: string | null
}

export function ChatMessageItem({
  message,
  copiedId,
  onCopy,
  onShare,
  currentRoomId
}: ChatMessageProps) {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })

  return (
    <div
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
          <span className="text-xs text-muted-foreground">{formatTime(new Date(message.timestamp))}</span>
          {message.role === "assistant" && (
            <>
              <Button
                variant="ghost" size="icon" className="h-5 w-5"
                onClick={() => onCopy(message.id, message.content)}
                title="Sao chép"
              >
                <Copy className={cn("h-3 w-3", copiedId === message.id ? "text-green-500" : "")} />
              </Button>
              {currentRoomId && onShare && (
                <Button
                  variant="ghost" size="icon" className="h-5 w-5 text-primary hover:text-primary/80"
                  onClick={() => onShare(message.content)}
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
  )
}
