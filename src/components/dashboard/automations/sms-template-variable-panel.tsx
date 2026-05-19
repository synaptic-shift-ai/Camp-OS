"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { VARIABLE_GROUPS } from "@/lib/email/variable-definitions"
import { Braces, Search } from "lucide-react"
import { cn } from "@/lib/utils"

type SmsTemplateVariablePanelProps = {
  onInsert: (path: string) => void
  onAfterInsert?: () => void
  className?: string
}

export function SmsTemplateVariablePanel({
  onInsert,
  onAfterInsert,
  className,
}: SmsTemplateVariablePanelProps) {
  const [search, setSearch] = useState("")
  const panelRef = useRef<HTMLDivElement>(null)
  const [twoColumns, setTwoColumns] = useState(false)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return

    const TWO_COLUMN_MIN_WIDTH_PX = 500
    const update = (width: number) => {
      setTwoColumns(width >= TWO_COLUMN_MIN_WIDTH_PX)
    }

    update(el.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width =
        entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width
      update(width)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return VARIABLE_GROUPS

    return VARIABLE_GROUPS.map((group) => ({
      ...group,
      variables: group.variables.filter(
        (v) =>
          v.path.toLowerCase().includes(q) ||
          v.label.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q)
      ),
    })).filter((group) => group.variables.length > 0)
  }, [search])

  return (
    <TooltipProvider delayDuration={700} skipDelayDuration={200}>
      <div
        ref={panelRef}
        className={cn("flex h-full w-full flex-col bg-background", className)}
      >
        <div className="w-full shrink-0 space-y-2 border-b px-4 py-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Braces className="h-4 w-4 text-muted-foreground" />
              Available Variables
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click to copy · Double-click to insert into body
            </p>
          </div>
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search variables…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full border-border/80 bg-muted/30 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto p-3">
          {filteredGroups.length === 0 ? (
            <div className="flex w-full flex-1 items-center justify-center px-4 py-12">
              <p className="w-full text-center text-sm text-muted-foreground">
                No variables match your search.
              </p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {filteredGroups.map((group) => (
                <section
                  key={group.prefix}
                  className="rounded-lg bg-muted/50 p-3 dark:bg-muted/30"
                >
                  <h3 className="mb-2 text-xs font-medium text-foreground">
                    {group.label}
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      ({group.variables.length})
                    </span>
                  </h3>
                  <div
                    className={cn(
                      "grid min-w-0 gap-1.5",
                      twoColumns ? "grid-cols-2" : "grid-cols-1"
                    )}
                  >
                    {group.variables.map((v) => {
                      const token = `{{${v.path}}}`
                      return (
                        <Tooltip key={v.path}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "w-full min-w-0 rounded-[5px] border border-border/70 bg-background px-2.5 py-1.5",
                                "text-left text-[11px] font-mono leading-none text-foreground/90",
                                "whitespace-nowrap shadow-sm transition-colors",
                                twoColumns && "truncate",
                                "hover:border-primary/40 hover:bg-primary/5 hover:shadow",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                                "cursor-pointer select-none"
                              )}
                              onClick={() => {
                                onInsert(v.path)
                                onAfterInsert?.()
                              }}
                            >
                              {token}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            sideOffset={6}
                            className="max-w-xs space-y-1 border border-border bg-popover px-3 py-2 text-left text-popover-foreground shadow-md"
                          >
                            <p className="break-all font-mono text-xs text-foreground">
                              {token}
                            </p>
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              {v.label}: {v.description}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
