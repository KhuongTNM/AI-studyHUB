import { getAccessToken } from "@/lib/auth-storage"
import type { StudyRoom } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Backend DTO ─────────────────────────────────────────────────────────────

export interface ApiStudyRoom {
  id: string
  code: string
  hostId: string
  hostName?: string | null
  hasPassword: boolean
  maxMembers: number
  currentMemberCount: number
  active: boolean
  createdAt: string
  members: ApiStudyRoomMember[]
  messages: ApiStudyRoomMessage[]
}

interface ApiStudyRoomMember {
  userId: string
  displayName: string
  joinedAt: string
}

interface ApiStudyRoomMessage {
  id: string
  senderId?: string | null
  senderName: string
  content: string
  messageType: "user" | "system" | "document"
  documentId?: string | null
  documentName?: string | null
  documentSubject?: string | null
  documentType?: string | null
  documentVisibility?: "public" | "private" | null
  documentDownloadable?: boolean
  createdAt: string
}

interface ErrorBody {
  message?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

export function mapApiStudyRoom(apiRoom: ApiStudyRoom): StudyRoom {
  return {
    id: apiRoom.code,
    hostId: apiRoom.hostId,
    hostName: apiRoom.hostName ?? "Unknown",
    capacity: apiRoom.maxMembers,
    members: apiRoom.members.map(member => ({
      userId: member.userId,
      displayName: member.displayName,
      joinedAt: new Date(member.joinedAt),
    })),
    messages: apiRoom.messages.map(message => ({
      id: message.id,
      senderId: message.senderId ?? "system",
      senderName: message.senderName,
      content: message.content,
      messageType: message.messageType,
      documentId: message.documentId ?? undefined,
      documentName: message.documentName ?? undefined,
      documentSubject: message.documentSubject ?? undefined,
      documentType: message.documentType ?? undefined,
      documentVisibility: message.documentVisibility ?? undefined,
      documentDownloadable: message.documentDownloadable ?? false,
      timestamp: new Date(message.createdAt),
    })),
    createdAt: new Date(apiRoom.createdAt),
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * POST /api/study-rooms — tạo phòng học nhóm (BR-041 đến BR-043).
 *
 * Yêu cầu:
 * - User phải có gói trả phí còn hiệu lực (hoặc Admin / Sub-admin).
 * - roomCode viết hoa, duy nhất trong hệ thống.
 * - password tuỳ chọn.
 */
export async function createStudyRoomApi(
  roomCode: string,
  password?: string,
): Promise<StudyRoom> {
  const body: Record<string, string> = { roomCode: roomCode.trim().toUpperCase() }
  if (password && password.trim()) body.password = password.trim()

  const response = await fetch(`${API_BASE_URL}/api/study-rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiStudyRoom((await response.json()) as ApiStudyRoom)
}

export async function fetchStudyRoomsApi(): Promise<StudyRoom[]> {
  const response = await fetch(`${API_BASE_URL}/api/study-rooms`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const rooms = (await response.json()) as ApiStudyRoom[]
  return rooms.map(mapApiStudyRoom)
}

export async function fetchStudyRoomApi(roomCode: string): Promise<StudyRoom> {
  const response = await fetch(`${API_BASE_URL}/api/study-rooms/${encodeURIComponent(roomCode)}`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiStudyRoom((await response.json()) as ApiStudyRoom)
}

export async function joinStudyRoomApi(roomCode: string, password?: string): Promise<StudyRoom> {
  const response = await fetch(`${API_BASE_URL}/api/study-rooms/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ password: password?.trim() || "" }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiStudyRoom((await response.json()) as ApiStudyRoom)
}

export async function leaveStudyRoomApi(roomCode: string): Promise<StudyRoom> {
  const response = await fetch(`${API_BASE_URL}/api/study-rooms/${encodeURIComponent(roomCode)}/leave`, {
    method: "POST",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiStudyRoom((await response.json()) as ApiStudyRoom)
}

export async function sendStudyRoomMessageApi(roomCode: string, content: string): Promise<StudyRoom> {
  const response = await fetch(`${API_BASE_URL}/api/study-rooms/${encodeURIComponent(roomCode)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ content }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiStudyRoom((await response.json()) as ApiStudyRoom)
}

export async function shareStudyRoomDocumentApi(roomCode: string, documentId: string): Promise<StudyRoom> {
  const response = await fetch(`${API_BASE_URL}/api/study-rooms/${encodeURIComponent(roomCode)}/share-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ documentId }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiStudyRoom((await response.json()) as ApiStudyRoom)
}
