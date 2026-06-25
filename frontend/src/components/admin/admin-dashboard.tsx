"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2, HardDrive, KeyRound, LayoutDashboard, Package,
  Pencil, Plus, QrCode, Sparkles, Trash2, UserCog, Users, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp, type PackageTier, type User } from "@/lib/store"
import { adminText } from "@/configs/admin-i18n"
import { StatsOverview } from "./stats-overview"
import { UserTable } from "./user-table"
import { ConfirmModal } from "./confirm-modal"
import { SubAdminForm } from "./sub-admin-form"

// ─── Editable package type used only in admin UI ───────────────────────────
interface EditablePkg {
  id: string
  tier: string
  name: string
  price: number
  maxUsers: number
  storage: string
  createGroupLimit: number
  joinGroupLimit: number
  hasAiChat: boolean
  hasFlashcards: boolean
  qrLink?: string
}

function pkgFromPrice(pkg: { id: string; tier: string; name: string; price: number; maxUsers: number }): EditablePkg {
  return {
    id: pkg.id,
    tier: pkg.tier,
    name: pkg.name,
    price: pkg.price,
    maxUsers: pkg.maxUsers,
    storage: pkg.tier === "free" ? "512 MB" : pkg.tier === "2-4" ? "1 GB" : "5 GB",
    createGroupLimit: pkg.tier === "free" ? 0 : pkg.tier === "2-4" ? 20 : 50,
    joinGroupLimit: pkg.tier === "free" ? 5 : pkg.tier === "2-4" ? 30 : 60,
    hasAiChat: true,
    hasFlashcards: true,
    qrLink: "",
  }
}

// ─── VietQR link validator ─────────────────────────────────────────────────
type QRValidation = { valid: true } | { valid: false; error: string }

