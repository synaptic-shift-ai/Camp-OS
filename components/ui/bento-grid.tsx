"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

interface BentoGridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  title?: string
  description?: string
  icon?: React.ReactNode
}

function BentoGridComponent({ children, className, ...props }: BentoGridProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)} {...props}>
      {children}
    </div>
  )
}

function BentoGridItem({ children, className, title, description, icon, ...props }: BentoGridItemProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-6", className)} {...props}>
      {icon && <div className="mb-4">{icon}</div>}
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
      {children}
    </div>
  )
}

export const BentoGrid = Object.assign(BentoGridComponent, {
  Item: BentoGridItem,
})
