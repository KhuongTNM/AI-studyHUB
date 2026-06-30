import { getAccessToken } from "@/lib/auth-storage"
import type { ChatSource } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface AskParams {
  query: string
  userId: string
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
  { query, userId, documentId, topK = 5 }: AskParams,
  { onToken, onSources, onDone, onError }: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  try {
    const token = getAccessToken()

    const response = await fetch(`${API_BASE_URL}/api/v1/vector/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query,
        user_id: userId,
        document_id: documentId ?? null,
        top_k: topK,
      }),
      signal,
    })

    if (!response.ok || !response.body) {
      let message = `Yêu cầu thất bại (HTTP ${response.status})`
      try {
        const errBody = await response.json()
        if (errBody?.message) message = errBody.message
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
