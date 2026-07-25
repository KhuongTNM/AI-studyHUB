"use client"

import { useCallback, useEffect, useState } from "react"
import {
  CheckCircle2, Clock, HardDrive, KeyRound, LayoutDashboard, Package,
  Pencil, Plus, RefreshCw, Sparkles, Trash2, UserCog, Users, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp, type ActivityLog, type User } from "@/lib/store"
import type { PackagePrice } from "@/states/types"
import { adminText } from "@/configs/admin-i18n"
import { getLocalizedPlanName, isPlanNameTaken } from "@/configs/subscription-plan-labels"
import { StatsOverview } from "./stats-overview"
import { AdminAnalytics } from "./admin-analytics"
import { UserTable } from "./user-table"
import { ConfirmModal } from "./confirm-modal"
import { SubAdminForm } from "./sub-admin-form"
import {
  createSubscriptionPlanApi,
  deleteSubscriptionPlanApi,
  fetchSubscriptionPlansApi,
  updateSubscriptionPlanApi,
  type ApiSubscriptionPlan,
  type UpdateSubscriptionPlanInput,
} from "@/services/api/subscription-plans"
import { fetchUploadSettingsApi, updateUploadSettingsApi } from "@/services/api/upload-settings"

// ─── Editable package type used only in admin UI ───────────────────────────
interface EditablePkg {
  id: string
  tier: string
  planName: string
  name: string
  price: number
  maxUsers: number
  storage: string
  defaultStorageBytes: number
  createGroupLimit: number
  joinGroupLimit: number
  dailyAiChatLimit: number
  maxFlashcards: number
  hasAiChat: boolean
  hasFlashcards: boolean
}

function tierToPlanName(tier: string) {
  if (tier === "2-4") return "plan_2_4"
  if (tier === "5+") return "plan_5_plus"
  return tier
}

function tierFromPlanName(name: string): string {
  if (name === "plan_2_4") return "2-4"
  if (name === "plan_5_plus") return "5+"
  return name
}

function formatStorage(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1 && Number.isInteger(gb)) return `${gb} GB`
  const mb = bytes / (1024 * 1024)
  if (mb >= 1 && Number.isInteger(mb)) return `${mb} MB`
  return `${bytes} B`
}

function parseStorageBytes(value: string) {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(b|kb|mb|gb)?$/i)
  if (!match) return Number.NaN
  const amount = Number(match[1].replace(",", "."))
  const unit = (match[2] ?? "gb").toLowerCase()
  const multiplier =
    unit === "gb" ? 1024 ** 3 :
    unit === "mb" ? 1024 ** 2 :
    unit === "kb" ? 1024 :
    1
  return Math.round(amount * multiplier)
}

function formatPlanLimit(
  value: number,
  limited: (value: number) => string,
  unlimited: string,
  disabled: string,
) {
  if (value === -1) return unlimited
  if (value === 0) return disabled
  return limited(value)
}

function pkgFromPlan(plan: ApiSubscriptionPlan): EditablePkg {
  const tier = tierFromPlanName(plan.name)
  return {
    id: String(plan.id),
    tier,
    planName: plan.name,
    name: plan.name,
    price: Number(plan.price),
    maxUsers: plan.maxRoomMembers,
    storage: formatStorage(plan.defaultStorageBytes),
    defaultStorageBytes: plan.defaultStorageBytes,
    createGroupLimit: plan.createGroupLimit,
    joinGroupLimit: plan.joinGroupLimit,
    dailyAiChatLimit: plan.dailyAiChatLimit,
    maxFlashcards: plan.maxFlashcards,
    hasAiChat: true,
    hasFlashcards: true,
  }
}

