"use client"

import { useState, useRef, useCallback } from "react"
import type { ConditionGroupNode, ConditionNode } from "@/lib/automations/condition-tree"
import type { ConditionOperator } from "@/lib/automations/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================================================
// Constants
// ============================================================================

const VARIABLE_LABELS: Record<string, string> = {
  "reservation.status": "Status",
  "reservation.risk_score": "Risk Score",
  "reservation.lead_time_hours": "Lead Time (hours)",
  "reservation.lead_time_days": "Lead Time (days)",
  "reservation.has_overlap": "Has Overlap",
  "reservation.duration_nights": "Duration (nights)",
  "reservation.total_value": "Total Value",
  "reservation.is_new_guest": "Is New Guest",
  "reservation.has_pets": "Has Pets",
  "reservation.is_holiday_period": "Is Holiday Period",
  "reservation.includes_friday": "Includes Friday",
  "reservation.includes_saturday": "Includes Saturday",
  "reservation.is_peak_season": "Is Peak Season",
  "reservation.site_count": "Site Count",
  "reservation.check_in_date": "Check-in Date",
  "reservation.check_out_date": "Check-out Date",
  "reservation.num_guests": "Number of Guests",
  "reservation.num_pets": "Number of Pets",
  "guest.is_blacklisted": "Is Blacklisted",
  "guest.is_returning": "Is Returning Guest",
  "guest.previous_stays": "Previous Stays",
  "guest.tier": "Guest Tier",
  "guest.email": "Email",
  "guest.first_name": "First Name",
  "guest.last_name": "Last Name",
  "guest.phone": "Phone",
  "property.requires_waiver": "Requires Waiver",
  "property.name": "Property Name",
  "property.timezone": "Timezone",
  "site.status": "Site Status",
  "site.type": "Site Type",
  "site.name": "Site Name",
  "payment.amount": "Amount",
  "payment.method": "Payment Method",
  "payment.status": "Payment Status",
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  IS: "is",
  IS_NOT: "is not",
  GT: ">",
  LT: "<",
  GTE: "≥",
  LTE: "≤",
  BETWEEN: "between",
  BEFORE: "before",
  AFTER: "after",
  WITHIN_DATE_GROUP: "within",
  CONTAINS: "contains",
  NOT_CONTAINS: "does not contain",
  IS_TRUE: "is true",
  IS_FALSE: "is false",
}

// ============================================================================
// Component
// ============================================================================

type ConditionsPreviewProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  groups: ConditionGroupNode[]
}

export function ConditionsPreview({ open, onOpenChange, groups }: ConditionsPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Pan state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 500 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const viewBoxStart = useRef({ x: 0, y: 0 })

  const diagramW = 800
  const diagramH = groups.length === 0 ? 300 : Math.max(groups.length * 130 + 260, 440)

  // Reset view when opening
  const handleOpenChange = useCallback((v: boolean) => {
    if (v) {
      setViewBox({ x: 0, y: 0, w: diagramW, h: diagramH })
    }
    onOpenChange(v)
  }, [diagramW, diagramH, onOpenChange])

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isPanning.current = true
    panStart.current = { x: e.clientX, y: e.clientY }
    viewBoxStart.current = { x: viewBox.x, y: viewBox.y }
  }, [viewBox.x, viewBox.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = (e.clientX - panStart.current.x) * (viewBox.w / (containerRef.current?.clientWidth ?? 800))
    const dy = (e.clientY - panStart.current.y) * (viewBox.h / (containerRef.current?.clientHeight ?? 500))
    setViewBox(prev => ({
      ...prev,
      x: Math.max(-200, Math.min(200, viewBoxStart.current.x - dx)),
      y: Math.max(-100, Math.min(200, viewBoxStart.current.y - dy)),
    }))
  }, [viewBox.w, viewBox.h])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // Zoom
  const zoom = useCallback((direction: 1 | -1) => {
    setViewBox(prev => {
      const factor = direction === 1 ? 0.8 : 1.25
      const newW = Math.max(300, Math.min(2000, prev.w * factor))
      const newH = Math.max(200, Math.min(1400, prev.h * factor))
      const dw = (newW - prev.w) / 2
      const dh = (newH - prev.h) / 2
      return { x: prev.x - dw, y: prev.y - dh, w: newW, h: newH }
    })
  }, [])

  const resetView = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: diagramW, h: diagramH })
  }, [diagramW, diagramH])

  const zoomPercent = Math.round((diagramW / viewBox.w) * 100)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent wide className="h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Condition Flow Diagram</DialogTitle>
            <div className="flex items-center gap-1 mr-8">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => zoom(-1)} title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center font-mono">{zoomPercent}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => zoom(1)} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetView} title="Fit to view">
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {groups.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12 h-full flex items-center justify-center">
              No conditions defined. This automation will always execute when triggered.
            </div>
          ) : (
            <div
              ref={containerRef}
              className={cn(
                "w-full h-full cursor-grab active:cursor-grabbing select-none",
                "bg-muted/30"
              )}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <svg
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                className="w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                onWheel={(e) => {
                  e.preventDefault()
                  zoom(e.deltaY > 0 ? -1 : 1)
                }}
              >
                <defs>
                  <pattern id="dotgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="0.5" fill="currentColor" className="text-muted-foreground/15" />
                  </pattern>
                  <marker id="arrowDown" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <path d="M1,1 L4,6 L7,1" className="stroke-muted-foreground/50 fill-none" strokeWidth={1.5} />
                  </marker>
                </defs>
                <rect x={-200} y={-100} width={diagramW + 400} height={diagramH + 200} fill="url(#dotgrid)" />

                {/* IF diamond */}
                <FlowDiamond x={400} y={40} />
                <DownArrow x={400} y1={66} y2={88} />

                {/* Groups */}
                {groups.length === 1 ? (
                  <GroupDiagram group={groups[0]!} cx={400} y={95} />
                ) : (
                  <MultiGroupLayout groups={groups} baseY={95} />
                )}

                {/* THEN node */}
                <ThenNode x={400} y={diagramH - 40} />
                <DownArrow x={400} y1={diagramH - 65} y2={diagramH - 55} />
              </svg>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// SVG Primitives
