import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive/15 text-destructive font-semibold",
        outline:
          "border border-border text-foreground",
        ghost:
          "hover:bg-muted text-muted-foreground",
        link:
          "text-primary underline-offset-4 hover:underline",
        success:
          "bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
        primary:
          "bg-primary-light text-primary border border-primary-border/60 font-semibold",
        warning:
          "bg-amber-50 text-amber-600 border border-amber-100 font-semibold dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
        purple:
          "bg-purple-50 text-purple-600 border border-purple-100 font-semibold dark:bg-purple-950/40 dark:text-purple-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
