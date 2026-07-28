"use client"

import { useEffect, useState } from "react"
import { User, Lock, Clock, Camera, Zap, Sparkles, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useApp, formatBytes } from "@/lib/store"
import type { PackagePrice } from "@/states/types"

import { InfoTab } from "./tabs/info-tab"
import { HistoryTab } from "./tabs/history-tab"
import { SecurityTab } from "./tabs/security-tab"
import { PackagesTab } from "./tabs/packages-tab"
import { CheckoutModal } from "./checkout-modal"

type ProfileTab = "info" | "history" | "security" | "packages"

export function ProfilePage() {
  const {
    currentUser, updateUser, updateOwnProfile, changeOwnPassword,
    activityLogs, openAuthModal, packagePrices, mySubscription, language,
  } = useApp()
  const [tab, setTab] = useState<ProfileTab>("info")
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? "")
  const [saved, setSaved] = useState(false)
  const [infoError, setInfoError] = useState("")
  const [savingInfo, setSavingInfo] = useState(false)
  const [passError, setPassError] = useState("")
  const [passSuccess, setPassSuccess] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)

  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<PackagePrice | null>(null)
  const text = profileText[language]

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

  useEffect(() => {
    setDisplayName(currentUser?.displayName ?? "")
  }, [currentUser?.displayName])

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <User className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">{text.notLoggedIn}</h2>
        <p className="text-muted-foreground">{text.loginToView}</p>
        <Button onClick={() => openAuthModal("login")}>{text.loginNow}</Button>
      </div>
    )
  }

  const userLogs = activityLogs.filter(l => l.userId === currentUser.id)
  const avatarInitials = currentUser.displayName.slice(0, 2).toUpperCase()
  const storagePercent = Math.round((currentUser.storageUsed / currentUser.storageLimit) * 100)

  const handleSaveInfo = async () => {
    const trimmedName = displayName.trim()
    setInfoError("")
    setSaved(false)
    if (!trimmedName) {
      setInfoError(text.displayNameRequired)
      return
    }
    if (trimmedName.length > 50) {
      setInfoError(text.displayNameMax)
      return
    }

    setSavingInfo(true)
    try {
      const result = await updateOwnProfile(trimmedName)
      if (!result.success) {
        setInfoError(result.error ?? text.profileUpdateFailed)
        return
      }
      setDisplayName(trimmedName)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSavingInfo(false)
    }
  }

  const handleChangePassword = async (oldPass: string, newPass: string, confirmPass: string) => {
    setPassError("")
    setPassSuccess("")
    if (!oldPass) { setPassError(text.currentPasswordRequired); return false }
    if (newPass.length < 8) { setPassError(text.passwordMin); return false }
    if (!/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) { setPassError(text.passwordLetterNumber); return false }
    if (newPass !== confirmPass) { setPassError(text.passwordMismatch); return false }
    setChangingPassword(true)
    try {
      const result = await changeOwnPassword(oldPass, newPass, confirmPass)
      if (!result.success) {
        setPassError(result.error ?? text.passwordChangeFailed)
        return false
      }
      setPassSuccess(result.message ?? text.passwordChanged)
      return true
    } finally {
      setChangingPassword(false)
    }
  }

  const openCheckout = (plan: PackagePrice) => {
    setSelectedPlan(plan)
    setShowCheckoutModal(true)
  }

  const tabs: { id: ProfileTab; label: string; icon: React.ElementType }[] = [
    { id: "info", label: text.info, icon: User },
    { id: "packages", label: text.packages, icon: Zap },
    { id: "history", label: text.history, icon: Clock },
    { id: "security", label: text.security, icon: Lock },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background px-6 py-4">
        <h1 className="text-xl font-bold text-foreground">{text.title}</h1>
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
                  {currentUser.role === "admin" ? "Admin" : currentUser.role === "sub-admin" ? "Sub-admin" : text.student}
                </span>
                {currentUser.emailVerified && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" /> {text.verified}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: text.storageUsed, value: formatBytes(currentUser.storageUsed) },
              { label: text.recentActivity, value: `${userLogs.length} ${text.actions}` },
              { label: text.joinedDate, value: currentUser.createdAt.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US") },
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
              error={infoError}
              saving={savingInfo}
              onSave={handleSaveInfo}
              storagePercent={storagePercent}
              language={language}
            />
          )}

          {tab === "history" && <HistoryTab language={language} />}

          {tab === "security" && (
            <SecurityTab
              onChangePassword={handleChangePassword}
              error={passError}
              success={passSuccess}
              loading={changingPassword}
              language={language}
            />
          )}

          {tab === "packages" && (
            <PackagesTab
              currentUser={currentUser}
              packagePrices={packagePrices}
              mySubscription={mySubscription}
              onBuy={openCheckout}
              language={language}
            />
          )}
        </div>
      </div>

      {showCheckoutModal && selectedPlan && (
        <CheckoutModal
          selectedPlan={selectedPlan}
          currentUser={currentUser}
          updateUser={updateUser}
          language={language}
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

const profileText = {
  vi: {
    notLoggedIn: "Chưa đăng nhập",
    loginToView: "Đăng nhập để xem hồ sơ cá nhân",
    loginNow: "Đăng nhập ngay",
    currentPasswordRequired: "Nhập mật khẩu hiện tại.",
    displayNameRequired: "Tên hiển thị không được để trống.",
    displayNameMax: "Tên hiển thị không được vượt quá 50 ký tự.",
    profileUpdateFailed: "Không thể cập nhật hồ sơ.",
    passwordMin: "Mật khẩu mới phải có ít nhất 8 ký tự.",
    passwordLetterNumber: "Mật khẩu cần chứa chữ và số.",
    passwordMismatch: "Mật khẩu xác nhận không khớp.",
    passwordChanged: "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.",
    passwordChangeFailed: "Không thể đổi mật khẩu.",
    info: "Thông tin",
    packages: "Gói dịch vụ",
    history: "Lịch sử giao dịch",
    security: "Bảo mật",
    title: "Hồ sơ cá nhân",
    student: "Sinh viên",
    verified: "Đã xác thực",
    storageUsed: "Dung lượng đã dùng",
    recentActivity: "Hoạt động gần đây",
    actions: "thao tác",
    joinedDate: "Ngày tham gia",
  },
  en: {
    notLoggedIn: "Not signed in",
    loginToView: "Log in to view your profile",
    loginNow: "Log in now",
    currentPasswordRequired: "Enter your current password.",
    displayNameRequired: "Display name is required.",
    displayNameMax: "Display name cannot exceed 50 characters.",
    profileUpdateFailed: "Could not update profile.",
    passwordMin: "New password must be at least 8 characters.",
    passwordLetterNumber: "Password must contain letters and numbers.",
    passwordMismatch: "Password confirmation does not match.",
    passwordChanged: "Password changed successfully. Please log in again.",
    passwordChangeFailed: "Could not change password.",
    info: "Info",
    packages: "Packages",
    history: "Transaction history",
    security: "Security",
    title: "Profile",
    student: "Student",
    verified: "Verified",
    storageUsed: "Storage used",
    recentActivity: "Recent activity",
    actions: "actions",
    joinedDate: "Joined",
  },
} as const
