import { getAccessToken } from "@/lib/auth-storage"
import { MOCK_API } from "@/services/mock/mock-config"
import {
  mockCreateGroupRequest,
  mockFetchGroupDetailRequest,
  mockFetchGroupMembersRequest,
  mockFetchGroupMessagesRequest,
  mockFetchGroupsRequest,
  mockFetchGroupSettingsRequest,
} from "@/services/mock/group-chats.mock"
import type { GroupChat, GroupChatMember, GroupChatMessage, GroupInvitation, GroupInvitationCandidate } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// Group core and message history are API-backed. File/image helpers use the
// corresponding endpoints when those actions are available.

type GroupMessageType = "text" | "document" | "image" | "system"

interface ApiGroupMember {
  userId: string
  displayName?: string | null
  avatar?: string | null
  role: string
  joinedAt: string
}

interface ApiInvitationCandidate {
  userId: string
  displayName?: string | null
  avatar?: string | null
  role?: string | null
  joinedAt?: string | null
}

interface ApiGroupMessage {
  id: string
  groupId: string
  senderId?: string | null
  senderName?: string | null
  content?: string | null
  messageType: GroupMessageType
  documentId?: string | null
  documentName?: string | null
  documentSubject?: string | null
  documentVisibility?: string | null
  documentDownloadable?: boolean | null
  imageUrl?: string | null
  imageName?: string | null
  createdAt: string
}

interface ApiGroup {
  id: string
  groupCode: string
  name: string
  description?: string | null
  ownerId: string
  ownerName?: string | null
  maxMembers?: number | null
  members?: ApiGroupMember[]
  createdAt: string
  updatedAt: string
}

export interface ApiGroupSettings {
  groupId?: string
  muted: boolean
  pinned: boolean
}

interface ErrorBody {
  message?: string
  error?: string
  code?: string
}

async function parseError(response: Response): Promise<string> {
  let backendMessage = ""

  try {
    const body = (await response.json()) as ErrorBody
    backendMessage = body.message || body.error || body.code || ""
  } catch {
    // ignore
  }

  const normalized = backendMessage.trim().toUpperCase()
  if (response.status === 401 || normalized === "UNAUTHENTICATED") {
    return "Group API rejected this session. Please refresh or log in again. If other modules still work, backend group authentication needs checking."
  }

  if (backendMessage) return backendMessage

  return `Không thể gọi Group API (HTTP ${response.status}). Vui lòng thử lại.`
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function jsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...authHeaders(),
  }
}

function mapMember(api: ApiGroupMember): GroupChatMember {
  return {
    userId: api.userId,
    displayName: api.displayName ?? "Member",
    avatar: api.avatar ?? undefined,
    role: api.role === "owner" ? "owner" : "member",
    joinedAt: new Date(api.joinedAt),
  }
}

function mapInvitationCandidate(api: ApiInvitationCandidate): GroupInvitationCandidate {
  return {
    userId: api.userId,
    displayName: api.displayName ?? "Member",
    avatar: api.avatar ?? null,
  }
}

function mapMessage(api: ApiGroupMessage): GroupChatMessage {
  const documentVisibility = api.documentVisibility?.toLowerCase()

  return {
    id: api.id,
    groupId: api.groupId,
    senderId: api.senderId ?? "system",
    senderName: api.senderName ?? "System",
    content: api.content ?? "",
    timestamp: new Date(api.createdAt),
    messageType: api.messageType,
    documentId: api.documentId ?? undefined,
    documentName: api.documentName ?? undefined,
    documentSubject: api.documentSubject ?? undefined,
    documentVisibility: documentVisibility === "public" || documentVisibility === "private" ? documentVisibility : undefined,
    documentDownloadable: api.documentDownloadable ?? undefined,
    imageUrl: api.imageUrl ?? undefined,
    imageName: api.imageName ?? undefined,
  }
}

