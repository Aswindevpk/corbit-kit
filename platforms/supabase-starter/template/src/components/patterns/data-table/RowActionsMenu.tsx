import { DotsThree } from "@phosphor-icons/react"
import { buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { RowAction } from "./types"

type Props<T> = { row: T; actions: RowAction<T>[]; label: string }

export function RowActionsMenu<T>({ row, actions, label }: Props<T>) {
  const visible = actions.filter((a) => !a.hidden?.(row))
  if (visible.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        aria-label={`Actions for ${label}`}
      >
        <DotsThree weight="bold" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visible.map((a) => (
          <DropdownMenuItem key={a.label} variant={a.destructive ? "destructive" : "default"} onSelect={() => a.onSelect(row)}>
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
