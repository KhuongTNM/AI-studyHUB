"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchSubscriptionPlansApi, updatePackagePriceApi } from "@/services/api/subscription-plans"
import { grantSubscriptionApi } from "@/services/api/admin-users"
import { DEFAULT_PACKAGE_PRICES } from "@/states/mock-data"
import type { PackagePrice, PackageTier, User } from "@/states/types"
import type { Dispatch, SetStateAction } from "react"

interface SubscriptionStateDeps {
  currentUser: User | null
  setCurrentUser: Dispatch<SetStateAction<User | null>>
  users: User[]
  setUsers: Dispatch<SetStateAction<User[]>>
  addLog: (action: string, target: string, userId: string) => void
}

function tierToPlanName(tier: string): string {
  if (tier === "2-4") return "plan_2_4"
  if (tier === "5+") return "plan_5_plus"
  if (tier === "free") return "free"
  return tier
}

function tierFromPlanName(planName: string): string {
  if (planName === "plan_2_4") return "2-4"
  if (planName === "plan_5_plus") return "5+"
  return planName
}

function formatStorage(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1 && Number.isInteger(gb)) return `${gb} GB`
  const mb = bytes / (1024 * 1024)
  if (mb >= 1 && Number.isInteger(mb)) return `${mb} MB`
  return `${bytes} B`
}

export function useSubscriptionState({
  currentUser,
  setCurrentUser,
  users,
  setUsers,
  addLog,
}: SubscriptionStateDeps) {
  const [packagePrices, setPackagePrices] = useState<PackagePrice[]>(DEFAULT_PACKAGE_PRICES)

  // FIXED: tách phần fetch ra thành 1 hàm dùng lại được (refetchPackagePrices),
  // thay vì chỉ nằm trong useEffect và chỉ chạy lại khi currentUser?.id đổi.
  // Trước đây: admin tạo/sửa/xoá gói ở admin-dashboard.tsx chỉ cập nhật state
  // cục bộ editablePackages, KHÔNG hề gọi lại hàm này → packagePrices (dùng
  // chung cho PackagesTab, CheckoutModal, form "Cấp gói") bị stale cho tới khi
  // user đăng nhập lại. Giờ admin-dashboard.tsx sẽ gọi refetchPackagePrices()
  // ngay sau khi tạo/sửa/xoá gói thành công để đồng bộ ngay lập tức.
  const loadPackagePrices = useCallback(async () => {
    try {
      const plans = await fetchSubscriptionPlansApi()
      setPackagePrices(plans.map(plan => ({
        id: String(plan.id),
        planName: plan.name,
        tier: tierFromPlanName(plan.name),
        name: plan.name,
        price: Number(plan.price),
        maxUsers: plan.maxRoomMembers,
        defaultStorageBytes: plan.defaultStorageBytes,
        storageLabel: formatStorage(plan.defaultStorageBytes),
        createGroupLimit: plan.createGroupLimit,
        joinGroupLimit: plan.joinGroupLimit,
        dailyAiChatLimit: plan.dailyAiChatLimit,
        maxFlashcards: plan.maxFlashcards,
      })))
    } catch {
      // Giữ giá cũ (mock hoặc lần fetch trước) nếu backend không khả dụng
    }
  }, [])

  // Đồng bộ giá gói từ backend khi user thay đổi (login/logout/switch user)
  useEffect(() => {
    let cancelled = false
    loadPackagePrices().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, loadPackagePrices])

  const updatePackagePrice = useCallback(
    async (tier: PackageTier | string, newPrice: number, adminPassword: string) => {
      if (currentUser?.role !== "admin") {
        return { success: false, error: "Chỉ Admin mới được chỉnh sửa giá gói." }
      }
      try {
        const updatedPlan = await updatePackagePriceApi(tierToPlanName(tier), newPrice, adminPassword)
        const updatedPrice = Number(updatedPlan.price)
        setPackagePrices(prev => prev.map(p => (tierToPlanName(p.planName ?? p.tier) === updatedPlan.name ? { ...p, price: updatedPrice } : p)))
        const updatedPlanLabel = packagePrices.find(plan => (plan.planName ?? plan.tier) === updatedPlan.name)?.name
        const tierName = updatedPlanLabel ?? (tier === "free" ? "Free" : tier === "2-4" ? "Pro" : tier === "5+" ? "VIP" : tier)
        addLog(
          `Cập nhật giá ${tierName}`,
          `${updatedPrice.toLocaleString("vi-VN")}đ/tháng`,
          currentUser.id,
        )
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể cập nhật giá gói.",
        }
      }
    },
    [currentUser, packagePrices, addLog],
  )

  /**
   * BR-063: Admin/Sub-admin cấp gói subscription cho user qua API.
   *
   * Gọi POST /api/admin/users/{userId}/subscription để persist lên server,
   * đồng thời cập nhật local state ngay để UI phản hồi tức thì.
   */
  const grantSubscription = useCallback(
    async (
      userId: string,
      tier: string,
      durationMonths: number,
      adminPassword: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) {
        return { success: false, error: "Không có quyền thực hiện." }
      }
      const targetUser = users.find(u => u.id === userId)
      if (!targetUser) return { success: false, error: "Không tìm thấy người dùng." }
      if (currentUser.role === "sub-admin" && targetUser.role === "admin") {
        return { success: false, error: "Sub-admin không thể cấp gói cho Admin." }
      }
      if (!adminPassword.trim()) return { success: false, error: "Mật khẩu Admin không được để trống." }

      try {
        const updatedUser = await grantSubscriptionApi(userId, tierToPlanName(tier), durationMonths, adminPassword)

        setUsers(prev => prev.map(u => (u.id === userId ? updatedUser : u)))
        if (currentUser.id === userId) setCurrentUser(updatedUser)

        const grantedPlan = packagePrices.find(plan => (plan.planName ?? plan.tier) === tierToPlanName(tier))
        const tierName = grantedPlan?.name ?? (tier === "free" ? "Free" : tier === "2-4" ? "Pro" : tier === "5+" ? "VIP" : tier)
        addLog(
          `Cấp gói ${tierName} (${durationMonths} tháng)`,
          targetUser.email,
          currentUser.id,
        )
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể cấp gói.",
        }
      }
    },
    [currentUser, users, packagePrices, setCurrentUser, setUsers, addLog],
  )

  const buySubscription = useCallback(
    (tier: string) => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

      const expiresAt =
        tier === "free" ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      setUsers(prev =>
        prev.map(u =>
          u.id === currentUser.id
            ? { ...u, subscriptionTier: tier, subscriptionExpiresAt: expiresAt }
            : u,
        ),
      )
      setCurrentUser(prev =>
        prev ? { ...prev, subscriptionTier: tier, subscriptionExpiresAt: expiresAt } : prev,
      )

      const selectedPlan = packagePrices.find(plan => (plan.planName ?? plan.tier) === tierToPlanName(tier))
      const tierName = selectedPlan?.name ?? (tier === "free" ? "Free" : tier === "2-4" ? "Pro" : tier === "5+" ? "VIP" : tier)
      addLog(`Đăng ký mua gói ${tierName}`, currentUser.email, currentUser.id)
      return { success: true }
    },
    [currentUser, packagePrices, setCurrentUser, setUsers, addLog],
  )

  return {
    packagePrices,
    refetchPackagePrices: loadPackagePrices,
    updatePackagePrice,
    grantSubscription,
    buySubscription,
  }
}