function validateVietQRLink(link: string, price: number): QRValidation {
  if (!link.trim()) return { valid: false, error: "" }
  try {
    const url = new URL(link)
    if (url.hostname !== "api.vietqr.io" || !url.pathname.match(/^\/image\/.+/)) {
      return { valid: false, error: "Link phải có dạng https://api.vietqr.io/image/..." }
    }
    const amountParam = url.searchParams.get("amount")
    if (!amountParam) {
      return { valid: false, error: "Link thiếu tham số amount (số tiền)" }
    }
    const amount = Number(amountParam)
    if (isNaN(amount) || amount < 0) {
      return { valid: false, error: "Tham số amount không hợp lệ" }
    }
    if (amount !== price) {
      return {
        valid: false,
        error: `Số tiền QR (${amount.toLocaleString("vi-VN")}đ) không khớp với giá gói (${price.toLocaleString("vi-VN")}đ)`,
      }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: "Link không hợp lệ" }
  }
}

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

  // ── Package management local state ────────────────────────────────────────
  const [editablePackages, setEditablePackages] = useState<EditablePkg[]>([])
  const [pkgEditId, setPkgEditId] = useState<string | null>(null)
  const [pkgDraft, setPkgDraft] = useState<Partial<EditablePkg>>({})
  const [showAddPkgModal, setShowAddPkgModal] = useState(false)
  const [newPkgForm, setNewPkgForm] = useState({
    name: "", price: 0, storage: "1 GB", createGroupLimit: 20, joinGroupLimit: 30,
  })
  const syncedRef = useRef(false)

  const isAdmin = currentUser?.role === "admin"
  const isSubAdmin = currentUser?.role === "sub-admin"
  const canManage = isAdmin || isSubAdmin
  const text = adminText[language === "vi" ? "vi" : "en"]

  useEffect(() => {
    const syncSection = () => setSection(getStoredAdminSection())
    window.addEventListener(ADMIN_SECTION_EVENT, syncSection)
    return () => window.removeEventListener(ADMIN_SECTION_EVENT, syncSection)
  }, [])

  // Sync editable packages once from backend data on first load
  useEffect(() => {
    if (!syncedRef.current && packagePrices.length > 0) {
      syncedRef.current = true
      setEditablePackages(packagePrices.map(pkgFromPrice))
    }
  }, [packagePrices])

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

  const startEditPkg = (pkg: EditablePkg) => {
    setPkgEditId(pkg.id)
    setPkgDraft({ ...pkg })
  }

  const cancelEditPkg = () => {
    setPkgEditId(null)
    setPkgDraft({})
  }

  const savePkg = (pkg: EditablePkg) => {
    const updated = { ...pkg, ...pkgDraft }
    const isKnownTier = ["free", "2-4", "5+"].includes(pkg.tier)
    if (isKnownTier && updated.price !== pkg.price) {
      const pkgName = updated.name
      requirePassword(
        formatAdminText(text.updatePrice, { name: pkgName }),
        async (password) => {
          const result = await updatePackagePrice(pkg.tier as PackageTier, updated.price, password)
          if (result.success) {
            setEditablePackages(prev => prev.map(p => p.id === pkg.id ? updated : p))
            setMessage(formatAdminText(text.priceUpdated, { name: pkgName }))
          } else {
            setMessage(result.error ?? text.actionFailed)
          }
        }
      )
    } else {
      setEditablePackages(prev => prev.map(p => p.id === pkg.id ? updated : p))
      setMessage(`Đã cập nhật gói "${updated.name}".`)
    }
    setPkgEditId(null)
    setPkgDraft({})
  }

  const deletePkg = (pkg: EditablePkg) => {
    setEditablePackages(prev => prev.filter(p => p.id !== pkg.id))
    setMessage(`Đã xóa gói "${pkg.name}".`)
  }

  const addNewPkg = () => {
    if (!newPkgForm.name.trim()) return
    const id = `pkg-custom-${Date.now()}`
    const newPkg: EditablePkg = {
      id,
      tier: id,
      name: newPkgForm.name,
      price: newPkgForm.price,
      maxUsers: newPkgForm.joinGroupLimit,
      storage: newPkgForm.storage,
      createGroupLimit: newPkgForm.createGroupLimit,
      joinGroupLimit: newPkgForm.joinGroupLimit,
      hasAiChat: true,
      hasFlashcards: true,
    }
    setEditablePackages(prev => [...prev, newPkg])
    setShowAddPkgModal(false)
    setNewPkgForm({ name: "", price: 0, storage: "1 GB", createGroupLimit: 20, joinGroupLimit: 30 })
    setMessage(`Đã thêm gói "${newPkg.name}".`)
  }

  const renderPackages = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Quản lý gói dịch vụ</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {editablePackages.length} gói
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddPkgModal(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Thêm gói
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
                  Mặc định
                </span>
              )}
              {pkg.tier === "2-4" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                  Phổ biến
                </span>
              )}
              {pkg.tier === "5+" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                  Cao cấp
                </span>
              )}

              <div className="flex flex-1 flex-col p-6">
                {/* Package name */}
                {isEditing ? (
                  <input
                    type="text"
                    value={draft.name}
                    onChange={e => setPkgDraft(d => ({ ...d, name: e.target.value }))}
                    className="mb-1 w-full rounded-lg border border-primary bg-background px-3 py-1.5 text-lg font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Tên gói"
                  />
                ) : (
                  <h3 className="mb-1 text-lg font-bold text-foreground">{pkg.name}</h3>
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
                        className="w-36 rounded-lg border border-primary bg-background px-3 py-1.5 text-xl font-extrabold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-sm text-muted-foreground">đ/tháng</span>
                    </div>
                  ) : (
                    <>
                      <span className="text-2xl font-extrabold text-foreground">
                        {pkg.price === 0 ? "Miễn phí" : `${pkg.price.toLocaleString("vi-VN")}đ`}
                      </span>
                      {pkg.price > 0 && <span className="text-xs text-muted-foreground">/tháng</span>}
                    </>
                  )}
                </div>

                {/* Features list */}
                <ul className="mb-6 flex-1 space-y-3 border-t border-border pt-4 text-sm">
                  {/* AI Chat — always on */}
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <span>AI Chat cá nhân hỏi đáp</span>
                  </li>

                  {/* Group limits */}
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {isEditing ? (
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-24 shrink-0">Tạo tối đa:</span>
                          <input
                            type="number"
                            min="0"
                            value={draft.createGroupLimit ?? 0}
                            onChange={e => setPkgDraft(d => ({ ...d, createGroupLimit: Number(e.target.value) }))}
                            className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-xs">nhóm</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-24 shrink-0">Tham gia tối đa:</span>
                          <input
                            type="number"
                            min="0"
                            value={draft.joinGroupLimit ?? 0}
                            onChange={e => setPkgDraft(d => ({ ...d, joinGroupLimit: Number(e.target.value) }))}
                            className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-xs">nhóm</span>
                        </div>
                      </div>
                    ) : (
                      <span>
                        {pkg.createGroupLimit === 0
                          ? `Không tạo nhóm, tham gia tối đa ${pkg.joinGroupLimit} nhóm`
                          : `Tạo tối đa ${pkg.createGroupLimit} nhóm, tham gia tối đa ${pkg.joinGroupLimit} nhóm`}
                      </span>
                    )}
                  </li>

                  {/* Storage */}
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs shrink-0">Dung lượng:</span>
                        <input
                          type="text"
                          value={draft.storage ?? ""}
                          onChange={e => setPkgDraft(d => ({ ...d, storage: e.target.value }))}
                          className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="vd: 1 GB"
                        />
                      </div>
                    ) : (
                      <span>Dung lượng lưu trữ: {pkg.storage}</span>
                    )}
                  </li>

                  {/* Flashcards — always on */}
                  <li className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <span>Tạo flashcards từ tài liệu</span>
                  </li>
                </ul>

                {/* VietQR section */}
                {pkg.price > 0 && (() => {
                  const qrValidation = validateVietQRLink(draft.qrLink ?? "", draft.price)
                  const hasValidQR = !isEditing && pkg.qrLink && validateVietQRLink(pkg.qrLink, pkg.price).valid

                  return isEditing ? (
                    <div className="mb-4 space-y-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <QrCode className="h-3.5 w-3.5" />
                        Mã QR thanh toán (VietQR Quick Link)
                      </p>
                      <textarea
                        rows={3}
                        value={draft.qrLink ?? ""}
                        onChange={e => setPkgDraft(d => ({ ...d, qrLink: e.target.value }))}
                        placeholder="Dán Quick Link từ my.vietqr.io vào đây..."
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      {(draft.qrLink ?? "").trim() !== "" && (
                        <p className={`text-xs font-medium ${qrValidation.valid ? "text-green-600" : "text-destructive"}`}>
                          {qrValidation.valid
                            ? "✓ Link hợp lệ — QR sẽ hiển thị cho người dùng"
                            : `✗ ${(qrValidation as { valid: false; error: string }).error}`}
                        </p>
                      )}
                    </div>
                  ) : hasValidQR ? (
                    <div className="mb-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/20 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <QrCode className="h-3.5 w-3.5" />
                        QR thanh toán
                      </p>
                      <img
                        src={pkg.qrLink}
                        alt={`QR thanh toán ${pkg.name}`}
                        className="h-36 w-36 rounded-lg object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    </div>
                  ) : (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                      <QrCode className="h-4 w-4 shrink-0" />
                      <span>Chưa có mã QR — nhấn Chỉnh sửa để thêm</span>
                    </div>
                  )
                })()}

                {/* Action buttons */}
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 gap-1.5"
                      size="sm"
                      onClick={() => savePkg(pkg)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Cập nhật gói
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
                      Chỉnh sửa
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePkg(pkg)}
                      className="border-destructive/40 px-3 text-destructive hover:bg-destructive/10 hover:border-destructive"
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
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Plus className="h-5 w-5 text-primary" />
                Thêm gói dịch vụ mới
              </h3>
              <button
                onClick={() => setShowAddPkgModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tên gói *</span>
                <input
                  type="text"
                  value={newPkgForm.name}
                  onChange={e => setNewPkgForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="vd: Gói Enterprise"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Giá gói (VNĐ/tháng)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newPkgForm.price}
                    onChange={e => setNewPkgForm(f => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">đ/tháng</span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tạo tối đa (nhóm)</span>
                  <input
                    type="number"
                    min="0"
                    value={newPkgForm.createGroupLimit}
                    onChange={e => setNewPkgForm(f => ({ ...f, createGroupLimit: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Tham gia tối đa (nhóm)</span>
                  <input
                    type="number"
                    min="0"
                    value={newPkgForm.joinGroupLimit}
                    onChange={e => setNewPkgForm(f => ({ ...f, joinGroupLimit: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Dung lượng lưu trữ</span>
                <input
                  type="text"
                  value={newPkgForm.storage}
                  onChange={e => setNewPkgForm(f => ({ ...f, storage: e.target.value }))}
                  placeholder="vd: 10 GB"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddPkgModal(false)}>
                {text.cancel}
              </Button>
              <Button onClick={addNewPkg} disabled={!newPkgForm.name.trim()} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Thêm gói
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
