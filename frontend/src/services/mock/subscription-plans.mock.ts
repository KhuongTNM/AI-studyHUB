/**
 * Mock cho API Gói dịch vụ (Subscription Plan) — dùng khi MOCK_API = true (mock-config.ts).
 *
 * Theo AI-studyHUB_API_File_SubscriptionPlan.docx +
 * AI-studyHUB_Business_Logic_File_SubscriptionPlan.docx:
 *
 * - BR-201: KHÔNG có field displayName ở bất kỳ đâu — object trả về chỉ có "name".
 * - BR-202: gói "free" không bao giờ được xoá, kể cả khi 0 người dùng đang active.
 * - BR-203: gói "free" được sửa mọi thuộc tính giới hạn (limits) bình thường,
 *   NHƯNG price và name của gói free là bất biến — mock từ chối đúng như spec
 *   để FE test được toàn bộ luồng khoá UI + xử lý lỗi 400 mà không cần chờ
 *   Backend deploy.
 *
 * Khi đổi MOCK_API = false, toàn bộ file này không còn được gọi tới nữa.
 */

import type {
  ApiSubscriptionPlan,
  CreateSubscriptionPlanInput,
  UpdateSubscriptionPlanInput,
} from "@/services/api/subscription-plans"

// ─── Kho dữ liệu giả lập trong phiên làm việc (mất khi reload trang) ────────

interface MockPlan {
  id: number
  name: string
  price: number
  maxRoomMembers: number
  defaultStorageBytes: number
  createGroupLimit: number
  joinGroupLimit: number
  dailyAiChatLimit: number
  maxFlashcards: number
  isDeleted: boolean
}

const FREE_PLAN_NAME = "free"

let mockSeq = 3
const mockPlans: MockPlan[] = [
  {
    id: 1,
    name: "free",
    price: 0,
    maxRoomMembers: 4,
    defaultStorageBytes: 512 * 1024 * 1024,
    createGroupLimit: 0,
    joinGroupLimit: 5,
    dailyAiChatLimit: 5,
    maxFlashcards: 5,
    isDeleted: false,
  },
  {
    id: 2,
    name: "Gói Pro",
    price: 49000,
    maxRoomMembers: 4,
    defaultStorageBytes: 2 * 1024 * 1024 * 1024,
    createGroupLimit: 20,
    joinGroupLimit: 30,
    dailyAiChatLimit: 50,
    maxFlashcards: 50,
    isDeleted: false,
  },
  {
    id: 3,
    name: "Gói VIP",
    price: 99000,
    maxRoomMembers: 10,
    defaultStorageBytes: 5 * 1024 * 1024 * 1024,
    createGroupLimit: -1,
    joinGroupLimit: -1,
    dailyAiChatLimit: -1,
    maxFlashcards: -1,
    isDeleted: false,
  },
]

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function findPlan(planName: string): MockPlan | undefined {
  const target = planName.trim().toLowerCase()
  return mockPlans.find(p => !p.isDeleted && p.name.toLowerCase() === target)
}

/**
 * FIXED: dùng chung cho các mock khác (vd flashcards.mock.ts) cần tra giới hạn
 * thật của một gói theo subscriptionPlanId — thay vì đoán qua tier hardcode
 * ("2-4"/"5+"), vốn luôn sai với gói custom admin tạo thêm (id >= 4).
 * Trả về undefined nếu không tìm thấy (id null/không tồn tại/đã xoá) — nơi gọi
 * tự quyết định fallback (thường là gói free).
 */
export function mockFindPlanById(id?: number | null): ApiSubscriptionPlan | undefined {
  if (id === null || id === undefined) return undefined
  const plan = mockPlans.find(p => !p.isDeleted && p.id === Number(id))
  return plan ? toApiShape(plan) : undefined
}

/** Gói free hiện tại — dùng làm fallback an toàn khi không tra được plan theo id. */
export function mockGetFreePlan(): ApiSubscriptionPlan {
  return toApiShape(mockPlans.find(p => p.name.toLowerCase() === FREE_PLAN_NAME) ?? mockPlans[0])
}

