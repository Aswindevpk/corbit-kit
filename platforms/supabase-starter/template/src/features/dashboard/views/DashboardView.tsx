import { useState } from "react"
import { Users, Database, Coins, Tray, CaretRight } from "@phosphor-icons/react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { KpiCard } from "../components/KpiCard"
import { useDashboardStats } from "../api/dashboard.queries"

const STAT_ICONS = [Users, Database, Coins, Tray]
const STAT_COLORS = [
  "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400",
]

type Period = "month" | "3months" | "6months"

export function DashboardView({ userName = "there" }: { userName?: string }) {
  const { data, isLoading } = useDashboardStats()
  const [period, setPeriod] = useState<Period>("month")

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full max-w-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const chartPoints = data.chart.points[period]

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-sm py-6">
        <div className="max-w-xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Welcome back, {userName} <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.greeting.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.stats.map((stat, i) => (
          <KpiCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={STAT_ICONS[i]!}
            iconColorClass={STAT_COLORS[i]}
            change={stat.change}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-base font-semibold">{data.chart.title}</CardTitle>
            <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-sm">
              {data.chart.periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
                    period === p.key ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="relative w-full h-56">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[11px] text-muted-foreground/80 pl-8">
                {["1.5K", "1K", "500", "250", "0"].map((label) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-6 text-right -ml-8">{label}</span>
                    <div className="flex-1 border-b border-dashed border-border" />
                  </div>
                ))}
              </div>
              <svg className="absolute inset-0 w-full h-full pl-8 pb-6 overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="statsGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M 20 160 Q 140 120 260 70 T 460 30" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 20 160 Q 140 120 260 70 T 460 30 L 460 190 L 20 190 Z" fill="url(#statsGrad)" />
              </svg>
              <div className="absolute bottom-0 left-8 right-0 flex justify-between text-[11px] text-muted-foreground pt-2">
                {chartPoints.map((pt) => (
                  <span key={pt.label} className="font-medium">
                    {pt.label}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.quickActions.map((action) => (
              <button
                key={action.title}
                className="group flex w-full items-center justify-between rounded-sm border border-border p-3 text-left transition-all hover:border-primary/40 hover:bg-secondary/60 cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 items-center justify-center rounded-sm ${action.colorClass}`}>
                    <Database size={18} weight="bold" />
                  </div>
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {action.title}
                  </span>
                </div>
                <CaretRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" weight="bold" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
