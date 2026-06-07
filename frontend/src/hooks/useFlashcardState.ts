"use client"

import { useCallback, useState } from "react"
import { MOCK_FLASHCARDS } from "@/states/mock-data"
import type { Document, Flashcard } from "@/states/types"

interface FlashcardStateDeps {
  documents: Document[]
}

export function useFlashcardState({ documents }: FlashcardStateDeps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>(MOCK_FLASHCARDS)
  const [flashcardSelectedDocumentId, setFlashcardSelectedDocId] = useState<string | "all">("all")

  const addFlashcards = useCallback((cards: Flashcard[]) => {
    setFlashcards(prev => [...cards, ...prev])
  }, [])

  const deleteFlashcard = useCallback((id: string) => {
    setFlashcards(prev => prev.filter(card => card.id !== id))
  }, [])

  const updateFlashcardStatus = useCallback((id: string, status: Flashcard["status"]) => {
    setFlashcards(prev => prev.map(card => (card.id === id ? { ...card, status } : card)))
  }, [])

  const setFlashcardSelectedDocumentId = useCallback((id: string | "all") => {
    setFlashcardSelectedDocId(id)
  }, [])

  const generateFlashcardsFromDocument = useCallback(
    (docId: string) => {
      const doc = documents.find(d => d.id === docId)
      if (!doc) return

      const now = Date.now()
      const topic = doc.subject || doc.name || "chủ đề"
      const tags = doc.tags.length > 0 ? doc.tags.join(", ") : null

      const generated: Flashcard[] = [
        {
          id: `flashcard-${now}-1`,
          documentId: doc.id,
          question: `Nội dung chính của tài liệu "${doc.name}" là gì?`,
          answer: doc.description
            ? `${doc.description}`
            : `Tài liệu này tập trung vào ${topic}.`,
          createdAt: new Date(),
        },
        {
          id: `flashcard-${now}-2`,
          documentId: doc.id,
          question: `Những khái niệm quan trọng cần nhớ trong tài liệu này là gì?`,
          answer: tags
            ? `Các khái niệm chính bao gồm: ${tags}.`
            : `Các khái niệm chính xoay quanh ${topic}.`,
          createdAt: new Date(),
        },
        {
          id: `flashcard-${now}-3`,
          documentId: doc.id,
          question: `Làm thế nào để áp dụng kiến thức này trong bài tập hoặc ôn tập?`,
          answer: `Sử dụng ý chính từ tài liệu để trả lời ví dụ, tóm tắt nội dung và lặp lại thường xuyên.`,
          createdAt: new Date(),
        },
      ]

      setFlashcards(prev => [...generated, ...prev])
      setFlashcardSelectedDocId(doc.id)
    },
    [documents],
  )

  return {
    flashcards,
    flashcardSelectedDocumentId,
    addFlashcards,
    deleteFlashcard,
    updateFlashcardStatus,
    setFlashcardSelectedDocumentId,
    generateFlashcardsFromDocument,
  }
}
