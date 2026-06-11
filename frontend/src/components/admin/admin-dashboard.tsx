"use client"

import { useState } from "react"
import {
  KeyRound, LayoutDashboard, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp, type PackageTier, type User } from "@/lib/store"
import { adminText } from "@/configs/admin-i18n"
import { StatsOverview } from "./stats-overview"
import { UserTable } from "./user-table"
import { ConfirmModal } from "./confirm-modal"
import { SubAdminForm } from "./sub-admin-form"

type PendingAction = { label: string; run: (password: string) => void | Promise<void> } | null

export function AdminDashboard() {
  const {
    currentUser, users, documents, language, setCurrentPage, updateUser,
    toggleUserLock, resetUserPassword, deleteUserAccount, createSubAdminAccount,
    packagePrices, updatePackagePrice, grantSubscription, updateUserStorageLimit,
  } = useApp()
  const [userSearch, setUserSearch] = useState("")
  const [message, setMessage] = useState("")
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [adminPassword, setAdminPassword] = useState("")
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState("Reset1234")
  const [resetLoading, setResetLoading] = useState(false)
  const [subAdminForm, setSubAdminForm] = useState({ displayName: "", email: "", password: "" })

  const [grantTarget, setGrantTarget] = useState<User | null>(null)
  const [grantTier, setGrantTier] = useState<PackageTier>("2-4")
  const [grantDuration, setGrantDuration] = useState<number>(1)

  const isAdmin = currentUser?.role === "admin"
  const isSubAdmin = currentUser?.role === "sub-admin"
  const canManage = isAdmin || isSubAdmin

  const text = adminText[language === "vi" ? "vi" : "en"]

  const totalStorage = users.reduce((sum, user) => sum + user.storageUsed, 0)
  const activeUsers = users.filter(user => !user.isLocked).length
  const lockedUsers = users.filter(user => user.isLocked).length

  if (!canManage || !currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <LayoutDashboard className="h-16 w-16 text-destructive" />
        <h2 className="text-xl font-semibold text-foreground">{text.denied}</h2>
        <p className="text-muted-foreground">{text.deniedBody}</p>
        <Button onClick={() => setCurrentPage("home")}>{text.home}</Button>
      </div>
    )
  }

  const requirePassword = (label: string, run: (password: string) => void | Promise<void>) => {
    setPendingAction({ label, run })
    setAdminPassword("")
    setMessage("")
  }

  const confirmAction = async () => {
    await pendingAction?.run(adminPassword)
    setPendingAction(null)
    setAdminPassword("")
  }

  const canTouchAccount = (target: User) => {
    if (target.id === currentUser.id) return false
    if (isSubAdmin && target.role === "admin") return false
    return true
  }

  const canUpdateStorage = (target: User) => canTouchAccount(target) && target.role === "user"

  const runAccountAction = (result: { success: boolean; error?: string }, successText: string) => {
    setMessage(result.success ? successText : result.error ?? text.actionFailed)
  }

  const formatAdminText = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((value, [key, replacement]) => value.replace(`{${key}}`, String(replacement)), template)

  const updateStorageLimit = async (user: User, value: string) => {
    const gb = Number(value)
    if (Number.isFinite(gb) && gb > 0) {
      const currentGb = user.storageLimit / (1024 * 1024 * 1024)
      if (Math.abs(gb - currentGb) < 0.001) return
      const result = await updateUserStorageLimit(user.id, gb)
      runAccountAction(result, formatAdminText(text.storageUpdated, { email: user.email }))
    } else {
      setMessage(text.storagePositive)
    }
  }

  const createSubAdmin = async () => {
    const result = await createSubAdminAccount(subAdminForm.email, subAdminForm.password, subAdminForm.displayName)
    runAccountAction(result, text.createSubAdminSuccess)
    if (result.success) setSubAdminForm({ displayName: "", email: "", password: "" })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <LayoutDashboard className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{text.title}</h1>
              <p className="text-sm text-muted-foreground">{text.subtitle}</p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
            {currentUser.role}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <StatsOverview
          totalUsers={users.length}
          activeUsers={activeUsers}
          lockedUsers={lockedUsers}
          totalStorageUsed={totalStorage}
          text={text}
        />

        {isAdmin && (
          <SubAdminForm
            form={subAdminForm}
            onFormChange={setSubAdminForm}
            onSubmit={createSubAdmin}
            message={message}
            text={text}
          />
        )}

        {/* Cấu hình giá gói dịch vụ */}
        {isAdmin && (
        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {text.packagePrices}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {packagePrices.filter(p => p.tier !== "free").map(pkg => {
              return (
                <div key={pkg.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pkg.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAdminText(text.maxRoomMembers, { count: pkg.maxUsers })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      defaultValue={pkg.price}
                      onBlur={e => {
                        const newPrice = Number(e.target.value)
                        if (!isNaN(newPrice) && newPrice >= 0) {
                          requirePassword(formatAdminText(text.updatePrice, { name: pkg.name }), async (password) => {
                            const result = await updatePackagePrice(pkg.tier, newPrice, password)
                            runAccountAction(result, formatAdminText(text.priceUpdated, { name: pkg.name }))
                          })
                        }
                      }}
                      className="h-9 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground">{text.perMonthVnd}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        )}

        <UserTable
          users={users}
          documents={documents}
          userSearch={userSearch}
          onUserSearchChange={setUserSearch}
          onLock={(user) =>
            requirePassword(
              user.isLocked ? text.unlock : text.lock,
              async () =>
                runAccountAction(
                  await toggleUserLock(user.id),
                  user.isLocked ? text.accountUnlocked : text.accountLocked
                )
            )
          }
          onReset={(user) => setResetTarget(user)}
          onDelete={(user) =>
            requirePassword(
              text.delete,
              () => runAccountAction(deleteUserAccount(user.id), text.accountDeleted)
            )
          }
          onGrant={(user) => {
            setGrantTarget(user)
            setGrantTier(user.subscriptionTier || "free")
            setGrantDuration(1)
          }}
          onStorageLimit={updateStorageLimit}
          text={text}
        />
      </div>

      {pendingAction && (
        <ConfirmModal
          title={pendingAction.label}
          password={adminPassword}
          setPassword={setAdminPassword}
          passwordLabel={text.confirmPassword}
          confirmLabel={text.confirm}
          cancelLabel={text.cancel}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}

      {resetTarget && (() => {
        const hasMinLength = newPassword.length >= 8
        const hasLetter = /[a-zA-Z]/.test(newPassword)
        const hasDigit = /[0-9]/.test(newPassword)
        const isPasswordValid = hasMinLength && hasLetter && hasDigit
        const isDirty = newPassword !== "Reset1234" || newPassword.length === 0

        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">{text.reset}: {resetTarget.email}</h3>
            <div className="mt-4 block text-sm">
              <span className="mb-1 block text-muted-foreground">{text.newPassword}</span>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={"w-full rounded-lg border px-3 py-2 text-sm bg-background " + (!isPasswordValid && isDirty ? "border-destructive focus:ring-destructive" : "border-border")}
              />
              {/* BR-002 inline checklist */}
              <ul className="mt-2 space-y-1">
                <li className={"flex items-center gap-1.5 text-xs " + (hasMinLength ? "text-green-600" : "text-destructive")}>
                  <span>{hasMinLength ? "✓" : "✗"}</span> {text.min8}
                </li>
                <li className={"flex items-center gap-1.5 text-xs " + (hasLetter ? "text-green-600" : "text-destructive")}>
                  <span>{hasLetter ? "✓" : "✗"}</span> {text.hasLetterRule}
                </li>
                <li className={"flex items-center gap-1.5 text-xs " + (hasDigit ? "text-green-600" : "text-destructive")}>
                  <span>{hasDigit ? "✓" : "✗"}</span> {text.hasDigitRule}
                </li>
              </ul>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" disabled={resetLoading} onClick={() => { setResetTarget(null); setNewPassword("Reset1234") }}>{text.cancel}</Button>
              <Button disabled={resetLoading || !isPasswordValid} onClick={async () => {
                setResetLoading(true)
                const result = await resetUserPassword(resetTarget.id, newPassword)
                setResetLoading(false)
                if (result.success) {
                  setMessage(text.resetSuccess)
                  setResetTarget(null)
                  setNewPassword("Reset1234")
                } else {
                  setMessage(result.error ?? text.resetFailed)
                }
              }}><KeyRound className="mr-2 h-4 w-4" />{resetLoading ? text.processing : text.save}</Button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Modal Cấp Gói Dịch Vụ */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              {formatAdminText(text.grantTitle, { email: grantTarget.email })}
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{text.choosePackage}</label>
                <select
                  value={grantTier}
                  onChange={e => setGrantTier(e.target.value as any)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="free">{text.freeCancelPlan}</option>
                  <option value="2-4">{text.package2To4People}</option>
                  <option value="5+">{text.package5PlusPeople}</option>
                </select>
              </div>

              {grantTier !== "free" && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{text.durationLabel}</label>
                  <select
                    value={grantDuration}
                    onChange={e => setGrantDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={1}>{text.month1}</option>
                    <option value={3}>{text.month3}</option>
                    <option value={6}>{text.month6}</option>
                    <option value={12}>{text.month12}</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGrantTarget(null)}>{text.cancel}</Button>
              <Button onClick={() => {
                const planLabel = grantTier === "free" ? "Free" : grantTier === "2-4" ? text.plan2To4 : text.plan5Plus
                requirePassword(formatAdminText(text.grantConfirmTitle, { plan: planLabel, email: grantTarget.email }), async () => {
                  const res = await grantSubscription(grantTarget.id, grantTier, grantDuration)
                  runAccountAction(res, text.grantSuccess)
                  if (res.success) {
                    const storageLimit = grantTier === "free" ? 1024 * 1024 * 512 : grantTier === "2-4" ? 1024 * 1024 * 1024 : 1024 * 1024 * 1024 * 5
                    updateUser(grantTarget.id, { storageLimit })
                  }
                })
                setGrantTarget(null)
              }}>{text.confirm}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

