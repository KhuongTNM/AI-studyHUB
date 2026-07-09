"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Document, GroupChat, GroupChatMessage, PackageTier, User } from "@/states/types"
import {
  createGroupApi,
  deleteGroupApi,
  downloadGroupDocumentApi,
  exportGroupChatApi,
  fetchGroupMembersApi,
  fetchGroupsApi,
  fetchGroupSettingsApi,
  joinGroupApi,
  leaveGroupApi,
  reportGroupApi,
  sendGroupMessageApi,
  shareGroupDocumentApi,
  updateGroupMuteApi,
  updateGroupPinApi,
  uploadGroupImageApi,
} from "@/services/api/group-chats"

interface GroupChatStateDeps {
  currentUser: User | null
}

type ActionResult = { success: boolean; error?: string }

const GROUP_CREATE_LIMIT_BY_TIER: Record<PackageTier, number> = {
  free: 0,
  "2-4": 20,
  "5+": 50,
}

const GROUP_JOIN_LIMIT_BY_TIER: Record<PackageTier, number> = {
  free: 5,
  "2-4": 30,
  "5+": 60,
}

function getEffectiveTier(user: User | null): PackageTier {
  if (!user) return "free"
  if (user.role === "admin" || user.role === "sub-admin") return "5+"
  return user.subscriptionTier ?? "free"
}

function hasActivePaidPlan(user: User | null) {
  if (!user) return false
  if (user.role === "admin" || user.role === "sub-admin") return true
  if (user.subscriptionTier !== "2-4" && user.subscriptionTier !== "5+") return false
  if (!user.subscriptionExpiresAt) return false
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now()
}

function getRuleTier(user: User | null): PackageTier {
  if (!hasActivePaidPlan(user)) return "free"
  return getEffectiveTier(user)
}

