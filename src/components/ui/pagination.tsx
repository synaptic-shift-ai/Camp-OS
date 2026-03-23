"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DEFAULT_WINDOW = 2

function getPageItems(
  currentPage: number,
  totalPages: number,
  windowSize: number
): (number | "ellipsis")[] {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [1]

  const rangeStart = Math.max(1, currentPage - windowSize)
  const rangeEnd = Math.min(totalPages, currentPage + windowSize)
  const items: (number | "ellipsis")[] = []

  if (rangeStart > 1) {
    items.push(1)
    if (rangeStart > 2) items.push("ellipsis")
  }
  for (let p = rangeStart; p <= rangeEnd; p++) {
    items.push(p)
  }
  if (rangeEnd < totalPages) {
    if (rangeEnd < totalPages - 1) items.push("ellipsis")
    items.push(totalPages)
  }
  return items
}

export type PaginationProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  disabled?: boolean
  windowSize?: number
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled = false,
  windowSize = DEFAULT_WINDOW,
  className,
}: PaginationProps) {
  const pageItems = getPageItems(currentPage, totalPages, windowSize)
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn("flex items-center gap-1", className)}
    >
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(1)}
        disabled={!canPrev || disabled}
        aria-label="First page"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canPrev || disabled}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1 px-1">
        {pageItems.map((item, i) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
              aria-hidden
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={currentPage === item ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 min-w-8 text-xs"
              onClick={() => onPageChange(item)}
              disabled={disabled}
              aria-label={`Page ${item}`}
              aria-current={currentPage === item ? "page" : undefined}
            >
              {item}
            </Button>
          )
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canNext || disabled}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(totalPages)}
        disabled={!canNext || disabled}
        aria-label="Last page"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}