export function mapGroup(api: ApiGroup): GroupChat {
  return {
    id: api.id,
    groupCode: api.groupCode,
    name: api.name,
    description: api.description ?? undefined,
    ownerId: api.ownerId,
    ownerName: api.ownerName ?? "Owner",
    maxMembers: api.maxMembers ?? 99,
    members: (api.members ?? []).map(mapMember),
    messages: [],
    createdAt: new Date(api.createdAt),
    updatedAt: new Date(api.updatedAt),
  }
}

function mapGroupInvitation(api: ApiGroup): GroupInvitation {
  return {
    id: api.id,
    groupCode: api.groupCode,
    name: api.name,
    description: api.description ?? undefined,
    ownerId: api.ownerId,
    createdAt: new Date(api.createdAt),
    updatedAt: new Date(api.updatedAt),
  }
}

/** GET /api/groups/{groupId}/invitations/search — find an invitee by email. */
export async function searchGroupInvitationUserApi(
  groupId: string,
  email: string,
): Promise<GroupInvitationCandidate> {
  const normalizedEmail = email.trim().toLowerCase()

  const query = new URLSearchParams({ email: normalizedEmail })
  const response = await fetch(
    `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/invitations/search?${query.toString()}`,
    { headers: authHeaders() },
  )
  if (!response.ok) throw new Error(await parseError(response))
  return mapInvitationCandidate((await response.json()) as ApiInvitationCandidate)
}

/** POST /api/groups/{groupId}/invitations — invite a user by email. */
export async function inviteGroupMemberApi(groupId: string, email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()

  const query = new URLSearchParams({ email: normalizedEmail })
  const response = await fetch(
    `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/invitations?${query.toString()}`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}

/** GET /api/groups/invitations/pending — invitations awaiting the current user. */
export async function fetchPendingGroupInvitationsApi(): Promise<GroupInvitation[]> {
  const response = await fetch(`${API_BASE_URL}/api/groups/invitations/pending`, {
    headers: authHeaders(),
    cache: "no-store",
  })
  if (!response.ok) throw new Error(await parseError(response))
  const invitations = (await response.json()) as ApiGroup[]
  return invitations.map(mapGroupInvitation)
}

/** POST /api/groups/{groupId}/invitations/respond?accept=true|false — accept or decline. */
export async function respondGroupInvitationApi(groupId: string, accept: boolean): Promise<void> {
  const query = new URLSearchParams({ accept: String(accept) })
  const response = await fetch(
    `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/invitations/respond?${query.toString()}`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}

// ─── API calls ───────────────────────────────────────────────────────────────

/** GET /api/groups — list groups where current user is a member. */
export async function fetchGroupsApi(mockOwnerId?: string): Promise<GroupChat[]> {
  const response = MOCK_API
    ? await mockFetchGroupsRequest(mockOwnerId)
    : await fetch(`${API_BASE_URL}/api/groups`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  const groups = (await response.json()) as ApiGroup[]
  return groups.map(mapGroup)
}

/** GET /api/groups/{groupId} — group detail with members and recent messages. */
export async function fetchGroupDetailApi(groupId: string): Promise<GroupChat> {
  const response = MOCK_API
    ? await mockFetchGroupDetailRequest(groupId)
    : await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return mapGroup((await response.json()) as ApiGroup)
}

/** GET /api/groups/{groupId}/messages — full member-visible message history. */
export async function fetchGroupMessagesApi(groupId: string): Promise<GroupChatMessage[]> {
  const response = MOCK_API
    ? await mockFetchGroupMessagesRequest(groupId)
    : await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/messages`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  const messages = (await response.json()) as ApiGroupMessage[]
  return messages.map(mapMessage)
}

/** POST /api/groups — create group. The current contract has no group password. */
export async function createGroupApi(
  input: {
    groupCode?: string
    name: string
    description?: string
  },
  mockOwner?: { id: string; displayName?: string },
): Promise<GroupChat> {
  const response = MOCK_API
    ? await mockCreateGroupRequest(input, mockOwner ?? { id: "mock-current-user" })
    : await fetch(`${API_BASE_URL}/api/groups`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(input),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return mapGroup((await response.json()) as ApiGroup)
}

/** POST /api/groups/{groupId}/messages — send text message. */
export async function sendGroupMessageApi(groupId: string, content: string): Promise<GroupChatMessage> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/messages`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ content }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapMessage((await response.json()) as ApiGroupMessage)
}

/** POST /api/groups/{groupId}/documents — share a public document to group. */
export async function shareGroupDocumentApi(groupId: string, documentId: string): Promise<GroupChatMessage> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/documents`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ documentId }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapMessage((await response.json()) as ApiGroupMessage)
}

/** POST /api/groups/{groupId}/images — upload image attachment to group chat. */
export async function uploadGroupImageApi(groupId: string, file: File): Promise<GroupChatMessage> {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/images`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapMessage((await response.json()) as ApiGroupMessage)
}

function parseDownloadFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return "document"

  const encodedMatch = contentDisposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)
  if (encodedMatch?.[1]) {
    const encodedFilename = encodedMatch[1].trim().replace(/^"(.*)"$/, "$1")
    try {
      return decodeURIComponent(encodedFilename) || "document"
    } catch {
      return encodedFilename || "document"
    }
  }

  const filenameMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i)
  return (filenameMatch?.[1] ?? filenameMatch?.[2])?.trim() || "document"
}

