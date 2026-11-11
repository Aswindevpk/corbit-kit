import { useNavigate } from "react-router-dom"
import { Bell, SignOut, User as UserIcon, Gear, CaretDown } from "@phosphor-icons/react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth, useSignOut } from "@/features/auth"

const DEFAULT_USER = {
  name: "User",
  email: "",
  role: "Member",
  avatarUrl: "",
  initials: "U",
}

interface NavbarProps {
  currentViewTitle?: string
}

export function Navbar({ currentViewTitle = "Dashboard" }: NavbarProps) {
  const { user } = useAuth()
  const { mutate: signOut } = useSignOut()
  const navigate = useNavigate()

  const currentUser = user
    ? {
        name: user.user_metadata?.full_name || user.email?.split("@")[0] || DEFAULT_USER.name,
        email: user.email || DEFAULT_USER.email,
        role: "Member",
        avatarUrl: user.user_metadata?.avatar_url || "",
        initials: (user.email?.[0] || "U").toUpperCase(),
      }
    : DEFAULT_USER

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="size-9 rounded-sm hover:bg-secondary cursor-pointer transition-colors" />
        <Separator orientation="vertical" className="h-4 bg-border" />
        <span className="text-sm font-semibold tracking-tight text-foreground">{currentViewTitle}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative size-9 rounded-sm hover:bg-secondary cursor-pointer transition-colors">
          <Bell className="size-5 text-muted-foreground" />
          <span className="sr-only">Toggle notifications</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="h-10 flex items-center gap-2.5 px-3 rounded-sm hover:bg-secondary cursor-pointer transition-colors outline-none select-none">
            <Avatar className="size-7 rounded-sm after:rounded-sm">
              <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} className="rounded-sm" />
              <AvatarFallback className="rounded-sm bg-primary/10 text-primary font-semibold text-xs">
                {currentUser.initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left leading-tight md:block">
              <div className="text-sm font-semibold text-foreground truncate">{currentUser.name}</div>
              <div className="text-xs text-muted-foreground truncate">{currentUser.role}</div>
            </div>
            <CaretDown className="size-3.5 text-muted-foreground ml-1 hidden md:block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-56 rounded-sm p-1.5 shadow-md border-border" align="end">
            <DropdownMenuLabel className="font-normal px-3 py-2">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-semibold leading-none text-foreground">{currentUser.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{currentUser.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1 bg-border" />
            <DropdownMenuItem className="rounded-sm px-3 py-2 text-sm cursor-pointer">
              <UserIcon className="mr-2 size-4 text-muted-foreground" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="rounded-sm px-3 py-2 text-sm cursor-pointer">
              <Gear className="mr-2 size-4 text-muted-foreground" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1 bg-border" />
            <DropdownMenuItem
              variant="destructive"
              className="rounded-sm px-3 py-2 text-sm cursor-pointer"
              onClick={() => signOut(undefined, { onSuccess: () => navigate("/login", { replace: true }) })}
            >
              <SignOut className="mr-2 size-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
