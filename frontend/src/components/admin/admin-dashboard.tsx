"use client"

import { useEffect, useState } from "react"
import {
  KeyRound, LayoutDashboard, Sparkles, UserCog,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp, type PackageTier, type User } from "@/lib/store"
import { adminText } from "@/configs/admin-i18n"
import { StatsOverview } from "./stats-overview"
import { UserTable } from "./user-table"
import { ConfirmModal } from "./confirm-modal"
import { SubAdminForm } from "./sub-admin-form"

type AdminSection = "overview" | "accounts" | "sub-admins" | "packages"
type PendingAction = { label: string; run: (password: string) => void | Promise<void> } | null
const ADMIN_SECTION_EVENT = "admin-section-change"

function getStoredAdminSection(): AdminSection {
  if (typeof window === "undefined") return "overview"
  const stored = window.sessionStorage.getItem("admin-section")
  return ["overview", "accounts", "sub-admins", "packages"].includes(stored ?? "")
    ? stored as AdminSection
    : "overview"
}

export function AdminDashboard() {
  const {
    currentUser, users, documents, language, setCurrentPage, updateUser,
    toggleUserLock, resetUserPassword, createSubAdminAccount,
    packagePrices, updatePackagePrice, grantSubscription, updateUserStorageLimit,
  } = useApp()

  const [section, setSection] = useState<AdminSection>(getStoredAdminSection)
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

  useEffect(() => {
    const syncSection = () => setSection(getStoredAdminSection())
    window.addEventListener(ADMIN_SECTION_EVENT, syncSection)
    return () => window.removeEventListener(ADMIN_SECTION_EVENT, syncSection)
  }, [])

  const selectSection = (nextSection: AdminSection) => {
    window.sessionStorage.setItem("admin-section", nextSection)
    setSection(nextSection)
    window.dispatchEvent(new Event(ADMIN_SECTION_EVENT))
  }

  const totalStorage = users.reduce((sum, user) => sum + user.storageUsed, 0)
  const activeUsers = users.filter(user => !user.isLocked).length
  const lockedUsers = users.filter(user => user.isLocked).length
  const subAdminCount = users.filter(user => user.role === "sub-admin").length
  const normalUserCount = users.filter(user => user.role === "user").length

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

  const formatAdminText = (template: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((value, [key, replacement]) => value.replace(`{${key}}`, String(replacement)), template)

  const runAccountAction = (result: { success: boolean; error?: string }, successText: string) => {
    setMessage(result.success ? successText : result.error ?? text.actionFailed)
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

  const updateStorageLimit = async (user: User, value: string) => {
    const gb = Number(value)
    if (!Number.isFinite(gb) || gb <= 0) {
      setMessage(text.storagePositive)
      return
    }
    const currentGb = user.storageLimit / (1024 * 1024 * 1024)
    if (Math.abs(gb - currentGb) < 0.001) return
    const result = await updateUserStorageLimit(user.id, gb)
    runAccountAction(result, formatAdminText(text.storageUpdated, { email: user.email }))
  }

  const createSubAdmin = async () => {
    const result = await createSubAdminAccount(subAdminForm.email, subAdminForm.password, subAdminForm.displayName)
    runAccountAction(result, text.createSubAdminSuccess)
    if (result.success) setSubAdminForm({ displayName: "", email: "", password: "" })
  }

  const renderOverview = () => (
    <div className="space-y-6">
      <StatsOverview
        totalUsers={users.length}
        activeUsers={activeUsers}
        lockedUsers={lockedUsers}
        totalStorageUsed={totalStorage}
        text={text}
      />
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          {text.adminOverview}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <AdminMetric label={text.normalUsers} value={normalUserCount} />
          <AdminMetric label={text.subAdmins} value={subAdminCount} />
          <AdminMetric label={text.documentsManaged} value={documents.filter(doc => doc.status !== "deleted").length} />
        </div>
      </section>
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
          <UserCog className="h-4 w-4 text-primary" />
          {text.adminTasks}
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AdminTaskButton label={text.accountsPage} body={text.accountsPageHint} onClick={() => selectSection("accounts")} />
          {isAdmin && <AdminTaskButton label={text.subAdminsPage} body={text.subAdminsPageHint} onClick={() => selectSection("sub-admins")} />}
          {isAdmin && <AdminTaskButton label={text.packagesPage} body={text.packagesPageHint} onClick={() => selectSection("packages")} />}
        </div>
      </section>
    </div>
  )

  const renderAccounts = () => (
    <UserTable
      users={users}
      documents={documents}
      userSearch={userSearch}
      isSubAdmin={isSubAdmin}
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
      onGrant={(user) => {
        setGrantTarget(user)
        setGrantTier(user.subscriptionTier || "free")
        setGrantDuration(1)
      }}
      onStorageLimit={updateStorageLimit}
      text={text}
    />
  )

  const renderSubAdmins = () => (
    <div className="space-y-6">
      <SubAdminForm
        form={subAdminForm}
        onFormChange={setSubAdminForm}
        onSubmit={createSubAdmin}
        message={message}
        text={text}
      />
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold text-foreground">{text.currentSubAdmins}</h2>
        <div className="space-y-2">
          {users.filter(user => user.role === "sub-admin").map(user => (
            <div key={user.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">sub-admin</span>
            </div>
          ))}
          {users.filter(user => user.role === "sub-admin").length === 0 && (
            <p className="text-sm text-muted-foreground">{text.noSubAdmins}</p>
          )}
        </div>
      </section>
    </div>
  )

  const renderPackages = () => (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        {text.packagePrices}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {packagePrices.filter(p => p.tier !== "free").map(pkg => {
          const packageName = pkg.tier === "2-4" ? text.package2To4People : text.package5PlusPeople
          return (
          <div key={pkg.id} className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold text-foreground">{packageName}</p>
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
                  if (!isNaN(newPrice) && newPrice >= 0 && newPrice !== pkg.price) {
                    requirePassword(formatAdminText(text.updatePrice, { name: packageName }), async (password) => {
                      const result = await updatePackagePrice(pkg.tier, newPrice, password)
                      runAccountAction(result, formatAdminText(text.priceUpdated, { name: packageName }))
                    })
                  }
                }}
                className="h-9 w-32 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">{text.perMonthVnd}</span>
            </div>
          </div>
        )})}
      </div>
    </section>
  )

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

      <div className="min-h-0 flex-1">
        <main className="h-full min-w-0 overflow-y-auto p-6">
          {message && (
            <div className="mb-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              {message}
            </div>
          )}
          {section === "overview" && renderOverview()}
          {section === "accounts" && renderAccounts()}
          {section === "sub-admins" && isAdmin && renderSubAdmins()}
          {section === "packages" && isAdmin && renderPackages()}
        </main>
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

      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          loading={resetLoading}
          text={text}
          onCancel={() => { setResetTarget(null); setNewPassword("Reset1234") }}
          onSave={async () => {
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
          }}
        />
      )}

      {grantTarget && (
        <GrantPackageModal
          target={grantTarget}
          tier={grantTier}
          duration={grantDuration}
          setTier={setGrantTier}
          setDuration={setGrantDuration}
          text={text}
          formatAdminText={formatAdminText}
          onCancel={() => setGrantTarget(null)}
          onConfirm={() => {
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
          }}
        />
      )}
    </div>
  )
}

function AdminMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function AdminTaskButton({ label, body, onClick }: { label: string; body: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
    >
      <p className="font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </button>
  )
}

function ResetPasswordModal({
  target, newPassword, setNewPassword, loading, text, onCancel, onSave,
}: {
  target: User
  newPassword: string
  setNewPassword: (value: string) => void
  loading: boolean
  text: any
  onCancel: () => void
  onSave: () => void
}) {
  const hasMinLength = newPassword.length >= 8
  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasDigit = /[0-9]/.test(newPassword)
  const isPasswordValid = hasMinLength && hasLetter && hasDigit
  const isDirty = newPassword !== "Reset1234" || newPassword.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">{text.reset}: {target.email}</h3>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-muted-foreground">{text.newPassword}</span>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className={"w-full rounded-lg border px-3 py-2 text-sm bg-background " + (!isPasswordValid && isDirty ? "border-destructive focus:ring-destructive" : "border-border")}
          />
        </label>
        <ul className="mt-2 space-y-1">
          <Rule valid={hasMinLength} label={text.min8} />
          <Rule valid={hasLetter} label={text.hasLetterRule} />
          <Rule valid={hasDigit} label={text.hasDigitRule} />
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" disabled={loading} onClick={onCancel}>{text.cancel}</Button>
          <Button disabled={loading || !isPasswordValid} onClick={onSave}>
            <KeyRound className="mr-2 h-4 w-4" />
            {loading ? text.processing : text.save}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Rule({ valid, label }: { valid: boolean; label: string }) {
  return (
    <li className={"flex items-center gap-1.5 text-xs " + (valid ? "text-green-600" : "text-destructive")}>
      <span>{valid ? "✓" : "✗"}</span> {label}
    </li>
  )
}

function GrantPackageModal({
  target, tier, duration, setTier, setDuration, text, formatAdminText, onCancel, onConfirm,
}: {
  target: User
  tier: PackageTier
  duration: number
  setTier: (tier: PackageTier) => void
  setDuration: (duration: number) => void
  text: any
  formatAdminText: (template: string, values: Record<string, string | number>) => string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">
          {formatAdminText(text.grantTitle, { email: target.email })}
        </h3>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">{text.choosePackage}</span>
            <select
              value={tier}
              onChange={e => setTier(e.target.value as PackageTier)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="free">{text.freeCancelPlan}</option>
              <option value="2-4">{text.package2To4People}</option>
              <option value="5+">{text.package5PlusPeople}</option>
            </select>
          </label>
          {tier !== "free" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">{text.durationLabel}</span>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={1}>{text.month1}</option>
                <option value={3}>{text.month3}</option>
                <option value={6}>{text.month6}</option>
                <option value={12}>{text.month12}</option>
              </select>
            </label>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>{text.cancel}</Button>
          <Button onClick={onConfirm}>{text.confirm}</Button>
        </div>
      </div>
    </div>
  )
}
