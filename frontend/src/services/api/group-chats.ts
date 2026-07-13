import { getAccessToken } from "@/lib/auth-storage"
import type { GroupChat, GroupChatMember, GroupChatMessage } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// Group core is API-backed. Message/file/image helpers remain here for later
// backend tasks and should only be called once those endpoints are available.

type GroupMessageType = "text" | "document" | "image" | "system"

interface ApiGroupMember {
  userId: string
  displayName?: string | null
  avatar?: string | null
  role: string
  joinedAt: string
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
  messages?: ApiGroupMessage[]
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
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody
    if (body.message) return body.message
  } catch {
    // ignore
  }
  return "Đã xảy ra lỗi. Vui lòng thử lại."
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
    password: "",
    name: api.name,
    description: api.description ?? undefined,
    ownerId: api.ownerId,
    ownerName: api.ownerName ?? "Owner",
    maxMembers: api.maxMembers ?? 99,
    members: (api.members ?? []).map(mapMember),
    messages: (api.messages ?? []).map(mapMessage),
    createdAt: new Date(api.createdAt),
    updatedAt: new Date(api.updatedAt),
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

/** GET /api/groups — list groups where current user is a member. */
export async function fetchGroupsApi(): Promise<GroupChat[]> {
  const response = await fetch(`${API_BASE_URL}/api/groups`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const groups = (await response.json()) as ApiGroup[]
  return groups.map(mapGroup)
}

/** GET /api/groups/{groupId} — group detail with members and recent messages. */
export async function fetchGroupDetailApi(groupId: string): Promise<GroupChat> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapGroup((await response.json()) as ApiGroup)
}

/** GET /api/groups/{groupId}/password — owner-only plain-text password. */
export async function fetchGroupPasswordApi(groupId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/password`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    const error = new Error(await parseError(response)) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  const password = (await response.text()).trim()
  if (!password) throw new Error("GROUP_PASSWORD_NOT_AVAILABLE")
  return password
}

/** POST /api/groups — create group. Backend hashes password and checks limits. */
export async function createGroupApi(input: {
  groupCode?: string
  name: string
  description?: string
  password: string
}): Promise<GroupChat> {
  const response = await fetch(`${API_BASE_URL}/api/groups`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapGroup((await response.json()) as ApiGroup)
}

/** POST /api/groups/join — join by Group ID and password. Backend returns 200 with no body. */
export async function joinGroupApi(groupCode: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/groups/join`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ groupCode, password }),
  })
  if (!response.ok) throw new Error(await parseError(response))
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

/** GET /api/groups/{groupId}/documents/{documentId}/download — download shared file. */
export async function downloadGroupDocumentApi(groupId: string, documentId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/documents/${encodeURIComponent(documentId)}/download`,
    { headers: authHeaders() },
  )
  if (!response.ok) throw new Error(await parseError(response))

  const blob = await response.blob()
  const contentDisposition = response.headers.get("Content-Disposition")
  let filename = "document"
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/)
    if (match?.[1]) filename = match[1].trim()
  }

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** GET /api/groups/{groupId}/members — real member list for modal. */
export async function fetchGroupMembersApi(groupId: string): Promise<GroupChatMember[]> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/members`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const members = (await response.json()) as ApiGroupMember[]
  return members.map(mapMember)
}

/** GET /api/groups/{groupId}/settings — member-level group options. */
export async function fetchGroupSettingsApi(groupId: string): Promise<ApiGroupSettings> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/settings`, {
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

/** DELETE /api/groups/{groupId} — owner deletes group after password confirmation. */
export async function deleteGroupApi(groupId: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}`, {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify({ password }),
  })
  if (!response.ok) throw new Error(await parseError(response))
}
