"use client"

import { useMemo, useState, useEffect } from "react"
import { BookOpen, Copy, Plus, RotateCcw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp, Flashcard } from "@/lib/store"
import { cn } from "@/lib/utils"

export function FlashcardPage() {
  const {
    documents,
    flashcards,
    addFlashcards,
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

  const text = language === "vi" ? {
    title: "Flashcards học tập",
    description: "Tạo và ôn lại nhanh những thẻ học tập giúp ghi nhớ kiến thức chính.",
    selectDoc: "Chọn tài liệu",
    allDocs: "Tất cả tài liệu",
    cardCount: "Thẻ học",
    noCard: "Không có thẻ nào phù hợp. Hãy thêm thẻ mới hoặc chọn tài liệu khác.",
    addCard: "Thêm thẻ mới",
    questionPlaceholder: "Nhập câu hỏi...",
    answerPlaceholder: "Nhập câu trả lời...",
    addButton: "Tạo thẻ",
    resetButton: "Làm mới",
    viewAnswer: "Xem đáp án",
    hideAnswer: "Ẩn đáp án",
    copy: "Sao chép",
    statusLabel: "Trạng thái",
    statusNew: "Mới",
    statusLearning: "Đang học",
    statusMastered: "Đã thuộc",
  } : {
    title: "Study Flashcards",
    description: "Build and review quick learning cards to remember key concepts faster.",
    selectDoc: "Select document",
    allDocs: "All documents",
    cardCount: "Flashcards",
    noCard: "No cards match this document. Add a new card or choose another document.",
    addCard: "Add new card",
    questionPlaceholder: "Enter question...",
    answerPlaceholder: "Enter answer...",
    addButton: "Create card",
    resetButton: "Reset",
    viewAnswer: "Show answer",
    hideAnswer: "Hide answer",
    copy: "Copy",
    statusLabel: "Status",
    statusNew: "New",
    statusLearning: "Learning",
    statusMastered: "Mastered",
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

  const handleAddCard = () => {
    if (!question.trim() || !answer.trim()) return
    const newCard: Flashcard = {
      id: `flashcard-${Date.now()}`,
      question: question.trim(),
      answer: answer.trim(),
      documentId: selectedDocId === "all" ? undefined : selectedDocId,
      createdAt: new Date(),
      status: "new",
    }
    addFlashcards([newCard])
    setQuestion("")
    setAnswer("")
    setFlipped(true)
    setActiveIndex(0)
  }

  const handleReset = () => {
    setQuestion("")
    setAnswer("")
  }

  const handleGenerateAI = async () => {
    if (selectedDocId === "all") return
    setIsGenerating(true)
    await new Promise(resolve => setTimeout(resolve, 1300))
    generateFlashcardsFromDocument(selectedDocId)
    setIsGenerating(false)
    setFlipped(false)
    setActiveIndex(0)
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
          <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Button
              onClick={handleGenerateAI}
              disabled={selectedDocId === "all" || isGenerating}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? (language === "vi" ? "Đang tạo flashcard..." : "Generating flashcards...") : (language === "vi" ? "Tạo flashcard bằng AI" : "Generate AI flashcards")}
            </Button>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
              {selectedDocId === "all"
                ? language === "vi" ? "Chọn tài liệu để tạo flashcard" : "Select a document to generate"
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
                    {filteredCards[activeIndex].documentId ? (language === "vi" ? "AI" : "AI") : (language === "vi" ? "Tùy chỉnh" : "Manual")}
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
                      <p className="text-lg leading-8 text-foreground">{filteredCards[activeIndex].answer}</p>
                    ) : (
                      <p className="text-2xl font-semibold leading-snug text-foreground">{filteredCards[activeIndex].question}</p>
                    )}
                  </div>
                </button>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{filteredCards[activeIndex].documentId ? documents.find(doc => doc.id === filteredCards[activeIndex].documentId)?.name : (language === "vi" ? "Tổng quát" : "General")}</span>
                  <span>•</span>
                  <span>{new Date(filteredCards[activeIndex].createdAt).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}</span>
                  <span>•</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {statusText(filteredCards[activeIndex].status ?? "new", text)}
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
                    onClick={() => handleCopy(`${filteredCards[activeIndex].question}\n${filteredCards[activeIndex].answer}`)}
                  >
                    <Copy className="h-4 w-4" />
                    {text.copy}
                  </Button>
                  <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-1">
                    <span className="px-2 text-xs font-medium text-muted-foreground">{text.statusLabel}</span>
                    {(["new", "learning", "mastered"] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => updateFlashcardStatus(filteredCards[activeIndex].id, status)}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                          (filteredCards[activeIndex].status ?? "new") === status
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
              <p className="text-sm font-semibold text-foreground">{text.addCard}</p>
              <p className="text-xs text-muted-foreground">{language === "vi" ? "Tạo câu hỏi và đáp án để ôn luyện nhanh." : "Create a question and answer to review quickly."}</p>
            </div>
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
            <Button onClick={handleAddCard} className="gap-2">
              <Plus className="h-4 w-4" />
              {text.addButton}
            </Button>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {text.resetButton}
            </Button>
          </div>
        </aside>
      </div>
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
