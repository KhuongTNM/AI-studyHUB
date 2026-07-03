"use client"

import { useCallback, useState } from "react"
import {
  generateFlashcardsApi,
  fetchFlashcardsApi,
  updateFlashcardStatusApi,
  createFlashcardApi,
  deleteFlashcardApi,
  updateFlashcardApi,
} from "@/services/api/flashcards"
import type { Document, Flashcard } from "@/states/types"

interface FlashcardStateDeps {
  documents: Document[]
}

export function useFlashcardState({ documents }: FlashcardStateDeps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [flashcardSelectedDocumentId, setFlashcardSelectedDocId] = useState<string | "all">("all")

  // ── Thêm flashcard thủ công qua API (BR-037) ─────────────────────────────
  // Gọi API trước, chỉ thêm vào state khi thành công (tránh card "ảo" khi lỗi).
  const addFlashcards = useCallback(
    async (
      cards: { question: string; answer: string; documentId?: string }[],
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        const created = await Promise.all(
          cards.map(card =>
            createFlashcardApi({
              question: card.question,
              answer: card.answer,
              documentId: card.documentId,
            }),
          ),
        )
        setFlashcards(prev => [...created, ...prev])
        return { success: true }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "Không thể tạo flashcard.",
        }
      }
    },
    [],
  )

  // ── Xoá flashcard qua API, optimistic + rollback (BR-040) ───────────────
  const deleteFlashcard = useCallback(
    async (id: string): Promise<{ success: boolean; message?: string }> => {
      let removedCard: Flashcard | undefined
      let removedIndex = -1
      setFlashcards(prev => {
        removedIndex = prev.findIndex(card => card.id === id)
        removedCard = prev[removedIndex]
        return prev.filter(card => card.id !== id)
      })

      try {
        await deleteFlashcardApi(id)
        return { success: true }
      } catch (error) {
        // Rollback: chèn lại card vào đúng vị trí cũ
        if (removedCard) {
          setFlashcards(prev => {
            const next = [...prev]
            next.splice(Math.max(0, removedIndex), 0, removedCard as Flashcard)
            return next
          })
        }
        return {
          success: false,
          message: error instanceof Error ? error.message : "Không thể xoá flashcard.",
        }
      }
    },
    [],
  )

  // ── Sửa nội dung flashcard qua API, optimistic + rollback ────────────────
  const updateFlashcard = useCallback(
    async (
      id: string,
      updates: { question: string; answer: string },
    ): Promise<{ success: boolean; message?: string }> => {
      let previousCard: Flashcard | undefined
      setFlashcards(prev =>
        prev.map(card => {
          if (card.id === id) {
            previousCard = card
            return { ...card, ...updates }
          }
          return card
        }),
      )

      try {
        const updated = await updateFlashcardApi(id, updates)
        setFlashcards(prev => prev.map(card => (card.id === id ? updated : card)))
        return { success: true }
      } catch (error) {
        if (previousCard) {
          const restored = previousCard
          setFlashcards(prev => prev.map(card => (card.id === id ? restored : card)))
        }
        return {
          success: false,
          message: error instanceof Error ? error.message : "Không thể cập nhật flashcard.",
        }
      }
    },
    [],
  )

  // ── Cập nhật trạng thái flashcard qua API (BR-038) ───────────────────────
  const updateFlashcardStatus = useCallback((id: string, status: Flashcard["status"]) => {
    // Optimistic
    setFlashcards(prev =>
      prev.map(card => card.id === id ? { ...card, status } : card),
    )
    if (!status) return
    updateFlashcardStatusApi(id, status)
      .then(updated => {
        setFlashcards(prev =>
          prev.map(card => card.id === id ? { ...card, status: updated.status } : card),
        )
      })
      .catch(() => {
        // Optimistic update đã hiển thị, giữ nguyên nếu API lỗi
      })
  }, [])

  const setFlashcardSelectedDocumentId = useCallback((id: string | "all") => {
    setFlashcardSelectedDocId(id)
  }, [])

  /**
   * Gọi AI backend tạo flashcard từ tài liệu (BR-036).
   * Fallback sang mock nếu API không khả dụng.
   */
  const generateFlashcardsFromDocument = useCallback(
    async (docId: string) => {
      const doc = documents.find(d => d.id === docId)
      if (!doc) return

      // Thử gọi API thật trước
      try {
        const generated = await generateFlashcardsApi(docId)
        if (generated.length > 0) {
          setFlashcards(prev => [...generated, ...prev])
          setFlashcardSelectedDocId(docId)
          return
        }
      } catch {
        // Backend không khả dụng → fallback mock bên dưới
      }

      // ── Fallback mock (BR-036: tối thiểu 3 flashcard) ─────────────────────
      const now = Date.now()
      const topic = doc.subject || doc.name || "chủ đề"
      const tags = doc.tags.length > 0 ? doc.tags.join(", ") : null

      const mockCards: Flashcard[] = [
        {
          id: `fc-${now}-1`,
          documentId: doc.id,
          question: `Nội dung chính của tài liệu "${doc.name}" là gì?`,
          answer: doc.description
            ? doc.description
            : `Tài liệu này tập trung vào ${topic}.`,
          createdAt: new Date(),
          status: "new",
          aiGenerated: true,
        },
        {
          id: `fc-${now}-2`,
          documentId: doc.id,
          question: `Những khái niệm quan trọng cần nhớ trong tài liệu này là gì?`,
          answer: tags
            ? `Các khái niệm chính bao gồm: ${tags}.`
            : `Các khái niệm chính xoay quanh ${topic}.`,
          createdAt: new Date(),
          status: "new",
          aiGenerated: true,
        },
        {
          id: `fc-${now}-3`,
          documentId: doc.id,
          question: `Làm thế nào để áp dụng kiến thức này trong bài tập hoặc ôn tập?`,
          answer: `Sử dụng ý chính từ tài liệu để trả lời ví dụ, tóm tắt nội dung và lặp lại thường xuyên.`,
          createdAt: new Date(),
          status: "new",
          aiGenerated: true,
        },
      ]

      setFlashcards(prev => [...mockCards, ...prev])
      setFlashcardSelectedDocId(docId)
    },
    [documents],
  )

  /**
   * Load flashcard theo document từ API (BR-039).
   * Dùng khi user chọn một tài liệu cụ thể trong Flashcard page.
   */
  const loadFlashcardsForDocument = useCallback(async (docId: string) => {
    if (docId === "all") return
    try {
      const cards = await fetchFlashcardsApi(docId)
      if (cards.length > 0) {
        setFlashcards(prev => {
          // Loại bỏ cards cũ của doc này, thêm bản mới nhất từ server
          const others = prev.filter(c => c.documentId !== docId)
          return [...cards, ...others]
        })
      }
    } catch {
      // Giữ nguyên state nếu API lỗi
    }
  }, [])

  return {
    flashcards,
    flashcardSelectedDocumentId,
    addFlashcards,
    deleteFlashcard,
    updateFlashcard,
    updateFlashcardStatus,
    generateFlashcardsFromDocument,
    loadFlashcardsForDocument,
    setFlashcardSelectedDocumentId,
  }
}
