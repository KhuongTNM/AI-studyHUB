"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchActivityLogsApi } from "@/services/api/activity-logs"
import type { ActivityLog, User } from "@/states/types"

export function useActivityLogs(currentUser: User | null) {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [activityLogsLoading, setActivityLogsLoading] = useState(false)
  const [activityLogsError, setActivityLogsError] = useState<string | null>(null)

  const loadActivityLogs = useCallback(async () => {
    if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) {
      return { success: false, error: "Không có quyền xem nhật ký hoạt động." }
    }

    setActivityLogsLoading(true)
    setActivityLogsError(null)
    try {
      const page = await fetchActivityLogsApi(0, 50)
      setActivityLogs(page.logs)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải nhật ký hoạt động."
      setActivityLogs([])
      setActivityLogsError(message)
      return { success: false, error: message }
    } finally {
      setActivityLogsLoading(false)
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) return
    void loadActivityLogs()
  }, [currentUser?.id, currentUser?.role, loadActivityLogs])

  const addLog = useCallback((action: string, target: string, userId: string) => {
    setActivityLogs(prev => [
      {
        id: `log-${Date.now()}`,
        userId,
        action,
        target,
        timestamp: new Date(),
      },
      ...prev,
    ])
  }, [])

  return { activityLogs, activityLogsLoading, activityLogsError, addLog, loadActivityLogs }
}
