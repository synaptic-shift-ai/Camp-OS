"use client"

import { useEffect, useRef, useState } from "react"
import type { DashboardReservation } from "@/lib/dashboard/queries"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  capitalizeWordsPreserveSpacing,
  formatMoney,
  formatShortDate,
  getFirstLastInitials,
  getStatusLabel,
} from "@/lib/utils"

export type ReservationStatusStyle = {
  bg: string
  border: string
  text: string
  pillBg: string
  pillText: string
}

type ReservationBlockProps = {
  reservation: DashboardReservation
  lane: number
  leftPx: number
  widthPx: number
  topPx: number
  heightPx: number
  styleForStatus: ReservationStatusStyle
  onOpenDialog: (reservation: DashboardReservation) => void
  onDragStartReservation: (reservation: DashboardReservation) => void
  onDragEndReservation: () => void
  isDraggingReservation: boolean
  columnWidthPx: number
}

export function ReservationBlock({
  reservation,
  lane,
  leftPx,
  widthPx,
  topPx,
  heightPx,
  styleForStatus,
  onOpenDialog,
  onDragStartReservation,
  onDragEndReservation,
  isDraggingReservation,
  columnWidthPx,
}: ReservationBlockProps) {
  const [open, setOpen] = useState(false)
  const [isThisBlockDragging, setIsThisBlockDragging] = useState(false)
  const [isPointerArmedForDrag, setIsPointerArmedForDrag] = useState(false)
  const prevBodyCursorRef = useRef<string>("")

  const minBlockWidth = Math.max(16, Math.min(80, columnWidthPx - 6))
  const actualWidth = Math.max(minBlockWidth, widthPx)
  const guestName = capitalizeWordsPreserveSpacing(reservation.guestName)
  const compactGuestName = getFirstLastInitials(reservation.guestName)
  const displayName = actualWidth < 72 ? compactGuestName : guestName

  const applyGlobalDragCursor = () => {
    document.body.style.setProperty("cursor", "grabbing", "important")
    document.documentElement.style.setProperty("cursor", "grabbing", "important")
  }

  const restoreGlobalDragCursor = () => {
    document.body.style.cursor = prevBodyCursorRef.current
    document.documentElement.style.removeProperty("cursor")
  }

  // Restore body cursor if unmounted while dragging
  useEffect(() => {
    return () => {
      if (isThisBlockDragging || isPointerArmedForDrag) {
        restoreGlobalDragCursor()
      }
    }
  }, [isThisBlockDragging, isPointerArmedForDrag])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={[
            "absolute transition-opacity",
            isThisBlockDragging || isPointerArmedForDrag ? "cursor-grabbing opacity-50" : "cursor-grab",
          ].join(" ")}
          draggable
          style={{
            left: leftPx,
            top: topPx,
            width: actualWidth,
            height: heightPx,
            zIndex: lane + 1,
          }}
          title={`${guestName} • ${reservation.checkIn} to ${reservation.checkOut}`}
          onPointerDown={() => {
            // Set cursor immediately on press so users see drag state without delay.
            setIsPointerArmedForDrag(true)
            prevBodyCursorRef.current = document.body.style.cursor
            applyGlobalDragCursor()
          }}
          onPointerUp={() => {
            if (!isThisBlockDragging) {
              setIsPointerArmedForDrag(false)
              restoreGlobalDragCursor()
            }
          }}
          onClick={() => {
            setOpen(false)
            onOpenDialog(reservation)
          }}
          onDragStart={() => {
            setOpen(false)
            setIsPointerArmedForDrag(false)
            setIsThisBlockDragging(true)
            applyGlobalDragCursor()
            onDragStartReservation(reservation)
          }}
          onDragEnd={() => {
            setIsPointerArmedForDrag(false)
            setIsThisBlockDragging(false)
            restoreGlobalDragCursor()
            onDragEndReservation()
          }}
          onPointerEnter={() => {
            if (!isDraggingReservation) setOpen(true)
          }}
          onPointerLeave={() => {
            setOpen(false)
          }}
        >
          <div
            className={[
              "flex h-full w-full items-center overflow-hidden rounded-sm border px-2 transition-all",
              isThisBlockDragging || isPointerArmedForDrag
                ? [styleForStatus.bg, styleForStatus.border, styleForStatus.text, "border-2 border-dashed ring-1 ring-border/60"].join(" ")
                : [styleForStatus.bg, styleForStatus.border, styleForStatus.text].join(" "),
            ].join(" ")}
          >
            <p className="min-w-0 truncate text-[13px] font-semibold">{displayName}</p>
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-3 bg-card text-foreground border border-border/80 shadow-md rounded-md outline-none"
        align="center"
        sideOffset={4}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(false)
          onOpenDialog(reservation)
        }}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{guestName}</p>
              <p className="mt-0.5 truncate text-xs font-semibold uppercase tracking-wide opacity-80">
                {reservation.confirmationNumber}
              </p>
            </div>
            <span
              className={[
                "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                styleForStatus.pillBg,
                styleForStatus.pillText,
              ].join(" ")}
            >
              {getStatusLabel(reservation.status)}
            </span>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Site: {reservation.siteName}
              {reservation.siteNumber ? ` (#${reservation.siteNumber})` : ""}
            </div>
            <div>
              {formatShortDate(reservation.checkIn)} - {formatShortDate(reservation.checkOut)}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Paid</span>
              <span className="font-medium text-foreground">{formatMoney(reservation.paidAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Balance</span>
              <span className="font-medium text-foreground">
                {formatMoney(Math.max(0, reservation.totalAmount - reservation.paidAmount))}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
