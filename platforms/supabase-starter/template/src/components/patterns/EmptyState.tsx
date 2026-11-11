import type { ReactNode } from "react"
import { Tray } from "@phosphor-icons/react"

/** UI-STATE-EMPTY: say what's missing and offer the action that fixes it. */
export type EmptyStateProps = { title: string; description?: string; action?: ReactNode; icon?: ReactNode }

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="text-muted-foreground">{icon ?? <Tray className="size-8" aria-hidden />}</div>
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
