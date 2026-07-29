/**
 * Token lỗi + thông điệp hiển thị dùng CHUNG cho cơ chế Batching sinh Flashcard AI
 * (BR-099 → BR-105, xem Flashcard_AI_Batching_API_Contract.md — Mục 2, 4.1, 6).
 *
 * Theo đúng contract: CÙNG một bộ token này xuất hiện ở 2 chỗ:
 *  - field `message` của lỗi cứng (400/422/429/503) khi createdCount = 0
 *  - field `failureReason` của response 200 khi status = "PARTIAL_SUCCESS"
 * Nên FE dùng 1 hàm mapErrorMessage(token) duy nhất cho cả 2 trường hợp (Mục 6 — việc FE).
 *
 * SỬA (Flashcard_AI_Daily_Quota_API_Contract.docx v2.0, BR-110 → BR-112): thêm token
 * FLASHCARD_DAILY_LIMIT_EXCEEDED — THAY THẾ hoàn toàn nhánh lỗi "vượt quota tổng" cũ
 * (đã bị bãi bỏ, Gap 2). Token này chỉ xuất hiện ở nhánh lỗi cứng (400), KHÔNG xuất
 * hiện ở failureReason của PARTIAL_SUCCESS (BE chặn TRƯỚC khi gọi AI, nên không có
 * batch nào chạy để "thành công một phần").
 *
 * LƯU Ý: các lỗi ĐÃ CÓ khác (document not found, chưa sở hữu, chưa embedding xong,
 * lỗi hệ thống 500...) KHÔNG nằm trong bộ token này — đó vẫn là ApiException/lỗi phẳng
 * với message tiếng Việt tự do, hiển thị thẳng như hành vi cũ (Mục 6/Mục 4 API Contract
 * — "KHÔNG switch/case theo nội dung message này", Gap 7 để sau).
 */

export type FlashcardGenerateErrorToken =
  | "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED"
  | "FLASHCARD_DAILY_LIMIT_EXCEEDED"
  | "AI_GENERATION_TIMEOUT"
  | "AI_RATE_LIMIT_EXCEEDED"
  | "AI_CONTENT_SAFETY_BLOCKED"

const KNOWN_TOKENS: readonly FlashcardGenerateErrorToken[] = [
  "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED",
  "FLASHCARD_DAILY_LIMIT_EXCEEDED",
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
  /** MỚI (BR-110, Mục 5.3) — chỉ có khi token = FLASHCARD_DAILY_LIMIT_EXCEEDED. */
  dailyLimit?: number
  /** MỚI (BR-110, Mục 5.3) — số thẻ AI đã sinh trong ngày hôm nay tại thời điểm bị chặn. */
  usedToday?: number
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
  /** MỚI (BR-110) — chỉ có giá trị khi token = FLASHCARD_DAILY_LIMIT_EXCEEDED. */
  readonly dailyLimit?: number
  readonly usedToday?: number

  constructor(body: GenerateFlashcardsErrorBody) {
    super(body.message)
    this.name = "GenerateFlashcardsError"
    this.token = isFlashcardGenerateErrorToken(body.message) ? body.message : null
    this.perClickLimit = body.perClickLimit
    this.requestedCount = body.requestedCount
    this.createdCount = body.createdCount
    this.dailyLimit = body.dailyLimit
    this.usedToday = body.usedToday
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
  extra?: { perClickLimit?: number; requestedCount?: number; dailyLimit?: number; usedToday?: number },
): string {
  const perClickLimit = extra?.perClickLimit
  const requestedCount = extra?.requestedCount
  const dailyLimit = extra?.dailyLimit

  if (language === "vi") {
    switch (token) {
      case "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED":
        return perClickLimit !== undefined && requestedCount !== undefined
          ? `Mỗi lượt chỉ được tạo tối đa ${perClickLimit} thẻ (bạn đang yêu cầu ${requestedCount}). Vui lòng giảm số lượng hoặc chia thành nhiều lượt.`
          : "Bạn đã vượt quá số thẻ tối đa cho phép mỗi lượt tạo. Vui lòng giảm số lượng."
      case "FLASHCARD_DAILY_LIMIT_EXCEEDED":
        // BR-110 Mục 3: nêu rõ đã dùng hết N lượt hôm nay, hạn mức reset lúc 00:00 giờ VN
        // hôm sau, đồng thời nhắc user vẫn tạo được thẻ bằng cách nhập tay không giới hạn.
        return dailyLimit !== undefined
          ? `Bạn đã dùng hết ${dailyLimit} lượt tạo Flashcard bằng AI hôm nay. Hạn mức sẽ được cấp lại vào 00:00 giờ Việt Nam ngày mai. Bạn vẫn có thể tạo Flashcard bằng cách nhập tay, không giới hạn số lượng.`
          : "Bạn đã dùng hết lượt tạo Flashcard bằng AI hôm nay. Hạn mức sẽ được cấp lại vào ngày mai. Bạn vẫn có thể tạo Flashcard bằng cách nhập tay, không giới hạn số lượng."
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
    case "FLASHCARD_DAILY_LIMIT_EXCEEDED":
      return dailyLimit !== undefined
        ? `You've used all ${dailyLimit} AI flashcard generations for today. Your limit resets at midnight Vietnam time. You can still add flashcards manually with no limit.`
        : "You've used up today's AI flashcard generation limit. It resets tomorrow. You can still add flashcards manually with no limit."
    case "AI_GENERATION_TIMEOUT":
    case "AI_RATE_LIMIT_EXCEEDED":
      return "The AI system is busy right now. Please try again later."
    case "AI_CONTENT_SAFETY_BLOCKED":
      return "This document contains content that isn't suitable for automatic flashcard generation. Please try another document."
  }
}
