"use client"

import { useCallback, useState } from "react"
import { MOCK_ACTIVITY } from "@/states/mock-data"
import type { ActivityLog } from "@/states/types"

export function useActivityLogs() {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(MOCK_ACTIVITY)

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

  return { activityLogs, addLog }
}
