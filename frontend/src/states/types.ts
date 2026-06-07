export type UserRole = "guest" | "user" | "sub-admin" | "admin"
export type PackageTier = "free" | "2-4" | "5+"

export interface User {
  id: string
  email: string
  displayName: string
  password: string
  avatar?: string
  role: UserRole
  isLocked: boolean
  emailVerified: boolean
  createdAt: Date
  loginAttempts: number
  lastActive: Date
  storageUsed: number
  storageLimit: number
  subscriptionTier?: PackageTier
  subscriptionExpiresAt?: Date
  languagePreference?: Language
}

export interface PackagePrice {
  id: string
  name: string
  tier: PackageTier
  price: number
  maxUsers: number
}

export interface RoomMessage {
  id: string
  senderId: string
  senderName: string
  content: string
  timestamp: Date
}

export interface StudyRoom {
  id: string
  password?: string
  hostId: string
  hostName: string
  capacity: number
  members: {
    userId: string
    displayName: string
    joinedAt: Date
  }[]
  messages: RoomMessage[]
  createdAt: Date
}

export interface Category {
  id: string
  name: string
  color: string
}

export type DocStatus = "uploading" | "scanning" | "ready" | "failed" | "deleted"
export type ShareStatus = "none" | "pending" | "approved" | "rejected"

export interface Document {
  id: string
  name: string
  type: "pdf" | "docx" | "pptx"
  size: string
  sizeBytes: number
  uploadedAt: Date
  uploadedBy: string
  categoryId: string
  subject: string
  status: DocStatus
  uploadProgress?: number
  description?: string
  tags: string[]
  downloadCount: number
  isPublic: boolean
  shareStatus: ShareStatus
  shareNote?: string
  reviewedBy?: string
  reviewedAt?: Date
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  documentId?: string
  createdAt: Date
}

export interface ActivityLog {
  id: string
  userId: string
  action: string
  target: string
  timestamp: Date
}
export type FlashcardStatus = "new" | "learning" | "mastered"

export interface Flashcard {
  id: string
  documentId?: string
  question: string
  answer: string
  createdAt: Date
  status?: FlashcardStatus
}
export type Language = "vi" | "en"
