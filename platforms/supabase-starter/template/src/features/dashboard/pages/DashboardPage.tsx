import { useAuth } from "@/features/auth"
import { DashboardView } from "../views/DashboardView"

export function DashboardPage() {
  const { user } = useAuth()
  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0]
  return <DashboardView userName={userName} />
}
