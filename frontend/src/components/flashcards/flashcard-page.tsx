"use client"

import { useMemo, useState, useEffect } from "react"
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
    flashcardSelectedDocumentId,
    setFlashcardSelectedDocumentId,
    language,
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
    validationError: "Vui lòng nhập cả câu hỏi và câu trả lời.",
    aiBadge: "AI",
    manualBadge: "Tùy chỉnh",
    generateSuccess: (count: number) => `Đã tạo ${count} flashcard từ tài liệu.`,
    generateError: "Không thể tạo flashcard.",
    generateEmpty: "AI không tạo được thẻ nào từ tài liệu này. Vui lòng thử tài liệu khác.",
    cardCountLabel: "Số lượng thẻ",
    docEmbeddingProcessing: "Tài liệu đang được xử lý, vui lòng thử lại sau ít phút.",
    docEmbeddingFailed: "Tài liệu xử lý AI thất bại, không thể sinh flashcard.",
    docEmbeddingNone: "Tài liệu chưa sẵn sàng để sinh flashcard AI.",
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
    validationError: "Please enter both a question and an answer.",
    aiBadge: "AI",
    manualBadge: "Manual",
    generateSuccess: (count: number) => `Generated ${count} flashcard${count === 1 ? "" : "s"} from the document.`,
    generateError: "Could not generate flashcards.",
    generateEmpty: "AI couldn't generate any cards from this document. Try another document.",
    cardCountLabel: "Card count",
    docEmbeddingProcessing: "The document is still being processed. Please try again in a few minutes.",
    docEmbeddingFailed: "AI processing failed for this document, so flashcards can't be generated.",
    docEmbeddingNone: "This document isn't ready for AI flashcard generation yet.",
  }

  const availableDocs = [{ id: "all", name: text.allDocs }, ...documents.map(doc => ({ id: doc.id, name: doc.name }))]

  useEffect(() => {
    setSelectedDocId(flashcardSelectedDocumentId ?? "all")
  }, [flashcardSelectedDocumentId])

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

  const activeCard = filteredCards[activeIndex]

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
          toast.error(result.message ?? text.createError)
        }
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    resetForm()
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
        if (result.count > 0) {
          toast.success(text.generateSuccess(result.count))
          setFlipped(false)
          setActiveIndex(0)
        } else {
          toast.error(text.generateEmpty)
        }
      } else {
        toast.error(result.message ?? text.generateError)
      }
    } finally {
      setIsGenerating(false)
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
              disabled={selectedDocId === "all" || isGenerating || embeddingNotReady}
              title={embeddingNotReady ? embeddingHint(selectedDoc?.embeddingStatus, text) : undefined}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? (language === "vi" ? "Đang tạo flashcard..." : "Generating flashcards...") : (language === "vi" ? "Tạo flashcard bằng AI" : "Generate AI flashcards")}
            </Button>
            <select
              value={generateCount}
              onChange={e => setGenerateCount(Number(e.target.value))}
              disabled={selectedDocId === "all" || isGenerating || embeddingNotReady}
              title={text.cardCountLabel}
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              {[3, 5, 8].map(n => (
                <option key={n} value={n}>{n} {language === "vi" ? "thẻ" : "cards"}</option>
              ))}
            </select>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              {selectedDocId === "all"
                ? language === "vi" ? "Chọn tài liệu để tạo flashcard" : "Select a document to generate"
                : embeddingNotReady
                ? embeddingHint(selectedDoc?.embeddingStatus, text)
                : language === "vi" ? "AI sẽ đọc tài liệu và sinh flashcard" : "AI will read the document and generate cards"}
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
                  <span>{language === "vi" ? "Thẻ" : "Card"} {activeIndex + 1}/{filteredCards.length}</span>
                  <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase text-primary">
                    {activeCard.aiGenerated ? text.aiBadge : text.manualBadge}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setFlipped(prev => !prev)}
                  className="relative mt-6 w-full overflow-hidden rounded-[1.75rem] border border-border bg-background p-8 text-left shadow-lg transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="absolute inset-x-6 top-6 h-px bg-border opacity-50" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">{flipped ? "B" : "A"}</span>
                    <span>{flipped ? (language === "vi" ? "Mặt sau" : "Back") : (language === "vi" ? "Mặt trước" : "Front")}</span>
                  </div>
                  <div className="mt-5 min-h-[180px]">
                    {flipped ? (
                      <p className="text-lg leading-8 text-foreground">{activeCard.answer}</p>
                    ) : (
                      <p className="text-2xl font-semibold leading-snug text-foreground">{activeCard.question}</p>
                    )}
                  </div>
                </button>

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
                      disabled={activeIndex === 0}
                      onClick={() => {
                        setActiveIndex(prev => Math.max(0, prev - 1))
                        setFlipped(false)
                      }}
                    >
                      {language === "vi" ? "Trước" : "Previous"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={activeIndex === filteredCards.length - 1}
                      onClick={() => {
                        setActiveIndex(prev => Math.min(filteredCards.length - 1, prev + 1))
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
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {editingId ? text.cancelEdit : text.resetButton}
            </Button>
          </div>
        </aside>
      </div>

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
