/**
 * Mock cho luồng Chat AI + Hạn mức theo gói (CHAT-101, CHAT-102) — dùng khi
 * MOCK_API = true (mock-config.ts, dùng CHUNG với các mock khác trong dự án).
 *
 * Cùng nguyên tắc như các file mock khác: trả về đúng Response (status, body
 * JSON hoặc stream) như Backend thật sẽ trả theo Chat_AI_Quota_API_Contract.docx
 * (v2.0) — để code xử lý ở services/api/chat.ts chạy y hệt lúc dùng backend thật.
 *
 * Danh tính "User hiện tại" được lấy lại đúng qua mockFetchCurrentUserRequest()
 * (auth.mock.ts) theo accessToken đang lưu ở localStorage — nhờ vậy quota mock
 * ra đúng theo gói/role của tài khoản mock đang đăng nhập (Free/Pro/VIP/
 * Admin/Sub-Admin), khớp với dữ liệu gói ở subscription-plans.mock.ts.
 *
 * LƯU Ý: số lượt "đã dùng" chỉ tính trong bộ nhớ phiên làm việc hiện tại (mất
 * khi reload trang) — đủ để FE tự test luồng chặn hạn mức (CHAT-101/103) và
 * chỉ số "Đã dùng X/Y" (CHAT-102), không phải nơi lưu trữ thật.
 */

import { getAccessToken } from "@/lib/auth-storage"
import { mockFetchCurrentUserRequest } from "./auth.mock"
import { mockFindPlanById, mockGetFreePlan } from "./subscription-plans.mock"

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

interface MockIdentity {
  email: string
  role: string
  subscriptionPlanId: number | null
}

async function resolveMockIdentity(): Promise<MockIdentity | null> {
  const token = getAccessToken()
  const response = await mockFetchCurrentUserRequest(token)
  if (!response.ok) return null
  const user = await response.json()
  return {
    email: user.email,
    role: user.role,
    subscriptionPlanId: user.subscriptionPlanId ?? null,
  }
}

// CHAT-SEC-01/0.1: Admin & Sub-Admin luôn miễn trừ hoàn toàn khỏi hạn mức.
function dailyLimitFor(identity: MockIdentity): number {
  if (identity.role === "admin" || identity.role === "sub-admin") return -1
  const plan = mockFindPlanById(identity.subscriptionPlanId ?? undefined) ?? mockGetFreePlan()
  return plan.dailyAiChatLimit
}

// ─── Bộ đếm "đã dùng hôm nay" theo email, reset khi qua ngày (server time) ──

const usageByEmail = new Map<string, { count: number; dateKey: string }>()

function todayKey(): string {
  return new Date().toDateString()
}

function getUsedCount(email: string): number {
  const entry = usageByEmail.get(email)
  if (!entry || entry.dateKey !== todayKey()) return 0
  return entry.count
}

function incrementUsedCount(email: string): void {
  const key = todayKey()
  const entry = usageByEmail.get(email)
  if (!entry || entry.dateKey !== key) {
    usageByEmail.set(email, { count: 1, dateKey: key })
    return
  }
  entry.count += 1
}

// ─── 1. CHAT-102 — GET /api/v1/chat/quota ──────────────────────────────────

export async function mockGetChatQuotaRequest(): Promise<Response> {
  await delay(150)
  const identity = await resolveMockIdentity()
  if (!identity) return jsonResponse(401, { message: "Phiên đăng nhập đã hết hạn." })

  const limit = dailyLimitFor(identity)
  const used = getUsedCount(identity.email)

  if (limit === -1) {
    return jsonResponse(200, { limit: -1, used, remaining: null, unlimited: true })
  }
  return jsonResponse(200, { limit, used, remaining: Math.max(0, limit - used), unlimited: false })
}

// ─── 2. CHAT-101/CHAT-SEC-01 — POST /api/v1/vector/search (giả lập stream) ──

interface MockAskParams {
  query: string
  documentId?: string | null
  topK?: number
}

export async function mockAskRagSearchRequest(params: MockAskParams): Promise<Response> {
  await delay(250)
  const identity = await resolveMockIdentity()
  if (!identity) return jsonResponse(401, { message: "Phiên đăng nhập đã hết hạn." })

  const limit = dailyLimitFor(identity)
  const used = getUsedCount(identity.email)

  // CHAT-101: chặn TRƯỚC khi "sinh câu trả lời" nếu đã đạt/vượt hạn mức —
  // message giữ ĐÚNG nguyên văn để khớp regex isQuotaError ở chat-interface.tsx.
  if (limit !== -1 && used >= limit) {
    return jsonResponse(400, {
      message: `Bạn đã dùng hết lượt Chat AI trong ngày (${limit} lượt). Vui lòng nâng cấp gói dịch vụ.`,
    })
  }

  incrementUsedCount(identity.email)

  const answer = buildMockAnswer(params.query, params.documentId)
  const sources = params.documentId
    ? [
        {
          content: "Đoạn trích dẫn minh hoạ (MOCK_API) được lấy từ tài liệu bạn đang chọn để trả lời câu hỏi trên.",
          documentId: params.documentId,
          documentName: "Tài liệu đang chọn",
          score: 0.87,
        },
      ]
    : []

  const fullPayload = `${answer}\n\n[SOURCES]\n${JSON.stringify({ sources })}\n\n`
  return new Response(buildTokenStream(fullPayload), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  })
}

function buildMockAnswer(query: string, documentId?: string | null): string {
  const trimmed = query.trim()
  const scope = documentId ? "trong tài liệu bạn đang chọn" : "trong toàn bộ tài liệu của bạn"
  return (
    `Đây là câu trả lời demo (MOCK_API) cho câu hỏi: "${trimmed}". ` +
    `Hệ thống mock đang giả lập luồng RAG ${scope} — khi Backend triển khai xong ` +
    `CHAT-101/CHAT-SEC-01, câu trả lời thật từ AI Service sẽ thay thế đoạn này.`
  )
}

/** Giả lập stream token-by-token giống hệt định dạng thật (đọc từng đoạn nhỏ, có độ trễ nhỏ). */
function buildTokenStream(fullText: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const CHUNK_SIZE = 6
  let position = 0

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (position >= fullText.length) {
        controller.close()
        return
      }
      await delay(20)
      const chunk = fullText.slice(position, position + CHUNK_SIZE)
      position += CHUNK_SIZE
      controller.enqueue(encoder.encode(chunk))
    },
  })
}
