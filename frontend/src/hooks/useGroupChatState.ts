"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Document, GroupChat, GroupChatMessage, GroupInvitation, GroupInvitationCandidate, PackagePrice, PackageTier, User } from "@/states/types"
import {
  createGroupApi,
  deleteGroupApi,
  downloadGroupDocumentApi,
  exportGroupChatApi,
  fetchGroupMessagesApi,
  fetchGroupMembersApi,
  fetchGroupsApi,
  fetchGroupSettingsApi,
  fetchPendingGroupInvitationsApi,
  kickGroupMemberApi,
  leaveGroupApi,
  reportGroupApi,
  respondGroupInvitationApi,
  inviteGroupMemberApi,
  searchGroupInvitationUserApi,
  sendGroupMessageApi,
  shareGroupDocumentApi,
  updateGroupMuteApi,
  updateGroupPinApi,
  uploadGroupImageApi,
} from "@/services/api/group-chats"

interface GroupChatStateDeps {
  currentUser: User | null
  packagePrices: PackagePrice[]
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

const GROUP_INVITATION_POLL_INTERVAL_MS = 5000

function tierToPlanName(tier: string): string {
  if (tier === "2-4") return "plan_2_4"
  if (tier === "5+") return "plan_5_plus"
  if (tier === "free") return "free"
  return tier
}

function getFallbackLimits(user: User | null) {
  const requestedTier = !user
    ? "free"
    : user.role === "admin" || user.role === "sub-admin"
      ? "5+"
      : user.subscriptionTier ?? "free"
  const tier: PackageTier = requestedTier === "2-4" || requestedTier === "5+"
    ? requestedTier
    : "free"

  return {
    create: GROUP_CREATE_LIMIT_BY_TIER[tier],
    join: GROUP_JOIN_LIMIT_BY_TIER[tier],
  }
}

function resolveGroupLimits(user: User | null, packagePrices: PackagePrice[]) {
  const fallback = getFallbackLimits(user)
  if (!user || user.role === "admin" || user.role === "sub-admin") return fallback

  const freePlan = packagePrices.find(plan => (plan.planName ?? plan.tier) === "free")
  const selectedPlan = user.subscriptionPlanId == null
    ? packagePrices.find(plan => (plan.planName ?? plan.tier) === tierToPlanName(user.subscriptionTier ?? "free"))
    : packagePrices.find(plan => Number(plan.id) === Number(user.subscriptionPlanId))
  const planExpired = Boolean(
    user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt).getTime() <= Date.now(),
  )
  const effectivePlan = planExpired ? freePlan : selectedPlan

  return {
    create: effectivePlan?.createGroupLimit ?? fallback.create,
    join: effectivePlan?.joinGroupLimit ?? fallback.join,
  }
}

