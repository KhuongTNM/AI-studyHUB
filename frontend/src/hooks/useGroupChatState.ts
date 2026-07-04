"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Document, GroupChat, GroupChatMessage, PackageTier, User } from "@/states/types"
import {
  createGroupApi,
  deleteGroupApi,
  fetchGroupsApi,
  joinGroupApi,
  leaveGroupApi,
  sendGroupMessageApi,
  shareGroupDocumentApi,
} from "@/services/api/group-chats"

interface GroupChatStateDeps {
  currentUser: User | null
}

type ActionResult = { success: boolean; error?: string }
type AsyncActionResult = Promise<ActionResult>

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

export function useGroupChatState({ currentUser }: GroupChatStateDeps) {
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  const ruleTier = useMemo(() => getRuleTier(currentUser), [currentUser])
  const groupCreateLimit = GROUP_CREATE_LIMIT_BY_TIER[ruleTier]
  const groupJoinLimit = GROUP_JOIN_LIMIT_BY_TIER[ruleTier]

  const reloadGroups = useCallback(async (preferredGroupId?: string, preferredGroupCode?: string) => {
    const nextGroups = await fetchGroupsApi()
    setGroups(nextGroups)
    setActiveGroupId(prev => {
      if (preferredGroupId && nextGroups.some(group => group.id === preferredGroupId)) return preferredGroupId
      if (preferredGroupCode) {
        const byCode = nextGroups.find(group => group.groupCode.toUpperCase() === preferredGroupCode.toUpperCase())
        if (byCode) return byCode.id
      }
      if (prev && nextGroups.some(group => group.id === prev)) return prev
      return nextGroups[0]?.id ?? null
    })
    return nextGroups
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!currentUser) {
      setGroups([])
      setActiveGroupId(null)
      return
    }

    fetchGroupsApi()
      .then(nextGroups => {
        if (cancelled) return
        setGroups(nextGroups)
        setActiveGroupId(prev => {
          if (prev && nextGroups.some(group => group.id === prev)) return prev
          return nextGroups[0]?.id ?? null
        })
      })
      .catch(() => {
        if (cancelled) return
        setGroups([])
        setActiveGroupId(null)
      })

    return () => {
      cancelled = true
    }
  }, [currentUser?.id])

  const getJoinedCount = useCallback(() => {
    if (!currentUser) return 0
    return groups.filter(group => group.members.some(member => member.userId === currentUser.id)).length
  }, [currentUser, groups])

  const createGroup = useCallback(async (
    name: string,
    description: string | undefined,
    password: string,
    groupCode = makeGroupCode(),
  ): AsyncActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to create a group." }
    if (groupCreateLimit <= 0) {
      return { success: false, error: "Your current package cannot create groups." }
    }

    const ownedGroups = groups.filter(group => group.ownerId === currentUser.id)
    const joinedCount = getJoinedCount()
    if (ownedGroups.length >= groupCreateLimit) {
      return { success: false, error: `Your current package allows ${groupCreateLimit} created group(s).` }
    }
    if (joinedCount >= groupJoinLimit) {
      return { success: false, error: `Your current package allows ${groupJoinLimit} total joined group(s).` }
    }

    const trimmedName = name.trim()
    const trimmedPassword = password.trim()
    if (!trimmedName) return { success: false, error: "Group name is required." }
    if (!trimmedPassword) return { success: false, error: "Group password is required." }
    if (groups.some(group => group.groupCode.toUpperCase() === groupCode.toUpperCase())) {
      return { success: false, error: "Generated group ID already exists. Generate another ID." }
    }

    try {
      const group = await createGroupApi({
        groupCode: groupCode.trim().toUpperCase(),
        name: trimmedName,
        description: description?.trim() || undefined,
        password: trimmedPassword,
      })
      setGroups(prev => [group, ...prev.filter(item => item.id !== group.id)])
      setActiveGroupId(group.id)
      await reloadGroups(group.id, group.groupCode)
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to create group." }
    }
  }, [currentUser, getJoinedCount, groupCreateLimit, groupJoinLimit, groups, reloadGroups])

  const joinGroup = useCallback(async (groupCode: string, password: string): AsyncActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to join a group." }
    const trimmedCode = groupCode.trim().toUpperCase()
    const trimmedPassword = password.trim()
    if (!trimmedCode) return { success: false, error: "Group ID is required." }
    if (!trimmedPassword) return { success: false, error: "Group password is required." }
    if (getJoinedCount() >= groupJoinLimit) {
      return { success: false, error: `Your current package allows ${groupJoinLimit} total joined group(s).` }
    }

    try {
      const group = await joinGroupApi(trimmedCode, trimmedPassword)
      if (group) {
        setGroups(prev => [group, ...prev.filter(item => item.id !== group.id)])
        setActiveGroupId(group.id)
        await reloadGroups(group.id, group.groupCode)
      } else {
        await reloadGroups(undefined, trimmedCode)
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to join group." }
    }
  }, [currentUser, getJoinedCount, groupJoinLimit, reloadGroups])

  const leaveGroup = useCallback(async (groupId: string): AsyncActionResult => {
    if (!currentUser) return { success: false, error: "Please log in." }
    const group = groups.find(item => item.id === groupId)
    if (!group) return { success: false, error: "Group not found." }
    if (group.ownerId === currentUser.id) return { success: false, error: "Owners must delete the group instead of leaving it." }

    try {
      await leaveGroupApi(groupId)
      await reloadGroups()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to leave group." }
    }
  }, [currentUser, groups, reloadGroups])

  const deleteGroup = useCallback(async (groupId: string, password: string): AsyncActionResult => {
    if (!currentUser) return { success: false, error: "Please log in." }
    const group = groups.find(item => item.id === groupId)
    if (!group) return { success: false, error: "Group not found." }
    if (group.ownerId !== currentUser.id) return { success: false, error: "Only the group owner can delete this group." }
    if (!password.trim()) return { success: false, error: "Group password is required." }
    try {
      await deleteGroupApi(groupId, password.trim())
      await reloadGroups()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to delete group." }
    }
  }, [currentUser, groups, reloadGroups])

  const sendGroupMessage = useCallback(async (groupId: string, content: string): AsyncActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to send messages." }
    if (!content.trim()) return { success: false, error: "Message is empty." }

    try {
      const message = await sendGroupMessageApi(groupId, content.trim())
      setGroups(prev => prev.map(group => group.id === groupId
        ? { ...group, messages: [...group.messages, message], updatedAt: new Date() }
        : group,
      ))
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to send message." }
    }
  }, [currentUser])

  const shareGroupDocument = useCallback(async (groupId: string, document: Document): AsyncActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to share documents." }
    if (!document.isPublic) return { success: false, error: "Private documents cannot be shared to a group." }

    try {
      const message = await shareGroupDocumentApi(groupId, document.id)
      setGroups(prev => prev.map(group => group.id === groupId
        ? { ...group, messages: [...group.messages, message], updatedAt: new Date() }
        : group,
      ))
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to share document." }
    }
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
    sendGroupMessage,
    shareGroupDocument,
    shareGroupImage,
    generateGroupCode: makeGroupCode,
  }
}
