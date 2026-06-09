"use client"

import { useEffect, useState } from "react"
import { User, Lock, Clock, Camera, Zap, Sparkles, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, formatBytes, type PackageTier } from "@/lib/store"

import { InfoTab } from "./tabs/info-tab"
import { HistoryTab } from "./tabs/history-tab"
import { SecurityTab } from "./tabs/security-tab"
import { PackagesTab } from "./tabs/packages-tab"
import { CheckoutModal } from "./checkout-modal"

type ProfileTab = "info" | "history" | "security" | "packages"

export function ProfilePage() {
  const { currentUser, updateUser, activityLogs, openAuthModal, packagePrices } = useApp()
  const [tab, setTab] = useState<ProfileTab>("info")
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "")
  const [saved, setSaved] = useState(false)
  const [passError, setPassError] = useState("")
  const [passSuccess, setPassSuccess] = useState("")

  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [selectedTier, setSelectedTier] = useState<PackageTier | null>(null)

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

  const handleChangePassword = (oldPass: string, newPass: string, confirmPass: string) => {
    setPassError("")
    setPassSuccess("")
    if (!oldPass) { setPassError("Nhập mật khẩu hiện tại."); return }
    if (newPass.length < 8) { setPassError("Mật khẩu mới phải có ít nhất 8 ký tự."); return }
    if (!/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) { setPassError("Mật khẩu cần chứa chữ và số."); return }
    if (newPass !== confirmPass) { setPassError("Mật khẩu xác nhận không khớp."); return }
    
    // In a real app, this would be an API call
    setPassSuccess("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.")
  }

  const openCheckout = (tier: PackageTier) => {
    setSelectedTier(tier)
    setShowCheckoutModal(true)
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
          {tab === "info" && (
            <InfoTab
              currentUser={currentUser}
              displayName={displayName}
              setDisplayName={setDisplayName}
              saved={saved}
              onSave={handleSaveInfo}
              storagePercent={storagePercent}
            />
          )}

          {tab === "history" && <HistoryTab logs={userLogs} />}

          {tab === "security" && (
            <SecurityTab
              onChangePassword={handleChangePassword}
              error={passError}
              success={passSuccess}
            />
          )}

          {tab === "packages" && (
            <PackagesTab
              currentUser={currentUser}
              packagePrices={packagePrices}
              onBuy={openCheckout}
            />
          )}
        </div>
      </div>

      {showCheckoutModal && selectedTier && (
        <CheckoutModal
          selectedTier={selectedTier}
          packagePrices={packagePrices}
          currentUser={currentUser}
          updateUser={updateUser}
          onClose={() => setShowCheckoutModal(false)}
          onSuccess={() => {
            setShowCheckoutModal(false)
            setTab("packages")
          }}
        />
      )}
    </div>
  )
}
