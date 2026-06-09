import { Clock } from "lucide-react"

interface HistoryTabProps {
  logs: any[]
}

export function HistoryTab({ logs }: HistoryTabProps) {
  return (
    <div>
      <h3 className="mb-4 font-semibold text-foreground">Lịch sử hoạt động</h3>
      {logs.length === 0 ? (
        <p className="text-muted-foreground">Chưa có hoạt động nào.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{log.action}</p>
                <p className="text-xs text-muted-foreground">{log.target}</p>
              </div>
              <span className="text-xs text-muted-foreground">
                {log.timestamp.toLocaleString("vi-VN")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
