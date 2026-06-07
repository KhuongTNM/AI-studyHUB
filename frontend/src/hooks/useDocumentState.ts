"use client"

import { useCallback, useState } from "react"
import { MOCK_CATEGORIES, MOCK_DOCUMENTS } from "@/states/mock-data"
import type { Category, Document } from "@/states/types"

export function useDocumentState() {
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS)
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES)

  const addDocument = useCallback((doc: Document) => {
    setDocuments(prev => [doc, ...prev])
  }, [])

  const updateDocument = useCallback((id: string, updates: Partial<Document>) => {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, ...updates } : d)))
  }, [])

  const deleteDocument = useCallback((id: string) => {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: "deleted" } : d)))
  }, [])

  const restoreDocument = useCallback((id: string) => {
    setDocuments(prev => prev.map(d => (d.id === id ? { ...d, status: "ready" } : d)))
  }, [])

  const addCategory = useCallback((name: string, color: string) => {
    const cat: Category = { id: `cat-${Date.now()}`, name, color }
    setCategories(prev => [...prev, cat])
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id))
  }, [])

  return {
    documents,
    /** Exposed so admin actions (e.g. deleteUserAccount) can soft-delete user docs */
    setDocuments,
    categories,
    addDocument,
    updateDocument,
    deleteDocument,
    restoreDocument,
    addCategory,
    deleteCategory,
  }
}
