import { AlertCircle, Copy, FileText, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type ChatMessage } from "@/lib/store"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface ChatMessageProps {
  message: ChatMessage
  copiedId: string | null
  onCopy: (id: string, content: string) => void
}

export function ChatMessageItem({
  message,
  copiedId,
  onCopy,
}: ChatMessageProps) {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })

  const isEmptyStreaming = message.role === "assistant" && message.isStreaming && !message.content.trim()

  return (
    <div
      className={cn(
        "flex gap-3",
        message.role === "user" ? "justify-end" : "justify-start",
      )}
    >
      {message.role === "assistant" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70">
          <Sparkles className={cn("h-4 w-4 text-primary-foreground", message.isStreaming && "animate-pulse")} />
        </div>
      )}
      <div className="max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            message.role === "user"
              ? "bg-primary text-primary-foreground"
              : message.error
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-foreground",
          )}
        >
          {isEmptyStreaming ? (
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-foreground/40" />
            </div>
          ) : message.role === "assistant" ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
            </p>
          )}

          {message.error && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>Không thể kết nối tới AI</span>
            </div>
          )}
        </div>

        {!!message.sources?.length && !message.isStreaming && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Nguồn tham khảo:</p>
            {message.sources.map((source, idx) => (
              <div
                key={idx}
                className="flex items-start gap-1.5 rounded-lg border border-border bg-card/50 px-2.5 py-1.5 text-xs text-muted-foreground"
              >
                <FileText className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-2">
                  {source.documentName ? `${source.documentName}: ` : ""}
                  {source.content}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          className={cn(
            "mt-1 flex items-center gap-1",
            message.role === "user" ? "justify-end" : "justify-start",
          )}
        >
          <span className="text-xs text-muted-foreground">{formatTime(new Date(message.timestamp))}</span>
          {message.role === "assistant" && !message.isStreaming && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onCopy(message.id, message.content)}
                title="Sao chép"
              >
                <Copy className={cn("h-3 w-3", copiedId === message.id ? "text-green-500" : "")} />
              </Button>
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