// ============================================================================

function DownArrow({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <line x1={x} y1={y1} x2={x} y2={y2} className="stroke-muted-foreground/40" strokeWidth={1.5} markerEnd="url(#arrowDown)" />
  )
}

function FlowDiamond({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <polygon
        points={`${x},${y - 26} ${x + 52},${y} ${x},${y + 26} ${x - 52},${y}`}
        className="fill-blue-100 dark:fill-blue-900/40 stroke-blue-300 dark:stroke-blue-700"
        strokeWidth={1.5}
      />
      <text x={x} y={y + 5} textAnchor="middle" className="fill-blue-700 dark:fill-blue-300" fontSize={14} fontWeight={700}>IF</text>
    </g>
  )
}

function ThenNode({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 100} y={y - 20} width={200} height={40} rx={8}
        className="fill-green-100 dark:fill-green-900/30 stroke-green-300 dark:stroke-green-700" strokeWidth={1.5} />
      <text x={x - 25} y={y + 5} textAnchor="middle" className="fill-green-700 dark:fill-green-400" fontSize={14} fontWeight={700}>THEN</text>
      <text x={x + 45} y={y + 5} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>run actions</text>
    </g>
  )
}

// ============================================================================
// Multi-Group Layout
// ============================================================================

function MultiGroupLayout({ groups, baseY }: { groups: ConditionGroupNode[]; baseY: number }) {
  const totalWidth = Math.min(groups.length * 220, 720)
  const startX = 400 - totalWidth / 2
  const step = groups.length > 1 ? totalWidth / (groups.length - 1) : 0
  const midY = baseY - 6

  return (
    <g>
      <line x1={400} y1={88} x2={400} y2={midY} className="stroke-muted-foreground/40" strokeWidth={1.5} />
      <line x1={startX} y1={midY} x2={startX + totalWidth} y2={midY} className="stroke-muted-foreground/40" strokeWidth={1.5} />
      {groups.map((_, i) => {
        const cx = startX + step * i
        return <line key={i} x1={cx} y1={midY} x2={cx} y2={baseY} className="stroke-muted-foreground/40" strokeWidth={1.5} markerEnd="url(#arrowDown)" />
      })}
      {groups.map((_, i) => {
        if (i === 0) return null
        const prevCx = startX + step * (i - 1)
        const cx = startX + step * i
        const mid = (prevCx + cx) / 2
        return (
          <g key={`and-${i}`}>
            <rect x={mid - 18} y={baseY - 18} width={36} height={20} rx={4}
              className="fill-blue-100 dark:fill-blue-900/50 stroke-blue-200 dark:stroke-blue-800" strokeWidth={1} />
            <text x={mid} y={baseY - 4} textAnchor="middle" className="fill-blue-600 dark:fill-blue-400" fontSize={11} fontWeight={700}>AND</text>
          </g>
        )
      })}
      {groups.map((group, i) => (
        <GroupDiagram key={group.id} group={group} cx={startX + step * i} y={baseY + 4} />
      ))}
    </g>
  )
}

// ============================================================================
// Group Diagram Box
// ============================================================================

