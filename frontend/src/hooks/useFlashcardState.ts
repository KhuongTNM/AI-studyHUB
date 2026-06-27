"use client"

import { useCallback, useState } from "react"
import {
  generateFlashcardsApi,
  fetchFlashcardsApi,
  updateFlashcardStatusApi,
} from "@/services/api/flashcards"
import type { Document, Flashcard } from "@/states/types"

interface FlashcardStateDeps {
  documents: Document[]
}

export function useFlashcardState({ documents }: FlashcardStateDeps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [flashcardSelectedDocumentId, setFlashcardSelectedDocId] = useState<string | "all">("all")

  // ── Thêm flashcard vào state (tạo thủ công - BR-037) ────────────────────
  const addFlashcards = useCallback((cards: Flashcard[]) => {
    setFlashcards(prev => [...cards, ...prev])
  }, [])

  // ── Xoá flashcard (cục bộ - không có endpoint delete) ───────────────────
  const deleteFlashcard = useCallback((id: string) => {
    setFlashcards(prev => prev.filter(card => card.id !== id))
  }, [])

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
        },
        {
          id: `fc-${now}-3`,
          documentId: doc.id,
          question: `Làm thế nào để áp dụng kiến thức này trong bài tập hoặc ôn tập?`,
          answer: `Sử dụng ý chính từ tài liệu để trả lời ví dụ, tóm tắt nội dung và lặp lại thường xuyên.`,
          createdAt: new Date(),
          status: "new",
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
    updateFlashcardStatus,
    generateFlashcardsFromDocument,
    loadFlashcardsForDocument,
    setFlashcardSelectedDocumentId,
  }
}
