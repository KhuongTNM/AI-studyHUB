import { Mail, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBytes } from "@/lib/store"

interface InfoTabProps {
  currentUser: any
  displayName: string
  setDisplayName: (val: string) => void
  saved: boolean
  onSave: () => void
  storagePercent: number
}

export function InfoTab({
  currentUser,
  displayName,
  setDisplayName,
  saved,
  onSave,
  storagePercent
}: InfoTabProps) {
  return (
    <div className="max-w-md space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Tên hiển thị <span className="text-muted-foreground">({displayName.length}/50)</span>
        </label>
        <input
          id="profile-name"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          maxLength={50}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{currentUser.email}</span>
          <span className="ml-auto text-xs text-muted-foreground">Không thể thay đổi (BR-20)</span>
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Dung lượng lưu trữ</label>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-muted-foreground">{formatBytes(currentUser.storageUsed)} đã dùng</span>
            <span className="text-muted-foreground">{formatBytes(currentUser.storageLimit)} tổng</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full transition-all", storagePercent > 80 ? "bg-destructive" : "bg-primary")}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{storagePercent}% đã sử dụng</p>
        </div>
      </div>
      <Button
        id="save-profile-btn"
        onClick={onSave}
        disabled={!displayName.trim() || displayName.length > 50}
        className="gap-2"
      >
        {saved ? <><CheckCircle2 className="h-4 w-4" />Đã lưu!</> : "Lưu thay đổi"}
      </Button>
    </div>
  )
}
