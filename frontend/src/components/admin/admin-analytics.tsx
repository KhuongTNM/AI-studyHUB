"use client"

import { useMemo } from "react"
import { BarChart3, Package, Users } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { getLocalizedPlanName } from "@/configs/subscription-plan-labels"
import type { Language, PackagePrice, User } from "@/states/types"

type AnalyticsText = {
  analyticsTitle: string
  analyticsSubtitle: string
  analyticsSnapshot: string
  usersByRole: string
  usersByPlan: string
  monthlyUsersDesc: string
  chartNoData: string
  chartUsers: string
  chartUnknownPlan: string
  adminRole: string
  normalUsers: string
  subAdmins: string
}

const CHART_COLORS = ["#635bff", "#14b8a6", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6"]
const MONTHS_TO_SHOW = 6

function shorten(value: string, maxLength = 18) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

/**
 * Chỉ match theo `subscriptionPlanId` — đây là field DUY NHẤT BE thật sự
 * trả về để liên kết user với gói (entity User.java không có `tier`).
 * Không còn fallback so theo `tier`/`subscriptionTier` vì đó là field tự
 * chế ở FE, không tồn tại trong DB/API thật.
 */
function resolvePlan(user: User, packages: PackagePrice[]) {
  if (user.subscriptionPlanId == null) return undefined
  return packages.find(plan => String(plan.id) === String(user.subscriptionPlanId))
}

function Panel({
  icon: Icon,
  title,
  description,
  children,
  className = "",
}: {
  icon: typeof Users
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`min-w-0 rounded-lg border border-border bg-card p-4 ${className}`}>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[250px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

export function AdminAnalytics({
  users,
  packages,
  language,
  text,
}: {
  users: User[]
  packages: PackagePrice[]
  language: Language
  text: AnalyticsText
}) {
  const roleRows = useMemo(
    () => [
      { key: "regular", name: text.normalUsers, value: users.filter(user => user.role === "user").length, fill: CHART_COLORS[0] },
      { key: "subAdmin", name: text.subAdmins, value: users.filter(user => user.role === "sub-admin").length, fill: CHART_COLORS[1] },
      { key: "admin", name: text.adminRole, value: users.filter(user => user.role === "admin").length, fill: CHART_COLORS[2] },
    ],
    [text.adminRole, text.normalUsers, text.subAdmins, users],
  )

  const roleData = useMemo(
    () => roleRows.filter(row => row.value > 0),
    [roleRows],
  )

  const roleConfig = useMemo(
    () => ({
      regular: { label: text.normalUsers, color: CHART_COLORS[0] },
      subAdmin: { label: text.subAdmins, color: CHART_COLORS[1] },
      admin: { label: text.adminRole, color: CHART_COLORS[2] },
      empty: { label: text.chartNoData, color: "#d1d5db" },
    }),
    [text.adminRole, text.chartNoData, text.normalUsers, text.subAdmins],
  )

  const pieData = roleData.length > 0
    ? roleData
    : [{ key: "empty", name: text.chartNoData, value: 1, fill: "#d1d5db" }]

  const planBuckets = useMemo(() => {
    const counts = new Map<string, { key: string; name: string; total: number }>()

    users.forEach(user => {
      const plan = resolvePlan(user, packages)
      const key = plan ? `plan-${plan.id}` : "plan-unknown"
      const name = plan ? getLocalizedPlanName(plan, language) : text.chartUnknownPlan
      const current = counts.get(key)
      counts.set(key, current ? { ...current, total: current.total + 1 } : { key, name: shorten(name, 20), total: 1 })
    })

    return Array.from(counts.values())
      .sort((left, right) => right.total - left.total)
      .map((item, index) => ({ ...item, fill: CHART_COLORS[index % CHART_COLORS.length] }))
  }, [language, packages, text.chartUnknownPlan, users])

  const monthlyPlanData = useMemo(() => {
    const monthLabel = (date: Date) =>
      language === "vi" ? `thg ${date.getMonth() + 1}` : date.toLocaleDateString("en-US", { month: "short" })

    const now = new Date()
    const months = Array.from({ length: MONTHS_TO_SHOW }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS_TO_SHOW - 1 - index), 1)
      return { year: date.getFullYear(), month: date.getMonth(), label: monthLabel(date) }
    })

    return months.map(({ year, month, label }) => {
      const row: Record<string, string | number> = { label }
      planBuckets.forEach(bucket => { row[bucket.key] = 0 })

      users.forEach(user => {
        const createdAt = new Date(user.createdAt)
        if (createdAt.getFullYear() !== year || createdAt.getMonth() !== month) return
        const plan = resolvePlan(user, packages)
        const key = plan ? `plan-${plan.id}` : "plan-unknown"
        row[key] = (Number(row[key]) || 0) + 1
      })

      return row
    })
  }, [language, packages, planBuckets, users])

  const monthlyPlanConfig = useMemo(
    () => Object.fromEntries(planBuckets.map(bucket => [bucket.key, { label: bucket.name, color: bucket.fill }])),
    [planBuckets],
  )

  const hasMonthlyData = planBuckets.length > 0 && monthlyPlanData.some(row =>
    planBuckets.some(bucket => Number(row[bucket.key]) > 0),
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">{text.analyticsTitle}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{text.analyticsSubtitle}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {text.analyticsSnapshot}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel icon={Users} title={text.usersByRole} className="xl:col-span-2">
          <div className="relative">
            <ChartContainer config={roleConfig} className="h-[250px] w-full aspect-auto">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
                <Pie data={pieData} dataKey="value" nameKey="key" innerRadius={62} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                  {pieData.map(item => <Cell key={item.key} fill={item.fill} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            {roleData.length > 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-2xl font-bold tabular-nums text-foreground">{users.length}</p>
                  <p className="text-xs text-muted-foreground">{text.chartUsers}</p>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-3">
            {roleRows.map(row => (
              <div key={row.key} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.fill }} />
                <span className="truncate text-muted-foreground">{row.name}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel icon={Package} title={text.usersByPlan} description={text.monthlyUsersDesc} className="xl:col-span-3">
          {!hasMonthlyData ? (
            <EmptyChart label={text.chartNoData} />
          ) : (
            <ChartContainer config={monthlyPlanConfig} className="h-[282px] w-full aspect-auto">
              <BarChart data={monthlyPlanData} margin={{ left: 6, right: 14, top: 8, bottom: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {planBuckets.map(bucket => (
                  <Bar key={bucket.key} dataKey={bucket.key} name={bucket.name} fill={bucket.fill} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </Panel>
      </div>
    </section>
  )
}