/** GET /api/groups/{groupId}/documents/{documentId}/download — download shared file. */
export async function downloadGroupDocumentApi(groupId: string, documentId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/documents/${encodeURIComponent(documentId)}/download`,
    { headers: authHeaders() },
  )
  if (!response.ok) throw new Error(await parseError(response))

  const blob = await response.blob()
  const filename = parseDownloadFilename(response.headers.get("Content-Disposition"))
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  // Keep the object URL alive until the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** GET /api/groups/{groupId}/members — real member list for modal. */
export async function fetchGroupMembersApi(groupId: string): Promise<GroupChatMember[]> {
  const response = MOCK_API
    ? await mockFetchGroupMembersRequest(groupId)
    : await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/members`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  const members = (await response.json()) as ApiGroupMember[]
  return members.map(mapMember)
}

/** GET /api/groups/{groupId}/settings — member-level group options. */
export async function fetchGroupSettingsApi(groupId: string): Promise<ApiGroupSettings> {
  const response = MOCK_API
    ? await mockFetchGroupSettingsRequest(groupId)
    : await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/settings`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as ApiGroupSettings
}

/** PATCH /api/groups/{groupId}/settings/mute — mute/unmute current user's group notifications. */
export async function updateGroupMuteApi(groupId: string, muted: boolean): Promise<ApiGroupSettings> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/settings/mute`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ muted }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as ApiGroupSettings
}

/** PATCH /api/groups/{groupId}/settings/pin — pin/unpin current user's group. */
export async function updateGroupPinApi(groupId: string, pinned: boolean): Promise<ApiGroupSettings> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/settings/pin`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ pinned }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as ApiGroupSettings
}

/** GET /api/groups/{groupId}/messages/export — download chat history export. */
export async function exportGroupChatApi(groupId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/messages/export`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `group-${groupId}-chat-export.txt`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** POST /api/groups/{groupId}/report — report group to moderators/admin. */
export async function reportGroupApi(groupId: string, reason: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/report`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ reason }),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/** DELETE /api/groups/{groupId}/members/me — leave group. */
export async function leaveGroupApi(groupId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/members/me`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/** DELETE /api/groups/{groupId}/members/{targetUserId} — owner removes a member. */
export async function kickGroupMemberApi(
  groupId: string,
  targetUserId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(targetUserId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  )
  if (!response.ok) throw new Error(await parseError(response))
}

/** DELETE /api/groups/{groupId} — owner deletes group after a frontend confirmation. */
export async function deleteGroupApi(groupId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}