function GroupDiagram({ group, cx, y }: { group: ConditionGroupNode; cx: number; y: number }) {
  const isOr = group.logicOperator === "OR"
  const allItems: Array<{ id: string; type: "condition"; data: ConditionNode } | { id: string; type: "nested"; data: ConditionGroupNode }> = [
    ...group.conditions.map(c => ({ id: c.id, type: "condition" as const, data: c })),
    ...group.children.map(g => ({ id: g.id, type: "nested" as const, data: g })),
  ]
  const boxW = 200
  const boxH = 38 + allItems.length * 22
  const boxX = cx - boxW / 2
  const borderColor = isOr ? "stroke-amber-300 dark:stroke-amber-800" : "stroke-blue-300 dark:stroke-blue-800"
  const bgColor = isOr ? "fill-amber-50/80 dark:fill-amber-950/20" : "fill-blue-50/80 dark:fill-blue-950/20"
  const badgeBg = isOr ? "fill-amber-200 dark:fill-amber-800" : "fill-blue-200 dark:fill-blue-800"
  const badgeFg = isOr ? "fill-amber-800 dark:fill-amber-200" : "fill-blue-800 dark:fill-blue-200"

  return (
    <g>
      <rect x={boxX} y={y} width={boxW} height={boxH} rx={8} className={cn(borderColor, bgColor)} strokeWidth={1.5} />
      <rect x={boxX + 8} y={y + 8} width={36} height={20} rx={4} className={badgeBg} />
      <text x={boxX + 26} y={y + 22} textAnchor="middle" className={badgeFg} fontSize={11} fontWeight={700}>{group.logicOperator}</text>
      <text x={boxX + 52} y={y + 22} className="fill-muted-foreground" fontSize={10}>{allItems.length} item{allItems.length !== 1 ? "s" : ""}</text>

      {allItems.length > 0 && (
        <line x1={boxX + 14} y1={y + 32} x2={boxX + 14} y2={y + boxH - 6} className="stroke-border" strokeWidth={1} strokeDasharray="3,2" />
      )}

      {allItems.map((item, idx) => {
        const iy = y + 38 + idx * 22
        const connector = <line key={`line-${item.id}`} x1={boxX + 6} y1={iy + 8} x2={boxX + 14} y2={iy + 8} className="stroke-border" strokeWidth={1} />
        if (item.type === "condition") {
          return (
            <g key={item.id}>
              {connector}
              <ConditionText condition={item.data} x={boxX + 18} y={iy} />
            </g>
          )
        }
        return (
          <g key={item.id}>
            {connector}
            <NestedChip group={item.data} x={boxX + 18} y={iy} />
          </g>
        )
      })}
    </g>
  )
}

// ============================================================================
// Condition Text Row
// ============================================================================

function ConditionText({ condition, x, y }: { condition: ConditionNode; x: number; y: number }) {
  const varLabel = VARIABLE_LABELS[condition.variable] ?? condition.variable.split(".").pop() ?? condition.variable
  const opLabel = OPERATOR_LABELS[condition.operator] ?? condition.operator
  const valueStr = formatValue(condition)
  const valueColor = condition.operator === "IS_TRUE"
    ? "fill-green-600 dark:fill-green-400"
    : condition.operator === "IS_FALSE"
      ? "fill-red-600 dark:fill-red-400"
      : "fill-blue-600 dark:fill-blue-400"

  return (
    <>
      <text x={x} y={y + 12} className="fill-foreground" fontSize={11} fontWeight={500}>{varLabel}</text>
      <text x={x + 72} y={y + 12} className="fill-muted-foreground" fontSize={11}>{opLabel}</text>
      <text x={x + 110} y={y + 12} className={valueColor} fontSize={11}>{valueStr}</text>
    </>
  )
}

// ============================================================================
// Nested Group Chip
// ============================================================================

function NestedChip({ group, x, y }: { group: ConditionGroupNode; x: number; y: number }) {
  const count = group.conditions.length + group.children.length
  return (
    <>
      <rect x={x} y={y + 1} width={90} height={17} rx={4} className="fill-muted stroke-border" strokeWidth={0.5} />
      <text x={x + 8} y={y + 14} className="fill-muted-foreground" fontSize={10} fontWeight={600}>{group.logicOperator}</text>
      <text x={x + 30} y={y + 14} className="fill-muted-foreground" fontSize={10}>({count} items)</text>
    </>
  )
}

// ============================================================================
// Value Formatter
// ============================================================================

function formatValue(condition: ConditionNode): string {
  const { operator, value } = condition
  if (operator === "IS_TRUE") return "true"
  if (operator === "IS_FALSE") return "false"
  if (operator === "BETWEEN" && Array.isArray(value)) return `${value[0] ?? "_"} & ${value[1] ?? "_"}`
  if (operator === "WITHIN_DATE_GROUP" && typeof value === "object" && value !== null) {
    const v = value as { startDate?: string; endDate?: string }
    return `${v.startDate ?? "?"} → ${v.endDate ?? "?"}`
  }
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}
