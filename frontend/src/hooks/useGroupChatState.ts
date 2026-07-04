"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Document, GroupChat, GroupChatMessage, PackageTier, User } from "@/states/types"
import {
  createGroupApi,
  deleteGroupApi,
  fetchGroupMembersApi,
  fetchGroupsApi,
  fetchGroupSettingsApi,
  joinGroupApi,
  leaveGroupApi,
  updateGroupMuteApi,
  updateGroupPinApi,
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

export function useGroupChatState({ currentUser }: GroupChatStateDeps) {
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  const ruleTier = useMemo(() => getRuleTier(currentUser), [currentUser])
  const groupCreateLimit = GROUP_CREATE_LIMIT_BY_TIER[ruleTier]
  const groupJoinLimit = GROUP_JOIN_LIMIT_BY_TIER[ruleTier]

  const hydrateGroup = useCallback(async (group: GroupChat): Promise<GroupChat> => {
    const [members, settings] = await Promise.all([
      fetchGroupMembersApi(group.id).catch(() => group.members),
      fetchGroupSettingsApi(group.id).catch(() => ({ muted: false, pinned: false })),
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
      return []
    }

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
  }, [activeGroupId, currentUser, hydrateGroup])

  useEffect(() => {
    if (!currentUser) {
      setGroups([])
      setActiveGroupId(null)
      return
    }

    let cancelled = false
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
      .catch(() => {
        if (!cancelled) {
          setGroups([])
          setActiveGroupId(null)
        }
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

  const sendGroupMessage = useCallback((groupId: string, content: string): ActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to send messages." }
    if (!content.trim()) return { success: false, error: "Message is empty." }

    const message: GroupChatMessage = {
      id: `msg-${Date.now()}`,
      groupId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      content: content.trim(),
      timestamp: new Date(),
      messageType: "text",
    }

    setGroups(prev => prev.map(group => group.id === groupId
      ? { ...group, messages: [...group.messages, message], updatedAt: new Date() }
      : group,
    ))
    return { success: true }
  }, [currentUser])

  const shareGroupDocument = useCallback((groupId: string, document: Document): ActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to share documents." }
    if (!document.isPublic) return { success: false, error: "Private documents cannot be shared to a group." }

    const message: GroupChatMessage = {
      id: `msg-${Date.now()}`,
      groupId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      content: document.name,
      timestamp: new Date(),
      messageType: "document",
      documentId: document.id,
      documentName: document.name,
      documentSubject: document.subject || "No subject",
      documentVisibility: document.isPublic ? "public" : "private",
      documentDownloadable: document.isPublic,
    }

    setGroups(prev => prev.map(group => group.id === groupId
      ? { ...group, messages: [...group.messages, message], updatedAt: new Date() }
      : group,
    ))
    return { success: true }
  }, [currentUser])

  const shareGroupImage = useCallback((groupId: string): ActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to upload images." }

    const imageSeed = `${currentUser.id}-${Date.now()}`
    const imageNumber = Math.floor(100 + Math.random() * 900)
    const message: GroupChatMessage = {
      id: `msg-${Date.now()}`,
      groupId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      content: `study-snapshot-${imageNumber}.png`,
      timestamp: new Date(),
      messageType: "image",
      imageName: `study-snapshot-${imageNumber}.png`,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(imageSeed)}/720/420`,
    }

    setGroups(prev => prev.map(group => group.id === groupId
      ? { ...group, messages: [...group.messages, message], updatedAt: new Date() }
      : group,
    ))
    return { success: true }
  }, [currentUser])

  return {
    groups,
    activeGroupId,
    groupCreateLimit,
    groupJoinLimit,
    setActiveGroupId,
    createGroup,
    joinGroup,
    leaveGroup,
    deleteGroup,
    updateGroupMuted,
    updateGroupPinned,
    sendGroupMessage,
    shareGroupDocument,
    shareGroupImage,
    generateGroupCode: makeGroupCode,
  }
}
