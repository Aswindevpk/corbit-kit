import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/features/auth"

/** Redirects to /login until a session resolves. Add permission checks here once there's a backend. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}
