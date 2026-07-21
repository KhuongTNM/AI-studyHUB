/**
 * Token lỗi + thông điệp hiển thị dùng CHUNG cho cơ chế Batching sinh Flashcard AI
 * (BR-099 → BR-105, xem Flashcard_AI_Batching_API_Contract.md — Mục 2, 4.1, 6).
 *
 * Theo đúng contract: CÙNG một bộ 4 token này xuất hiện ở 2 chỗ:
 *  - field `message` của lỗi cứng (400/422/429/503) khi createdCount = 0
 *  - field `failureReason` của response 200 khi status = "PARTIAL_SUCCESS"
 * Nên FE dùng 1 hàm mapErrorMessage(token) duy nhất cho cả 2 trường hợp (Mục 6 — việc FE).
 *
 * LƯU Ý: lỗi quota tổng (vượt maxFlashcards) và các lỗi ĐÃ CÓ khác (document not found,
 * chưa sở hữu, chưa embedding xong, lỗi hệ thống 500...) KHÔNG nằm trong bộ token này —
 * đó vẫn là ApiException với message tiếng Việt tự do, hiển thị thẳng như hành vi cũ
 * (Mục 6 — "KHÔNG switch/case theo nội dung message này").
 */

export type FlashcardGenerateErrorToken =
  | "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED"
  | "AI_GENERATION_TIMEOUT"
  | "AI_RATE_LIMIT_EXCEEDED"
  | "AI_CONTENT_SAFETY_BLOCKED"

const KNOWN_TOKENS: readonly FlashcardGenerateErrorToken[] = [
  "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED",
  "AI_GENERATION_TIMEOUT",
  "AI_RATE_LIMIT_EXCEEDED",
  "AI_CONTENT_SAFETY_BLOCKED",
]

export function isFlashcardGenerateErrorToken(value: string): value is FlashcardGenerateErrorToken {
  return (KNOWN_TOKENS as readonly string[]).includes(value)
}

/**
 * Thân JSON thô mà BE trả về cho lỗi cứng của POST /api/flashcards/generate
 * (Mục 2 của API Contract) — có thể kèm thêm field phẳng tuỳ token.
 */
export interface GenerateFlashcardsErrorBody {
  message: string
  perClickLimit?: number
  requestedCount?: number
  createdCount?: number
}

/**
 * Lỗi có cấu trúc, ném ra bởi generateFlashcardsApi khi response không ok.
 * - token !== null  → 1 trong 4 lỗi MỚI của cơ chế Batching, dùng mapErrorMessage() để hiển thị.
 * - token === null  → lỗi ĐÃ CÓ (quota tổng, document not found, chưa embedding xong, 500...),
 *   hiển thị thẳng `message` như hành vi hiện tại, KHÔNG map qua token.
 */
export class GenerateFlashcardsError extends Error {
  readonly token: FlashcardGenerateErrorToken | null
  readonly perClickLimit?: number
  readonly requestedCount?: number
  readonly createdCount?: number

  constructor(body: GenerateFlashcardsErrorBody) {
    super(body.message)
    this.name = "GenerateFlashcardsError"
    this.token = isFlashcardGenerateErrorToken(body.message) ? body.message : null
    this.perClickLimit = body.perClickLimit
    this.requestedCount = body.requestedCount
    this.createdCount = body.createdCount
  }
}

/**
 * Map 1 token lỗi (từ message của lỗi cứng, HOẶC từ failureReason của PARTIAL_SUCCESS)
 * sang thông điệp hiển thị cho người dùng, theo đúng tinh thần "Ảnh hưởng tới người dùng"
 * mô tả ở BR-104 (Business Logic doc):
 *  - timeout / rate-limit → "hệ thống AI đang quá tải, thử lại sau"
 *  - safety filter        → "tài liệu nguồn không phù hợp", KHÔNG gợi ý thử lại
 *  - per-click cap        → nêu rõ số liệu perClickLimit/requestedCount (không hardcode số)
 */
export function mapErrorMessage(
  token: FlashcardGenerateErrorToken,
  language: "vi" | "en",
  extra?: { perClickLimit?: number; requestedCount?: number },
): string {
  const perClickLimit = extra?.perClickLimit
  const requestedCount = extra?.requestedCount

  if (language === "vi") {
    switch (token) {
      case "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED":
        return perClickLimit !== undefined && requestedCount !== undefined
          ? `Mỗi lượt chỉ được tạo tối đa ${perClickLimit} thẻ (bạn đang yêu cầu ${requestedCount}). Vui lòng giảm số lượng hoặc chia thành nhiều lượt.`
          : "Bạn đã vượt quá số thẻ tối đa cho phép mỗi lượt tạo. Vui lòng giảm số lượng."
      case "AI_GENERATION_TIMEOUT":
      case "AI_RATE_LIMIT_EXCEEDED":
        return "Hệ thống AI đang quá tải, vui lòng thử lại sau."
      case "AI_CONTENT_SAFETY_BLOCKED":
        return "Tài liệu chứa nội dung không phù hợp để tạo flashcard tự động. Vui lòng thử tài liệu khác."
    }
  }

  switch (token) {
    case "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED":
      return perClickLimit !== undefined && requestedCount !== undefined
        ? `You can generate at most ${perClickLimit} cards per click (you requested ${requestedCount}). Please lower the count or split it into multiple requests.`
        : "You've exceeded the maximum number of cards allowed per click. Please lower the count."
    case "AI_GENERATION_TIMEOUT":
    case "AI_RATE_LIMIT_EXCEEDED":
      return "The AI system is busy right now. Please try again later."
    case "AI_CONTENT_SAFETY_BLOCKED":
      return "This document contains content that isn't suitable for automatic flashcard generation. Please try another document."
  }
}
