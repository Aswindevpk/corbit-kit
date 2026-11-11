import type { ElementType } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface KpiCardProps {
  title: string
  value: string | number
  icon: ElementType
  iconColorClass?: string
  change?: string
  changeColorClass?: string
  hoverBorderClass?: string
  className?: string
  onClick?: () => void
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  iconColorClass = "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  change,
  changeColorClass = "text-muted-foreground",
  hoverBorderClass = "hover:border-primary/40",
  className,
  onClick,
}: KpiCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn("transition-colors", hoverBorderClass, onClick && "cursor-pointer", className)}
    >
      <CardContent className="flex items-center gap-4">
        <div className={cn("flex size-13 items-center justify-center rounded-sm shrink-0", iconColorClass)}>
          <Icon size={26} weight="regular" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase truncate">{title}</p>
          <h3 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">{value}</h3>
          {change && (
            <span className={cn("text-[10px] font-medium block truncate mt-0.5", changeColorClass)}>{change}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