function makeGroupCode() {
  return `GRP-${Math.random().toString(36).slice(2, 5).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function isGroupUnavailableError(error: unknown) {
  const message = getErrorMessage(error, "").toUpperCase()
  return ["GROUP_NOT_FOUND", "GROUP_ACCESS_DENIED", "GROUP_MEMBER_NOT_FOUND"]
    .some(code => message.includes(code))
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

function mergeGroupMessages(
  group: GroupChat,
  messages: GroupChatMessage[],
  currentUser: User,
): GroupChat {
  const senderNames = new Map(group.members.map(member => [member.userId, member.displayName]))
  const merged = new Map(group.messages.map(message => [message.id, message]))

  for (const message of messages) {
    const senderName = senderNames.get(message.senderId) ??
      (message.senderId === currentUser.id ? currentUser.displayName : undefined)
    merged.set(message.id, senderName ? { ...message, senderName } : message)
  }

  const orderedMessages = Array.from(merged.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  )
  const latestMessage = orderedMessages[orderedMessages.length - 1]

  return {
    ...group,
    messages: orderedMessages,
    updatedAt: latestMessage && latestMessage.timestamp > group.updatedAt
      ? latestMessage.timestamp
      : group.updatedAt,
  }
}

export function useGroupChatState({ currentUser, packagePrices }: GroupChatStateDeps) {
  const [groups, setGroups] = useState<GroupChat[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupLoadError, setGroupLoadError] = useState<string | null>(null)
  const [pendingGroupInvitations, setPendingGroupInvitations] = useState<GroupInvitation[]>([])
  const [groupInvitationsLoading, setGroupInvitationsLoading] = useState(false)
  const [groupInvitationsError, setGroupInvitationsError] = useState<string | null>(null)
  const pendingInvitationRequestRef = useRef(false)

  const groupLimits = useMemo(
    () => resolveGroupLimits(currentUser, packagePrices),
    [currentUser, packagePrices],
  )
  const groupCreateLimit = groupLimits.create
  const groupJoinLimit = groupLimits.join

  const hydrateGroup = useCallback(async (group: GroupChat): Promise<GroupChat> => {
    const [members, settings, messages] = await Promise.all([
      fetchGroupMembersApi(group.id).catch(error => {
        console.warn("[GroupChat] Failed to load group members", { groupId: group.id, error })
        return group.members
      }),
      fetchGroupSettingsApi(group.id).catch(error => {
        console.warn("[GroupChat] Failed to load group settings", { groupId: group.id, error })
        return { muted: false, pinned: false }
      }),
      fetchGroupMessagesApi(group.id).catch(error => {
        console.warn("[GroupChat] Failed to load group messages", { groupId: group.id, error })
        return group.messages
      }),
    ])

    return mergeOwnerName(mergeGroupMessages({
      ...group,
      members,
      muted: settings.muted,
      pinned: settings.pinned,
    }, messages, currentUser!))
  }, [currentUser])

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
      console.warn("[GroupChat] Failed to load groups", error)
      setGroups([])
      setActiveGroupId(null)
      setGroupLoadError(message)
      throw error
    } finally {
      setGroupsLoading(false)
    }
  }, [activeGroupId, currentUser, hydrateGroup])

  // Keep the sidebar in sync across separate browser sessions without
  // rehydrating every group on each poll. The open group has dedicated
  // member/message polling below; this lightweight list refresh detects when
  // a group was deleted or the current user was kicked from it.
  const refreshGroupList = useCallback(async () => {
    if (!currentUser) return

    try {
      const apiGroups = await fetchGroupsApi()
      setGroups(previousGroups => {
        const previousById = new Map(previousGroups.map(group => [group.id, group]))

        return apiGroups.map(group => {
          const previous = previousById.get(group.id)
          if (!previous) return group

          return {
            ...previous,
            groupCode: group.groupCode,
            name: group.name,
            description: group.description,
            ownerId: group.ownerId,
            ownerName: group.ownerName,
            maxMembers: group.maxMembers,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
          }
        })
      })
      setActiveGroupId(previousId => {
        if (previousId && apiGroups.some(group => group.id === previousId)) return previousId
        return apiGroups[0]?.id ?? null
      })
    } catch (error) {
      console.warn("[GroupChat] Failed to refresh group list", error)
    }
  }, [currentUser])

  const loadGroups = useCallback(async (): Promise<ActionResult> => {
    try {
      await reloadGroups(null, null)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not load groups.") }
    }
  }, [reloadGroups])

  const loadPendingGroupInvitations = useCallback(async (): Promise<ActionResult> => {
    if (!currentUser?.id) {
      setPendingGroupInvitations([])
      setGroupInvitationsError(null)
      return { success: true }
    }

    if (pendingInvitationRequestRef.current) {
      return { success: true }
    }

    pendingInvitationRequestRef.current = true

    setGroupInvitationsLoading(true)
    setGroupInvitationsError(null)

    try {
      const invitations = await fetchPendingGroupInvitationsApi()
      if (currentUser?.id) {
        setPendingGroupInvitations(invitations)
      }
      return { success: true }
    } catch (error) {
      const message = getErrorMessage(error, "Could not load group invitations.")
      // Keep the last successful list during a transient polling failure so
      // one failed request does not hide an invitation already shown to the user.
      setGroupInvitationsError(message)
      return { success: false, error: message }
    } finally {
      pendingInvitationRequestRef.current = false
      setGroupInvitationsLoading(false)
    }
  }, [currentUser?.id])

  const respondGroupInvitation = useCallback(async (
    groupId: string,
    accept: boolean,
  ): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "UNAUTHENTICATED" }

    try {
      await respondGroupInvitationApi(groupId, accept)
      setPendingGroupInvitations(prev => prev.filter(invitation => invitation.id !== groupId))

      if (accept) {
        // The response changes membership on the server. Refresh the real list
        // so the accepted group is immediately available in Group Chat.
        try {
          await reloadGroups(groupId, null)
        } catch (error) {
          // The invitation response already succeeded. A later group refresh
          // can be retried when the user opens Group Chat again.
          console.warn("[GroupChat] Accepted invitation but could not refresh groups", { groupId, error })
        }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not respond to group invitation.") }
    }
  }, [currentUser, reloadGroups])

  useEffect(() => {
    if (!currentUser?.id) {
      setPendingGroupInvitations([])
      setGroupInvitationsError(null)
      return
    }

    const refreshInvitations = () => {
      if (document.visibilityState === "visible") {
        void loadPendingGroupInvitations()
      }
    }

    void loadPendingGroupInvitations()
    const intervalId = window.setInterval(refreshInvitations, GROUP_INVITATION_POLL_INTERVAL_MS)
    window.addEventListener("focus", refreshInvitations)
    window.addEventListener("online", refreshInvitations)
    document.addEventListener("visibilitychange", refreshInvitations)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refreshInvitations)
      window.removeEventListener("online", refreshInvitations)
      document.removeEventListener("visibilitychange", refreshInvitations)
    }
  }, [currentUser?.id, loadPendingGroupInvitations])

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
          console.warn("[GroupChat] Failed to load groups", error)
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

  // A group can be deleted or a member can be kicked from another session.
  // Refresh only the lightweight group list so those changes appear without
  // a full page reload or repeated hydration of every group.
  useEffect(() => {
    if (!currentUser?.id) return

    let cancelled = false
    let requestInFlight = false

    const refresh = async () => {
      if (cancelled || requestInFlight) return
      requestInFlight = true
      try {
        await refreshGroupList()
      } finally {
        requestInFlight = false
      }
    }

    const intervalId = window.setInterval(() => { void refresh() }, 3000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh()
    }

    window.addEventListener("focus", refresh)
    window.addEventListener("online", refresh)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("online", refresh)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [currentUser?.id, refreshGroupList])

  // The backend currently exposes history but no push channel. Refresh only
  // the open group so separate sessions converge without reloading every group.
  useEffect(() => {
    if (!currentUser || !activeGroupId) return

    let cancelled = false
    let requestInFlight = false

    const refreshMessages = async () => {
      if (cancelled || requestInFlight) return
      requestInFlight = true

      try {
        const messages = await fetchGroupMessagesApi(activeGroupId)
        if (cancelled) return

        setGroups(prev => prev.map(group => group.id === activeGroupId
          ? mergeGroupMessages(group, messages, currentUser)
          : group,
        ))
      } catch (error) {
        if (!cancelled) {
          console.warn("[GroupChat] Failed to refresh group messages", { groupId: activeGroupId, error })
          if (isGroupUnavailableError(error)) void refreshGroupList()
        }
      } finally {
        requestInFlight = false
      }
    }

    void refreshMessages()
    const intervalId = window.setInterval(() => { void refreshMessages() }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeGroupId, currentUser, refreshGroupList])

  // Membership changes happen in another session when someone accepts an
  // invitation or leaves the group. Refresh the open group's members so the
  // header, sidebar count, info modal, and member modal stay in sync.
  useEffect(() => {
    if (!currentUser?.id || !activeGroupId) return

    let cancelled = false
    let requestInFlight = false

    const refreshMembers = async () => {
      if (cancelled || requestInFlight) return
      requestInFlight = true

      try {
        const members = await fetchGroupMembersApi(activeGroupId)
        if (cancelled) return

        setGroups(prev => prev.map(group => group.id === activeGroupId
          ? mergeOwnerName({ ...group, members })
          : group,
        ))
      } catch (error) {
        if (!cancelled) {
          console.warn("[GroupChat] Failed to refresh group members", { groupId: activeGroupId, error })
          if (isGroupUnavailableError(error)) void refreshGroupList()
        }
      } finally {
        requestInFlight = false
      }
    }

    void refreshMembers()
    const intervalId = window.setInterval(() => { void refreshMembers() }, 3000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshMembers()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [activeGroupId, currentUser?.id, refreshGroupList])

  const createGroup = useCallback(async (
    name: string,
    description: string | undefined,
    groupCode = makeGroupCode(),
  ): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in to create a group." }

    try {
      const group = await createGroupApi({
        groupCode: groupCode.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() || undefined,
      })
      await reloadGroups(group.id, group.groupCode)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not create group.") }
    }
  }, [currentUser, reloadGroups])

  const searchGroupInvitationUser = useCallback(async (
    groupId: string,
    email: string,
  ): Promise<{ success: boolean; user?: GroupInvitationCandidate; error?: string }> => {
    if (!currentUser) return { success: false, error: "UNAUTHENTICATED" }

    const group = groups.find(item => item.id === groupId)
    if (!group) return { success: false, error: "GROUP_NOT_FOUND" }
    if (group.ownerId !== currentUser.id) return { success: false, error: "GROUP_OWNER_REQUIRED" }

    try {
      const user = await searchGroupInvitationUserApi(groupId, email.trim().toLowerCase())
      if (user.userId === currentUser.id || email.trim().toLowerCase() === currentUser.email.toLowerCase()) {
        return { success: false, error: "GROUP_CANNOT_INVITE_SELF" }
      }
      return { success: true, user }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "USER_NOT_FOUND") }
    }
  }, [currentUser, groups])

  const inviteGroupMemberByEmail = useCallback(async (groupId: string, email: string): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "UNAUTHENTICATED" }

    const group = groups.find(item => item.id === groupId)
    if (!group) return { success: false, error: "GROUP_NOT_FOUND" }
    if (group.ownerId !== currentUser.id) return { success: false, error: "GROUP_OWNER_REQUIRED" }
    if (email.trim().toLowerCase() === currentUser.email.toLowerCase()) {
      return { success: false, error: "GROUP_CANNOT_INVITE_SELF" }
    }

    try {
      await inviteGroupMemberApi(groupId, email.trim().toLowerCase())
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not invite group member.") }
    }
  }, [currentUser, groups])

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

  const kickGroupMember = useCallback(async (
    groupId: string,
    targetUserId: string,
  ): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in." }

    const group = groups.find(item => item.id === groupId)
    if (!group) return { success: false, error: "GROUP_NOT_FOUND" }
    if (group.ownerId !== currentUser.id) return { success: false, error: "GROUP_OWNER_REQUIRED" }
    if (targetUserId === currentUser.id) return { success: false, error: "GROUP_CANNOT_KICK_SELF" }

    try {
      await kickGroupMemberApi(groupId, targetUserId)
      await reloadGroups(groupId, null)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not remove group member.") }
    }
  }, [currentUser, groups, reloadGroups])

  const deleteGroup = useCallback(async (groupId: string): Promise<ActionResult> => {
    if (!currentUser) return { success: false, error: "Please log in." }

    try {
      await deleteGroupApi(groupId)
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
    if (!currentUser) return { success: false, error: "Please log in to download documents." }

    try {
      await downloadGroupDocumentApi(groupId, documentId)
      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error, "Could not download document.") }
    }
  }, [currentUser])

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
    pendingGroupInvitations,
    groupInvitationsLoading,
    groupInvitationsError,
    groupCreateLimit,
    groupJoinLimit,
    setActiveGroupId,
    loadGroups,
    loadPendingGroupInvitations,
    respondGroupInvitation,
    createGroup,
    searchGroupInvitationUser,
    inviteGroupMemberByEmail,
    leaveGroup,
    kickGroupMember,
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
