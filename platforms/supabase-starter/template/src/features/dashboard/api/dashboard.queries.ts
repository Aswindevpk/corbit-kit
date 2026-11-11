import { useQuery } from "@tanstack/react-query"
import type { DashboardStats } from "../types/dashboard"

/**
 * DUMMY DATA. This hook is written exactly like a real query hook (same
 * signature, same react-query usage, same return shape) so that once a real
 * `dashboard_stats` RPC/table exists, only the body below changes — nothing
 * that calls useDashboardStats() needs to.
 *
 *   queryFn: async () => {
 *     const { data, error } = await supabase.rpc('get_dashboard_stats')
 *     if (error) throw new AppError('UNKNOWN', { detail: error.message })
 *     return data as DashboardStats
 *   }
 */
const DUMMY_STATS: DashboardStats = {
  greeting: { subtitle: "Here's what's happening across your workspace today." },
  stats: [
    { title: "Total Users", value: "1,284", change: "+12% this month" },
    { title: "Active Records", value: "356", change: "+4% this month" },
    { title: "Revenue", value: "$18.2k", change: "+8% this month" },
    { title: "Open Items", value: "27", change: "-3% this month" },
  ],
  chart: {
    title: "Activity overview",
    periods: [
      { key: "month", label: "Month" },
      { key: "3months", label: "3M" },
      { key: "6months", label: "6M" },
    ],
    points: {
      month: [
        { label: "Week 1", value: 120 },
        { label: "Week 2", value: 280 },
        { label: "Week 3", value: 450 },
        { label: "Week 4", value: 680 },
      ],
      "3months": [
        { label: "Month 1", value: 250 },
        { label: "Month 2", value: 600 },
        { label: "Month 3", value: 850 },
      ],
      "6months": [
        { label: "M1", value: 150 },
        { label: "M2", value: 300 },
        { label: "M3", value: 500 },
        { label: "M4", value: 650 },
        { label: "M5", value: 850 },
        { label: "M6", value: 1200 },
      ],
    },
  },
  quickActions: [
    { title: "Add a record", actionKey: "add-record", colorClass: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" },
    { title: "Invite a teammate", actionKey: "invite", colorClass: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" },
    { title: "View reports", actionKey: "reports", colorClass: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400" },
  ],
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"] as const,
    queryFn: async (): Promise<DashboardStats> => DUMMY_STATS,
    staleTime: Infinity,
  })
}
