import { createBrowserRouter } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "./guards"
import { LoginPage } from "@/features/auth"
import { DashboardPage } from "@/features/dashboard"
import { NotFoundPage } from "@/pages/NotFound"

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      // Add each new feature's page here, e.g.:
      // { path: '[feature]', element: <FeaturePage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])