function pkgFromPrice(pkg: PackagePrice): EditablePkg {
  const defaultStorageBytes = pkg.defaultStorageBytes ?? (pkg.tier === "free" ? 512 * 1024 * 1024 : pkg.tier === "2-4" ? 1024 * 1024 * 1024 : 5 * 1024 * 1024 * 1024)
  const joinGroupLimit = pkg.joinGroupLimit ?? (pkg.tier === "free" ? 5 : pkg.tier === "2-4" ? 30 : 60)
  return {
    id: pkg.id,
    tier: pkg.tier,
    planName: pkg.planName ?? tierToPlanName(pkg.tier),
    name: pkg.name,
    price: pkg.price,
    maxUsers: pkg.maxUsers,
    storage: formatStorage(defaultStorageBytes),
    defaultStorageBytes,
    createGroupLimit: pkg.createGroupLimit ?? (pkg.tier === "free" ? 0 : pkg.tier === "2-4" ? 20 : 50),
    joinGroupLimit,
    dailyAiChatLimit: pkg.dailyAiChatLimit ?? 5,
    maxFlashcards: pkg.maxFlashcards ?? 5,
    hasAiChat: true,
    hasFlashcards: true,
  }
}

type AdminSection = "overview" | "accounts" | "sub-admins" | "packages" | "activity-logs" | "upload-settings"
type PendingAction = { label: string; run: (password: string) => void | Promise<void> } | null
const ADMIN_SECTION_EVENT = "admin-section-change"

function getStoredAdminSection(): AdminSection {
  if (typeof window === "undefined") return "overview"
  const stored = window.sessionStorage.getItem("admin-section")
  return ["overview", "accounts", "sub-admins", "packages", "activity-logs", "upload-settings"].includes(stored ?? "")
    ? stored as AdminSection
    : "overview"
}

