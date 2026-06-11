import { getAccessToken } from "@/lib/auth-storage"
import type { Flashcard, FlashcardStatus } from "@/states/types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Backend DTO ─────────────────────────────────────────────────────────────

interface ApiFlashcard {
  id: string
  userId: string
  documentId: string
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
    documentId: api.documentId,
    question: api.question,
    answer: api.answer,
    status: mapStatus(api.status),
    createdAt: new Date(api.createdAt),
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * POST /api/flashcards/generate — AI tạo flashcard từ tài liệu (BR-036).
 * Tối thiểu 3 flashcard được tạo từ tài liệu có trạng thái "ready".
 */
export async function generateFlashcardsApi(documentId: string): Promise<Flashcard[]> {
  const response = await fetch(`${API_BASE_URL}/api/flashcards/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ documentId }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  const cards = (await response.json()) as ApiFlashcard[]
  return cards.map(mapApiFlashcard)
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
