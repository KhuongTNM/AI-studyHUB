"use client"

import { useMemo } from "react"
import { BarChart3, HardDrive, Package, Users } from "lucide-react"
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
import { getLocalizedPlanName, normalizePlanName } from "@/configs/subscription-plan-labels"
import type { Language, PackagePrice, User } from "@/states/types"

type AnalyticsText = {
  analyticsTitle: string
  analyticsSubtitle: string
  analyticsSnapshot: string
  usersByRole: string
  usersByPlan: string
  storageByAccount: string
  chartNoData: string
  chartUsers: string
  chartUsed: string
  chartLimit: string
  storageUnit: string
  chartUnknownPlan: string
  adminRole: string
  normalUsers: string
  subAdmins: string
}

const BYTES_PER_GB = 1024 ** 3
const CHART_COLORS = ["#635bff", "#14b8a6", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6"]

function toGb(bytes: number) {
  return Number((Math.max(0, bytes) / BYTES_PER_GB).toFixed(2))
}

function shorten(value: string, maxLength = 18) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function resolvePlan(user: User, packages: PackagePrice[]) {
  if (user.subscriptionPlanId != null) {
    const matchedById = packages.find(plan => String(plan.id) === String(user.subscriptionPlanId))
    if (matchedById) return matchedById
  }

  const normalizedTier = normalizePlanName(user.subscriptionTier, user.subscriptionTier)
  return packages.find(plan => normalizePlanName(plan.planName, plan.tier) === normalizedTier)
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

  const planData = useMemo(() => {
    const counts = new Map<string, { key: string; name: string; users: number }>()

    users.forEach(user => {
      const plan = resolvePlan(user, packages)
      const key = plan ? `plan-${plan.id}` : "plan-unknown"
      const name = plan ? getLocalizedPlanName(plan, language) : text.chartUnknownPlan
      const current = counts.get(key)
      counts.set(key, current ? { ...current, users: current.users + 1 } : { key, name: shorten(name, 20), users: 1 })
    })

    return Array.from(counts.values())
      .sort((left, right) => right.users - left.users)
      .map((item, index) => ({ ...item, fill: CHART_COLORS[index % CHART_COLORS.length] }))
  }, [language, packages, text.chartUnknownPlan, users])

  const storageData = useMemo(
    () => users
      .map(user => ({
        key: user.id,
        name: shorten(user.displayName || user.email.split("@")[0], 16),
        used: toGb(user.storageUsed),
        limit: toGb(user.storageLimit),
      }))
      .sort((left, right) => right.used - left.used)
      .slice(0, 6),
    [users],
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

        <Panel icon={Package} title={text.usersByPlan} className="xl:col-span-3">
          {planData.length === 0 ? (
            <EmptyChart label={text.chartNoData} />
          ) : (
            <ChartContainer config={{ users: { label: text.chartUsers, color: CHART_COLORS[0] } }} className="h-[282px] w-full aspect-auto">
              <BarChart data={planData} layout="vertical" margin={{ left: 6, right: 14, top: 8, bottom: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={92} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent nameKey="dataKey" />} />
                <Bar dataKey="users" radius={[0, 4, 4, 0]}>
                  {planData.map(item => <Cell key={item.key} fill={item.fill} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel icon={HardDrive} title={text.storageByAccount} description={text.storageUnit} className="xl:col-span-5">
          {storageData.length === 0 ? (
            <EmptyChart label={text.chartNoData} />
          ) : (
            <ChartContainer config={{ used: { label: text.chartUsed, color: CHART_COLORS[0] }, limit: { label: text.chartLimit, color: "#dbeafe" } }} className="h-[282px] w-full aspect-auto">
              <BarChart data={storageData} layout="vertical" margin={{ left: 6, right: 14, top: 8, bottom: 8 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} unit=" GB" />
                <YAxis dataKey="name" type="category" width={86} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent nameKey="dataKey" />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="used" fill="var(--color-used)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="limit" fill="var(--color-limit)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </Panel>

      </div>
    </section>
  )
}
