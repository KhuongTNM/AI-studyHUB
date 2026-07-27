import { getAccessToken } from "@/lib/auth-storage"
import type { ChatSource, ChatMessage, ChatSession } from "@/states/types"
import { MOCK_API } from "@/services/mock/mock-config"
import { mockGetChatQuotaRequest, mockAskRagSearchRequest } from "@/services/mock/chat-quota.mock"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Backend DTO (docs.chat_sessions / docs.chat_messages) ────────────────────

interface ApiChatSession {
  id: string
  userId: string
  documentId?: string | null
  title?: string | null
  createdAt: string
}

interface ApiChatMessage {
  id: string
  sessionId: string
  role: "user" | "assistant"
  content: string
  createdAt: string
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
  return `Yêu cầu thất bại (HTTP ${response.status})`
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function mapApiSession(api: ApiChatSession): ChatSession {
  return {
    id: api.id,
    title: api.title?.trim() || "Cuộc trò chuyện mới",
    messages: [],
    documentId: api.documentId ?? undefined,
    createdAt: new Date(api.createdAt),
  }
}

function mapApiMessage(api: ApiChatMessage): ChatMessage {
  return {
    id: api.id,
    role: api.role,
    content: api.content,
    timestamp: new Date(api.createdAt),
  }
}

// ─── Chat session/message API calls ────────────────────────────────────────────

/** GET /api/v1/chat/sessions — danh sách session của user hiện tại, mới nhất trước */
export async function fetchChatSessionsApi(): Promise<ChatSession[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const sessions = (await response.json()) as ApiChatSession[]
  return sessions.map(mapApiSession)
}

/** GET /api/v1/chat/sessions/{sessionId}/messages — toàn bộ tin nhắn theo thứ tự thời gian */
export async function fetchChatMessagesApi(sessionId: string): Promise<ChatMessage[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const messages = (await response.json()) as ApiChatMessage[]
  return messages.map(mapApiMessage)
}

/** POST /api/v1/chat/sessions — tạo session mới, gắn kèm documentId (nếu có) */
export async function createChatSessionApi(documentId?: string | null): Promise<ChatSession> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ documentId: documentId ?? null }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const session = (await response.json()) as ApiChatSession
  return mapApiSession(session)
}

/** POST /api/v1/chat/sessions/{sessionId}/messages — lưu 1 tin nhắn vào session */
export async function saveChatMessageApi(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ role, content }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const message = (await response.json()) as ApiChatMessage
  return mapApiMessage(message)
}

/** DELETE /api/v1/chat/sessions/{sessionId} */
export async function deleteChatSessionApi(sessionId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/sessions/${sessionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/** GET /api/v1/chat/quota — CHAT-102: số lượt Chat AI còn lại trong ngày theo gói hiện tại */
export interface ChatQuotaResponse {
  limit: number
  used: number
  remaining: number | null
  unlimited: boolean
}

export async function fetchChatQuotaApi(): Promise<ChatQuotaResponse> {
  const response = MOCK_API
    ? await mockGetChatQuotaRequest()
    : await fetch(`${API_BASE_URL}/api/v1/chat/quota`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

interface AskParams {
  query: string
  // userId KHÔNG còn cần truyền nữa — Backend tự xác định qua JWT (CHAT-SEC-01,
  // xem Chat_AI_Quota_API_Contract.docx v2.0, Mục 0.3/CHAT-SEC-01). Gửi field
  // này lên (dù Backend sẽ bỏ qua) chỉ gây nhiễu, nên loại bỏ hẳn khỏi request.
  documentId?: string | null
  topK?: number
}

interface StreamCallbacks {
  /** Gọi mỗi khi nhận được thêm một đoạn text từ AI */
  onToken: (deltaText: string, fullTextSoFar: string) => void
  /** Gọi khi nhận được danh sách nguồn trích dẫn (cuối stream) */
  onSources?: (sources: ChatSource[]) => void
  /** Gọi khi stream kết thúc thành công */
  onDone?: () => void
  /** Gọi khi có lỗi */
  onError?: (error: Error) => void
}

const SOURCES_MARKER = "[SOURCES]"

/**
 * Gọi RAG pipeline (POST /api/v1/vector/search) và đọc câu trả lời dạng stream.
 * Backend trả về text thuần chảy từng phần (token-by-token), kết thúc bằng:
 *   \n\n[SOURCES]\n{"sources":[...]}\n\n
 */
export async function askRagStream(
  { query, documentId, topK = 5 }: AskParams,
  { onToken, onSources, onDone, onError }: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  try {
    const token = getAccessToken()

    const response = MOCK_API
      ? await mockAskRagSearchRequest({ query, documentId, topK })
      : await fetch(`${API_BASE_URL}/api/v1/vector/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            query,
            documentId: documentId ?? null,
            topK,
          }),
          signal,
        })

    if (!response.ok || !response.body) {
      let message = `Yêu cầu thất bại (HTTP ${response.status})`
      try {
        const errBody = await response.json()
        // GAP-3: Java trả lỗi ở field "message", Python (AI Service) proxy nguyên văn
        // ở field "detail" — đọc theo fallback để luôn bắt được nội dung lỗi thật.
        message = errBody?.message || errBody?.detail || message
      } catch {
        // ignore, giữ message mặc định
      }
      throw new Error(message)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")

    let rawBuffer = ""        // toàn bộ dữ liệu thô nhận được, dùng để dò marker [SOURCES]
    let emittedTextLength = 0 // số ký tự câu trả lời đã "phát" ra ngoài (trước marker)

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      rawBuffer += decoder.decode(value, { stream: true })

      const markerIndex = rawBuffer.indexOf(SOURCES_MARKER)
      if (markerIndex === -1) {
        // Chưa thấy marker -> toàn bộ buffer hiện tại (trừ phần đã emit) là câu trả lời
        const answerSoFar = rawBuffer
        if (answerSoFar.length > emittedTextLength) {
          const delta = answerSoFar.slice(emittedTextLength)
          emittedTextLength = answerSoFar.length
          onToken(delta, answerSoFar.trimEnd())
        }
      } else {
        // Đã thấy marker -> phần trước marker là câu trả lời cuối cùng
        const answerFinal = rawBuffer.slice(0, markerIndex)
        if (answerFinal.length > emittedTextLength) {
          const delta = answerFinal.slice(emittedTextLength)
          emittedTextLength = answerFinal.length
          onToken(delta, answerFinal.trimEnd())
        }
      }
    }

    // Sau khi đọc xong toàn bộ stream, parse phần [SOURCES] nếu có
    const markerIndex = rawBuffer.indexOf(SOURCES_MARKER)
    if (markerIndex !== -1 && onSources) {
      const jsonPart = rawBuffer.slice(markerIndex + SOURCES_MARKER.length).trim()
      try {
        const parsed = JSON.parse(jsonPart)
        const sources: ChatSource[] = Array.isArray(parsed?.sources) ? parsed.sources : []
        onSources(sources)
      } catch {
        // Nếu parse lỗi thì bỏ qua sources, không làm hỏng câu trả lời chính
      }
    }

    onDone?.()
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // Người dùng hủy request, không coi là lỗi
      return
    }
    onError?.(error instanceof Error ? error : new Error("Đã xảy ra lỗi không xác định"))
  }
}
