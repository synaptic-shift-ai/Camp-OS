"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LayoutGrid, List } from "lucide-react"

type ReservationsViewSwitcherProps = {
  view: "list" | "timeline"
  listHref: string
  timelineHref: string
}

export function ReservationsViewSwitcher({ view, listHref, timelineHref }: ReservationsViewSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-end">
      <div className="relative inline-flex items-center rounded-md border border-border/80 bg-card/50 p-1">
        {isPending ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (isPending || view === "list") return
            startTransition(() => router.push(listHref))
          }}
          disabled={isPending}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            view === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
            isPending ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <List className="h-4 w-4" />
          List
        </button>

        <button
          type="button"
          onClick={() => {
            if (isPending || view === "timeline") return
            startTransition(() => router.push(timelineHref))
          }}
          disabled={isPending}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            view === "timeline"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/60",
            isPending ? "pointer-events-none opacity-60" : "",
          ].join(" ")}
        >
          <LayoutGrid className="h-4 w-4" />
          Timeline
        </button>
      </div>
    </div>
  )
}

