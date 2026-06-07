"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchAdminUsersApi, updateUserStorageLimitApi } from "@/services/api/admin-users"
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
    (id: string) => {
      const target = users.find(u => u.id === id)
      if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
      if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }
      if (currentUser.role === "sub-admin" && target.role === "admin") {
        return { success: false, error: "Sub-admin không được khóa tài khoản Admin." }
      }
      if (target.id === currentUser.id) return { success: false, error: "Không thể tự khóa tài khoản hiện tại." }

      setUsers(prev =>
        prev.map(u => (u.id === id ? { ...u, isLocked: !u.isLocked, loginAttempts: 0 } : u)),
      )
      addLog(
        target.isLocked ? "Unlocked account" : "Locked account",
        target.email,
        currentUser.id,
      )
      return { success: true }
    },
    [currentUser, users, addLog],
  )

  const resetUserPassword = useCallback(
    (id: string, password: string) => {
      const target = users.find(u => u.id === id)
      if (!currentUser || !target) return { success: false, error: "Không tìm thấy tài khoản." }
      if (!["admin", "sub-admin"].includes(currentUser.role)) return { success: false, error: "Không có quyền." }
      if (currentUser.role === "sub-admin" && target.role === "admin") {
        return { success: false, error: "Sub-admin không được reset mật khẩu Admin." }
      }
      if (password.length < 8) return { success: false, error: "Mật khẩu phải có ít nhất 8 ký tự." }

      setUsers(prev =>
        prev.map(u => (u.id === id ? { ...u, password, loginAttempts: 0 } : u)),
      )
      return { success: true }
    },
    [currentUser, users],
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
    (email: string, password: string, displayName: string) => {
      if (currentUser?.role !== "admin")
        return { success: false, error: "Chỉ Admin mới có thể tạo tài khoản sub-admin." }
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { success: false, error: "Email này đã được đăng ký." }
      }
      if (password.length < 8) return { success: false, error: "Mật khẩu phải có ít nhất 8 ký tự." }
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return { success: false, error: "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số." }
      }

      const subAdmin: User = {
        id: `sub-admin-${Date.now()}`,
        email,
        displayName,
        password,
        role: "sub-admin",
        isLocked: false,
        emailVerified: true,
        createdAt: new Date(),
        loginAttempts: 0,
        lastActive: new Date(),
        storageUsed: 0,
        storageLimit: 1024 * 1024 * 1024,
      }

      setUsers(prev => [...prev, subAdmin])
      addLog("Admin tạo tài khoản sub-admin", email, currentUser.id)
      return { success: true }
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