function makeGroupCode() {
  return `GRP-${Math.random().toString(36).slice(2, 5).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function mergeOwnerName(group: GroupChat): GroupChat {
  const owner = group.members.find(member => member.userId === group.ownerId)
  return {
    ...group,
    ownerName: owner?.displayName ?? group.ownerName,
  }
}

function withCurrentSender(message: GroupChatMessage, user: User): GroupChatMessage {
  if (message.senderId && message.senderId !== "system") {
    return {
      ...message,
      senderName: message.senderName === "System" ? user.displayName : message.senderName,
    }
  }
  return message
}

export function useGroupChatState({ currentUser }: GroupChatStateDeps) {
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupLoadError, setGroupLoadError] = useState<string | null>(null)

  const ruleTier = useMemo(() => getRuleTier(currentUser), [currentUser])
  const groupCreateLimit = GROUP_CREATE_LIMIT_BY_TIER[ruleTier]
  const groupJoinLimit = GROUP_JOIN_LIMIT_BY_TIER[ruleTier]

  const hydrateGroup = useCallback(async (group: GroupChat): Promise<GroupChat> => {
    const [members, settings] = await Promise.all([
      fetchGroupMembersApi(group.id).catch(error => {
        console.warn("[GroupChat] Failed to load group members", { groupId: group.id, error })
        return group.members
      }),
      fetchGroupSettingsApi(group.id).catch(error => {
        console.warn("[GroupChat] Failed to load group settings", { groupId: group.id, error })
        return { muted: false, pinned: false }
      }),
    ])

    return mergeOwnerName({
      ...group,
      members,
      muted: settings.muted,
      pinned: settings.pinned,
    })
  }, [])

  const reloadGroups = useCallback(async (preferredGroupId?: string | null, preferredGroupCode?: string | null) => {
    if (!currentUser) {
      setGroups([])
      setActiveGroupId(null)
      setGroupLoadError(null)
      return []
    }

    setGroupsLoading(true)
    setGroupLoadError(null)

    try {
      const apiGroups = await fetchGroupsApi()
      const hydratedGroups = await Promise.all(apiGroups.map(group => hydrateGroup(group)))
      setGroups(hydratedGroups)

      const preferred =
        (preferredGroupId && hydratedGroups.find(group => group.id === preferredGroupId)) ||
        (preferredGroupCode && hydratedGroups.find(group => group.groupCode.toUpperCase() === preferredGroupCode.toUpperCase())) ||
        hydratedGroups.find(group => group.id === activeGroupId) ||
        hydratedGroups[0] ||
        null

      setActiveGroupId(preferred?.id ?? null)
      return hydratedGroups
    } catch (error) {
      const message = getErrorMessage(error, "Could not load groups.")
      console.error("[GroupChat] Failed to load groups", error)
      setGroups([])
      setActiveGroupId(null)
      setGroupLoadError(message)
      throw error
    } finally {
      setGroupsLoading(false)
    }
  }, [activeGroupId, currentUser, hydrateGroup])

  const loadGroups = useCallback(async (): Promise<ActionResult> => {
    try {
      await reloadGroups(null, null)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not load groups.") }
    }
  }, [reloadGroups])

  useEffect(() => {
    if (!currentUser) {
      setGroups([])
      setActiveGroupId(null)
      setGroupLoadError(null)
      return
    }

    let cancelled = false
    setGroupsLoading(true)
    setGroupLoadError(null)

    fetchGroupsApi()
      .then(apiGroups => Promise.all(apiGroups.map(group => hydrateGroup(group))))
      .then(hydratedGroups => {
        if (cancelled) return
        setGroups(hydratedGroups)
        setActiveGroupId(prev => {
          if (prev && hydratedGroups.some(group => group.id === prev)) return prev
          return hydratedGroups[0]?.id ?? null
        })
      })
      .catch(error => {
        if (!cancelled) {
          const message = getErrorMessage(error, "Could not load groups.")
          console.error("[GroupChat] Failed to load groups", error)
          setGroups([])
          setActiveGroupId(null)
          setGroupLoadError(message)
        }
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, hydrateGroup])

  const createGroup = useCallback(async (
    name: string,
    description: string | undefined,
    password: string,
    groupCode = makeGroupCode(),
  ): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in to create a group." }

    try {
      const group = await createGroupApi({
        groupCode: groupCode.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() || undefined,
        password: password.trim(),
      })
      await reloadGroups(group.id, group.groupCode)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not create group.") }
    }
  }, [currentUser, reloadGroups])

  const joinGroup = useCallback(async (groupCode: string, password: string): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in to join a group." }

    const trimmedCode = groupCode.trim().toUpperCase()
    try {
      await joinGroupApi(trimmedCode, password.trim())
      await reloadGroups(null, trimmedCode)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not join group.") }
    }
  }, [currentUser, reloadGroups])

  const leaveGroup = useCallback(async (groupId: string): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in." }

    try {
      await leaveGroupApi(groupId)
      await reloadGroups(null, null)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not leave group.") }
    }
  }, [currentUser, reloadGroups])

  const deleteGroup = useCallback(async (groupId: string, password: string): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in." }

    try {
      await deleteGroupApi(groupId, password.trim())
      await reloadGroups(null, null)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not delete group.") }
    }
  }, [currentUser, reloadGroups])

  const updateGroupMuted = useCallback(async (groupId: string, muted: boolean): Promise<ActionResult> => {
    try {
      const settings = await updateGroupMuteApi(groupId, muted)
      setGroups(prev => prev.map(group => group.id === groupId ? { ...group, muted: settings.muted, pinned: settings.pinned } : group))
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not update group notifications.") }
    }
  }, [])

  const updateGroupPinned = useCallback(async (groupId: string, pinned: boolean): Promise<ActionResult> => {
    try {
      const settings = await updateGroupPinApi(groupId, pinned)
      setGroups(prev => prev.map(group => group.id === groupId ? { ...group, muted: settings.muted, pinned: settings.pinned } : group))
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not update group pin.") }
    }
  }, [])

  const appendGroupMessage = useCallback((message: GroupChatMessage) => {
    setGroups(prev => prev.map(group => group.id === message.groupId
      ? { ...group, messages: [...group.messages, message], updatedAt: message.timestamp }
      : group,
    ))
  }, [])

  const sendGroupMessage = useCallback(async (groupId: string, content: string): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in to send messages." }
    if (!content.trim()) return { success: false, error: "Message is empty." }

    try {
      const message = await sendGroupMessageApi(groupId, content.trim())
      appendGroupMessage(withCurrentSender(message, currentUser))
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not send message.") }
    }
  }, [appendGroupMessage, currentUser])

  const shareGroupDocument = useCallback(async (groupId: string, document: Document): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in to share documents." }
    if (!document.isPublic) return { success: false, error: "Private documents cannot be shared to a group." }

    try {
      const message = await shareGroupDocumentApi(groupId, document.id)
      appendGroupMessage(withCurrentSender(message, currentUser))
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not share document.") }
    }
  }, [appendGroupMessage, currentUser])

  const shareGroupImage = useCallback(async (groupId: string, file: File): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in to upload images." }

    try {
      const message = await uploadGroupImageApi(groupId, file)
      appendGroupMessage(withCurrentSender(message, currentUser))
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not upload image.") }
    }
  }, [appendGroupMessage, currentUser])

  const downloadGroupDocument = useCallback(async (groupId: string, documentId: string): Promise<ActionResult> => {
    try {
      await downloadGroupDocumentApi(groupId, documentId)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not download document.") }
    }
  }, [])

  const exportGroupChat = useCallback(async (groupId: string): Promise<ActionResult> => {
    try {
      await exportGroupChatApi(groupId)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not export chat history.") }
    }
  }, [])

  const reportGroup = useCallback(async (groupId: string, reason: string): Promise<ActionResult> => {
    try {
      await reportGroupApi(groupId, reason.trim())
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not report group.") }
    }
  }, [])

  return {
    groups,
    activeGroupId,
    groupsLoading,
    groupLoadError,
    groupCreateLimit,
    groupJoinLimit,
    setActiveGroupId,
    loadGroups,
    createGroup,
    joinGroup,
    leaveGroup,
    deleteGroup,
    updateGroupMuted,
    updateGroupPinned,
    sendGroupMessage,
    shareGroupDocument,
    shareGroupImage,
    downloadGroupDocument,
    exportGroupChat,
    reportGroup,
    generateGroupCode: makeGroupCode,
  }
}
