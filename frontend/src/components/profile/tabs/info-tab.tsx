import { Mail, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/store"
import type { Language, User } from "@/states/types"

interface InfoTabProps {
  currentUser: User
  displayName: string
  setDisplayName: (val: string) => void
  saved: boolean
  error: string
  saving: boolean
  onSave: () => Promise<void>
  storagePercent: number
  language: Language
}

export function InfoTab({
  currentUser,
  displayName,
  setDisplayName,
  saved,
  error,
  saving,
  onSave,
  storagePercent,
  language,
}: InfoTabProps) {
  const text = infoText[language]

  return (
    <div className="max-w-md space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {text.displayName} <span className="text-muted-foreground">({displayName.trim().length}/50)</span>
        </label>
        <input
          id="profile-name"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          maxLength={50}
          disabled={saving}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {error && (
          <p className="mt-1.5 text-sm text-destructive">{error}</p>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{currentUser.email}</span>
          <span className="ml-auto text-xs text-muted-foreground">{text.emailLocked}</span>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">{text.storage}</label>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-muted-foreground">{formatBytes(currentUser.storageUsed)} {text.used}</span>
            <span className="text-muted-foreground">{formatBytes(currentUser.storageLimit)} {text.total}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full transition-all", storagePercent > 80 ? "bg-destructive" : "bg-primary")}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{storagePercent}% {text.used}</p>
        </div>
      </div>
      <Button
        id="save-profile-btn"
        onClick={onSave}
        disabled={saving || !displayName.trim() || displayName.trim().length > 50}
        className="gap-2"
      >
        {saved ? <><CheckCircle2 className="h-4 w-4" />{text.saved}</> : saving ? text.saving : text.save}
      </Button>
    </div>
  )
}

const infoText = {
  vi: {
    displayName: "Tên hiển thị",
    emailLocked: "Tính năng đổi mail sẽ được phát triển trong tương lai",
    storage: "Dung lượng lưu trữ",
    used: "đã dùng",
    total: "tổng",
    save: "Lưu thay đổi",
    saving: "Đang lưu...",
    saved: "Đã lưu!",
  },
  en: {
    displayName: "Display name",
    emailLocked: "Email change feature will be developed in the future",
    storage: "Storage",
    used: "used",
    total: "total",
    save: "Save changes",
    saving: "Saving...",
    saved: "Saved!",
  },
} as const
