"use client"

import type React from "react"
import { cn } from "@/lib/utils"

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function TiltCard({ children, className, ...props }: TiltCardProps) {
  return (
    <div className={cn("transition-transform hover:scale-105", className)} {...props}>
      {children}
    </div>
  )
}
