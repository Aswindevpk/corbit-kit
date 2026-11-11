export type DashboardStat = { title: string; value: string; change?: string }

export type ChartPoint = { label: string; value: number }

export type DashboardStats = {
  greeting: { subtitle: string }
  stats: [DashboardStat, DashboardStat, DashboardStat, DashboardStat]
  chart: {
    title: string
    periods: { key: "month" | "3months" | "6months"; label: string }[]
    points: Record<"month" | "3months" | "6months", ChartPoint[]>
  }
  quickActions: { title: string; actionKey: string; colorClass: string }[]
}
