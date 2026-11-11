import { Outlet } from "react-router-dom"
import { Navbar } from "@/components/layout/Navbar"
import { AppSidebar } from "@/components/layout/Sidebar"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

export function AppShell() {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={true}>
        <div className="min-h-screen w-full flex bg-background text-foreground font-sans selection:bg-primary-light selection:text-primary">
          <AppSidebar />
          <SidebarInset className="flex flex-col min-w-0 bg-background">
            <Navbar />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default AppShell