/** So sánh không phân biệt hoa/thường, giống findByNameIgnoreCase phía backend. */
function isFreePlanName(name: string): boolean {
  return name.trim().toLowerCase() === FREE_PLAN_NAME
}

/** Object trả về cho FE — KHÔNG có displayName, KHÔNG có isDeleted (nội bộ mock). */
function toApiShape(plan: MockPlan): ApiSubscriptionPlan {
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    maxRoomMembers: plan.maxRoomMembers,
    defaultStorageBytes: plan.defaultStorageBytes,
    createGroupLimit: plan.createGroupLimit,
    joinGroupLimit: plan.joinGroupLimit,
    dailyAiChatLimit: plan.dailyAiChatLimit,
    maxFlashcards: plan.maxFlashcards,
  }
}

// ─── 1. GET /api/subscription-plans (public, list) ──────────────────────────

export async function mockFetchSubscriptionPlansRequest(): Promise<Response> {
  await delay(150)
  return jsonResponse(200, mockPlans.filter(p => !p.isDeleted).map(toApiShape))
}

// ─── 2. GET /api/subscription-plans/{planName} (public, detail) ─────────────

export async function mockFetchSubscriptionPlanRequest(planName: string): Promise<Response> {
  await delay(120)
  const plan = findPlan(planName)
  if (!plan) return jsonResponse(404, { message: "Không tìm thấy gói dịch vụ." })
  return jsonResponse(200, toApiShape(plan))
}

// ─── 3. POST /api/admin/subscription-plans (create) ─────────────────────────

export async function mockCreateSubscriptionPlanRequest(
  input: CreateSubscriptionPlanInput,
): Promise<Response> {
  await delay(300)

  const name = input.name?.trim() ?? ""
  if (!name) return jsonResponse(400, { message: "Tên gói không được để trống." })
  if (!(input.price > 0)) return jsonResponse(400, { message: "Giá gói cước phải lớn hơn 0." })
  if (mockPlans.some(p => !p.isDeleted && p.name.toLowerCase() === name.toLowerCase())) {
    // BE thật (PlanAlreadyExistsException) trả 400, KHÔNG phải 409 như API spec gốc
    // ghi (xem mục 3, subscription-plan-be-notes-for-fe.md) — mock khớp theo BE thật.
    return jsonResponse(400, { message: "Tên gói dịch vụ đã tồn tại." })
  }

  mockSeq += 1
  const plan: MockPlan = {
    id: mockSeq,
    name,
    price: input.price,
    maxRoomMembers: input.maxRoomMembers,
    defaultStorageBytes: input.defaultStorageBytes,
    createGroupLimit: input.createGroupLimit,
    joinGroupLimit: input.joinGroupLimit,
    dailyAiChatLimit: input.dailyAiChatLimit ?? 5,
    maxFlashcards: input.maxFlashcards ?? 5,
    isDeleted: false,
  }
  mockPlans.push(plan)
  return jsonResponse(201, toApiShape(plan))
}

// ─── 4. PUT /api/admin/subscription-plans/{planName} (update) — BR-203 ──────

