import { getAccessToken } from "@/lib/auth-storage"
import type { Flashcard, FlashcardStatus } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Backend DTO ─────────────────────────────────────────────────────────────

interface ApiFlashcard {
  id: string
  userId: string
  documentId: string | null
  question: string
  answer: string
  status: string        // "new" | "learning" | "mastered"
  aiGenerated: boolean
  createdAt: string
  updatedAt: string
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

function mapStatus(status: string): FlashcardStatus {
  switch (status) {
    case "learning": return "learning"
    case "mastered": return "mastered"
    default:         return "new"
  }
}

export function mapApiFlashcard(api: ApiFlashcard): Flashcard {
  return {
    id: api.id,
    documentId: api.documentId ?? undefined,
    question: api.question,
    answer: api.answer,
    status: mapStatus(api.status),
    aiGenerated: api.aiGenerated,
    createdAt: new Date(api.createdAt),
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * POST /api/flashcards/generate — AI tạo flashcard từ nội dung tài liệu thật (BR-036).
 * Backend gọi sang AI service (RAG + LLM) nên có thể mất 5–20s tuỳ độ dài tài liệu;
 * dùng AbortController để tránh treo UI vô thời hạn nếu AI service bị treo/timeout.
 */
const GENERATE_TIMEOUT_MS = 30_000

export async function generateFlashcardsApi(documentId: string, count?: number): Promise<Flashcard[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE_URL}/api/flashcards/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(count ? { documentId, count } : { documentId }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(await parseError(response))
    const cards = (await response.json()) as ApiFlashcard[]
    return cards.map(mapApiFlashcard)
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Quá thời gian chờ, vui lòng thử lại.")
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * GET /api/flashcards?documentId={id} — lấy danh sách flashcard theo tài liệu (BR-039).
 */
export async function fetchFlashcardsApi(documentId: string): Promise<Flashcard[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/flashcards?documentId=${encodeURIComponent(documentId)}`,
    { headers: authHeaders() },
  )
  if (!response.ok) throw new Error(await parseError(response))
  const cards = (await response.json()) as ApiFlashcard[]
  return cards.map(mapApiFlashcard)
}

/**
 * PATCH /api/flashcards/{id}/status — cập nhật trạng thái flashcard (BR-038).
 * Trạng thái: "new" | "learning" | "mastered"
 */
export async function updateFlashcardStatusApi(
  id: string,
  status: FlashcardStatus,
): Promise<Flashcard> {
  const response = await fetch(`${API_BASE_URL}/api/flashcards/${id}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ status }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiFlashcard((await response.json()) as ApiFlashcard)
}

/**
 * POST /api/flashcards — Thêm flashcard thủ công (BR-037).
 * documentId là optional — không bắt buộc gắn tài liệu.
 */
export async function createFlashcardApi(payload: {
  question: string
  answer: string
  documentId?: string
}): Promise<Flashcard> {
  const response = await fetch(`${API_BASE_URL}/api/flashcards`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiFlashcard((await response.json()) as ApiFlashcard)
}

/**
 * DELETE /api/flashcards/{id} — Xoá 1 flashcard độc lập (BR-040).
 */
export async function deleteFlashcardApi(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/flashcards/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
  if (!response.ok) throw new Error(await parseError(response))
}

/**
 * PATCH /api/flashcards/{id} — Sửa câu hỏi/câu trả lời.
 */
export async function updateFlashcardApi(
  id: string,
  payload: { question: string; answer: string },
): Promise<Flashcard> {
  const response = await fetch(`${API_BASE_URL}/api/flashcards/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiFlashcard((await response.json()) as ApiFlashcard)
}