export function AdminDashboard() {
  const {
    currentUser, users, documents, language, setCurrentPage, updateUser,
    toggleUserLock, resetUserPassword, deleteUserAccount, createSubAdminAccount,
    packagePrices, refetchPackagePrices, grantSubscription, updateUserStorageLimit,
    activityLogs, activityLogsLoading, activityLogsError, loadActivityLogs,
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
  const [grantTier, setGrantTier] = useState("2-4")
  const [grantDuration, setGrantDuration] = useState<number>(1)

  // ── Upload settings — TOÀN HỆ THỐNG, không gắn với gói dịch vụ ───────────
  const [uploadSettings, setUploadSettings] = useState({ maxFileSizeMb: 50, maxFilesPerUpload: 5 })
  const [uploadSettingsLoading, setUploadSettingsLoading] = useState(false)

  // ── Package management local state ────────────────────────────────────────
  const [editablePackages, setEditablePackages] = useState<EditablePkg[]>([])
  const [pkgEditId, setPkgEditId] = useState<string | null>(null)
  const [pkgDraft, setPkgDraft] = useState<Partial<EditablePkg>>({})
  const [showAddPkgModal, setShowAddPkgModal] = useState(false)
  const [addPkgError, setAddPkgError] = useState("")
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [newPkgForm, setNewPkgForm] = useState({
    name: "",
    price: 0,
    maxRoomMembers: 4,
    storage: "1 GB",
    createGroupLimit: 20,
    joinGroupLimit: 30,
    dailyAiChatLimit: 5,
    maxFlashcards: 5,
  })

  const isAdmin = currentUser?.role === "admin"
  const isSubAdmin = currentUser?.role === "sub-admin"
  const canManage = isAdmin || isSubAdmin
  const text = adminText[language === "vi" ? "vi" : "en"]

  useEffect(() => {
    const syncSection = () => setSection(getStoredAdminSection())
    window.addEventListener(ADMIN_SECTION_EVENT, syncSection)
    return () => window.removeEventListener(ADMIN_SECTION_EVENT, syncSection)
  }, [])

  const loadEditablePackages = useCallback(async () => {
    setPackagesLoading(true)
    try {
      const plans = await fetchSubscriptionPlansApi()
      setEditablePackages(plans.map(pkgFromPlan))
    } catch (error) {
      setEditablePackages(packagePrices.map(pkgFromPrice))
      setMessage(error instanceof Error ? error.message : text.actionFailed)
    } finally {
      setPackagesLoading(false)
    }
  }, [packagePrices, text.actionFailed])

  useEffect(() => {
    if (section === "packages") void loadEditablePackages()
  }, [loadEditablePackages, section])

  const loadUploadSettings = useCallback(async () => {
    setUploadSettingsLoading(true)
    try {
      const data = await fetchUploadSettingsApi()
      setUploadSettings({ maxFileSizeMb: data.maxFileSizeMb, maxFilesPerUpload: data.maxFilesPerUpload })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.actionFailed)
    } finally {
      setUploadSettingsLoading(false)
    }
  }, [text.actionFailed])

  useEffect(() => {
    if (section === "upload-settings") void loadUploadSettings()
  }, [loadUploadSettings, section])

  const saveUploadSettings = () => {
    if (!Number.isFinite(uploadSettings.maxFileSizeMb) || uploadSettings.maxFileSizeMb <= 0) {
      setMessage("Dung lượng tối đa mỗi file phải lớn hơn 0.")
      return
    }
    if (!Number.isInteger(uploadSettings.maxFilesPerUpload) || uploadSettings.maxFilesPerUpload < 1) {
      setMessage("Số lượng file tối đa phải từ 1 trở lên.")
      return
    }
    requirePassword("Cập nhật cấu hình upload", async (adminPassword) => {
      try {
        const updated = await updateUploadSettingsApi(
          uploadSettings.maxFileSizeMb,
          uploadSettings.maxFilesPerUpload,
          adminPassword,
        )
        setUploadSettings({ maxFileSizeMb: updated.maxFileSizeMb, maxFilesPerUpload: updated.maxFilesPerUpload })
        setMessage("Đã cập nhật cấu hình upload.")
      } catch (error) {
        setMessage(error instanceof Error ? error.message : text.actionFailed)
      }
    })
  }

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
    if (!adminPassword.trim()) {
      setMessage(text.adminPasswordRequired)
      return
    }
    await pendingAction?.run(adminPassword)
    setPendingAction(null)
    setAdminPassword("")
  }

  const updateStorageLimit = (user: User, value: string) => {
    const gb = Number(value)
    if (!Number.isFinite(gb) || gb <= 0) {
      setMessage(text.storagePositive)
      return
    }
    const currentGb = user.storageLimit / (1024 * 1024 * 1024)
    if (Math.abs(gb - currentGb) < 0.001) return
    requirePassword(
      formatAdminText(text.storageUpdated, { email: user.email }),
      async (adminPassword) => {
        const result = await updateUserStorageLimit(user.id, gb, adminPassword)
        runAccountAction(result, formatAdminText(text.storageUpdated, { email: user.email }))
      },
    )
  }

  const createSubAdmin = () => {
    requirePassword(text.createSubAdmin, async (adminPassword) => {
      const result = await createSubAdminAccount(
        subAdminForm.email,
        subAdminForm.password,
        subAdminForm.displayName,
        adminPassword,
      )
      runAccountAction(result, text.createSubAdminSuccess)
      if (result.success) setSubAdminForm({ displayName: "", email: "", password: "" })
    })
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
      <AdminAnalytics
        users={users}
        packages={packagePrices}
        language={language}
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
          {isAdmin && (
            <AdminTaskButton
              label="Cấu hình Upload"
              body="Chỉnh dung lượng & số lượng file tối đa, áp dụng cho mọi user"
              onClick={() => selectSection("upload-settings")}
            />
          )}
          <AdminTaskButton label={text.activityLogsPage} body={text.activityLogsPageHint} onClick={() => selectSection("activity-logs")} />
        </div>
      </section>
    </div>
  )

  const actorLabel = (log: ActivityLog) => {
    const actor = users.find(user => user.id === log.userId)
    return actor ? `${actor.displayName} (${actor.email})` : log.userId
  }

  const renderActivityLogs = () => (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Clock className="h-5 w-5 text-primary" />
            {text.activityLogsTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{text.activityLogsSubtitle}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={activityLogsLoading}
          onClick={() => void loadActivityLogs()}
        >
          <RefreshCw className={`h-4 w-4 ${activityLogsLoading ? "animate-spin" : ""}`} />
          {text.activityRefresh}
        </Button>
      </div>

      {activityLogsError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {activityLogsError}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">{text.activityAction}</th>
              <th className="px-4 py-3 font-semibold">{text.activityTarget}</th>
              <th className="px-4 py-3 font-semibold">{text.activityUser}</th>
              <th className="px-4 py-3 font-semibold">{text.activityTime}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activityLogsLoading && activityLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {text.activityLoading}
                </td>
              </tr>
            ) : activityLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  {text.activityEmpty}
                </td>
              </tr>
            ) : (
              activityLogs.map(log => (
                <tr key={log.id} className="bg-background/50">
                  <td className="px-4 py-3 font-medium text-foreground">{log.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">{log.target}</td>
                  <td className="px-4 py-3 text-muted-foreground">{actorLabel(log)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {log.timestamp.toLocaleString(language === "vi" ? "vi-VN" : "en-US")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
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
          async (adminPassword) =>
            runAccountAction(
              await toggleUserLock(user.id, adminPassword),
              user.isLocked ? text.accountUnlocked : text.accountLocked
            )
        )
      }
      onReset={(user) => setResetTarget(user)}
      onDelete={(user) =>
        requirePassword(
          `${text.delete}: ${user.email}`,
          async (adminPassword) =>
            runAccountAction(
              await deleteUserAccount(user.id, adminPassword),
              text.accountDeleted,
            ),
        )
      }
      onGrant={(user) => {
        setGrantTarget(user)
        const userPlan = user.subscriptionPlanId == null
          ? packagePrices.find(plan => (plan.planName ?? plan.tier) === tierToPlanName(user.subscriptionTier || "free"))
          : packagePrices.find(plan => Number(plan.id) === Number(user.subscriptionPlanId))
        setGrantTier(userPlan?.planName ?? user.subscriptionTier ?? "free")
        setGrantDuration(1)
      }}
      onStorageLimit={updateStorageLimit}
      text={text}
      packagePrices={packagePrices}
      language={language}
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

  const startEditPkg = (pkg: EditablePkg) => {
    setPkgEditId(pkg.id)
    setPkgDraft({ ...pkg })
  }

  const cancelEditPkg = () => {
    setPkgEditId(null)
    setPkgDraft({})
  }

  const buildPlanUpdatePayload = (pkg: EditablePkg): { error: string } | { payload: UpdateSubscriptionPlanInput } => {
    if (!pkg.name.trim() || pkg.name.trim().length > 50) return { error: "Tên gói phải có từ 1 đến 50 ký tự." }
    if (!Number.isFinite(pkg.price) || pkg.price < 0) return { error: "Giá gói không hợp lệ." }
    if (!Number.isInteger(pkg.createGroupLimit) || pkg.createGroupLimit < -1) return { error: "Giới hạn tạo nhóm phải là số nguyên từ -1 trở lên." }
    if (!Number.isInteger(pkg.joinGroupLimit) || pkg.joinGroupLimit < -1) return { error: "Giới hạn tham gia nhóm phải là số nguyên từ -1 trở lên." }
    if (!Number.isInteger(pkg.dailyAiChatLimit) || pkg.dailyAiChatLimit < -1) return { error: "Giới hạn AI Chat phải là số nguyên từ -1 trở lên." }
    if (!Number.isInteger(pkg.maxFlashcards) || pkg.maxFlashcards < -1) return { error: "Giới hạn flashcard phải là số nguyên từ -1 trở lên." }
    const defaultStorageBytes = parseStorageBytes(pkg.storage)
    if (!Number.isFinite(defaultStorageBytes) || defaultStorageBytes <= 0) return { error: "Dung lượng lưu trữ không hợp lệ." }

    return {
      payload: {
        name: pkg.name.trim(),
        price: pkg.price,
        defaultStorageBytes,
        createGroupLimit: pkg.createGroupLimit,
        joinGroupLimit: pkg.joinGroupLimit,
        dailyAiChatLimit: pkg.dailyAiChatLimit,
        maxFlashcards: pkg.maxFlashcards,
      },
    }
  }

  const savePkg = async (pkg: EditablePkg) => {
    const updated = { ...pkg, ...pkgDraft }
    const payloadResult = buildPlanUpdatePayload(updated)
    if ("error" in payloadResult) {
      setMessage(payloadResult.error)
      return
    }

    const wantsNameChange = updated.name.trim().toLowerCase() !== pkg.name.trim().toLowerCase()
    if (
      wantsNameChange &&
      isPlanNameTaken(updated.name, editablePackages, { excludeId: pkg.id })
    ) {
      setMessage("Tên gói này đã được sử dụng. Vui lòng chọn tên khác.")
      return
    }

    const runSave = async (adminPassword: string) => {
      try {
        const responsePlan = await updateSubscriptionPlanApi(pkg.planName, payloadResult.payload, adminPassword)
        const savedPlan = {
          ...pkgFromPlan(responsePlan),
        }
        setEditablePackages(prev => prev.map(p => p.id === pkg.id ? savedPlan : p))
        // FIXED: đồng bộ luôn packagePrices dùng chung (trang User + form "Cấp gói"),
        // trước đây chỉ có editablePackages cục bộ được cập nhật.
        void refetchPackagePrices()
        setMessage(`Đã cập nhật gói "${savedPlan.name}".`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : text.actionFailed)
      } finally {
        setPkgEditId(null)
        setPkgDraft({})
      }
    }

    requirePassword(formatAdminText(text.updatePackage, { name: updated.name }), runSave)
  }

  const deletePkg = (pkg: EditablePkg) => {
    requirePassword(formatAdminText(text.deletePackage, { name: pkg.name }), async (adminPassword) => {
      try {
        await deleteSubscriptionPlanApi(pkg.planName, adminPassword)
        setEditablePackages(prev => prev.filter(p => p.id !== pkg.id))
        // FIXED: đồng bộ luôn packagePrices dùng chung.
        void refetchPackagePrices()
        setMessage(`Đã xóa gói "${pkg.name}".`)
      } catch (error) {
        setMessage(error instanceof Error ? error.message : text.actionFailed)
      }
    })
  }

  const addNewPkg = () => {
    setAddPkgError("")
    if (!newPkgForm.name.trim()) return
    const defaultStorageBytes = parseStorageBytes(newPkgForm.storage)
    if (!Number.isFinite(defaultStorageBytes) || defaultStorageBytes <= 0) {
      setAddPkgError("Dung lượng mặc định không hợp lệ.")
      return
    }
    if (!Number.isInteger(newPkgForm.maxRoomMembers) || newPkgForm.maxRoomMembers < 1) {
      setAddPkgError("Số thành viên tối đa phải từ 1 trở lên.")
      return
    }
    if (!Number.isInteger(newPkgForm.createGroupLimit) || newPkgForm.createGroupLimit < -1) {
      setAddPkgError("Giới hạn tạo nhóm phải từ -1 trở lên.")
      return
    }
    if (!Number.isInteger(newPkgForm.joinGroupLimit) || newPkgForm.joinGroupLimit < 1) {
      setAddPkgError("Giới hạn tham gia nhóm phải từ 1 trở lên.")
      return
    }
    if (!Number.isInteger(newPkgForm.dailyAiChatLimit) || newPkgForm.dailyAiChatLimit < -1) {
      setAddPkgError("Giới hạn AI Chat phải từ -1 trở lên.")
      return
    }
    if (!Number.isInteger(newPkgForm.maxFlashcards) || newPkgForm.maxFlashcards < -1) {
      setAddPkgError("Giới hạn flashcard phải từ -1 trở lên.")
      return
    }
    if (isPlanNameTaken(newPkgForm.name, editablePackages)) {
      setAddPkgError("Tên gói này đã được sử dụng. Vui lòng chọn tên khác.")
      return
    }

    requirePassword(text.addPackage, async (adminPassword) => {
      try {
        const created = await createSubscriptionPlanApi({
          name: newPkgForm.name.trim(),
          price: newPkgForm.price,
          defaultStorageBytes,
          maxRoomMembers: newPkgForm.maxRoomMembers,
          createGroupLimit: newPkgForm.createGroupLimit,
          joinGroupLimit: newPkgForm.joinGroupLimit,
          dailyAiChatLimit: newPkgForm.dailyAiChatLimit,
          maxFlashcards: newPkgForm.maxFlashcards,
        }, adminPassword)
        const newPkg = pkgFromPlan(created)
        setEditablePackages(prev => [...prev, newPkg])
        // FIXED: đây chính là bug gốc — trước đây gói mới chỉ vào editablePackages
        // (list riêng của trang admin), packagePrices (dùng chung cho user +
        // form "Cấp gói") không hề hay biết, phải F5/login lại mới thấy.
        void refetchPackagePrices()
        setShowAddPkgModal(false)
        setAddPkgError("")
        setNewPkgForm({
          name: "",
          price: 0,
          maxRoomMembers: 4,
          storage: "1 GB",
          createGroupLimit: 20,
          joinGroupLimit: 30,
          dailyAiChatLimit: 5,
          maxFlashcards: 5,
        })
        setMessage(`Đã thêm gói "${newPkg.name}".`)
      } catch (error) {
        setAddPkgError(error instanceof Error ? error.message : text.actionFailed)
      }
    })
  }

  const renderUploadSettings = () => (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-2">
        <HardDrive className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Cấu hình giới hạn Upload</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Áp dụng cho toàn bộ user, hoàn toàn độc lập với gói dịch vụ (subscription plan).
      </p>

      {uploadSettingsLoading ? (
        <p className="text-sm text-muted-foreground">{text.loading}</p>
      ) : (
        <section className="space-y-4 rounded-lg border border-border bg-card p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Dung lượng tối đa mỗi file (MB)
            </span>
            <input
              type="number"
              min="0.1"
              step="1"
              value={uploadSettings.maxFileSizeMb}
              onChange={e => setUploadSettings(s => ({ ...s, maxFileSizeMb: Number(e.target.value) }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Số lượng file tối đa mỗi lần upload
            </span>
            <input
              type="number"
              min="1"
              max="100"
              step="1"
              value={uploadSettings.maxFilesPerUpload}
              onChange={e => setUploadSettings(s => ({ ...s, maxFilesPerUpload: Number(e.target.value) }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>

          <Button onClick={saveUploadSettings} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Lưu cấu hình
          </Button>
        </section>
      )}
    </div>
  )

  const renderPackages = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{text.packageManagement}</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {packagesLoading ? text.loading : formatAdminText(text.packageCount, { count: editablePackages.length })}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => { setAddPkgError(""); setShowAddPkgModal(true) }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          {text.addPackage}
        </Button>
      </div>

      {/* Package cards grid — mirrors the customer view */}
      <div className="grid gap-6 md:grid-cols-3">
        {editablePackages.map((pkg) => {
          const isEditing = pkgEditId === pkg.id
          const draft = isEditing ? { ...pkg, ...pkgDraft } : pkg

          return (
            <div
              key={pkg.id}
              className={`relative flex flex-col rounded-2xl border bg-card transition-all ${
                isEditing
                  ? "border-primary ring-2 ring-primary/20 shadow-lg"
                  : "border-border hover:border-primary/40 hover:shadow-md"
              }`}
            >
              {/* Top badge for known tiers */}
              {pkg.tier === "free" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-muted px-3 py-0.5 text-xs font-semibold text-muted-foreground border border-border">
                  {text.defaultBadge}
                </span>
              )}
              {pkg.tier === "2-4" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                  {text.popularBadge}
                </span>
              )}
              {pkg.tier === "5+" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                  {text.premiumBadge}
                </span>
              )}

              <div className="flex flex-1 flex-col p-6">
                {isEditing ? (
                  <label className="mb-3 block">
                    <span className="mb-1 block text-xs font-semibold text-muted-foreground">{text.packageNameField}</span>
                    <input
                      type="text"
                      maxLength={50}
                      value={draft.name ?? pkg.name}
                      onChange={e => setPkgDraft(d => ({ ...d, name: e.target.value }))}
                      disabled={pkg.planName === "free"}
                      title={pkg.planName === "free" ? text.cannotEditFreeName : undefined}
                      className="w-full rounded-lg border border-primary bg-background px-3 py-1.5 text-lg font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                ) : (
                  <h3 className="mb-3 text-lg font-bold text-foreground">{getLocalizedPlanName(pkg, language)}</h3>
                )}

                {/* Price */}
                <div className="mb-5 flex items-baseline gap-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={draft.price}
                        onChange={e => setPkgDraft(d => ({ ...d, price: Number(e.target.value) }))}
                        disabled={pkg.planName === "free"}
                        title={pkg.planName === "free" ? text.cannotEditFreePrice : undefined}
                        className="w-36 rounded-lg border border-primary bg-background px-3 py-1.5 text-xl font-extrabold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <span className="text-sm text-muted-foreground">{text.vndPerMonth}</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-2xl font-extrabold text-foreground">
                        {pkg.price === 0 ? text.freePrice : `${pkg.price.toLocaleString("vi-VN")}đ`}
                      </span>
                      {pkg.price > 0 && <span className="text-xs text-muted-foreground">{text.perMonth}</span>}
                    </>
                  )}
                </div>

                {/* Features list */}
                <ul className="mb-6 flex-1 space-y-3 border-t border-border pt-4 text-sm">
                  {/* Group limits */}
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {isEditing ? (
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-24 shrink-0">{text.createLimitLabel}</span>
                          <input
                            type="number"
                            min="-1"
                            value={draft.createGroupLimit ?? 0}
                            onChange={e => setPkgDraft(d => ({ ...d, createGroupLimit: Number(e.target.value) }))}
                            title={text.unlimitedInputHint}
                            className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-xs">{text.groupsUnit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-24 shrink-0">{text.joinLimitLabel}</span>
                          <input
                            type="number"
                            min="-1"
                            value={draft.joinGroupLimit ?? 0}
                            onChange={e => setPkgDraft(d => ({ ...d, joinGroupLimit: Number(e.target.value) }))}
                            title={text.unlimitedInputHint}
                            className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-xs">{text.groupsUnit}</span>
                        </div>
                      </div>
                    ) : (
                      <span>
                        {pkg.createGroupLimit === 0
                          ? text.noCreateGroupFeature(formatPlanLimit(pkg.joinGroupLimit, value => `${value} ${text.groupsUnit}`, text.unlimited, text.unlimited))
                          : text.groupLimitsFeature(
                              formatPlanLimit(pkg.createGroupLimit, value => `${value} ${text.groupsUnit}`, text.unlimited, text.unlimited),
                              formatPlanLimit(pkg.joinGroupLimit, value => `${value} ${text.groupsUnit}`, text.unlimited, text.unlimited),
                            )}
                      </span>
                    )}
                  </li>

                  {/* Storage */}
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs">{text.storageShortLabel}</span>
                        <input
                          type="text"
                          value={draft.storage ?? pkg.storage}
                          onChange={e => setPkgDraft(d => ({ ...d, storage: e.target.value }))}
                          placeholder={text.storagePlaceholder}
                          className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <span>{formatAdminText(text.storageFeature, { storage: pkg.storage })}</span>
                    )}
                  </li>

                  {/* Daily AI chat and total flashcard limits are editable in PUT. */}
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs">{text.dailyAiChatLimitField}</span>
                        <input
                          type="number"
                          min="-1"
                          value={draft.dailyAiChatLimit ?? 5}
                          onChange={e => setPkgDraft(d => ({ ...d, dailyAiChatLimit: Number(e.target.value) }))}
                          title={text.unlimitedInputHint}
                          className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <span>{formatPlanLimit(pkg.dailyAiChatLimit, text.aiChatLimitFeature, text.aiChatUnlimitedFeature, text.aiChatDisabledFeature)}</span>
                    )}
                  </li>
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs">{text.maxFlashcardsField}</span>
                        <input
                          type="number"
                          min="-1"
                          value={draft.maxFlashcards ?? 5}
                          onChange={e => setPkgDraft(d => ({ ...d, maxFlashcards: Number(e.target.value) }))}
                          title={text.unlimitedInputHint}
                          className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    ) : (
                      <span>{formatPlanLimit(pkg.maxFlashcards, text.flashcardsLimitFeature, text.flashcardsUnlimitedFeature, text.flashcardsDisabledFeature)}</span>
                    )}
                  </li>
                </ul>

                {/* Action buttons */}
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5"
                      size="sm"
                      onClick={() => savePkg(pkg)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {text.updatePackage}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEditPkg}
                      className="px-3"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 gap-1.5"
                      size="sm"
                      onClick={() => startEditPkg(pkg)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {text.edit}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePkg(pkg)}
                      disabled={pkg.planName === "free"}
                      className="border-destructive/40 px-3 text-destructive hover:bg-destructive/10 hover:border-destructive disabled:cursor-not-allowed disabled:opacity-60"
                      title={pkg.planName === "free" ? text.cannotDeleteFreePlan : text.deletePackage}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Package Modal */}
      {showAddPkgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Plus className="h-5 w-5 text-primary" />
                {text.addPackageTitle}
              </h3>
              <button
                onClick={() => { setShowAddPkgModal(false); setAddPkgError("") }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {addPkgError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {addPkgError}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.packageNameRequired}</span>
                <input
                  type="text"
                  value={newPkgForm.name}
                  onChange={e => setNewPkgForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={text.packageNamePlaceholder}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.packagePriceLabel}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newPkgForm.price}
                    onChange={e => setNewPkgForm(f => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">{text.vndPerMonth}</span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.maxRoomMembersField}</span>
                  <input
                    type="number"
                    min="1"
                    value={newPkgForm.maxRoomMembers}
                    onChange={e => setNewPkgForm(f => ({ ...f, maxRoomMembers: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.createLimitField}</span>
                  <input
                    type="number"
                    min="-1"
                    value={newPkgForm.createGroupLimit}
                    onChange={e => setNewPkgForm(f => ({ ...f, createGroupLimit: Number(e.target.value) }))}
                    title={text.unlimitedInputHint}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.joinLimitField}</span>
                  <input
                    type="number"
                    min="1"
                    value={newPkgForm.joinGroupLimit}
                    onChange={e => setNewPkgForm(f => ({ ...f, joinGroupLimit: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.storageLimit}</span>
                <input
                  type="text"
                  value={newPkgForm.storage}
                  onChange={e => setNewPkgForm(f => ({ ...f, storage: e.target.value }))}
                  placeholder={text.storagePlaceholderLarge}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.dailyAiChatLimitField}</span>
                  <input
                    type="number"
                    min="-1"
                    value={newPkgForm.dailyAiChatLimit}
                    onChange={e => setNewPkgForm(f => ({ ...f, dailyAiChatLimit: Number(e.target.value) }))}
                    title={text.unlimitedInputHint}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{text.maxFlashcardsField}</span>
                  <input
                    type="number"
                    min="-1"
                    value={newPkgForm.maxFlashcards}
                    onChange={e => setNewPkgForm(f => ({ ...f, maxFlashcards: Number(e.target.value) }))}
                    title={text.unlimitedInputHint}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowAddPkgModal(false); setAddPkgError("") }}>
                {text.cancel}
              </Button>
              <Button onClick={addNewPkg} disabled={!newPkgForm.name.trim()} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {text.addPackage}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
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
          {section === "upload-settings" && isAdmin && renderUploadSettings()}
          {section === "activity-logs" && renderActivityLogs()}
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
            requirePassword(text.reset, async (adminPassword) => {
              setResetLoading(true)
              const result = await resetUserPassword(resetTarget.id, newPassword, adminPassword)
              setResetLoading(false)
              if (result.success) {
                setMessage(text.resetSuccess)
                setResetTarget(null)
                setNewPassword("Reset1234")
              } else {
                setMessage(result.error ?? text.resetFailed)
              }
            })
          }}
        />
      )}

      {grantTarget && (
        <GrantPackageModal
          target={grantTarget}
          plans={packagePrices}
          language={language}
          tier={grantTier}
          duration={grantDuration}
          setTier={setGrantTier}
          setDuration={setGrantDuration}
          text={text}
          formatAdminText={formatAdminText}
          onCancel={() => setGrantTarget(null)}
          onConfirm={() => {
            const selectedPlan = packagePrices.find(plan => (plan.planName ?? plan.tier) === grantTier)
            const planLabel = selectedPlan
              ? getLocalizedPlanName(selectedPlan, language)
              : grantTier
            requirePassword(formatAdminText(text.grantConfirmTitle, { plan: planLabel, email: grantTarget.email }), async (adminPassword) => {
              const res = await grantSubscription(grantTarget.id, grantTier, grantDuration, adminPassword)
              runAccountAction(res, text.grantSuccess)
              if (res.success) {
                if (selectedPlan?.defaultStorageBytes) {
                  updateUser(grantTarget.id, { storageLimit: selectedPlan.defaultStorageBytes })
                }
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
  target, plans, language, tier, duration, setTier, setDuration, text, formatAdminText, onCancel, onConfirm,
}: {
  target: User
  plans: PackagePrice[]
  language: "vi" | "en"
  tier: string
  duration: number
  setTier: (tier: string) => void
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
              onChange={e => setTier(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {plans.map(plan => (
                <option key={plan.id} value={plan.planName ?? plan.tier}>
                  {getLocalizedPlanName(plan, language)}
                </option>
              ))}
            </select>
          </label>
          {Boolean(plans.find(plan => (plan.planName ?? plan.tier) === tier)?.price) && (
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
