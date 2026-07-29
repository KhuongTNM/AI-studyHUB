/**
 * Mock cho GET /api/subscriptions/me (SUB-202) — dùng khi MOCK_API = true
 * (mock-config.ts).
 *
 * Kho dữ liệu giả lập trong subscription-plans.mock.ts không lưu vết
 * User↔Gói theo phiên đăng nhập (không có bảng "payment.subscriptions" giả
 * lập), nên mock này KHÔNG thể trả đúng snapshot thật của từng User. Luôn trả
 * về gói Free hiện hành làm fallback an toàn — đúng tinh thần "luôn có phản
 * hồi hợp lệ, không có nhánh 404" của endpoint thật, đủ để FE dựng UI mà
 * không cần chờ Backend.
 *
 * Khi đổi MOCK_API = false, file này không còn được gọi tới nữa.
 */

import { mockGetFreePlan } from "@/services/mock/subscription-plans.mock"
import type { MySubscription } from "@/services/api/subscriptions"

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function mockFetchMySubscriptionRequest(): Promise<Response> {
  await delay(150)
  const freePlan = mockGetFreePlan()
  const now = new Date()
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  const body: MySubscription = {
    planId: freePlan.id,
    planName: freePlan.name,
    status: "ACTIVE",
    startDate: now.toISOString(),
    endDate: oneYearLater.toISOString(),
    pricePaid: 0,
    dailyAiChatLimit: freePlan.dailyAiChatLimit,
    maxFlashcards: freePlan.maxFlashcards,
    createGroupLimit: freePlan.createGroupLimit,
    joinGroupLimit: freePlan.joinGroupLimit,
    maxRoomMembers: freePlan.maxRoomMembers,
    storageBytes: freePlan.defaultStorageBytes,
  }
  return jsonResponse(200, body)
}
