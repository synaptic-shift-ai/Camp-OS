"use client"

import Link from "next/link"
import { TreePine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BookingPortalHeaderProps = {
  propertyName: string
  subtitle: string
  backHref?: string
}

export function BookingPortalHeader({
  propertyName,
  subtitle,
  backHref = "/",
}: BookingPortalHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                "bg-[#2D5A27] hover:bg-[#1e3d1a] dark:bg-emerald-800 dark:hover:bg-emerald-900"
              )}
            >
              <TreePine className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className={cn("text-xl font-bold", "text-[#2D5A27] dark:text-emerald-400")}>
                {propertyName}
              </h1>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <Button variant="ghost" asChild>
            <Link href={backHref}>Back to Home</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
