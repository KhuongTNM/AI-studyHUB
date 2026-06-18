"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Document, GroupChat, GroupChatMessage, PackageTier, User } from "@/states/types"

interface GroupChatStateDeps {
  currentUser: User | null
}

type ActionResult = { success: boolean; error?: string }

const GROUP_LIMIT_BY_TIER: Record<PackageTier, number> = {
  free: 0,
  "2-4": 4,
  "5+": 99,
}

const GROUP_MEMBER_LIMIT_BY_TIER: Record<PackageTier, number> = {
  free: 0,
  "2-4": 4,
  "5+": 99,
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

function getGroupLimit(user: User | null) {
  if (!hasActivePaidPlan(user)) return 0
  return GROUP_LIMIT_BY_TIER[getEffectiveTier(user)]
}

function getGroupMemberLimit(user: User | null) {
  if (!hasActivePaidPlan(user)) return 0
  return GROUP_MEMBER_LIMIT_BY_TIER[getEffectiveTier(user)]
}

function createSeedGroup(user: User): GroupChat {
  const now = new Date()
  const groupId = `group-${user.id}-demo`
  return {
    id: groupId,
    name: "SWP391 - Study Group",
    description: "Shared study discussion and files",
    ownerId: user.id,
    ownerName: user.displayName,
    maxMembers: Math.max(getGroupMemberLimit(user), 2),
    members: [
      {
        userId: user.id,
        displayName: user.displayName,
        role: "owner",
        joinedAt: now,
      },
      {
        userId: "mock-member-1",
        displayName: "Demo Classmate",
        role: "member",
        joinedAt: now,
      },
    ],
    messages: [
      {
        id: `msg-${Date.now()}-welcome`,
        groupId,
        senderId: "system",
        senderName: "System",
        content: "Group chat is running with mocked frontend state. Backend APIs are documented separately.",
        timestamp: now,
        messageType: "system",
      },
      {
        id: `msg-${Date.now()}-sample`,
        groupId,
        senderId: "mock-member-1",
        senderName: "Demo Classmate",
        content: "Can you share the programming document here?",
        timestamp: now,
        messageType: "text",
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

export function useGroupChatState({ currentUser }: GroupChatStateDeps) {
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  const groupLimit = useMemo(() => getGroupLimit(currentUser), [currentUser])
  const groupMemberLimit = useMemo(() => getGroupMemberLimit(currentUser), [currentUser])

  useEffect(() => {
    if (!currentUser) {
      setGroups([])
      setActiveGroupId(null)
      return
    }

    setGroups(prev => {
      if (prev.some(group => group.ownerId === currentUser.id || group.members.some(member => member.userId === currentUser.id))) {
        return prev
      }
      if (groupLimit <= 0) return []
      const seededGroup = createSeedGroup(currentUser)
      setActiveGroupId(seededGroup.id)
      return [seededGroup]
    })
  }, [currentUser?.id, groupLimit])

  const createGroup = useCallback((name: string, description?: string): ActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to create a group." }
    if (groupLimit <= 0 || groupMemberLimit <= 0) {
      return { success: false, error: "Upgrade to a study group package before creating groups." }
    }

    const ownedGroups = groups.filter(group => group.ownerId === currentUser.id)
    if (ownedGroups.length >= groupLimit) {
      return { success: false, error: `Your current package allows ${groupLimit} group(s).` }
    }

    const trimmedName = name.trim()
    if (!trimmedName) return { success: false, error: "Group name is required." }

    const now = new Date()
    const groupId = `group-${Date.now()}`
    const group: GroupChat = {
      id: groupId,
      name: trimmedName,
      description: description?.trim() || undefined,
      ownerId: currentUser.id,
      ownerName: currentUser.displayName,
      maxMembers: groupMemberLimit,
      members: [{
        userId: currentUser.id,
        displayName: currentUser.displayName,
        role: "owner",
        joinedAt: now,
      }],
      messages: [{
        id: `msg-${Date.now()}-system`,
        groupId,
        senderId: "system",
        senderName: "System",
        content: `${currentUser.displayName} created the group.`,
        timestamp: now,
        messageType: "system",
      }],
      createdAt: now,
      updatedAt: now,
    }

    setGroups(prev => [group, ...prev])
    setActiveGroupId(group.id)
    return { success: true }
  }, [currentUser, groupLimit, groupMemberLimit, groups])

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

  return {
    groups,
    activeGroupId,
    groupLimit,
    groupMemberLimit,
    setActiveGroupId,
    createGroup,
    sendGroupMessage,
    shareGroupDocument,
  }
}
