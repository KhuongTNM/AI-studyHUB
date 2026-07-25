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

import { mockFindPlanById, mockGetFreePlan } from "@/services/mock/subscription-plans.mock"

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
 * FIXED: trước đây hardcode theo tier ("2-4"→20, "5+"→-1, else free=5) — gói
 * custom admin tạo thêm (id >= 4) không rơi vào "2-4"/"5+" nên luôn bị tính
 * như free dù user đã mua gói khác. Giờ tra thẳng maxFlashcards thật của gói
 * theo subscriptionPlanId (mockFindPlanById, dùng chung mockPlans với
 * subscription-plans.mock.ts) — đúng với BẤT KỲ gói nào, kể cả gói mới tạo.
 * Chỉ fallback về tier hardcode cũ cho phiên/tài khoản cũ không có planId.
 */
function planMaxFlashcards(planId: number | null | undefined, tierFallback: string): number {
  const plan = mockFindPlanById(planId)
  if (plan) return plan.maxFlashcards
  if (tierFallback === "2-4") return 20
  if (tierFallback === "5+") return -1 // không giới hạn
  return mockGetFreePlan().maxFlashcards // free
}

/**
 * Trần số thẻ TỐI ĐA MỖI LƯỢT BẤM (BR-099) — độc lập với maxFlashcards ở trên.
 * BE không có field perClickLimit riêng, nên mock suy ra một cách hợp lý từ
 * maxFlashcards thật của gói (id-based), thay vì đoán theo tier hardcode:
 * - Gói không giới hạn (maxFlashcards = -1) → trần 50/lượt (bảo vệ quota AI dùng chung).
 * - Gói có giới hạn → trần = maxFlashcards, kẹp trong khoảng [5, 50].
 */
function planPerClickLimit(planId: number | null | undefined, tierFallback: string): number {
  const plan = mockFindPlanById(planId)
  const maxFlashcards = plan ? plan.maxFlashcards : undefined
  if (maxFlashcards === -1) return 50
  if (typeof maxFlashcards === "number") return Math.max(5, Math.min(maxFlashcards, 50))
  // Fallback cho phiên/tài khoản cũ không có planId.
  if (tierFallback === "2-4") return 20
  if (tierFallback === "5+") return 50
  return 5 // free — BR-099: cố định 5/lượt, không phụ thuộc quota tổng
}
let cachedPerClickLimit = 5

function toApiShape(card: MockFlashcard) {
  return { ...card }
}

// ─── 1. Quota gói dịch vụ (GET /api/subscription-plans/{planName}) ──────────

export async function mockFetchFlashcardQuotaRequest(
  tier: string,
  subscriptionPlanId?: number | null,
): Promise<Response> {
  await delay(200)
  cachedMaxFlashcards = planMaxFlashcards(subscriptionPlanId, tier)
  cachedPerClickLimit = planPerClickLimit(subscriptionPlanId, tier)
  return jsonResponse(200, { maxFlashcards: cachedMaxFlashcards, perClickLimit: cachedPerClickLimit })
}

// ─── 2. Generate AI theo cơ chế Batching (POST /api/flashcards/generate) ────
// Mô phỏng đúng luồng BR-100: chia N thành các batch 5 thẻ, chạy tuần tự,
// "lưu" ngay sau mỗi batch thành công. Response trả về đúng shape MỚI của
// GenerateFlashcardsResponse (Mục 1, 4.1 của API Contract) — KHÔNG còn là
// mảng phẳng như trước.
//
// TEST HOOK (chỉ tồn tại ở mock, không phải hành vi thật của BE): vì UI chỉ
// cho nhập "count" (không có ô nhập documentId tự do), dùng vài giá trị count
// cố định làm công tắc mô phỏng các kịch bản lỗi ở Mục 3/BR-104 để test UI mà
// không cần BE thật. Các giá trị này đều ≤ 20 nên test được trên mọi gói.
//   count = 13 → PARTIAL_SUCCESS: batch 1+2 thành công (10 thẻ), batch 3 timeout.
//   count = 17 → lỗi cứng 429 AI_RATE_LIMIT_EXCEEDED ngay batch đầu (0 thẻ).
//   count = 19 → lỗi cứng 422 AI_CONTENT_SAFETY_BLOCKED ngay batch đầu (0 thẻ).
const BATCH_SIZE = 5
const TEST_HOOK_PARTIAL_TIMEOUT = 13
const TEST_HOOK_RATE_LIMIT = 17
const TEST_HOOK_SAFETY_BLOCKED = 19

