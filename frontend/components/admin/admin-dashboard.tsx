"use client"

import { useMemo, useState } from "react"
import {
  HardDrive, KeyRound, LayoutDashboard, Lock, Plus, RotateCcw,
  Search, Sparkles, Trash2, Unlock, Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, formatBytes, type PackageTier, type User } from "@/lib/store"

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
  const [subAdminForm, setSubAdminForm] = useState({ displayName: "", email: "", password: "" })

  const [grantTarget, setGrantTarget] = useState<User | null>(null)
  const [grantTier, setGrantTier] = useState<PackageTier>("2-4")
  const [grantDuration, setGrantDuration] = useState<number>(1)

  const isAdmin = currentUser?.role === "admin"
  const isSubAdmin = currentUser?.role === "sub-admin"
  const canManage = isAdmin || isSubAdmin

  const text = language === "vi" ? {
    denied: "Không có quyền truy cập",
    deniedBody: "Chỉ Admin hoặc sub-admin mới có thể truy cập trang quản trị.",
    home: "Về trang chủ",
    title: "Admin Dashboard",
    subtitle: "Quản lý tài khoản, thống kê người dùng và giới hạn dung lượng.",
    totalUsers: "Tổng người dùng",
    activeUsers: "Đang hoạt động",
    lockedUsers: "Tài khoản bị khóa",
    storageUsed: "Dung lượng đã dùng",
    accounts: "Quản lý tài khoản",
    search: "Tìm theo tên hoặc email",
    storageLimit: "Giới hạn dung lượng",
    reset: "Reset mật khẩu",
    lock: "Khóa",
    unlock: "Mở khóa",
    delete: "Xóa tài khoản",
    createSubAdmin: "Tạo acc sub-admin",
    displayName: "Tên hiển thị",
    password: "Mật khẩu",
    confirmPassword: "Xác thực mật khẩu Admin",
    confirm: "Xác nhận",
    cancel: "Hủy",
    newPassword: "Mật khẩu mới",
    save: "Lưu",
  } : {
    denied: "Access denied",
    deniedBody: "Only Admin or sub-admin accounts can open this dashboard.",
    home: "Back home",
    title: "Admin Dashboard",
    subtitle: "Manage accounts, user statistics, and user storage limits.",
    totalUsers: "Total users",
    activeUsers: "Active users",
    lockedUsers: "Locked accounts",
    storageUsed: "Storage used",
    accounts: "Account management",
    search: "Search by name or email",
    storageLimit: "Storage limit",
    reset: "Reset password",
    lock: "Lock",
    unlock: "Unlock",
    delete: "Delete account",
    createSubAdmin: "Create sub-admin",
    displayName: "Display name",
    password: "Password",
    confirmPassword: "Confirm Admin password",
    confirm: "Confirm",
    cancel: "Cancel",
    newPassword: "New password",
    save: "Save",
  }

  const filteredUsers = users.filter(user =>
    !userSearch ||
    user.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  const totalStorage = users.reduce((sum, user) => sum + user.storageUsed, 0)
  const activeUsers = users.filter(user => !user.isLocked).length
  const lockedUsers = users.filter(user => user.isLocked).length
  const docsByUser = useMemo(() => {
    return users.reduce<Record<string, number>>((acc, user) => {
      acc[user.id] = documents.filter(doc => doc.uploadedBy === user.id && doc.status !== "deleted").length
      return acc
    }, {})
  }, [documents, users])

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
    setMessage(result.success ? successText : result.error ?? "Không thể thực hiện thao tác.")
  }

  const updateStorageLimit = async (user: User, value: string) => {
    const gb = Number(value)
    if (Number.isFinite(gb) && gb > 0) {
      const currentGb = user.storageLimit / (1024 * 1024 * 1024)
      if (Math.abs(gb - currentGb) < 0.001) return
      const result = await updateUserStorageLimit(user.id, gb)
      runAccountAction(result, `Đã cập nhật dung lượng cho ${user.email}.`)
    } else {
      setMessage("Giới hạn dung lượng phải lớn hơn 0 GB.")
    }
  }

  const createSubAdmin = () => {
    const result = createSubAdminAccount(subAdminForm.email, subAdminForm.password, subAdminForm.displayName)
    runAccountAction(result, "Đã tạo tài khoản sub-admin.")
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
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Users} label={text.totalUsers} value={users.length} />
          <Stat icon={Users} label={text.activeUsers} value={activeUsers} />
          <Stat icon={Lock} label={text.lockedUsers} value={lockedUsers} />
          <Stat icon={HardDrive} label={text.storageUsed} value={formatBytes(totalStorage)} />
        </div>

        {isAdmin && (
          <section className="mb-6 rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-semibold text-foreground">{text.createSubAdmin}</h2>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <input value={subAdminForm.displayName} onChange={e => setSubAdminForm({ ...subAdminForm, displayName: e.target.value })} placeholder={text.displayName} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input value={subAdminForm.email} onChange={e => setSubAdminForm({ ...subAdminForm, email: e.target.value })} placeholder="subadmin@example.com" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <input type="password" value={subAdminForm.password} onChange={e => setSubAdminForm({ ...subAdminForm, password: e.target.value })} placeholder={text.password} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <Button disabled={!subAdminForm.displayName || !subAdminForm.email || !subAdminForm.password} onClick={() => requirePassword(text.createSubAdmin, createSubAdmin)}>
                <Plus className="mr-2 h-4 w-4" />{text.createSubAdmin}
              </Button>
            </div>
          </section>
        )}

        {/* Cấu hình giá gói dịch vụ */}
        {isAdmin && (
        <section className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Cấu hình giá các gói dịch vụ
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {packagePrices.filter(p => p.tier !== "free").map(pkg => {
              return (
                <div key={pkg.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{pkg.name}</p>
                    <p className="text-xs text-muted-foreground">Tối đa {pkg.maxUsers} người tham gia phòng</p>
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
                          requirePassword(`Cập nhật giá ${pkg.name}`, async (password) => {
                            const result = await updatePackagePrice(pkg.tier, newPrice, password)
                            runAccountAction(result, `Đã cập nhật giá ${pkg.name}.`)
                          })
                        }
                      }}
                      className="h-9 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-xs text-muted-foreground">VND/tháng</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
        )}

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground">{text.accounts}</h2>
            <div className="relative min-w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder={text.search} className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
            </div>
          </div>

          <div className="space-y-3">
            {filteredUsers.map(user => (
              <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
                <UserSummary user={user} docs={docsByUser[user.id] ?? 0} />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {text.storageLimit}
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    defaultValue={(user.storageLimit / (1024 * 1024 * 1024)).toFixed(1)}
                    disabled={!canUpdateStorage(user)}
                    onBlur={e => updateStorageLimit(user, e.target.value)}
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  GB
                </label>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!canTouchAccount(user)} onClick={() => {
                    setGrantTarget(user)
                    setGrantTier(user.subscriptionTier || "free")
                    setGrantDuration(1)
                  }}>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />Cấp gói
                  </Button>
                  <Button size="sm" variant="outline" disabled={!canTouchAccount(user)} onClick={() => setResetTarget(user)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{text.reset}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!canTouchAccount(user)} onClick={() => requirePassword(user.isLocked ? text.unlock : text.lock, () => runAccountAction(toggleUserLock(user.id), user.isLocked ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản."))}>
                    {user.isLocked ? <Unlock className="mr-1.5 h-3.5 w-3.5" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}
                    {user.isLocked ? text.unlock : text.lock}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!canTouchAccount(user)} className="text-destructive hover:text-destructive" onClick={() => requirePassword(text.delete, () => runAccountAction(deleteUserAccount(user.id), "Đã xóa tài khoản."))}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />{text.delete}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {message && <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{message}</p>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">{text.reset}: {resetTarget.email}</h3>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-muted-foreground">{text.newPassword}</span>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetTarget(null)}>{text.cancel}</Button>
              <Button onClick={() => {
                runAccountAction(resetUserPassword(resetTarget.id, newPassword), "Đã reset mật khẩu.")
                setResetTarget(null)
                setNewPassword("Reset1234")
              }}><KeyRound className="mr-2 h-4 w-4" />{text.save}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cấp Gói Dịch Vụ */}
      {grantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Cấp gói dịch vụ cho: {grantTarget.email}</h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Chọn gói dịch vụ</label>
                <select
                  value={grantTier}
                  onChange={e => setGrantTier(e.target.value as any)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="free">Gói Free (Hủy gói)</option>
                  <option value="2-4">Gói 2-4 người</option>
                  <option value="5+">Gói 5+ người</option>
                </select>
              </div>

              {grantTier !== "free" && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Thời hạn sử dụng (Gia hạn thêm)</label>
                  <select
                    value={grantDuration}
                    onChange={e => setGrantDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={1}>1 tháng</option>
                    <option value={3}>3 tháng</option>
                    <option value={6}>6 tháng</option>
                    <option value={12}>12 tháng</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGrantTarget(null)}>Hủy</Button>
              <Button onClick={() => {
                requirePassword(`Cấp gói ${grantTier === "free" ? "Free" : grantTier === "2-4" ? "2-4 người" : "5+ người"} cho ${grantTarget.email}`, () => {
                  const res = grantSubscription(grantTarget.id, grantTier, grantDuration)
                  runAccountAction(res, "Đã cấp gói dịch vụ thành công.")
                  if (res.success) {
                    const storageLimit = grantTier === "free" ? 1024 * 1024 * 512 : grantTier === "2-4" ? 1024 * 1024 * 1024 : 1024 * 1024 * 1024 * 5
                    updateUser(grantTarget.id, { storageLimit })
                  }
                })
                setGrantTarget(null)
              }}>Xác nhận</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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

function UserSummary({ user, docs }: { user: User; docs: number }) {
  const getPackageLabel = (u: User) => {
    if (u.role === "admin" || u.role === "sub-admin") return "Vô hạn"
    if (u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt).getTime() < Date.now()) return "Free (Hết hạn)"
    if (u.subscriptionTier === "2-4") return "2-4 người"
    if (u.subscriptionTier === "5+") return "5+ người"
    return "Free"
  }

  return (
    <div className="min-w-64 flex-1">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", user.role === "admin" ? "bg-orange-500" : user.role === "sub-admin" ? "bg-amber-500" : user.isLocked ? "bg-muted-foreground" : "bg-primary")}>
          {user.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{user.displayName}</p>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{user.role}</span>
            {user.isLocked && <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">locked</span>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {user.email} • {formatBytes(user.storageUsed)} used • {docs} files • Gói: <span className="font-semibold text-primary">{getPackageLabel(user)}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({
  title, password, setPassword, passwordLabel, confirmLabel, cancelLabel, onConfirm, onCancel,
}: {
  title: string
  password: string
  setPassword: (value: string) => void
  passwordLabel: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={passwordLabel}
          className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
