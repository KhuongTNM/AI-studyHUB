"use client"

import { Users, Lock, HardDrive } from "lucide-react"
import { formatBytes } from "@/lib/store"

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function StatsOverview({
  totalUsers,
  activeUsers,
  lockedUsers,
  totalStorageUsed,
  text,
}: {
  totalUsers: number
  activeUsers: number
  lockedUsers: number
  totalStorageUsed: number
  text: any
}) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={Users} label={text.totalUsers} value={totalUsers} />
      <Stat icon={Users} label={text.activeUsers} value={activeUsers} />
      <Stat icon={Lock} label={text.lockedUsers} value={lockedUsers} />
      <Stat icon={HardDrive} label={text.storageUsed} value={formatBytes(totalStorageUsed)} />
    </div>
  )
}
