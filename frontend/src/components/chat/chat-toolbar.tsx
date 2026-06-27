import { Plus, FileText, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Language } from "@/states/types"

interface ChatToolbarProps {
  onNewChat: () => void
  documents: any[]
  selectedDocId: string | null
  onSelectDoc: (id: string | null) => void
  showDocPicker: boolean
  setShowDocPicker: (val: boolean) => void
  language: Language
  children?: React.ReactNode
}

export function ChatToolbar({
  onNewChat,
  documents,
  selectedDocId,
  onSelectDoc,
  showDocPicker,
  setShowDocPicker,
  language,
  children,
}: ChatToolbarProps) {
  const availableDocs = documents.filter(d => d.status === "ready")
  const selectedDoc = availableDocs.find(d => d.id === selectedDocId)
  const text = toolbarText[language]

  return (
    <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
      <Button
        id="new-chat-btn-chat"
        variant="outline"
        size="sm"
        onClick={onNewChat}
        className="gap-1.5"
      >
        <Plus className="h-3 w-3" />
        {text.newChat}
      </Button>

      <div className="relative">
        <Button
          id="doc-picker-btn"
          variant="outline"
          size="sm"
          onClick={() => setShowDocPicker(!showDocPicker)}
          className={cn("gap-1.5", selectedDoc && "border-primary/50 bg-primary/5 text-primary")}
        >
          <FileText className="h-3 w-3" />
          {selectedDoc ? selectedDoc.name.slice(0, 20) + "..." : text.selectDocument}
          <ChevronDown className="h-3 w-3" />
        </Button>
        {showDocPicker && (
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-card shadow-xl">
            <div className="max-h-48 overflow-y-auto p-1">
              <button
                onClick={() => { onSelectDoc(null); setShowDocPicker(false) }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                {text.noDocument}
              </button>
              {availableDocs.map(doc => (
                <button
                  key={doc.id}
                  onClick={() => { onSelectDoc(doc.id); setShowDocPicker(false) }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                    selectedDocId === doc.id ? "bg-primary/10 text-primary" : "text-foreground",
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

      {children}

      {selectedDoc && (
        <span className="ml-auto hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary sm:flex">
          <FileText className="h-3 w-3" />
          {text.chattingWith}: {selectedDoc.name.slice(0, 25)}
        </span>
      )}
    </div>
  )
}

const toolbarText = {
  vi: {
    newChat: "Chat mới",
    selectDocument: "Chọn tài liệu",
    noDocument: "Không chọn tài liệu",
    chattingWith: "Đang chat với",
  },
  en: {
    newChat: "New chat",
    selectDocument: "Select document",
    noDocument: "No document",
    chattingWith: "Chatting with",
  },
} as const
