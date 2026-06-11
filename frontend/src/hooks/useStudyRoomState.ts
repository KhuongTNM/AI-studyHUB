"use client"

import { useCallback, useState } from "react"
import { MOCK_ROOMS } from "@/states/mock-data"
import { createStudyRoomApi } from "@/services/api/study-rooms"
import { getRoomCapacityForHost } from "@/utils/study-room-capacity"
import type { PackagePrice, RoomMessage, StudyRoom, User } from "@/states/types"

interface StudyRoomStateDeps {
  currentUser: User | null
  packagePrices: PackagePrice[]
  addLog: (action: string, target: string, userId: string) => void
}

export function useStudyRoomState({ currentUser, packagePrices, addLog }: StudyRoomStateDeps) {
  const [rooms, setRooms] = useState<StudyRoom[]>(MOCK_ROOMS)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)

  /**
   * Tạo phòng học nhóm mới.
   *
   * Gọi POST /api/study-rooms để persist phòng lên server (BR-041),
   * sau đó cập nhật local state để UI phản hồi ngay (BR-042 đến BR-045).
   */
  const createRoom = useCallback(
    async (roomId: string, password?: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }

      const capacity = getRoomCapacityForHost(currentUser, packagePrices)
      if (!capacity) {
        return { success: false, error: "Vui lòng nâng cấp gói để có quyền tạo phòng học." }
      }

      const trimmedId = roomId.trim().toUpperCase()
      if (!trimmedId) return { success: false, error: "Mã phòng không được để trống." }
      if (rooms.some(r => r.id === trimmedId)) {
        return { success: false, error: "Mã phòng này đã tồn tại." }
      }

      // Gọi API để kiểm tra / persist phòng trên server
      try {
        await createStudyRoomApi(trimmedId, password)
      } catch (error) {
        // Nếu server báo lỗi (ví dụ mã phòng đã tồn tại toàn cục), trả về lỗi
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể tạo phòng học.",
        }
      }

      // Tạo phòng trong local state để real-time UI hoạt động
      const newRoom: StudyRoom = {
        id: trimmedId,
        password: password || undefined,
        hostId: currentUser.id,
        hostName: currentUser.displayName,
        capacity,
        members: [
          { userId: currentUser.id, displayName: currentUser.displayName, joinedAt: new Date() },
        ],
        messages: [
          {
            id: `msg-sys-${Date.now()}`,
            senderId: "system",
            senderName: "Hệ thống",
            content: `Phòng học ${trimmedId} đã được tạo bởi ${currentUser.displayName}.`,
            timestamp: new Date(),
          },
        ],
        createdAt: new Date(),
      }

      setRooms(prev => [...prev, newRoom])
      setCurrentRoomId(trimmedId)
      addLog("Tạo phòng học nhóm", trimmedId, currentUser.id)

      // Mô phỏng thành viên tham gia sau 4 giây (demo)
      setTimeout(() => {
        setRooms(prev =>
          prev.map(r => {
            if (r.id !== trimmedId) return r
            const simUser =
              r.hostId === "user-2"
                ? { userId: "user-1", displayName: "Demo Student" }
                : { userId: "user-2", displayName: "AnhNV" }

            if (
              r.members.some(m => m.userId === simUser.userId) ||
              r.members.length >= r.capacity
            ) {
              return r
            }

            const joinMsg: RoomMessage = {
              id: `msg-sys-sim-${Date.now()}`,
              senderId: "system",
              senderName: "Hệ thống",
              content: `${simUser.displayName} đã tham gia phòng.`,
              timestamp: new Date(),
            }
            const chatMsg: RoomMessage = {
              id: `msg-sim-${Date.now()}`,
              senderId: simUser.userId,
              senderName: simUser.displayName,
              content: `Chào chủ phòng! Mình xin phép join cùng học nhé. Cậu định thảo luận môn gì thế?`,
              timestamp: new Date(),
            }

            return {
              ...r,
              members: [...r.members, { ...simUser, joinedAt: new Date() }],
              messages: [...r.messages, joinMsg, chatMsg],
            }
          }),
        )
      }, 4000)

      return { success: true }
    },
    [currentUser, packagePrices, rooms, addLog],
  )

  const joinRoom = useCallback(
    (roomId: string, password?: string) => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }
      if (!roomId.trim()) return { success: false, error: "Mã phòng không được để trống." }

      const targetRoomId = roomId.trim().toUpperCase()
      const targetRoom = rooms.find(r => r.id === targetRoomId)

      if (!targetRoom) return { success: false, error: "Phòng học không tồn tại." }
      if (targetRoom.password && targetRoom.password !== password) {
        return { success: false, error: "Mật khẩu phòng không đúng." }
      }

      const isMember = targetRoom.members.some(m => m.userId === currentUser.id)
      if (!isMember) {
        if (targetRoom.members.length >= targetRoom.capacity) {
          return { success: false, error: "Phòng học đã đầy." }
        }

        const joinMsg: RoomMessage = {
          id: `msg-sys-${Date.now()}`,
          senderId: "system",
          senderName: "Hệ thống",
          content: `${currentUser.displayName} đã tham gia phòng.`,
          timestamp: new Date(),
        }

        setRooms(prev =>
          prev.map(r =>
            r.id === targetRoomId
              ? {
                  ...r,
                  members: [
                    ...r.members,
                    { userId: currentUser.id, displayName: currentUser.displayName, joinedAt: new Date() },
                  ],
                  messages: [...r.messages, joinMsg],
                }
              : r,
          ),
        )
      }

      setCurrentRoomId(targetRoomId)
      addLog("Tham gia phòng học nhóm", targetRoomId, currentUser.id)

      // Mô phỏng host chào hỏi sau 2 giây
      setTimeout(() => {
        setRooms(prev =>
          prev.map(r => {
            if (r.id !== targetRoomId || r.hostId === currentUser.id) return r
            const simulatedMsg: RoomMessage = {
              id: `msg-sim-${Date.now()}`,
              senderId: r.hostId,
              senderName: r.hostName,
              content: `Chào ${currentUser.displayName}! Chào mừng bạn vào phòng cùng thảo luận nhé.`,
              timestamp: new Date(),
            }
            return { ...r, messages: [...r.messages, simulatedMsg] }
          }),
        )
      }, 2000)

      return { success: true }
    },
    [currentUser, rooms, addLog],
  )

  const closeRoom = useCallback(() => {
    if (!currentUser || !currentRoomId) return
    const targetRoom = rooms.find(r => r.id === currentRoomId)
    if (!targetRoom || targetRoom.hostId !== currentUser.id) return
    setRooms(prev => prev.filter(r => r.id !== currentRoomId))
    setCurrentRoomId(null)
    addLog("Đóng phòng học nhóm (Host)", currentRoomId, currentUser.id)
  }, [currentUser, currentRoomId, rooms, addLog])

  const leaveRoom = useCallback(() => {
    if (!currentUser || !currentRoomId) return
    const targetRoom = rooms.find(r => r.id === currentRoomId)
    if (!targetRoom) return

    if (targetRoom.hostId === currentUser.id) {
      closeRoom()
      return
    }

    const leaveMsg: RoomMessage = {
      id: `msg-sys-${Date.now()}`,
      senderId: "system",
      senderName: "Hệ thống",
      content: `${currentUser.displayName} đã rời phòng.`,
      timestamp: new Date(),
    }

    setRooms(prev =>
      prev.map(r =>
        r.id === currentRoomId
          ? {
              ...r,
              members: r.members.filter(m => m.userId !== currentUser.id),
              messages: [...r.messages, leaveMsg],
            }
          : r,
      ),
    )
    setCurrentRoomId(null)
    addLog("Rời phòng học nhóm", currentRoomId, currentUser.id)
  }, [currentUser, currentRoomId, rooms, closeRoom, addLog])

  const sendRoomMessage = useCallback(
    (content: string) => {
      if (!currentUser || !currentRoomId || !content.trim()) return

      const newMsg: RoomMessage = {
        id: `msg-${Date.now()}`,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        content: content.trim(),
        timestamp: new Date(),
      }

      setRooms(prev =>
        prev.map(r => r.id === currentRoomId ? { ...r, messages: [...r.messages, newMsg] } : r),
      )

      const lower = content.toLowerCase()
      const isGreeting = lower.includes("chào") || lower.includes("hello") || lower.includes("hi")
      const isStudy =
        lower.includes("bài tập") || lower.includes("ôn") || lower.includes("tài liệu")

      if (!isGreeting && !isStudy) return

      const delay = isGreeting ? 2500 : 3000
      const replyContent = isGreeting
        ? `Chào ${currentUser.displayName}! Hôm nay bạn định ôn tập nội dung gì thế?`
        : `Mình có tài liệu khá hay trong phần Tài liệu của tôi đó, bạn đã xem thử chưa?`

      setTimeout(() => {
        setRooms(prev =>
          prev.map(r => {
            if (r.id !== currentRoomId) return r
            const hostIsSelf = r.hostId === currentUser.id
            const responderId = hostIsSelf
              ? (r.members.find(m => m.userId !== currentUser.id)?.userId ?? "user-2")
              : r.hostId
            const responderName = hostIsSelf
              ? (r.members.find(m => m.userId !== currentUser.id)?.displayName ?? "AnhNV")
              : r.hostName

            const replyMsg: RoomMessage = {
              id: `msg-sim-${Date.now()}`,
              senderId: responderId,
              senderName: responderName,
              content: replyContent,
              timestamp: new Date(),
            }
            return { ...r, messages: [...r.messages, replyMsg] }
          }),
        )
      }, delay)
    },
    [currentUser, currentRoomId],
  )

  return {
    rooms,
    currentRoomId,
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    sendRoomMessage,
  }
}
