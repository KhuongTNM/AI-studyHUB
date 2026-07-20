import { AlertCircle, Copy, FileText, Sparkles, ThumbsDown, ThumbsUp, User } from "lucide-react"
import { type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type ChatMessage } from "@/lib/store"

function normalizeMarkdown(content: string) {
  return content
    .replace(/\\\*/g, "*")
    .replace(/\\_/g, "_")
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }

    return <span key={index}>{part}</span>
  })
}

function MarkdownMessage({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const normalized = normalizeMarkdown(content)
  const lines = normalized.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let listItems: ReactNode[] = []
  let listType: "ol" | "ul" | null = null

  const flushList = () => {
    if (!listType || listItems.length === 0) return

    const className = "my-2 space-y-1 pl-5"
    blocks.push(
      listType === "ol" ? (
        <ol key={`list-${blocks.length}`} className={cn(className, "list-decimal")}>
          {listItems}
        </ol>
      ) : (
        <ul key={`list-${blocks.length}`} className={cn(className, "list-disc")}>
          {listItems}
        </ul>
      ),
    )
    listItems = []
    listType = null
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      blocks.push(<div key={`space-${index}`} className="h-2" />)
      return
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.+)$/)
    const unordered = trimmed.match(/^[*-]\s+(.+)$/)

    if (ordered || unordered) {
      const nextType = ordered ? "ol" : "ul"
      if (listType && listType !== nextType) flushList()
      listType = nextType
      listItems.push(
        <li key={`item-${index}`} className="pl-1">
          {renderInlineMarkdown((ordered?.[2] ?? unordered?.[1] ?? "").trim())}
        </li>,
      )
      return
    }

    flushList()
    blocks.push(
      <p key={`p-${index}`} className="my-1">
        {renderInlineMarkdown(trimmed)}
      </p>,
    )
  })

  flushList()

  return (
    <div className="text-sm leading-relaxed">
      {blocks}
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
      )}
    </div>
  )
}

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
            <MarkdownMessage content={message.content} isStreaming={message.isStreaming} />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
              {message.isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/60 align-middle" />
              )}
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
