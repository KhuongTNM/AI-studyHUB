"use client"

import { Upload, Cloud, Bot, Shield, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Language } from "@/states/types"

const featureAccents = [
  "bg-sky-500/10 text-sky-600",
  "bg-cyan-500/10 text-cyan-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-violet-500/10 text-violet-600",
  "bg-amber-500/10 text-amber-600",
] as const

const featureIcons = [Upload, Cloud, BookOpen, Bot, Shield] as const

export function FeaturesSection({ language }: { language: Language }) {
  const text = featuresText[language]
  const features = text.items.map((item, index) => ({
    ...item,
    icon: featureIcons[index],
    accent: featureAccents[index],
  }))

  return (
    <section className="py-12">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
          {text.title}
        </h2>
        <p className="text-muted-foreground">
          {text.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className={cn(
              "group rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg",
              index < 3 ? "lg:col-span-2" : "lg:col-span-3"
            )}
          >
            <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-transform group-hover:scale-105", feature.accent)}>
              <feature.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Footer({ language }: { language: Language }) {
  const text = footerText[language]

  return (
    <footer className="border-t border-border py-6 text-center">
      <p className="text-sm text-muted-foreground">
        {text.copyright}
      </p>
    </footer>
  )
}

const featuresText = {
  vi: {
    title: "Mọi thứ bạn cần để học hiệu quả",
    subtitle: "Các chức năng cốt lõi của StudyHub",
    items: [
      {
        title: "Quản lý tài liệu",
        description: "Upload, phân loại theo môn, tìm kiếm và chia sẻ tài liệu dễ dàng.",
      },
      {
        title: "Lưu trữ Cloud",
        description: "Truy cập tài liệu mọi lúc, mọi nơi. Không lo đầy ổ cứng cá nhân.",
      },
      {
        title: "Flashcards học tập",
        description: "Tạo thẻ học nhanh từ nội dung và ôn luyện kiến thức mỗi ngày.",
      },
      {
        title: "AI Chatbot",
        description: "Hỏi đáp trực tiếp với nội dung tài liệu của bạn bằng AI.",
      },
      {
        title: "An toàn & Riêng tư",
        description: "Tài khoản bảo mật, dữ liệu mã hóa, chỉ bạn mới truy cập được.",
      },
    ],
  },
  en: {
    title: "Everything you need to study effectively",
    subtitle: "Core StudyHub features",
    items: [
      {
        title: "Document management",
        description: "Upload, classify by subject, search, and share documents easily.",
      },
      {
        title: "Cloud storage",
        description: "Access documents anywhere without filling up your personal drive.",
      },
      {
        title: "Study flashcards",
        description: "Create quick study cards from content and review knowledge every day.",
      },
      {
        title: "AI Chatbot",
        description: "Ask questions directly against your document content with AI.",
      },
      {
        title: "Security & Privacy",
        description: "Protected accounts, encrypted data, and owner-controlled access.",
      },
    ],
  },
} as const

const footerText = {
  vi: {
    copyright: "© 2026 StudyHub • SU26SWP391 • Dành cho sinh viên",
  },
  en: {
    copyright: "© 2026 StudyHub • SU26SWP391 • Built for students",
  },
} as const