function makeMockCard(documentId: string, seq: number): MockFlashcard {
  const now = new Date().toISOString()
  return {
    id: newId(),
    userId: "mock-current-user",
    documentId,
    question: `[Mock] Câu hỏi AI sinh ra #${seq} từ tài liệu ${documentId}`,
    answer: `[Mock] Đây là câu trả lời mẫu #${seq}, dùng để test giao diện.`,
    status: "new",
    aiGenerated: true,
    createdAt: now,
    updatedAt: now,
  }
}

export async function mockGenerateFlashcardsRequest(
  documentId: string,
  count: number | undefined,
): Promise<Response> {
  const requestedCount = count ?? 5

  // 1. Trần per-click (BR-099/BR-101) — validate TRƯỚC khi gọi AI, giống hệt
  //    thứ tự validate mô tả ở BR-100 bước 3.
  if (requestedCount > cachedPerClickLimit) {
    await delay(150)
    return jsonResponse(400, {
      message: "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED",
      perClickLimit: cachedPerClickLimit,
      requestedCount,
    })
  }

  // 2. Quota tổng còn lại (ĐÃ CÓ, giữ nguyên pattern lỗi cũ — flat message).
  const currentAiCount = mockCards.filter(c => c.aiGenerated).length
  if (cachedMaxFlashcards !== -1 && currentAiCount + requestedCount > cachedMaxFlashcards) {
    await delay(150)
    return jsonResponse(400, {
      message: `Gói của bạn chỉ cho phép tạo tối đa ${cachedMaxFlashcards} flashcard bằng AI. Bạn hiện có ${currentAiCount} thẻ AI, không thể tạo thêm ${requestedCount} thẻ.`,
    })
  }

  // 3. TEST HOOK — lỗi cứng ngay batch đầu tiên (0 thẻ tạo được).
  if (requestedCount === TEST_HOOK_RATE_LIMIT) {
    await delay(600)
    return jsonResponse(429, { message: "AI_RATE_LIMIT_EXCEEDED", createdCount: 0, requestedCount })
  }
  if (requestedCount === TEST_HOOK_SAFETY_BLOCKED) {
    await delay(600)
    return jsonResponse(422, { message: "AI_CONTENT_SAFETY_BLOCKED", createdCount: 0, requestedCount })
  }

  // 4. Chia batch theo BR-100 bước 5-11, chạy tuần tự, "lưu" ngay sau mỗi batch.
  const totalBatches = Math.max(1, Math.ceil(requestedCount / BATCH_SIZE))
  const created: MockFlashcard[] = []
  let remaining = requestedCount

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    await delay(400) // mô phỏng độ trễ gọi Gemini cho mỗi batch

    // TEST HOOK — timeout giữa chừng (chỉ khi đã có ≥1 thẻ, đúng BR-104.1: lỗi
    // SAU batch đầu → PARTIAL_SUCCESS, không phải lỗi cứng).
    if (requestedCount === TEST_HOOK_PARTIAL_TIMEOUT && batchIndex === 2) {
      mockCards.push(...created)
      return jsonResponse(200, {
        status: "PARTIAL_SUCCESS",
        requestedCount,
        createdCount: created.length,
        failureReason: "AI_GENERATION_TIMEOUT",
        flashcards: created.map(toApiShape),
      })
    }

    const batchSize = Math.min(BATCH_SIZE, remaining)
    for (let i = 0; i < batchSize; i++) {
      created.push(makeMockCard(documentId, mockCards.length + created.length + 1))
    }
    remaining -= batchSize
  }

  mockCards.push(...created)
  return jsonResponse(200, {
    status: "COMPLETED",
    requestedCount,
    createdCount: created.length,
    flashcards: created.map(toApiShape),
  })
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
