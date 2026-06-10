"use client"

import { useCallback, useEffect, useState } from "react"
import { createSubAdminApi, fetchAdminUsersApi, resetUserPasswordApi, toggleUserLockApi, updateUserStorageLimitApi } from "@/services/api/admin-users"
import { MOCK_USERS } from "@/states/mock-data"
import type { Document, User } from "@/states/types"
import { formatBytes } from "@/utils/format"
import type { Dispatch, SetStateAction } from "react"

interface AdminStateDeps {
  currentUser: User | null
  setCurrentUser: Dispatch<SetStateAction<User | null>>
  setDocuments: Dispatch<SetStateAction<Document[]>>
  addLog: (action: string, target: string, userId: string) => void
}

export function useAdminState({
  currentUser,
  setCurrentUser,
  setDocuments,
  addLog,
}: AdminStateDeps) {
  const [users, setUsers] = useState<User[]>(MOCK_USERS)

  // Fetch real user list when an admin/sub-admin logs in
  useEffect(() => {
    if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) return
    let cancelled = false
    fetchAdminUsersApi()
      .then(fetchedUsers => {
        if (cancelled) return
        setUsers(fetchedUsers)
        const refreshed = fetchedUsers.find(u => u.id === currentUser.id)
        if (refreshed) setCurrentUser(refreshed)
      })
      .catch(() => {
        // keep mock users when backend admin API is not available
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.role, setCurrentUser])

  const updateUser = useCallback(
    (id: string, updates: Partial<User>) => {
      setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updates } : u)))
      setCurrentUser(prev => (prev?.id === id ? { ...prev, ...updates } : prev))
    },
    [setCurrentUser],
  )

  const updateUserStorageLimit = useCallback(
    async (id: string, storageLimitGb: number) => {
      if (!currentUser || !["admin", "sub-admin"].includes(currentUser.role)) {
        return { success: false, error: "Không có quyền cập nhật dung lượng." }
      }
      const target = users.find(u => u.id === id)
      if (!target) return { success: false, error: "Không tìm thấy người dùng." }
      if (target.role !== "user") return { success: false, error: "Chỉ được chỉnh dung lượng của tài khoản user." }

      try {
        const updatedUser = await updateUserStorageLimitApi(id, storageLimitGb)
        setUsers(prev => prev.map(u => (u.id === id ? updatedUser : u)))
        setCurrentUser(prev => (prev?.id === id ? updatedUser : prev))
        addLog(
          "Cập nhật giới hạn dung lượng",
          `${updatedUser.email}: ${formatBytes(updatedUser.storageLimit)}`,
          currentUser.id,
        )
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể cập nhật dung lượng.",
        }
      }
    },
    [currentUser, users, setCurrentUser, addLog],
  )

  const toggleUserLock = useCallback(
    async (id: string) => {
      const target = users.find(u => u.id === id)
      if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
      if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }
      if (currentUser.role === "sub-admin" && target.role !== "user") {
        return { success: false, error: "Sub-admin chỉ được khóa/mở khóa tài khoản user." }
      }
      if (target.id === currentUser.id) return { success: false, error: "Không thể tự khóa tài khoản hiện tại." }

      const newLocked = !target.isLocked
      try {
        const updatedUser = await toggleUserLockApi(id, newLocked)
        setUsers(prev => prev.map(u => (u.id === id ? updatedUser : u)))
        addLog(
          newLocked ? "Locked account" : "Unlocked account",
          target.email,
          currentUser.id,
        )
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể thực hiện thao tác.",
        }
      }
    },
    [currentUser, users, addLog],
  )

  /** BR-062: Admin/Sub-admin reset mật khẩu của user bất kỳ (trừ Admin). BR-002 được validate phía client trước. */
  const resetUserPassword = useCallback(
    async (id: string, password: string): Promise<{ success: boolean; error?: string }> => {
      const target = users.find(u => u.id === id)
      if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
      if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }

      // BR-062: không được reset mật khẩu Admin
      if (target.role === "admin") {
        return { success: false, error: "Không được phép reset mật khẩu tài khoản Admin." }
      }
      if (currentUser.role === "sub-admin" && target.role !== "user") {
        return { success: false, error: "Sub-admin chỉ được reset mật khẩu tài khoản user." }
      }
      if (target.id === currentUser.id) {
        return { success: false, error: "Vui lòng dùng trang Profile để đổi mật khẩu của chính bạn." }
      }

      // BR-002: client-side validation (mirror backend PasswordPolicyValidator)
      if (password.length < 8) return { success: false, error: "Mật khẩu phải có ít nhất 8 ký tự." }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return { success: false, error: "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số." }
      }

      try {
        const updatedUser = await resetUserPasswordApi(id, password)
        setUsers(prev => prev.map(u => (u.id === id ? updatedUser : u)))
        addLog("Reset mật khẩu", target.email, currentUser.id)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể reset mật khẩu.",
        }
      }
    },
    [currentUser, users, addLog],
  )

  const deleteUserAccount = useCallback(
    (id: string) => {
      const target = users.find(u => u.id === id)
      if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
      if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }
      if (currentUser.role === "sub-admin" && target.role === "admin") {
        return { success: false, error: "Sub-admin không được xóa tài khoản Admin." }
      }
      if (target.id === currentUser.id) return { success: false, error: "Không thể tự xóa tài khoản hiện tại." }

      setUsers(prev => prev.filter(u => u.id !== id))
      setDocuments(prev =>
        prev.map(d => (d.uploadedBy === id ? { ...d, status: "deleted" } : d)),
      )
      return { success: true }
    },
    [currentUser, users, setDocuments],
  )

  const createSubAdminAccount = useCallback(
    async (email: string, password: string, displayName: string) => {
      if (currentUser?.role !== "admin")
        return { success: false, error: "Chỉ Admin mới có thể tạo tài khoản sub-admin." }
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, error: "Email này đã được đăng ký." }
      }
      if (password.length < 8) return { success: false, error: "Mật khẩu phải có ít nhất 8 ký tự." }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return { success: false, error: "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số." }
      }

      try {
        const subAdmin = await createSubAdminApi(email, password, displayName)
        setUsers(prev => [subAdmin, ...prev])
        addLog("Admin tạo tài khoản sub-admin", email, currentUser.id)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể tạo tài khoản sub-admin.",
        }
      }
    },
    [currentUser, users, addLog],
  )

  return {
    users,
    setUsers,
    updateUser,
    updateUserStorageLimit,
    toggleUserLock,
    resetUserPassword,
    deleteUserAccount,
    createSubAdminAccount,
  }
}
