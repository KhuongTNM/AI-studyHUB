import { getAccessToken } from "@/lib/auth-storage"
import type { Flashcard, FlashcardStatus } from "@/states/types"
import { MOCK_API } from "@/services/mock/mock-config"
import {
  GenerateFlashcardsError,
  type FlashcardGenerateErrorToken,
} from "@/services/api/flashcard-generate-errors"
import {
  mockFetchFlashcardQuotaRequest,
  mockFetchFlashcardDailyQuotaRequest,
  mockGenerateFlashcardsRequest,
  mockFetchFlashcardsRequest,
  mockFetchAllFlashcardsRequest,
  mockCreateFlashcardRequest,
  mockUpdateFlashcardStatusRequest,
  mockUpdateFlashcardRequest,
  mockDeleteFlashcardRequest,
  mockDeleteAllFlashcardsForDocumentRequest,
} from "@/services/mock/flashcards.mock"

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

/**
 * Giống parseError nhưng trả về NGUYÊN VẸN JSON body (không chỉ message) —
 * dùng cho POST /api/flashcards/generate vì các lỗi MỚI (per-click cap,
 * timeout, rate-limit, safety) kèm thêm field phẳng (perClickLimit,
 * requestedCount, createdCount) cần đọc lại để hiển thị đúng số liệu (Mục 2).
 */
async function parseErrorBody(response: Response): Promise<{
  message: string
  perClickLimit?: number
  requestedCount?: number
  createdCount?: number
  dailyLimit?: number
  usedToday?: number
}> {
  try {
    const body = (await response.json()) as {
      message?: string
      perClickLimit?: number
      requestedCount?: number
      createdCount?: number
      // MỚI (BR-110, Mục 5.3) — kèm theo lỗi FLASHCARD_DAILY_LIMIT_EXCEEDED.
      dailyLimit?: number
      usedToday?: number
    }
    return {
      message: body.message ?? "Đã xảy ra lỗi. Vui lòng thử lại.",
      perClickLimit: body.perClickLimit,
      requestedCount: body.requestedCount,
      createdCount: body.createdCount,
      dailyLimit: body.dailyLimit,
      usedToday: body.usedToday,
    }
  } catch {
    return { message: "Đã xảy ra lỗi. Vui lòng thử lại." }
  }
}

