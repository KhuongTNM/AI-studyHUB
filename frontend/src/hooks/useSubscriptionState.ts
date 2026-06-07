"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchSubscriptionPlansApi, updatePackagePriceApi } from "@/services/api/subscription-plans"
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

export function useSubscriptionState({
  currentUser,
  setCurrentUser,
  users,
  setUsers,
  addLog,
}: SubscriptionStateDeps) {
  const [packagePrices, setPackagePrices] = useState<PackagePrice[]>(DEFAULT_PACKAGE_PRICES)

  // Sync package prices from backend when user changes
  useEffect(() => {
    let cancelled = false
    fetchSubscriptionPlansApi()
      .then(plans => {
        if (cancelled) return
        setPackagePrices(prev =>
          prev.map(pkg => {
            const planName =
              pkg.tier === "2-4" ? "plan_2_4" : pkg.tier === "5+" ? "plan_5_plus" : "free"
            const plan = plans.find(item => item.name === planName)
            if (!plan) return pkg
            return {
              ...pkg,
              id: String(plan.id),
              name: plan.displayName,
              price: Number(plan.price),
              maxUsers: plan.maxRoomMembers || pkg.maxUsers,
            }
          }),
        )
      })
      .catch(() => {
        // keep mock prices when backend is not available
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  const updatePackagePrice = useCallback(
    async (tier: PackageTier, newPrice: number, adminPassword: string) => {
      if (currentUser?.role !== "admin") {
        return { success: false, error: "Chỉ Admin mới được chỉnh sửa giá gói." }
      }
      try {
        const updatedPlan = await updatePackagePriceApi(tier, newPrice, adminPassword)
        const updatedPrice = Number(updatedPlan.price)
        setPackagePrices(prev => prev.map(p => (p.tier === tier ? { ...p, price: updatedPrice } : p)))
        const tierName = tier === "2-4" ? "Gói 2-4 người" : "Gói 5+ người"
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
    [currentUser, addLog],
  )

  const grantSubscription = useCallback(
    (userId: string, tier: PackageTier, durationMonths: number) => {
      if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) {
        return { success: false, error: "Không có quyền thực hiện." }
      }
      const targetUser = users.find(u => u.id === userId)
      if (!targetUser) return { success: false, error: "Không tìm thấy người dùng." }
      if (currentUser.role === "sub-admin" && targetUser.role === "admin") {
        return { success: false, error: "Sub-admin không thể cấp gói cho Admin." }
      }

      const expiresAt =
        tier === "free"
          ? undefined
          : new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000)

      setUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? { ...u, subscriptionTier: tier, subscriptionExpiresAt: expiresAt }
            : u,
        ),
      )

      if (currentUser.id === userId) {
        setCurrentUser(prev =>
          prev ? { ...prev, subscriptionTier: tier, subscriptionExpiresAt: expiresAt } : prev,
        )
      }

      const tierName = tier === "free" ? "Free" : tier === "2-4" ? "2-4 người" : "5+ người"
      addLog(
        `Cấp gói ${tierName} (${durationMonths} tháng)`,
        targetUser.email,
        currentUser.id,
      )
      return { success: true }
    },
    [currentUser, users, setCurrentUser, setUsers, addLog],
  )

  const buySubscription = useCallback(
    (tier: PackageTier) => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

      const expiresAt =
        tier === "free"
          ? undefined
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

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

      const tierName = tier === "free" ? "Free" : tier === "2-4" ? "2-4 người" : "5+ người"
      addLog(`Đăng ký mua gói ${tierName}`, currentUser.email, currentUser.id)
      return { success: true }
    },
    [currentUser, setCurrentUser, setUsers, addLog],
  )

  return {
    packagePrices,
    updatePackagePrice,
    grantSubscription,
    buySubscription,
  }
}
