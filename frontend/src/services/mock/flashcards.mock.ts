/**
 * Mock cho các API flashcard — dùng khi MOCK_API = true (mock-config.ts).
 *
 * Mục tiêu: trả về đúng Response (status, headers, body) như flashcards.ts
 * mong đợi, để test được toàn bộ luồng UI (chọn số thẻ, generate AI, giới hạn
 * theo gói dịch vụ, thêm/sửa/xoá thủ công) mà KHÔNG cần chạy Backend Spring Boot
 * + AI service thật.
 *
 * Khi đổi MOCK_API = false, toàn bộ file này không còn được gọi tới nữa —
 * flashcards.ts sẽ gọi thẳng backend thật như bình thường.
 */

// ─── Kho dữ liệu giả lập trong phiên làm việc (mất khi reload trang) ────────

interface MockFlashcard {
  id: string
  userId: string
  documentId: string | null
  question: string
  answer: string
  status: "new" | "learning" | "mastered"
  aiGenerated: boolean
  createdAt: string
  updatedAt: string
}

const mockCards: MockFlashcard[] = []
let mockSeq = 0

// Cache lại giới hạn gói (maxFlashcards) mỗi lần fetchFlashcardQuotaApi được gọi,
// để generate/create mock dùng lại đúng con số đó khi enforce quota — giống hệt
// cách backend thật đọc plan.getMaxFlashcards() ở FlashcardService.java.
let cachedMaxFlashcards = 5

function newId(): string {
  mockSeq += 1
  return `mock-flashcard-${Date.now()}-${mockSeq}`
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Cùng công thức maxFlashcards với dữ liệu seed mặc định ở backend
 * (SubscriptionPlan.java: free=5, có thể chỉnh qua admin). Chỉ dùng cho mock.
 */
function planMaxFlashcards(tier: string): number {
  if (tier === "2-4") return 20
  if (tier === "5+") return -1 // không giới hạn
  return 5 // free
}

function toApiShape(card: MockFlashcard) {
  return { ...card }
}

// ─── 1. Quota gói dịch vụ (GET /api/subscription-plans/{planName}) ──────────

export async function mockFetchFlashcardQuotaRequest(tier: string): Promise<Response> {
  await delay(200)
  cachedMaxFlashcards = planMaxFlashcards(tier)
  return jsonResponse(200, { maxFlashcards: cachedMaxFlashcards })
}

// ─── 2. Generate AI (POST /api/flashcards/generate) ─────────────────────────

export async function mockGenerateFlashcardsRequest(
  documentId: string,
  count: number | undefined,
): Promise<Response> {
  await delay(500)
  const requestedCount = count ?? 5
  // Chỉ đếm thẻ do AI sinh ra — thẻ thêm thủ công không tính vào quota này.
  const currentAiCount = mockCards.filter(c => c.aiGenerated).length

  if (cachedMaxFlashcards !== -1 && currentAiCount + requestedCount > cachedMaxFlashcards) {
    return jsonResponse(400, {
      message: `Gói của bạn chỉ cho phép tạo tối đa ${cachedMaxFlashcards} flashcard bằng AI. Bạn hiện có ${currentAiCount} thẻ AI, không thể tạo thêm ${requestedCount} thẻ.`,
    })
  }

  const now = new Date().toISOString()
  const created: MockFlashcard[] = []
  for (let i = 0; i < requestedCount; i++) {
    const card: MockFlashcard = {
      id: newId(),
      userId: "mock-current-user",
      documentId,
      question: `[Mock] Câu hỏi AI sinh ra #${mockCards.length + 1} từ tài liệu ${documentId}`,
      answer: `[Mock] Đây là câu trả lời mẫu #${mockCards.length + 1}, dùng để test giao diện.`,
      status: "new",
      aiGenerated: true,
      createdAt: now,
      updatedAt: now,
    }
    mockCards.push(card)
    created.push(card)
  }

  return jsonResponse(200, created.map(toApiShape))
}

// ─── 3. Danh sách flashcard theo tài liệu (GET /api/flashcards?documentId=) ─

export async function mockFetchFlashcardsRequest(documentId: string): Promise<Response> {
  await delay(150)
  const list = mockCards.filter(c => c.documentId === documentId)
  return jsonResponse(200, list.map(toApiShape))
}

// ─── 4. Toàn bộ flashcard của user (GET /api/flashcards) ────────────────────

export async function mockFetchAllFlashcardsRequest(): Promise<Response> {
  await delay(150)
  return jsonResponse(200, mockCards.map(toApiShape))
}

// ─── 5. Thêm flashcard thủ công (POST /api/flashcards) ──────────────────────

// ─── 5. Thêm flashcard thủ công (POST /api/flashcards) ──────────────────────
// LƯU Ý: quota theo gói (maxFlashcards) chỉ áp dụng cho AI generate, KHÔNG áp
// dụng cho tạo thủ công — user được tự do thêm bao nhiêu thẻ tay tuỳ ý.

export async function mockCreateFlashcardRequest(payload: {
  question: string
  answer: string
  documentId?: string
}): Promise<Response> {
  await delay(300)

  const now = new Date().toISOString()
  const card: MockFlashcard = {
    id: newId(),
    userId: "mock-current-user",
    documentId: payload.documentId ?? null,
    question: payload.question.trim(),
    answer: payload.answer.trim(),
    status: "new",
    aiGenerated: false,
    createdAt: now,
    updatedAt: now,
  }
  mockCards.push(card)
  return jsonResponse(201, toApiShape(card))
}

// ─── 6. Cập nhật trạng thái (PATCH /api/flashcards/{id}/status) ─────────────

export async function mockUpdateFlashcardStatusRequest(
  id: string,
  status: "new" | "learning" | "mastered",
): Promise<Response> {
  await delay(150)
  const card = mockCards.find(c => c.id === id)
  if (!card) return jsonResponse(404, { message: "Flashcard không tồn tại." })
  card.status = status
  card.updatedAt = new Date().toISOString()
  return jsonResponse(200, toApiShape(card))
}

// ─── 7. Sửa câu hỏi/câu trả lời (PATCH /api/flashcards/{id}) ────────────────

export async function mockUpdateFlashcardRequest(
  id: string,
  payload: { question: string; answer: string },
): Promise<Response> {
  await delay(200)
  const card = mockCards.find(c => c.id === id)
  if (!card) return jsonResponse(404, { message: "Flashcard không tồn tại." })
  card.question = payload.question.trim()
  card.answer = payload.answer.trim()
  card.updatedAt = new Date().toISOString()
  return jsonResponse(200, toApiShape(card))
}

// ─── 8. Xoá 1 flashcard (DELETE /api/flashcards/{id}) ───────────────────────

export async function mockDeleteFlashcardRequest(id: string): Promise<Response> {
  await delay(150)
  const index = mockCards.findIndex(c => c.id === id)
  if (index === -1) return jsonResponse(404, { message: "Flashcard không tồn tại." })
  mockCards.splice(index, 1)
  return new Response(null, { status: 204 })
}

// ─── 9. Xoá toàn bộ flashcard của 1 tài liệu (DELETE /api/flashcards?documentId=) ─

export async function mockDeleteAllFlashcardsForDocumentRequest(documentId: string): Promise<Response> {
  await delay(200)
  for (let i = mockCards.length - 1; i >= 0; i--) {
    if (mockCards[i].documentId === documentId) mockCards.splice(i, 1)
  }
  return new Response(null, { status: 204 })
}