function authHeaders(): HeadersInit {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function tierToPlanName(tier: string): string {
  if (tier === "2-4") return "plan_2_4"
  if (tier === "5+") return "plan_5_plus"
  return "free"
}

/**
 * Giới hạn flashcard của gói dịch vụ hiện tại của user:
 *  - maxFlashcards: trần TỔNG số thẻ tồn tại (lifetime cap, ĐÃ CÓ trong schema).
 *    SỬA (Flashcard_AI_Daily_Quota_API_Contract.docx v2.0, Gap 2/Gap 5): field này
 *    KHÔNG còn được dùng để tính/chặn việc sinh Flashcard bằng AI nữa — quota tổng
 *    đã bị bãi bỏ hoàn toàn, thay bằng hạn mức NGÀY (xem FlashcardDailyQuota +
 *    fetchFlashcardDailyQuotaApi bên dưới). Field vẫn được giữ lại ở đây chỉ vì API
 *    /api/subscription-plans/{planName} vẫn trả về nó (DEPRECATED cho mục đích chặn AI).
 *  - perClickLimit: trần số thẻ MỖI LƯỢT BẤM "Tạo Flashcard tự động" (BR-099, ĐÃ CÓ —
 *    độc lập với hạn mức ngày). LUÔN là một số hữu hạn (kể cả khi maxFlashcards = -1),
 *    vì BR-099 yêu cầu "kể cả gói không giới hạn tổng cũng phải có 1 trần per-click hợp lý".
 *    Đây là lý do DUY NHẤT hàm fetchFlashcardQuotaApi bên dưới còn được gọi.
 */
export interface FlashcardLimits {
  maxFlashcards: number
  perClickLimit: number
}

/**
 * Lấy giới hạn flashcard (maxFlashcards + perClickLimit) của gói dịch vụ hiện tại của user,
 * gọi trực tiếp endpoint public GET /api/subscription-plans/{planName}.
 * Hàm này thuộc phạm vi tính năng flashcard, không đụng vào code/state của tính năng subscription.
 *
 * SỬA (Gap 5, API Contract Mục 0.2): kể từ khi có fetchFlashcardDailyQuotaApi(), hàm này
 * CHỈ còn dùng để lấy perClickLimit — KHÔNG dùng field maxFlashcards trả về ở đây để tính
 * "còn lại" nữa (đã chuyển hẳn sang field `remaining` của GET /api/flashcards/quota).
 *
 * LƯU Ý (Gap #6, API Contract batching cũ): field perClickLimit trên SubscriptionPlan hiện CHƯA
 * tồn tại ở BE tại thời điểm viết FE này — hàm này giả định BE sẽ trả field đó cùng
 * response hiện có. Nếu field vắng mặt (BE chưa deploy), fallback về FALLBACK_PER_CLICK_LIMIT
 * để không chặn UI.
 */
const FALLBACK_PER_CLICK_LIMIT = 5

export async function fetchFlashcardQuotaApi(
  subscriptionTier: string,
  subscriptionPlanId?: number | null,
): Promise<FlashcardLimits> {
  const planName = tierToPlanName(subscriptionTier)
  if (MOCK_API) {
    // FIXED: trước đây chỉ truyền subscriptionTier — mock quota luôn đoán theo
    // tier hardcode nên gói custom (id >= 4) bị tính như free. Giờ truyền thêm
    // subscriptionPlanId để mock tra đúng gói thật (xem flashcards.mock.ts).
    const response = await mockFetchFlashcardQuotaRequest(subscriptionTier, subscriptionPlanId)
    if (!response.ok) throw new Error(await parseError(response))
    const plan = (await response.json()) as { maxFlashcards: number; perClickLimit?: number }
    return { maxFlashcards: plan.maxFlashcards, perClickLimit: plan.perClickLimit ?? FALLBACK_PER_CLICK_LIMIT }
  }

  // Custom plans cannot be mapped from the legacy tier union. Resolve the
  // persisted plan id from the public list first, then fall back to the
  // built-in slug for older sessions that do not have an id.
  if (subscriptionPlanId !== null && subscriptionPlanId !== undefined) {
    const listResponse = await fetch(`${API_BASE_URL}/api/subscription-plans`)
    if (!listResponse.ok) throw new Error(await parseError(listResponse))
    const plans = (await listResponse.json()) as Array<{ id: number; maxFlashcards: number; perClickLimit?: number }>
    const currentPlan = plans.find(plan => Number(plan.id) === Number(subscriptionPlanId))
    if (currentPlan) {
      return { maxFlashcards: currentPlan.maxFlashcards, perClickLimit: currentPlan.perClickLimit ?? FALLBACK_PER_CLICK_LIMIT }
    }
  }

  const response = await fetch(`${API_BASE_URL}/api/subscription-plans/${planName}`)
  if (!response.ok) throw new Error(await parseError(response))
  const plan = (await response.json()) as { maxFlashcards: number; perClickLimit?: number }
  return { maxFlashcards: plan.maxFlashcards, perClickLimit: plan.perClickLimit ?? FALLBACK_PER_CLICK_LIMIT }
}

/**
 * GET /api/flashcards/quota — MỚI (BR-112, API Contract Mục 2 & 5.1).
 * Nguồn dữ liệu DUY NHẤT để hiển thị hạn mức tạo Flashcard AI CÒN LẠI trong ngày —
 * FE KHÔNG được tự tính lại bằng bất kỳ công thức nào dựa trên danh sách flashcard
 * hiện có (Gap 5, đã chốt chính thức). Gọi lại hàm này ngay khi vào màn hình
 * Flashcard và sau MỖI lượt tạo bằng AI (thành công hoặc bị chặn) — xem
 * useFlashcardState/flashcard-page.tsx.
 */
export interface FlashcardDailyQuota {
  /** Hạn mức tạo Flashcard AI/ngày theo gói hiện tại. -1 = không giới hạn. */
  limit: number
  /** Số LƯỢT (thẻ) AI đã sinh trong ngày hôm nay — increment-only, KHÔNG giảm khi xoá thẻ (Gap 3). */
  used: number
  /** limit - used. null khi unlimited = true. */
  remaining: number | null
  /** true nếu limit = -1 hoặc User là Admin/Sub-Admin. */
  unlimited: boolean
}

export async function fetchFlashcardDailyQuotaApi(): Promise<FlashcardDailyQuota> {
  const response = MOCK_API
    ? await mockFetchFlashcardDailyQuotaRequest()
    : await fetch(`${API_BASE_URL}/api/flashcards/quota`, {
        headers: authHeaders(),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
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
 * POST /api/flashcards/generate — AI tạo flashcard từ nội dung tài liệu thật (BR-036),
 * theo cơ chế Batching (BR-099 → BR-105, xem API Contract Mục 1 & 4.1).
 *
 * BREAKING CHANGE so với trước: response thành công không còn là mảng phẳng
 * List<FlashcardResponse> mà là object { status, requestedCount, createdCount,
 * failureReason?, flashcards }. Request (URL/method/body) giữ nguyên 100%.
 *
 * Backend gọi sang AI service theo NHIỀU batch tuần tự (5 thẻ/batch) nên tổng
 * thời gian có thể lâu hơn nhiều so với 1 request đơn — timeout ở đây được nới
 * theo số batch dự kiến (ceil(count/5) * BATCH_TIMEOUT_MS), thay vì 1 mốc cố định.
 */
const BATCH_TIMEOUT_MS = 30_000
const DEFAULT_GENERATE_COUNT = 5
const BATCH_SIZE = 5

interface ApiGenerateFlashcardsResponse {
  status: "COMPLETED" | "PARTIAL_SUCCESS"
  requestedCount: number
  createdCount: number
  failureReason?: string | null
  flashcards: ApiFlashcard[]
}

export interface GenerateFlashcardsResult {
  status: "COMPLETED" | "PARTIAL_SUCCESS"
  requestedCount: number
  createdCount: number
  /** Chỉ có giá trị khi status = PARTIAL_SUCCESS — dùng với mapErrorMessage() để hiển thị lý do dừng. */
  failureReason: FlashcardGenerateErrorToken | null
  flashcards: Flashcard[]
}

export async function generateFlashcardsApi(documentId: string, count?: number): Promise<GenerateFlashcardsResult> {
  const requestedCount = count ?? DEFAULT_GENERATE_COUNT
  const expectedBatches = Math.max(1, Math.ceil(requestedCount / BATCH_SIZE))
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), BATCH_TIMEOUT_MS * expectedBatches)

  try {
    const response = MOCK_API
      ? await mockGenerateFlashcardsRequest(documentId, count)
      : await fetch(`${API_BASE_URL}/api/flashcards/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(count ? { documentId, count } : { documentId }),
          signal: controller.signal,
        })
    if (!response.ok) throw new GenerateFlashcardsError(await parseErrorBody(response))
    const data = (await response.json()) as ApiGenerateFlashcardsResponse
    return {
      status: data.status,
      requestedCount: data.requestedCount,
      createdCount: data.createdCount,
      failureReason: (data.failureReason as FlashcardGenerateErrorToken | undefined) ?? null,
      flashcards: data.flashcards.map(mapApiFlashcard),
    }
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
  const response = MOCK_API
    ? await mockFetchFlashcardsRequest(documentId)
    : await fetch(
        `${API_BASE_URL}/api/flashcards?documentId=${encodeURIComponent(documentId)}`,
        { headers: authHeaders() },
      )
  if (!response.ok) throw new Error(await parseError(response))
  const cards = (await response.json()) as ApiFlashcard[]
  return cards.map(mapApiFlashcard)
}

/**
 * GET /api/flashcards — lấy TOÀN BỘ flashcard của user hiện tại (không giới hạn theo document).
 * Dùng để nạp lại dữ liệu khi mở app / F5 trang khi đang ở chế độ "Tất cả tài liệu".
 *
 * LƯU Ý: endpoint này hiện backend CHƯA hỗ trợ (GET /api/flashcards đang bắt buộc
 * query param `documentId`). Đã giao task cho backend bổ sung — xem
 * TASK_BACKEND_FLASHCARDS.md. Cho tới khi backend làm xong, hàm này sẽ trả lỗi và
 * được nuốt (catch) ở phía gọi, không làm crash UI.
 */
export async function fetchAllFlashcardsApi(): Promise<Flashcard[]> {
  const response = MOCK_API
    ? await mockFetchAllFlashcardsRequest()
    : await fetch(`${API_BASE_URL}/api/flashcards`, {
        headers: authHeaders(),
      })
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
  const response = MOCK_API
    ? await mockUpdateFlashcardStatusRequest(id, status)
    : await fetch(`${API_BASE_URL}/api/flashcards/${id}/status`, {
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
  const response = MOCK_API
    ? await mockCreateFlashcardRequest(payload)
    : await fetch(`${API_BASE_URL}/api/flashcards`, {
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
  const response = MOCK_API
    ? await mockDeleteFlashcardRequest(id)
    : await fetch(`${API_BASE_URL}/api/flashcards/${id}`, {
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
  const response = MOCK_API
    ? await mockUpdateFlashcardRequest(id, payload)
    : await fetch(`${API_BASE_URL}/api/flashcards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      })
  if (!response.ok) throw new Error(await parseError(response))
  return mapApiFlashcard((await response.json()) as ApiFlashcard)
}

/**
 * DELETE /api/flashcards?documentId={id} — Xoá TOÀN BỘ flashcard của một tài liệu.
 * Dùng khi user bấm nút "Làm mới" với 1 tài liệu cụ thể đang được chọn.
 */
export async function deleteAllFlashcardsForDocumentApi(documentId: string): Promise<void> {
  const response = MOCK_API
    ? await mockDeleteAllFlashcardsForDocumentRequest(documentId)
    : await fetch(
        `${API_BASE_URL}/api/flashcards?documentId=${encodeURIComponent(documentId)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        },
      )
  if (!response.ok) throw new Error(await parseError(response))
}
