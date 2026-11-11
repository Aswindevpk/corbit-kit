import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { House, Gear, CaretDown, type Icon } from "@phosphor-icons/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

/* ==========================================================================
   SIDEBAR DUMMY DATA
   ========================================================================== */

interface SubItem {
  id: string
  label: string
  badge?: string | number
}

interface NavItem {
  id: string
  label: string
  icon: Icon
  badge?: string | number
  children?: SubItem[]
  defaultOpen?: boolean
}

interface NavSection {
  id: string
  title: string
  items: NavItem[]
}

// Replace with the real brand name once known (Phase 3 of the workflow).
const BRAND_DATA = {
  name: "Your App",
  subtitle: "Dashboard",
  logoText: "YA",
}

// Add one NavItem per feature as it's built. See AGENTS.md for the convention.
const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    title: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: House,
      },
    ],
  },
]

const FOOTER_ITEMS: NavItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: Gear,
  },
]

/* ==========================================================================
   SIMPLE & CLEAN SIDEBAR COMPONENT
   ========================================================================== */

interface SidebarProps {
  activeKey?: string
  onSelect?: (key: string) => void
}

export function AppSidebar({ activeKey: propActiveKey, onSelect }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const currentPathKey =
    location.pathname === "/"
      ? "dashboard"
      : location.pathname.replace(/^\//, "").split("/")[0]

  const activeKey = propActiveKey ?? currentPathKey

  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({})

  const toggleDropdown = (id: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleSelect = (key: string) => {
    if (onSelect) {
      onSelect(key)
    } else {
      navigate(key === "dashboard" ? "/" : `/${key}`)
    }
  }

  return (
    <Sidebar className="border-r border-border bg-card w-64">
      {/* 1. Header with clean centered Brand Logo & Title */}
      <SidebarHeader className="pt-6 pb-4 px-4 flex flex-col items-center text-center border-b border-border/50">
        <div className="flex size-11 items-center justify-center rounded-sm bg-primary text-primary-foreground font-bold text-base shadow-xs">
          {BRAND_DATA.logoText}
        </div>
        <div className="mt-2.5">
          <h2 className="font-bold text-sm tracking-wider uppercase text-foreground">
            {BRAND_DATA.name}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{BRAND_DATA.subtitle}</p>
        </div>
      </SidebarHeader>

      {/* 2. Navigation Content with Left Indicator on Active Items */}
      <SidebarContent className="px-2 py-3 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.id} className="p-0">
            <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3.5 h-7 mb-1">
              {section.title}
            </SidebarGroupLabel>

            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {section.items.map((item) => {
                  const hasChildren = item.children && item.children.length > 0
                  const isOpen = !!openDropdowns[item.id]
                  const isChildActive = hasChildren && item.children?.some((child) => child.id === activeKey)
                  const isDirectActive = activeKey === item.id

                  if (hasChildren) {
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={isChildActive}
                          onClick={() => toggleDropdown(item.id)}
                          className={`relative cursor-pointer rounded-sm px-3.5 transition-colors ${
                            isChildActive
                              ? "bg-secondary text-foreground font-bold"
                              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                          }`}
                        >
                          {isChildActive && (
                            <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-sm bg-primary" />
                          )}
                          <item.icon
                            weight={isChildActive ? "fill" : "regular"}
                            className="size-5 shrink-0"
                          />
                          <span>{item.label}</span>
                          <CaretDown
                            className={`ml-auto size-4 transition-transform duration-200 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        </SidebarMenuButton>

                        {isOpen && (
                          <SidebarMenuSub className="ml-3.5 my-1 space-y-1 pl-3 border-l border-border/60">
                            {item.children?.map((subItem) => {
                              const isSubActive = activeKey === subItem.id
                              return (
                                <SidebarMenuSubItem key={subItem.id}>
                                  <SidebarMenuSubButton
                                    isActive={isSubActive}
                                    onClick={() => handleSelect(subItem.id)}
                                    className={`cursor-pointer rounded-sm px-3 transition-colors ${
                                      isSubActive
                                        ? "bg-primary/10 text-primary font-semibold"
                                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                                    }`}
                                  >
                                    <span>{subItem.label}</span>
                                    {subItem.badge && (
                                      <span className="ml-auto text-xs font-medium text-muted-foreground">
                                        {subItem.badge}
                                      </span>
                                    )}
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              )
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    )
                  }

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={isDirectActive}
                        onClick={() => handleSelect(item.id)}
                        className={`relative cursor-pointer rounded-sm px-3.5 transition-colors ${
                          isDirectActive
                            ? "bg-secondary text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                        }`}
                      >
                        {isDirectActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-sm bg-primary" />
                        )}
                        <item.icon
                          weight={isDirectActive ? "fill" : "regular"}
                          className="size-5 shrink-0"
                        />
                        <span>{item.label}</span>
                        {item.badge && (
                          <SidebarMenuBadge className="text-xs font-medium">
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* 3. Bottom Section for Settings & Help with clean separator */}
      <SidebarFooter className="border-t border-border/60 p-2">
        <SidebarMenu className="gap-1">
          {FOOTER_ITEMS.map((item) => {
            const isItemActive = activeKey === item.id
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={isItemActive}
                  onClick={() => handleSelect(item.id)}
                  className={`relative cursor-pointer rounded-sm px-3.5 transition-colors ${
                    isItemActive
                      ? "bg-secondary text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  }`}
                >
                  {isItemActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-sm bg-primary" />
                  )}
                  <item.icon
                    weight={isItemActive ? "fill" : "regular"}
                    className="size-5 shrink-0"
                  />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
