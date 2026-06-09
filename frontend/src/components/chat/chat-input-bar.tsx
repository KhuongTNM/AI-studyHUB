import { useRef } from "react"
import { Send, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChatInputBarProps {
  input: string
  setInput: (val: string) => void
  isLoading: boolean
  onSend: (content: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  currentUser: any
  openAuthModal: (mode: any) => void
  maxLength: number
}

export function ChatInputBar({
  input,
  setInput,
  isLoading,
  onSend,
  onKeyDown,
  currentUser,
  openAuthModal,
  maxLength
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  return (
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
        onSubmit={e => { e.preventDefault(); onSend(input) }}
        className="mx-auto max-w-3xl"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={currentUser ? "Nhập câu hỏi của bạn... (Enter để gửi)" : "Đăng nhập để sử dụng AI Chatbot"}
            rows={1}
            maxLength={maxLength}
            disabled={!currentUser}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <div className="flex flex-col items-end gap-1">
            {input.length > maxLength * 0.8 && (
              <span className={cn("text-xs", input.length >= maxLength ? "text-destructive" : "text-muted-foreground")}>
                {input.length}/{maxLength}
              </span>
            )}
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading || !currentUser || input.length > maxLength}
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
  )
}
