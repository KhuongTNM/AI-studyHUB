"use client"

import { useCallback, useEffect, useState } from "react"
import {
  createStudyRoomApi,
  fetchStudyRoomApi,
  fetchStudyRoomsApi,
  joinStudyRoomApi,
  leaveStudyRoomApi,
  sendStudyRoomMessageApi,
  shareStudyRoomDocumentApi,
} from "@/services/api/study-rooms"
import { getRoomCapacityForHost } from "@/utils/study-room-capacity"
import type { PackagePrice, StudyRoom, User } from "@/states/types"

interface StudyRoomStateDeps {
  currentUser: User | null
  packagePrices: PackagePrice[]
  addLog: (action: string, target: string, userId: string) => void
}

export function useStudyRoomState({ currentUser, packagePrices, addLog }: StudyRoomStateDeps) {
  const [rooms, setRooms] = useState<StudyRoom[]>([])
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)

  const upsertRoom = useCallback((room: StudyRoom) => {
    setRooms(prev => {
      if (room.members.length === 0) return prev.filter(r => r.id !== room.id)
      const exists = prev.some(r => r.id === room.id)
      return exists ? prev.map(r => r.id === room.id ? room : r) : [room, ...prev]
    })
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setRooms([])
      setCurrentRoomId(null)
      return
    }
    let cancelled = false
    fetchStudyRoomsApi()
      .then(fetchedRooms => {
        if (cancelled) return
        setRooms(fetchedRooms)
        const activeMembership = fetchedRooms.find(room =>
          room.members.some(member => member.userId === currentUser.id),
        )
        setCurrentRoomId(activeMembership?.id ?? null)
      })
      .catch(() => {
        if (!cancelled) setRooms([])
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentRoomId || !currentUser) return
    let stopped = false
    const refresh = async () => {
      try {
        const room = await fetchStudyRoomApi(currentRoomId)
        if (!stopped) upsertRoom(room)
      } catch {
        if (!stopped) {
          setRooms(prev => prev.filter(room => room.id !== currentRoomId))
          setCurrentRoomId(null)
        }
      }
    }
    const timer = window.setInterval(refresh, 5000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [currentRoomId, currentUser?.id, upsertRoom])

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

      try {
        const createdRoom = await createStudyRoomApi(trimmedId, password)
        upsertRoom(createdRoom)
        setCurrentRoomId(createdRoom.id)
        addLog("Tạo phòng học nhóm", createdRoom.id, currentUser.id)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể tạo phòng học.",
        }
      }
    },
    [currentUser, packagePrices, rooms, addLog, upsertRoom],
  )

  const joinRoom = useCallback(
    async (roomId: string, password?: string) => {
      if (!currentUser) return { success: false, error: "Vui lòng đăng nhập." }
      if (!roomId.trim()) return { success: false, error: "Mã phòng không được để trống." }

      const targetRoomId = roomId.trim().toUpperCase()
      try {
        const joinedRoom = await joinStudyRoomApi(targetRoomId, password)
        upsertRoom(joinedRoom)
        setCurrentRoomId(joinedRoom.id)
        addLog("Tham gia phòng học nhóm", joinedRoom.id, currentUser.id)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể tham gia phòng học.",
        }
      }
    },
    [currentUser, upsertRoom, addLog],
  )

  const closeRoom = useCallback(() => {
    if (!currentUser || !currentRoomId) return
    void leaveStudyRoomApi(currentRoomId)
      .then(room => {
        setRooms(prev => prev.filter(r => r.id !== room.id))
        setCurrentRoomId(null)
        addLog("Đóng phòng học nhóm (Host)", currentRoomId, currentUser.id)
      })
      .catch(() => {})
  }, [currentUser, currentRoomId, addLog])

  const leaveRoom = useCallback(() => {
    if (!currentUser || !currentRoomId) return
    void leaveStudyRoomApi(currentRoomId)
      .then(room => {
        if (room.members.length === 0 || room.hostId === currentUser.id) {
          setRooms(prev => prev.filter(r => r.id !== currentRoomId))
        } else {
          upsertRoom(room)
        }
        setCurrentRoomId(null)
        addLog("Rời phòng học nhóm", currentRoomId, currentUser.id)
      })
      .catch(() => {})
  }, [currentUser, currentRoomId, addLog, upsertRoom])

  const sendRoomMessage = useCallback(
    (content: string) => {
      if (!currentUser || !currentRoomId || !content.trim()) return

      void sendStudyRoomMessageApi(currentRoomId, content.trim())
        .then(upsertRoom)
        .catch(() => {})
    },
    [currentUser, currentRoomId, upsertRoom],
  )

  const shareRoomDocument = useCallback(
    async (documentId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser || !currentRoomId) return { success: false, error: "Vui lòng tham gia phòng học trước." }
      try {
        const room = await shareStudyRoomDocumentApi(currentRoomId, documentId)
        upsertRoom(room)
        return { success: true }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Không thể chia sẻ tài liệu.",
        }
      }
    },
    [currentUser, currentRoomId, upsertRoom],
  )

  return {
    rooms,
    currentRoomId,
    createRoom,
    joinRoom,
    leaveRoom,
    closeRoom,
    sendRoomMessage,
    shareRoomDocument,
  }
}
