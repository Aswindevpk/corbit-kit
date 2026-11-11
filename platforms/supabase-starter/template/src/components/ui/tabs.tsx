import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextType {
  value: string
  onValueChange: (value: string) => void
  variant?: "underline" | "pills" | "default" | "line"
}

const TabsContext = React.createContext<TabsContextType | null>(null)

function useTabs() {
  const context = React.useContext(TabsContext)
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider")
  }
  return context
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  variant?: "underline" | "pills" | "default" | "line"
  orientation?: "horizontal" | "vertical"
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  variant = "underline",
  className,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || "")
  const value = controlledValue !== undefined ? controlledValue : internalValue

  const handleValueChange = (val: string) => {
    if (controlledValue === undefined) {
      setInternalValue(val)
    }
    onValueChange?.(val)
  }

  return (
    <TabsContext.Provider
      value={{ value, onValueChange: handleValueChange, variant }}
    >
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "underline" | "pills" | "default" | "line"
}

export function TabsList({ className, variant: propVariant, ...props }: TabsListProps) {
  const context = useTabs()
  const variant = propVariant || context.variant

  return (
    <div
      className={cn(
        variant === "pills"
          ? "inline-flex items-center gap-1 bg-secondary/80 p-1 rounded-xl"
          : "flex items-center border-b border-border gap-8 overflow-x-auto",
        className
      )}
      {...props}
    />
  )
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const { value: activeValue, onValueChange, variant } = useTabs()
  const isActive = activeValue === value

  if (variant === "pills") {
    return (
      <button
        type="button"
        onClick={() => onValueChange(value)}
        className={cn(
          "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
          isActive
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-white/60",
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onValueChange(value)}
      className={cn(
        "relative pb-3 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
        isActive
          ? "text-primary font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value: activeValue } = useTabs()
  if (activeValue !== value) return null

  return (
    <div className={cn("mt-4 focus-visible:outline-none", className)} {...props}>
      {children}
    </div>
  )
}
