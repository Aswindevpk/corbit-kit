import type { ReactNode } from "react"

export type RowAction<T> = {
  label: string
  icon?: ReactNode
  onSelect: (row: T) => void
  destructive?: boolean
  /** Hide the action based on row state (e.g. "Restore" only for archived rows). */
  hidden?: (row: T) => boolean
}
