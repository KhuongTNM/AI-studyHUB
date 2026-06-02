"use client"

import { useEffect, useState } from "react"
import { User, Mail, Lock, Clock, Eye, EyeOff, CheckCircle2, AlertCircle, Camera, Shield, Zap, CreditCard, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, formatBytes, type PackageTier } from "@/lib/store"

type ProfileTab = "info" | "history" | "security" | "packages"

export function ProfilePage() {
  const { currentUser, updateUser, activityLogs, openAuthModal, packagePrices, buySubscription } = useApp()
  const [tab, setTab] = useState<ProfileTab>("info")
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "")
  const [showPass, setShowPass] = useState(false)
  const [oldPass, setOldPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [saved, setSaved] = useState(false)
  const [passError, setPassError] = useState("")
  const [passSuccess, setPassSuccess] = useState("")

  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PackageTier | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"qr" | "card" | "wallet">("qr")
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)

  useEffect(() => {
    const openPackagesTab = () => {
      setTab("packages")
      sessionStorage.removeItem("profile-tab")
    }

    if (sessionStorage.getItem("profile-tab") === "packages") {
      openPackagesTab()
    }

    window.addEventListener("profile-tab-packages", openPackagesTab)
    return () => window.removeEventListener("profile-tab-packages", openPackagesTab)
  }, [])

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <User className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Chưa đăng nhập</h2>
        <p className="text-muted-foreground">Đăng nhập để xem hồ sơ cá nhân</p>
        <Button onClick={() => openAuthModal("login")}>Đăng nhập ngay</Button>
      </div>
    )
  }

  const userLogs = activityLogs.filter(l => l.userId === currentUser.id)
  const avatarInitials = currentUser.displayName.slice(0, 2).toUpperCase()
  const storagePercent = Math.round((currentUser.storageUsed / currentUser.storageLimit) * 100)

  const handleSaveInfo = () => {
    if (!displayName.trim()) return
    if (displayName.length > 50) return
    updateUser(currentUser.id, { displayName: displayName.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleChangePassword = () => {
    setPassError("")
    setPassSuccess("")
    if (!oldPass) { setPassError("Nhập mật khẩu hiện tại."); return }
    if (newPass.length < 8) { setPassError("Mật khẩu mới phải có ít nhất 8 ký tự."); return }
    if (!/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) { setPassError("Mật khẩu cần chứa chữ và số."); return }
    if (newPass !== confirmPass) { setPassError("Mật khẩu xác nhận không khớp."); return }
    setPassSuccess("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.")
    setOldPass(""); setNewPass(""); setConfirmPass("")
  }

  const tabs: { id: ProfileTab; label: string; icon: React.ElementType }[] = [
    { id: "info", label: "Thông tin", icon: User },
    { id: "packages", label: "Gói dịch vụ", icon: Zap },
    { id: "history", label: "Lịch sử", icon: Clock },
    { id: "security", label: "Bảo mật", icon: Lock },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-6 py-4">
        <h1 className="text-xl font-bold text-foreground">Hồ sơ cá nhân</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-8">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className={cn(
                "flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold text-white",
                currentUser.role === "admin" || currentUser.role === "sub-admin" ? "bg-orange-500" : "bg-primary"
              )}>
                {avatarInitials}
              </div>
              <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-border shadow-sm hover:bg-muted transition-colors">
                <Camera className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{currentUser.displayName}</h2>
              <p className="text-muted-foreground">{currentUser.email}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  currentUser.role === "admin" || currentUser.role === "sub-admin" ? "bg-orange-100 text-orange-700" : "bg-primary/10 text-primary"
                )}>
                  {currentUser.role === "admin" ? "Admin" : currentUser.role === "sub-admin" ? "Sub-admin" : "Sinh viên"}
                </span>
                {currentUser.emailVerified && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> Đã xác thực
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Dung lượng đã dùng", value: formatBytes(currentUser.storageUsed) },
              { label: "Hoạt động gần đây", value: userLogs.length + " thao tác" },
              { label: "Ngày tham gia", value: currentUser.createdAt.toLocaleDateString("vi-VN") },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-border bg-card/50 p-3 text-center">
                <p className="text-sm font-semibold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* INFO TAB */}
          {tab === "info" && (
            <div className="max-w-md space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Tên hiển thị <span className="text-muted-foreground">({displayName.length}/50)</span>
                </label>
                <input
                  id="profile-name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  maxLength={50}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{currentUser.email}</span>
                  <span className="ml-auto text-xs text-muted-foreground">Không thể thay đổi (BR-20)</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Dung lượng lưu trữ</label>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">{formatBytes(currentUser.storageUsed)} đã dùng</span>
                    <span className="text-muted-foreground">{formatBytes(currentUser.storageLimit)} tổng</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={cn("h-2 rounded-full transition-all", storagePercent > 80 ? "bg-destructive" : "bg-primary")}
                      style={{ width: `${storagePercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{storagePercent}% đã sử dụng</p>
                </div>
              </div>
              <Button
                id="save-profile-btn"
                onClick={handleSaveInfo}
                disabled={!displayName.trim() || displayName.length > 50}
                className="gap-2"
              >
                {saved ? <><CheckCircle2 className="h-4 w-4" />Đã lưu!</> : "Lưu thay đổi"}
              </Button>
            </div>
          )}

          {/* HISTORY TAB */}
          {tab === "history" && (
            <div>
              <h3 className="mb-4 font-semibold text-foreground">Lịch sử hoạt động</h3>
              {userLogs.length === 0 ? (
                <p className="text-muted-foreground">Chưa có hoạt động nào.</p>
              ) : (
                <div className="space-y-2">
                  {userLogs.map(log => (
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
          )}

          {/* SECURITY TAB */}
          {tab === "security" && (
            <div className="max-w-md space-y-4">
              <h3 className="font-semibold text-foreground">Đổi mật khẩu</h3>
              {passError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />{passError}
                </div>
              )}
              {passSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />{passSuccess}
                </div>
              )}
              {[
                { id: "old-pass", label: "Mật khẩu hiện tại", value: oldPass, setter: setOldPass },
                { id: "new-pass", label: "Mật khẩu mới", value: newPass, setter: setNewPass },
                { id: "confirm-pass", label: "Xác nhận mật khẩu mới", value: confirmPass, setter: setConfirmPass },
              ].map(field => (
                <div key={field.id}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">{field.label}</label>
                  <div className="relative">
                    <input
                      id={field.id}
                      type={showPass ? "text" : "password"}
                      value={field.value}
                      onChange={e => field.setter(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
              <Button id="change-pass-btn" onClick={handleChangePassword}>Đổi mật khẩu</Button>
              <p className="text-xs text-muted-foreground">
                Lưu ý: Bạn sẽ bị đăng xuất sau khi đổi mật khẩu 
              </p>
            </div>
          )}

          {/* PACKAGES TAB */}
          {tab === "packages" && (
            <div className="space-y-6">
              {/* Current Subscription Status */}
              <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-violet-500/5 p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  Gói dịch vụ hiện tại
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Tên gói:</p>
                    <p className="text-lg font-bold text-foreground">
                      {currentUser.subscriptionExpiresAt && new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now()
                        ? "Gói đã hết hạn (Free)"
                        : currentUser.subscriptionTier === "2-4"
                        ? "Gói 2-4 người (Premium)"
                        : currentUser.subscriptionTier === "5+"
                        ? "Gói 5+ người (Enterprise)"
                        : "Gói Free (Mặc định)"}
                    </p>
                  </div>
                  {currentUser.subscriptionTier && currentUser.subscriptionTier !== "free" && currentUser.subscriptionExpiresAt && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Hạn sử dụng:</p>
                      <p className="text-lg font-bold text-foreground flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" />
                        {new Date(currentUser.subscriptionExpiresAt).toLocaleDateString("vi-VN")}
                        {new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now() ? (
                          <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-medium">Đã hết hạn</span>
                        ) : (
                          <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full font-medium">Đang hoạt động</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Package Options */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-6 text-center">Các gói dịch vụ học tập nhóm</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  {packagePrices.map((pkg) => {
                    const isActive = currentUser.subscriptionTier === pkg.tier &&
                                     (!currentUser.subscriptionExpiresAt || new Date(currentUser.subscriptionExpiresAt).getTime() > Date.now());
                    return (
                      <div
                        key={pkg.id}
                        className={cn(
                          "relative rounded-2xl border bg-card p-6 flex flex-col justify-between transition-all hover:shadow-lg",
                          isActive
                            ? "border-primary ring-2 ring-primary/20 scale-[1.02]"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {isActive && (
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
                            Đang sử dụng
                          </span>
                        )}
                        <div>
                          <h4 className="text-lg font-bold text-foreground mb-1">{pkg.name}</h4>
                          <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-2xl font-extrabold text-foreground">
                              {pkg.price === 0 ? "Miễn phí" : `${pkg.price.toLocaleString("vi-VN")}đ`}
                            </span>
                            {pkg.price > 0 && <span className="text-xs text-muted-foreground">/tháng</span>}
                          </div>

                          <ul className="space-y-3 mb-6 text-sm text-muted-foreground border-t border-border pt-4">
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              <span>AI Chat cá nhân hỏi đáp</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              <span>
                                {pkg.tier === "free"
                                  ? "Không hỗ trợ mở phòng học nhóm"
                                  : pkg.tier === "2-4"
                                  ? "Mở phòng học nhóm (tối đa 4 người)"
                                  : "Mở phòng học nhóm (tối đa 99 người)"}
                              </span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              <span>
                                Dung lượng lưu trữ:{" "}
                                {pkg.tier === "free" ? "512 MB" : pkg.tier === "2-4" ? "1 GB" : "5 GB"}
                              </span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                              <span>Tạo flashcards từ tài liệu</span>
                            </li>
                          </ul>
                        </div>

                        {pkg.tier === "free" ? (
                          <Button variant="outline" className="w-full" disabled>
                            Mặc định
                          </Button>
                        ) : (
                          <Button
                            variant={isActive ? "outline" : "default"}
                            className="w-full"
                            onClick={() => {
                              setSelectedTier(pkg.tier);
                              setShowCheckoutModal(true);
                              setPaymentMethod("qr");
                              setPurchaseSuccess(false);
                            }}
                          >
                            {isActive ? "Gia hạn gói" : "Nâng cấp ngay"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Simulation Modal */}
      {showCheckoutModal && selectedTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            {!purchaseSuccess ? (
              <>
                <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Xác nhận mua gói dịch vụ
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Bạn đang đăng ký gói{" "}
                  <span className="font-semibold text-foreground">
                    {selectedTier === "2-4" ? "Gói 2-4 người" : "Gói 5+ người"}
                  </span>{" "}
                  thời hạn 1 tháng.
                </p>

                {/* Price Display */}
                <div className="mb-6 rounded-xl bg-muted p-4 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-medium">Tổng tiền cần thanh toán:</span>
                  <span className="text-xl font-extrabold text-primary">
                    {(packagePrices.find(p => p.tier === selectedTier)?.price || 0).toLocaleString("vi-VN")}đ
                  </span>
                </div>

                {/* Payment Methods */}
                <div className="space-y-3 mb-6">
                  <p className="text-sm font-semibold text-foreground">Chọn phương thức thanh toán:</p>
                  {[
                    { id: "qr", label: "Quét mã QR (Ngân hàng / Ví điện tử)", desc: "Mã QR được tạo tự động để quét nhanh" },
                    { id: "card", label: "Thẻ ATM Nội địa / Quốc tế (Visa, Mastercard)", desc: "Nhập thông tin thẻ của bạn" },
                    { id: "wallet", label: "Ví điện tử Momo / ShopeePay / ZaloPay", desc: "Thanh toán qua ví điện tử liên kết" }
                  ].map((method) => (
                    <label
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                        paymentMethod === method.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === method.id}
                        onChange={() => {}}
                        className="mt-1 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCheckoutModal(false)}>
                    Hủy bỏ
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      const res = buySubscription(selectedTier);
                      if (res.success) {
                        setPurchaseSuccess(true);
                        const storageLimit = selectedTier === "2-4" ? 1024 * 1024 * 1024 : 1024 * 1024 * 1024 * 5;
                        updateUser(currentUser.id, { storageLimit });
                      }
                    }}
                  >
                    Xác nhận thanh toán
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-10 w-10 text-green-600 animate-bounce" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Thanh toán thành công!</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Tài khoản của bạn đã được nâng cấp lên{" "}
                  <span className="font-bold text-foreground">
                    {selectedTier === "2-4" ? "Gói 2-4 người" : "Gói 5+ người"}
                  </span>
                  . Hạn sử dụng của gói là 1 tháng kể từ hôm nay.
                </p>
                <Button className="w-full" onClick={() => {
                  setShowCheckoutModal(false);
                  setTab("packages");
                }}>
                  Tuyệt vời! Quay lại
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
