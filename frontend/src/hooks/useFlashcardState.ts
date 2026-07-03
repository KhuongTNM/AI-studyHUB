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
import type { Flashcard } from "@/states/types"

export function useFlashcardState() {
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
   * Gọi AI backend tạo flashcard thật từ nội dung tài liệu (BR-036).
   * Không còn fallback âm thầm sang mock khi lỗi — mọi lỗi (tài liệu chưa
   * embedding xong, AI service timeout/lỗi, không có quyền, v.v.) phải được
   * trả về rõ ràng cho UI hiển thị, không được nuốt mất bằng dữ liệu giả.
   */
  const generateFlashcardsFromDocument = useCallback(
    async (docId: string, count?: number): Promise<{ success: boolean; count: number; message?: string }> => {
      try {
        const generated = await generateFlashcardsApi(docId, count)
        setFlashcards(prev => [...generated, ...prev])
        setFlashcardSelectedDocId(docId)
        return { success: true, count: generated.length }
      } catch (error) {
        return {
          success: false,
          count: 0,
          message: error instanceof Error ? error.message : "Không thể tạo flashcard.",
        }
      }
    },
    [],
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
