"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { BookOpen, Copy, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useApp } from "@/lib/store"
import { fetchFlashcardQuotaApi, fetchFlashcardDailyQuotaApi, type FlashcardDailyQuota } from "@/services/api/flashcards"
import { mapErrorMessage } from "@/services/api/flashcard-generate-errors"
import { cn } from "@/lib/utils"
import type { EmbeddingStatus } from "@/states/types"

export function FlashcardPage() {
  const {
    documents,
    flashcards,
    addFlashcards,
    deleteFlashcard,
    updateFlashcard,
    generateFlashcardsFromDocument,
    updateFlashcardStatus,
    loadFlashcardsForDocument,
    loadAllFlashcards,
    deleteAllFlashcardsForDocument,
    flashcardSelectedDocumentId,
    setFlashcardSelectedDocumentId,
    language,
    currentUser,
  } = useApp()
  const [selectedDocId, setSelectedDocId] = useState<string>(flashcardSelectedDocumentId ?? "all")
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [flipped, setFlipped] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateCount, setGenerateCount] = useState<number>(5)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const text = language === "vi" ? {
    title: "Flashcards học tập",
    description: "Tạo và ôn lại nhanh những thẻ học tập giúp ghi nhớ kiến thức chính.",
    selectDoc: "Chọn tài liệu",
    allDocs: "Tất cả tài liệu",
    cardCount: "Thẻ học",
    noCard: "Không có thẻ nào phù hợp. Hãy thêm thẻ mới hoặc chọn tài liệu khác.",
    addCard: "Thêm thẻ mới",
    editCard: "Sửa thẻ",
    questionPlaceholder: "Nhập câu hỏi...",
    answerPlaceholder: "Nhập câu trả lời...",
    addButton: "Tạo thẻ",
    saveButton: "Lưu thay đổi",
    cancelEdit: "Huỷ sửa",
    creating: "Đang tạo...",
    saving: "Đang lưu...",
    resetButton: "Làm mới",
    resetConfirmTitle: "Xoá toàn bộ flashcard?",
    resetConfirmDesc: (name: string) => `Tất cả flashcard trong tài liệu "${name}" sẽ bị xoá vĩnh viễn. Hành động này không thể hoàn tác.`,
    resetConfirmButton: "Xoá tất cả",
    resetSuccess: "Đã xoá toàn bộ flashcard.",
    resetError: "Không thể xoá flashcard.",
    resetting: "Đang xoá...",
    viewAnswer: "Xem đáp án",
    hideAnswer: "Ẩn đáp án",
    copy: "Sao chép",
    edit: "Sửa",
    delete: "Xoá",
    statusLabel: "Trạng thái",
    statusNew: "Mới",
    statusLearning: "Đang học",
    statusMastered: "Đã thuộc",
    deleteTitle: "Xoá flashcard này?",
    deleteDesc: "Thẻ sẽ bị xoá vĩnh viễn khỏi bộ sưu tập. Các thẻ khác và tài liệu nguồn sẽ không bị ảnh hưởng.",
    deleteCancel: "Huỷ",
    deleteConfirm: "Xoá thẻ",
    deleting: "Đang xoá...",
    createSuccess: "Đã tạo flashcard mới.",
    createError: "Không thể tạo flashcard.",
    updateSuccess: "Đã cập nhật flashcard.",
    updateError: "Không thể cập nhật flashcard.",
    deleteSuccess: "Đã xoá flashcard.",
    deleteError: "Không thể xoá flashcard.",
    refreshError: "Không thể tải lại flashcard.",
    refreshing: "Đang tải lại...",
    validationError: "Vui lòng nhập cả câu hỏi và câu trả lời.",
    termTooLong: "Term/Front không được vượt quá 250 ký tự.",
    definitionTooLong: "Definition/Back không được vượt quá 250 ký tự.",
    documentNotOwned: "Bạn không có quyền truy cập tài liệu này.",
    aiBadge: "AI",
    manualBadge: "Tùy chỉnh",
    generateSuccess: (count: number) => `Đã tạo ${count} flashcard từ tài liệu.`,
    generatePartial: (created: number, requested: number) => `Đã tạo ${created}/${requested} thẻ, quá trình bị gián đoạn giữa chừng.`,
    generateError: "Không thể tạo flashcard.",
    generateEmpty: "AI không tạo được thẻ nào từ tài liệu này. Vui lòng thử tài liệu khác.",
    cardCountLabel: "Số lượng thẻ",
    docEmbeddingProcessing: "Tài liệu đang được xử lý, vui lòng thử lại sau ít phút.",
    docEmbeddingFailed: "Tài liệu xử lý AI thất bại, không thể sinh flashcard.",
    docEmbeddingNone: "Tài liệu chưa sẵn sàng để sinh flashcard AI.",
    quotaRemaining: (remaining: number, limit: number) =>
      `Còn ${remaining}/${limit} lượt tạo AI hôm nay`,
    quotaUnlimited: "Không giới hạn lượt tạo AI",
    quotaExhausted: "Bạn đã dùng hết lượt tạo Flashcard AI hôm nay. Hạn mức sẽ được cấp lại vào 00:00 giờ Việt Nam ngày mai. Bạn vẫn có thể tạo Flashcard bằng cách nhập tay, không giới hạn số lượng.",
    perClickLimitHint: (limit: number) => `Tối đa ${limit} thẻ/lượt bấm`,
  } : {
    title: "Study Flashcards",
    description: "Build and review quick learning cards to remember key concepts faster.",
    selectDoc: "Select document",
    allDocs: "All documents",
    cardCount: "Flashcards",
    noCard: "No cards match this document. Add a new card or choose another document.",
    addCard: "Add new card",
    editCard: "Edit card",
    questionPlaceholder: "Enter question...",
    answerPlaceholder: "Enter answer...",
    addButton: "Create card",
    saveButton: "Save changes",
    cancelEdit: "Cancel edit",
    creating: "Creating...",
    saving: "Saving...",
    resetButton: "Reset",
    resetConfirmTitle: "Delete all flashcards?",
    resetConfirmDesc: (name: string) => `All flashcards in "${name}" will be permanently deleted. This action cannot be undone.`,
    resetConfirmButton: "Delete all",
    resetSuccess: "All flashcards deleted.",
    resetError: "Could not delete flashcards.",
    resetting: "Deleting...",
    viewAnswer: "Show answer",
    hideAnswer: "Hide answer",
    copy: "Copy",
    edit: "Edit",
    delete: "Delete",
    statusLabel: "Status",
    statusNew: "New",
    statusLearning: "Learning",
    statusMastered: "Mastered",
    deleteTitle: "Delete this flashcard?",
    deleteDesc: "The card will be permanently removed. Other cards and the source document won't be affected.",
    deleteCancel: "Cancel",
    deleteConfirm: "Delete card",
    deleting: "Deleting...",
    createSuccess: "Flashcard created.",
    createError: "Could not create the flashcard.",
    updateSuccess: "Flashcard updated.",
    updateError: "Could not update the flashcard.",
    deleteSuccess: "Flashcard deleted.",
    deleteError: "Could not delete the flashcard.",
    refreshError: "Could not refresh flashcards.",
    refreshing: "Refreshing...",
    validationError: "Please enter both a question and an answer.",
    termTooLong: "The question must not exceed 250 characters.",
    definitionTooLong: "The answer must not exceed 250 characters.",
    documentNotOwned: "You don't have access to this document.",
    aiBadge: "AI",
    manualBadge: "Manual",
    generateSuccess: (count: number) => `Generated ${count} flashcard${count === 1 ? "" : "s"} from the document.`,
    generatePartial: (created: number, requested: number) => `Generated ${created}/${requested} cards — the process was interrupted partway through.`,
    generateError: "Could not generate flashcards.",
    generateEmpty: "AI couldn't generate any cards from this document. Try another document.",
    cardCountLabel: "Card count",
    docEmbeddingProcessing: "The document is still being processed. Please try again in a few minutes.",
    docEmbeddingFailed: "AI processing failed for this document, so flashcards can't be generated.",
    docEmbeddingNone: "This document isn't ready for AI flashcard generation yet.",
    quotaRemaining: (remaining: number, limit: number) =>
      `${remaining}/${limit} AI generations left today`,
    quotaUnlimited: "Unlimited AI generations",
    quotaExhausted: "You've used up today's AI flashcard generation limit. It resets at midnight Vietnam time. You can still add flashcards manually with no limit.",
    perClickLimitHint: (limit: number) => `Up to ${limit} cards per click`,
  }

  const availableDocs = [{ id: "all", name: text.allDocs }, ...documents.map(doc => ({ id: doc.id, name: doc.name }))]

  // Trần số thẻ MỖI LƯỢT BẤM (BR-099, ĐÃ CÓ) — lấy từ endpoint public của gói dịch vụ,
  // không phụ thuộc state của tính năng subscription. SỬA (Gap 5, Flashcard_AI_Daily_
  // Quota_API_Contract.docx v2.0): field maxFlashcards trả về cùng lúc KHÔNG còn được
  // dùng ở đây nữa — quota tổng đã bãi bỏ, xem dailyQuota bên dưới.
  const [perClickLimit, setPerClickLimit] = useState<number>(5)
  useEffect(() => {
    let cancelled = false
    // FIXED: trước đây guard bằng `!currentUser?.subscriptionTier` — nhưng giờ
    // subscriptionTier hợp lệ có thể là undefined cho user có gói custom (auth.ts
    // không còn đoán bừa tier nữa). Guard đúng là còn user hay không; subscriptionPlanId
    // mới là khoá tra cứu chính, subscriptionTier chỉ là fallback tên gói cũ.
    if (!currentUser) return
    fetchFlashcardQuotaApi(currentUser.subscriptionTier ?? "free", currentUser.subscriptionPlanId)
      .then(limits => {
        if (!cancelled) {
          setPerClickLimit(limits.perClickLimit)
        }
      })
      .catch(() => {
        // Giữ giá trị mặc định nếu không lấy được, tránh chặn UI
      })
    return () => {
      cancelled = true
    }
  }, [currentUser?.id, currentUser?.subscriptionTier, currentUser?.subscriptionPlanId])

  // MỚI (BR-110 → BR-112, Gap 5, đã CHỐT chính thức): hạn mức tạo Flashcard AI/ngày —
  // NGUỒN DUY NHẤT là GET /api/flashcards/quota. FE TUYỆT ĐỐI không tự tính lại bằng
  // công thức dựa trên danh sách flashcard hiện có (xoá hẳn totalCardCount/remainingQuota
  // kiểu "maxFlashcards - flashcards.length" đã dùng trước đây).
  const [dailyQuota, setDailyQuota] = useState<FlashcardDailyQuota | null>(null)
  const refreshDailyQuota = useCallback(async () => {
    if (!currentUser) { setDailyQuota(null); return }
    try {
      setDailyQuota(await fetchFlashcardDailyQuotaApi())
    } catch {
      // BR-112 Mục 5: lỗi khi gọi API lấy quota → ẩn chỉ số hiển thị, KHÔNG chặn
      // hay ảnh hưởng tới thao tác tạo Flashcard bình thường của User.
      setDailyQuota(null)
    }
  }, [currentUser])

  useEffect(() => {
    void refreshDailyQuota()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id])

  const isUnlimited = dailyQuota?.unlimited ?? false
  const remainingQuota = dailyQuota == null
    ? Infinity // Chưa tải xong / lỗi: không chặn UI theo BR-112 Mục 5, BE vẫn kiểm tra thật khi bấm tạo.
    : dailyQuota.unlimited
      ? Infinity
      : (dailyQuota.remaining ?? 0)
  // Số thẻ tối đa có thể NHẬP ở ô count: nhỏ hơn giữa hạn mức NGÀY còn lại VÀ
  // trần per-click của gói (BR-099) — dù hạn mức ngày còn nhiều (hoặc không giới
  // hạn), vẫn không được vượt trần mỗi lượt. Math.min với Infinity tự động
  // rơi về perClickLimit khi isUnlimited = true.
  const generateInputMax = Math.max(0, Math.min(remainingQuota, perClickLimit))

  useEffect(() => {
    setSelectedDocId(flashcardSelectedDocumentId ?? "all")
  }, [flashcardSelectedDocumentId])

  // Giữ generateCount trong giới hạn hợp lệ mỗi khi quota thay đổi
  // (ví dụ sau khi tạo thêm thẻ khiến quota còn lại giảm xuống).
  useEffect(() => {
    if (generateInputMax >= 1 && generateCount > generateInputMax) {
      setGenerateCount(generateInputMax)
    }
  }, [generateInputMax, generateCount])

  const filteredCards = useMemo(() => {
    if (selectedDocId === "all") return flashcards
    return flashcards.filter(card => card.documentId === selectedDocId)
  }, [flashcards, selectedDocId])

  useEffect(() => {
    if (selectedDocId !== "all") {
      void loadFlashcardsForDocument(selectedDocId)
    }
  }, [selectedDocId, loadFlashcardsForDocument])

  useEffect(() => {
    if (activeIndex >= filteredCards.length) {
      setActiveIndex(filteredCards.length > 0 ? filteredCards.length - 1 : 0)
      setFlipped(false)
    }
  }, [filteredCards, activeIndex])

  const selectedDocName = useMemo(() => {
    if (selectedDocId === "all") return text.allDocs
    return documents.find(doc => doc.id === selectedDocId)?.name ?? text.allDocs
  }, [documents, selectedDocId, text.allDocs])

  const selectedDoc = useMemo(
    () => (selectedDocId === "all" ? undefined : documents.find(doc => doc.id === selectedDocId)),
    [documents, selectedDocId],
  )
  // Tài liệu phải embedding xong ("done") mới đủ điều kiện sinh flashcard AI (khớp check ở FlashcardService.generateFlashcards phía BE).
  const embeddingNotReady = selectedDocId !== "all" && selectedDoc?.embeddingStatus !== "done"

  // Clamp ngay tại thời điểm render: nếu filteredCards vừa co lại (ví dụ vừa xoá
  // đúng thẻ cuối danh sách đang active), activeIndex cũ có thể trỏ ra ngoài mảng
  // mới trong khung hình render này (useEffect bên dưới chỉ sửa lại SAU khi đã
  // render xong), gây activeCard = undefined và crash khi đọc activeCard.aiGenerated.
  const safeActiveIndex = filteredCards.length > 0
    ? Math.min(activeIndex, filteredCards.length - 1)
    : 0
  const activeCard = filteredCards[safeActiveIndex]

  const resetForm = () => {
    setQuestion("")
    setAnswer("")
    setEditingId(null)
  }

  const handleAddCard = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error(text.validationError)
      return
    }
    setIsSaving(true)
    try {
      if (editingId) {
        const result = await updateFlashcard(editingId, {
          question: question.trim(),
          answer: answer.trim(),
        })
        if (result.success) {
          toast.success(text.updateSuccess)
          resetForm()
        } else {
          toast.error(result.message ?? text.updateError)
        }
      } else {
        // BR-107: không chặn tạo thủ công dù user đã hết quota AI.
        // Quota check (remainingQuota <= 0) chỉ áp dụng cho nút "Tạo bằng AI".
        const result = await addFlashcards([
          {
            question: question.trim(),
            answer: answer.trim(),
            documentId: selectedDocId === "all" ? undefined : selectedDocId,
          },
        ])
        if (result.success) {
          toast.success(text.createSuccess)
          resetForm()
          setFlipped(false)
          setActiveIndex(0)
        } else {
          // Hiển thị thẳng field message từ BE (theo API Contract Mục 6, Gap #5):
          // BE đã trả sẵn message tiếng Việt cho tất cả kịch bản lỗi
          // (vượt độ dài — BR-108, tài liệu không thuộc sở hữu — Gap #2,
          // cũng như các lỗi ĐÃ CÓ: NotBlank, 401, 500).
          // FE KHÔNG switch/case theo nội dung message vì BE chưa có ErrorCode ổn định.
          toast.error(result.message || text.createError)
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Nút "Làm mới":
  // - Nếu đang sửa thẻ → huỷ sửa
  // - Nếu chọn tài liệu cụ thể → mở dialog xác nhận XOÁ toàn bộ thẻ của tài liệu đó
  // - Nếu "Tất cả tài liệu" → nút bị ẩn (không cho xoá hàng loạt khi chưa chọn tài liệu)
  const handleReset = () => {
    if (editingId) {
      resetForm()
      return
    }
    if (selectedDocId !== "all") {
      setResetConfirmOpen(true)
    }
  }

  const handleConfirmReset = async () => {
    setIsResetting(true)
    try {
      const result = await deleteAllFlashcardsForDocument(selectedDocId)
      if (result.success) {
        toast.success(text.resetSuccess)
        setActiveIndex(0)
        setFlipped(false)
      } else {
        toast.error(result.message ?? text.resetError)
      }
    } finally {
      setIsResetting(false)
      setResetConfirmOpen(false)
    }
  }

  const handleStartEdit = (id: string) => {
    const card = flashcards.find(c => c.id === id)
    if (!card) return
    setEditingId(id)
    setQuestion(card.question)
    setAnswer(card.answer)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return
    setIsDeleting(true)
    try {
      const result = await deleteFlashcard(deleteTargetId)
      if (result.success) {
        toast.success(text.deleteSuccess)
        if (editingId === deleteTargetId) resetForm()
      } else {
        toast.error(result.message ?? text.deleteError)
      }
    } finally {
      setIsDeleting(false)
      setDeleteTargetId(null)
    }
  }

  const handleGenerateAI = async () => {
    if (selectedDocId === "all" || embeddingNotReady) return
    setIsGenerating(true)
    try {
      const result = await generateFlashcardsFromDocument(selectedDocId, generateCount)
      if (result.success) {
        if (result.createdCount > 0) {
          if (result.status === "PARTIAL_SUCCESS" && result.failureReason) {
            // Thành công một phần (BR-102/BR-104): nêu rõ số thẻ thực nhận +
            // lý do dừng, dùng chung mapErrorMessage với các lỗi cứng (Mục 6).
            toast.warning(
              `${text.generatePartial(result.createdCount, result.requestedCount)} ${mapErrorMessage(result.failureReason, language)}`,
            )
          } else {
            toast.success(text.generateSuccess(result.createdCount))
          }
          setFlipped(false)
          setActiveIndex(0)
        } else {
          toast.error(text.generateEmpty)
        }
      } else if (result.token) {
        // 1 trong 5 lỗi cứng của cơ chế Batching + hạn mức ngày (per-click cap, hạn mức
        // NGÀY BR-110, timeout, rate-limit, safety) — dùng mapErrorMessage() dùng chung,
        // kèm số liệu thật cho per-click cap / hạn mức ngày (Mục 6, BR-110 Mục 5.3).
        toast.error(
          mapErrorMessage(result.token, language, {
            perClickLimit: result.perClickLimit,
            requestedCount: result.requestedCount,
            dailyLimit: result.dailyLimit,
            usedToday: result.usedToday,
          }),
        )
      } else {
        // Lỗi ĐÃ CÓ (document not found, chưa embedding xong, lỗi hệ thống...) —
        // hiển thị thẳng message như hành vi cũ, không switch/case (Mục 6, Gap 7 để sau).
        toast.error(result.message || text.generateError)
      }
    } finally {
      setIsGenerating(false)
      // BR-111/BR-112 (Gap 5): gọi lại quota NGÀY sau MỖI lượt tạo bằng AI, thành
      // công hay bị chặn đều phải cập nhật lại — đây là nguồn hiển thị DUY NHẤT.
      void refreshDailyQuota()
    }
  }

  const handleCopy = (textValue: string) => {
    navigator.clipboard.writeText(textValue)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{text.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{text.description}</p>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-sm font-semibold text-foreground">{text.selectDoc}</p>
              <select
                value={selectedDocId}
                onChange={e => {
                  setSelectedDocId(e.target.value)
                  setFlashcardSelectedDocumentId(e.target.value)
                }}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {availableDocs.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name}</option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              {filteredCards.length} {text.cardCount} • {selectedDocName}
            </div>
          </div>
          <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Button
              onClick={handleGenerateAI}
              disabled={selectedDocId === "all" || isGenerating || embeddingNotReady || remainingQuota <= 0}
              title={embeddingNotReady ? embeddingHint(selectedDoc?.embeddingStatus, text) : remainingQuota <= 0 ? text.quotaExhausted : undefined}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? (language === "vi" ? "Đang tạo flashcard..." : "Generating flashcards...") : (language === "vi" ? "Tạo flashcard bằng AI" : "Generate AI flashcards")}
            </Button>
            <input
              type="number"
              min={1}
              max={generateInputMax}
              value={generateCount}
              onChange={e => {
                const raw = Number(e.target.value)
                const clamped = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), Math.max(generateInputMax, 1)) : 1
                setGenerateCount(clamped)
              }}
              disabled={selectedDocId === "all" || isGenerating || embeddingNotReady || remainingQuota <= 0}
              title={text.cardCountLabel}
              className="w-28 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            />
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              {selectedDocId === "all"
                ? language === "vi" ? "Chọn tài liệu để tạo flashcard" : "Select a document to generate"
                : embeddingNotReady
                ? embeddingHint(selectedDoc?.embeddingStatus, text)
                : remainingQuota <= 0
                ? text.quotaExhausted
                : (isUnlimited || dailyQuota == null ? text.quotaUnlimited : text.quotaRemaining(remainingQuota, dailyQuota.limit))
                  + " • " + text.perClickLimitHint(perClickLimit)}
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
              {text.noCard}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 to-sky-50 p-6 shadow-xl">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.32em] text-muted-foreground">
                  <span>{language === "vi" ? "Thẻ" : "Card"} {safeActiveIndex + 1}/{filteredCards.length}</span>
                  <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                    {activeCard.aiGenerated ? text.aiBadge : text.manualBadge}
                  </span>
                </div>

                {/* 3D Flip Card */}
                <div
                  className="relative mt-6 w-full cursor-pointer"
                  style={{ perspective: "1200px", minHeight: "220px" }}
                  onClick={() => setFlipped(prev => !prev)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setFlipped(prev => !prev) }}
                  aria-label={flipped ? (language === "vi" ? "Ẩn đáp án" : "Hide answer") : (language === "vi" ? "Xem đáp án" : "Show answer")}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      minHeight: "220px",
                      transformStyle: "preserve-3d",
                      transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                  >
                    {/* Mặt trước — xanh lá */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                      }}
                      className="flex flex-col rounded-[1.75rem] border border-green-200 bg-gradient-to-br from-green-50 to-emerald-100 p-8 shadow-lg"
                    >
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-200 font-bold text-green-800">A</span>
                        <span className="font-medium">{language === "vi" ? "Mặt trước" : "Front"}</span>
                      </div>
                      <div className="mt-5 flex min-h-[140px] items-center">
                        <p className="text-2xl font-semibold leading-snug text-green-900">{activeCard.question}</p>
                      </div>
                    </div>

                    {/* Mặt sau — đỏ */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                      className="flex flex-col rounded-[1.75rem] border border-red-200 bg-gradient-to-br from-red-50 to-rose-100 p-8 shadow-lg"
                    >
                      <div className="flex items-center gap-2 text-xs text-red-700">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-200 font-bold text-red-800">B</span>
                        <span className="font-medium">{language === "vi" ? "Mặt sau" : "Back"}</span>
                      </div>
                      <div className="mt-5 flex min-h-[140px] items-center">
                        <p className="text-lg leading-8 text-red-900">{activeCard.answer}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{activeCard.documentId ? documents.find(doc => doc.id === activeCard.documentId)?.name : (language === "vi" ? "Tổng quát" : "General")}</span>
                  <span>•</span>
                  <span>{new Date(activeCard.createdAt).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}</span>
                  <span>•</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {statusText(activeCard.status ?? "new", text)}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setFlipped(prev => !prev)}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {flipped ? text.hideAnswer : text.viewAnswer}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleCopy(`${activeCard.question}\n${activeCard.answer}`)}
                  >
                    <Copy className="h-4 w-4" />
                    {text.copy}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleStartEdit(activeCard.id)}
                  >
                    <Pencil className="h-4 w-4" />
                    {text.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteTargetId(activeCard.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {text.delete}
                  </Button>
                  <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-1">
                    <span className="px-2 text-xs font-medium text-muted-foreground">{text.statusLabel}</span>
                    {(["new", "learning", "mastered"] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateFlashcardStatus(activeCard.id, status)}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                          (activeCard.status ?? "new") === status
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {statusText(status, text)}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={safeActiveIndex === 0}
                      onClick={() => {
                        setActiveIndex(Math.max(0, safeActiveIndex - 1))
                        setFlipped(false)
                      }}
                    >
                      {language === "vi" ? "Trước" : "Previous"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={safeActiveIndex === filteredCards.length - 1}
                      onClick={() => {
                        setActiveIndex(Math.min(filteredCards.length - 1, safeActiveIndex + 1))
                        setFlipped(false)
                      }}
                    >
                      {language === "vi" ? "Tiếp" : "Next"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{editingId ? text.editCard : text.addCard}</p>
              <p className="text-xs text-muted-foreground">{language === "vi" ? "Tạo câu hỏi và đáp án để ôn luyện nhanh." : "Create a question and answer to review quickly."}</p>
            </div>
            {editingId && (
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-8 w-8"
                onClick={resetForm}
                title={text.cancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{language === "vi" ? "Câu hỏi" : "Question"}</label>
              <textarea
                rows={3}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder={text.questionPlaceholder}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">{language === "vi" ? "Đáp án" : "Answer"}</label>
              <textarea
                rows={4}
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder={text.answerPlaceholder}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleAddCard} disabled={isSaving} className="gap-2">
              {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {isSaving ? (editingId ? text.saving : text.creating) : (editingId ? text.saveButton : text.addButton)}
            </Button>
            {(editingId || selectedDocId !== "all") && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isResetting}
                className={cn("gap-2", !editingId && "text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive")}
              >
                {editingId ? (
                  <>
                    <X className="h-4 w-4" />
                    {text.cancelEdit}
                  </>
                ) : (
                  <>
                    <Trash2 className={cn("h-4 w-4", isResetting && "animate-spin")} />
                    {isResetting ? text.resetting : text.resetButton}
                  </>
                )}
              </Button>
            )}
          </div>
        </aside>
      </div>

      {/* Dialog xác nhận xoá toàn bộ flashcard của tài liệu đang chọn */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={open => !open && !isResetting && setResetConfirmOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{text.resetConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {text.resetConfirmDesc(selectedDocName)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>{text.deleteCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isResetting}
              onClick={event => {
                event.preventDefault()
                void handleConfirmReset()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? text.resetting : text.resetConfirmButton}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={open => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{text.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{text.deleteDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{text.deleteCancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={event => {
                event.preventDefault()
                void handleConfirmDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? text.deleting : text.deleteConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function statusText(
  status: "new" | "learning" | "mastered",
  text: { statusNew: string; statusLearning: string; statusMastered: string },
) {
  if (status === "learning") return text.statusLearning
  if (status === "mastered") return text.statusMastered
  return text.statusNew
}

function embeddingHint(
  embeddingStatus: EmbeddingStatus | undefined,
  text: { docEmbeddingProcessing: string; docEmbeddingFailed: string; docEmbeddingNone: string },
) {
  if (embeddingStatus === "processing") return text.docEmbeddingProcessing
  if (embeddingStatus === "failed") return text.docEmbeddingFailed
  return text.docEmbeddingNone
}
