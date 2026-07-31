"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatBytes, type User } from "@/lib/store"
import type { Language, PackagePrice } from "@/states/types"
import { getLocalizedPlanName } from "@/configs/subscription-plan-labels"

function UserSummary({ user, docs, text, packagePrices, language }: {
  user: User
  docs: number
  text: any
  packagePrices: PackagePrice[]
  language: Language
}) {
  const getPackageLabel = (u: User) => {
    if (u.role === "admin" || u.role === "sub-admin") return text.unlimited
    const expired = Boolean(
      u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt).getTime() <= Date.now(),
    )
    const plan = expired
      ? packagePrices.find(item => (item.planName ?? item.tier) === "free")
      : u.subscriptionPlanId == null
        ? packagePrices.find(item => (item.planName ?? item.tier) === (u.subscriptionTier === "2-4" ? "plan_2_4" : u.subscriptionTier === "5+" ? "plan_5_plus" : "free"))
        : packagePrices.find(item => Number(item.id) === Number(u.subscriptionPlanId))
    if (plan) return getLocalizedPlanName(plan, language)
    if (expired) return text.expiredFree
    if (u.subscriptionTier === "2-4") return text.plan2To4
    if (u.subscriptionTier === "5+") return text.plan5Plus
    return language === "vi" ? "Gói Free" : "Free plan"
  }

  return (
    <div className="min-w-64 flex-1">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
            user.role === "admin"
              ? "bg-orange-500"
              : user.role === "sub-admin"
                ? "bg-amber-500"
                : user.isLocked
                  ? "bg-muted-foreground"
                  : "bg-primary"
          )}
        >
          {user.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{user.displayName}</p>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
              {user.role}
            </span>
            {user.isLocked && (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                {text.locked}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {user.email} • {formatBytes(user.storageUsed)} {text.used} • {docs} {text.files} • {text.packageLabel}:{" "}
            <span className="font-semibold text-primary">{getPackageLabel(user)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export function UserTable({
  users,
  documents,
  userSearch,
  onUserSearchChange,
  onLock,
  onReset,
  onGrant,
  onStorageLimit,
  text,
  packagePrices,
  language,
  isSubAdmin
}: {
  users: User[]
  documents: any[]
  userSearch: string
  isSubAdmin: boolean
  onUserSearchChange: (value: string) => void
  onLock: (user: User) => void
  onReset: (user: User) => void
  onGrant: (user: User) => void
  onStorageLimit: (user: User, value: string) => void
  text: any
  packagePrices: PackagePrice[]
  language: Language
}) {
  const filteredUsers = users.filter(
    user =>
      !userSearch ||
      user.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  const docsByUser = users.reduce<Record<string, number>>((acc, user) => {
    acc[user.id] = documents.filter(
      doc => doc.uploadedBy === user.id && doc.status !== "deleted"
    ).length
    return acc
  }, {})

  const canOperate = (user: User) => isSubAdmin ? user.role === "user" : user.role !== "admin"

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-foreground">{text.accounts}</h2>
        <div className="relative min-w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={userSearch}
            onChange={e => onUserSearchChange(e.target.value)}
            placeholder={text.search}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredUsers.map(user => (
          <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
            <UserSummary
              user={user}
              docs={docsByUser[user.id] ?? 0}
              text={text}
              packagePrices={packagePrices}
              language={language}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              {text.storageLimit}
              <input
                type="number"
                min="0.1"
                step="0.1"
                defaultValue={(user.storageLimit / (1024 * 1024 * 1024)).toFixed(1)}
                disabled={!canOperate(user)}
                onBlur={e => onStorageLimit(user, e.target.value)}
                className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              />
              GB
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!canOperate(user)}
                onClick={() => onGrant(user)}
              >
                ✨ {text.grantPackage}
              </Button>
              {/* HIDDEN theo yêu cầu: ẩn nút Reset mật khẩu phía admin
              <Button
                size="sm"
                variant="outline"
                disabled={!canOperate(user)}
                onClick={() => onReset(user)}
              >
                ↻ {text.reset}
              </Button>
              */}
              <Button
                size="sm"
                variant="outline"
                disabled={!canOperate(user)}
                onClick={() => onLock(user)}
              >
                🔒 {user.isLocked ? text.unlock : text.lock}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
