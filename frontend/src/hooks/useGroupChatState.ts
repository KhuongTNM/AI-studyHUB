"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Document, GroupChat, GroupChatMessage, PackageTier, User } from "@/states/types"

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

function makeSystemMessage(groupId: string, content: string): GroupChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    groupId,
    senderId: "system",
    senderName: "System",
    content,
    timestamp: new Date(),
    messageType: "system",
  }
}

function createSeedGroup(user: User): GroupChat {
  const now = new Date()
  const groupId = `group-${user.id}-demo`
  return {
    id: groupId,
    groupCode: "GRP-DEMO-101",
    password: "123456",
    name: "SWP391 - Study Group",
    description: "Shared study discussion and files",
    ownerId: "mock-owner",
    ownerName: "Demo Host",
    maxMembers: 30,
    members: [
      {
        userId: user.id,
        displayName: user.displayName,
        role: "member",
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
      makeSystemMessage(groupId, "Group chat is running with mocked frontend state. Backend APIs are documented separately."),
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

  const ruleTier = useMemo(() => getRuleTier(currentUser), [currentUser])
  const groupCreateLimit = GROUP_CREATE_LIMIT_BY_TIER[ruleTier]
  const groupJoinLimit = GROUP_JOIN_LIMIT_BY_TIER[ruleTier]

  useEffect(() => {
    if (!currentUser) {
      setGroups([])
      setActiveGroupId(null)
      return
    }

    setGroups(prev => {
      if (prev.some(group => group.members.some(member => member.userId === currentUser.id))) {
        return prev
      }
      const seededGroup = createSeedGroup(currentUser)
      setActiveGroupId(seededGroup.id)
      return [seededGroup]
    })
  }, [currentUser?.id])

  const getJoinedCount = useCallback(() => {
    if (!currentUser) return 0
    return groups.filter(group => group.members.some(member => member.userId === currentUser.id)).length
  }, [currentUser, groups])

  const createGroup = useCallback((
    name: string,
    description: string | undefined,
    password: string,
    groupCode = makeGroupCode(),
  ): ActionResult => {
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

    const now = new Date()
    const groupId = `group-${Date.now()}`
    const group: GroupChat = {
      id: groupId,
      groupCode,
      password: trimmedPassword,
      name: trimmedName,
      description: description?.trim() || undefined,
      ownerId: currentUser.id,
      ownerName: currentUser.displayName,
      maxMembers: 99,
      members: [{
        userId: currentUser.id,
        displayName: currentUser.displayName,
        role: "owner",
        joinedAt: now,
      }],
      messages: [makeSystemMessage(groupId, `${currentUser.displayName} created the group.`)],
      createdAt: now,
      updatedAt: now,
    }

    setGroups(prev => [group, ...prev])
    setActiveGroupId(group.id)
    return { success: true }
  }, [currentUser, getJoinedCount, groupCreateLimit, groupJoinLimit, groups])

  const joinGroup = useCallback((groupCode: string, password: string): ActionResult => {
    if (!currentUser) return { success: false, error: "Please log in to join a group." }
    const trimmedCode = groupCode.trim().toUpperCase()
    const trimmedPassword = password.trim()
    if (!trimmedCode) return { success: false, error: "Group ID is required." }
    if (!trimmedPassword) return { success: false, error: "Group password is required." }
    if (getJoinedCount() >= groupJoinLimit) {
      return { success: false, error: `Your current package allows ${groupJoinLimit} total joined group(s).` }
    }

    const existingGroup = groups.find(group => group.groupCode.toUpperCase() === trimmedCode)
    if (existingGroup) {
      if (existingGroup.password !== trimmedPassword) return { success: false, error: "Group password is incorrect." }
      if (existingGroup.members.some(member => member.userId === currentUser.id)) {
        setActiveGroupId(existingGroup.id)
        return { success: true }
      }
      const updatedGroup = {
        ...existingGroup,
        members: [
          ...existingGroup.members,
          {
            userId: currentUser.id,
            displayName: currentUser.displayName,
            role: "member" as const,
            joinedAt: new Date(),
          },
        ],
        messages: [...existingGroup.messages, makeSystemMessage(existingGroup.id, `${currentUser.displayName} joined the group.`)],
        updatedAt: new Date(),
      }
      setGroups(prev => prev.map(group => group.id === existingGroup.id ? updatedGroup : group))
      setActiveGroupId(existingGroup.id)
      return { success: true }
    }

    const now = new Date()
    const groupId = `group-joined-${Date.now()}`
    const joinedGroup: GroupChat = {
      id: groupId,
      groupCode: trimmedCode,
      password: trimmedPassword,
      name: `Group ${trimmedCode}`,
      description: "Mocked joined group. Backend will load real group details later.",
      ownerId: "mock-owner",
      ownerName: "Group Owner",
      maxMembers: 99,
      members: [
        {
          userId: "mock-owner",
          displayName: "Group Owner",
          role: "owner",
          joinedAt: now,
        },
        {
          userId: currentUser.id,
          displayName: currentUser.displayName,
          role: "member",
          joinedAt: now,
        },
      ],
      messages: [makeSystemMessage(groupId, `${currentUser.displayName} joined with group ID ${trimmedCode}.`)],
      createdAt: now,
      updatedAt: now,
    }
    setGroups(prev => [joinedGroup, ...prev])
    setActiveGroupId(groupId)
    return { success: true }
  }, [currentUser, getJoinedCount, groupJoinLimit, groups])

  const leaveGroup = useCallback((groupId: string): ActionResult => {
    if (!currentUser) return { success: false, error: "Please log in." }
    const group = groups.find(item => item.id === groupId)
    if (!group) return { success: false, error: "Group not found." }
    if (group.ownerId === currentUser.id) return { success: false, error: "Owners must delete the group instead of leaving it." }

    setGroups(prev => prev
      .map(item => item.id === groupId
        ? {
            ...item,
            members: item.members.filter(member => member.userId !== currentUser.id),
            messages: [...item.messages, makeSystemMessage(item.id, `${currentUser.displayName} left the group.`)],
            updatedAt: new Date(),
          }
        : item)
      .filter(item => item.members.some(member => member.userId === currentUser.id) || item.ownerId === currentUser.id),
    )
    setActiveGroupId(prev => prev === groupId ? null : prev)
    return { success: true }
  }, [currentUser, groups])

  const deleteGroup = useCallback((groupId: string): ActionResult => {
    if (!currentUser) return { success: false, error: "Please log in." }
    const group = groups.find(item => item.id === groupId)
    if (!group) return { success: false, error: "Group not found." }
    if (group.ownerId !== currentUser.id) return { success: false, error: "Only the group owner can delete this group." }
    setGroups(prev => prev.filter(item => item.id !== groupId))
    setActiveGroupId(prev => prev === groupId ? null : prev)
    return { success: true }
  }, [currentUser, groups])

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
    groupCreateLimit,
    groupJoinLimit,
    setActiveGroupId,
    createGroup,
    joinGroup,
    leaveGroup,
    deleteGroup,
    sendGroupMessage,
    shareGroupDocument,
    generateGroupCode: makeGroupCode,
  }
}