export async function mockUpdateSubscriptionPlanRequest(
  planName: string,
  input: UpdateSubscriptionPlanInput,
): Promise<Response> {
  await delay(300)

  const plan = findPlan(planName)
  if (!plan) return jsonResponse(404, { message: "Không tìm thấy gói dịch vụ." })

  const editingFreePlan = isFreePlanName(plan.name)
  const wantsNameChange = typeof input.name === "string" && input.name.trim().length > 0
    && input.name.trim().toLowerCase() !== plan.name.toLowerCase()
  const wantsPriceChange = typeof input.price === "number" && input.price !== plan.price

  // BR-203: gói free — khoá price và name, các field còn lại vẫn cho sửa.
  if (editingFreePlan) {
    if (wantsPriceChange) {
      return jsonResponse(400, { message: "Không thể thay đổi giá gói Miễn phí." })
    }
    if (wantsNameChange) {
      return jsonResponse(400, { message: "Không thể đổi tên gói Miễn phí." })
    }
  }

  if (wantsNameChange) {
    const newName = input.name!.trim()
    const duplicate = mockPlans.some(
      p => !p.isDeleted && p !== plan && p.name.toLowerCase() === newName.toLowerCase(),
    )
    if (duplicate) return jsonResponse(400, { message: "Tên gói dịch vụ đã tồn tại." })
    plan.name = newName
  }

  if (wantsPriceChange) {
    if (!(input.price! > 0)) return jsonResponse(400, { message: "Giá gói cước phải lớn hơn 0." })
    plan.price = input.price!
  }

  if (typeof input.createGroupLimit === "number") plan.createGroupLimit = input.createGroupLimit
  if (typeof input.joinGroupLimit === "number") plan.joinGroupLimit = input.joinGroupLimit
  if (typeof input.dailyAiChatLimit === "number") plan.dailyAiChatLimit = input.dailyAiChatLimit
  if (typeof input.maxFlashcards === "number") plan.maxFlashcards = input.maxFlashcards
  if (typeof input.defaultStorageBytes === "number" && input.defaultStorageBytes > 0) {
    plan.defaultStorageBytes = input.defaultStorageBytes
  }

  return jsonResponse(200, toApiShape(plan))
}

// ─── 5. PATCH /api/admin/subscription-plans/{planName}/price — BR-203 ───────

export async function mockUpdatePackagePriceRequest(
  planName: string,
  price: number,
): Promise<Response> {
  await delay(250)

  const plan = findPlan(planName)
  if (!plan) return jsonResponse(404, { message: "Không tìm thấy gói dịch vụ." })

  // BR-203: API sửa giá riêng luôn từ chối trên gói free, bất kể giá trị gửi lên.
  if (isFreePlanName(plan.name)) {
    return jsonResponse(400, { message: "Không thể thay đổi giá gói Miễn phí." })
  }
  if (!(price > 0)) return jsonResponse(400, { message: "Giá gói cước phải lớn hơn 0." })

  plan.price = price
  return jsonResponse(200, toApiShape(plan))
}

// ─── 5b. GET .../{planName}/active-user-count — SUB-201a ────────────────────
//
// Mock đơn giản: kho dữ liệu giả lập trong file này không lưu vết User↔Gói
// theo phiên (không có "payment.subscriptions" giả lập), nên không thể đếm
// số người đang dùng thật. Luôn trả về 0 ("Hiện không có ai đang sử dụng gói
// này") — đủ để FE test được luồng hiển thị Pop-up mà không cần chờ Backend,
// KHÔNG dùng để kiểm thử số liệu cảnh báo chính xác (việc đó cần backend thật).

export async function mockFetchActiveUserCountRequest(planName: string): Promise<Response> {
  await delay(150)
  // Không lọc isDeleted (GAP-T4) — cho phép tra cứu cả với gói đã xoá mềm.
  const target = planName.trim().toLowerCase()
  const plan = mockPlans.find(p => p.name.toLowerCase() === target)
  if (!plan) return jsonResponse(404, { message: "Không tìm thấy gói dịch vụ." })
  return jsonResponse(200, { activeUserCount: 0 })
}

// ─── 6. DELETE /api/admin/subscription-plans/{planName} — BR-202 ────────────

export async function mockDeleteSubscriptionPlanRequest(
  planName: string,
): Promise<Response> {
  await delay(250)

  const plan = findPlan(planName)
  if (!plan) return jsonResponse(404, { message: "Không tìm thấy gói dịch vụ." })

  // BR-202: gói free không bao giờ được xoá — chặn TRƯỚC bước check subscription ACTIVE.
  if (isFreePlanName(plan.name)) {
    return jsonResponse(400, { message: "Không thể xoá gói Miễn phí." })
  }

  plan.isDeleted = true
  return new Response(null, { status: 204 })
}
