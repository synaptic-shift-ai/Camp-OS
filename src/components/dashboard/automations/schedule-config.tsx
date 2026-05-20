"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { evaluateCron } from "@/lib/automations/scheduler/cron-evaluator"
import type { ScheduledTriggerConfig } from "@/lib/automations/types"
import { cn } from "@/lib/utils"

// ============================================================================
// Constants
// ============================================================================

const SCHEDULE_PRESETS: Array<{ label: string; cron: string }> = [
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Daily 8am", cron: "0 8 * * *" },
  { label: "Daily 6pm", cron: "0 18 * * *" },
  { label: "Every Monday 9am", cron: "0 9 * * 1" },
  { label: "First of month", cron: "0 0 1 * *" },
  { label: "Every 5 minutes", cron: "*/5 * * * *" },
]

const TARGET_OPTIONS: Array<{ value: ScheduledTriggerConfig["target"]; label: string }> = [
  { value: "reservations", label: "Reservations" },
  { value: "guests", label: "Guests" },
  { value: "sites", label: "Sites" },
  { value: "property", label: "Property" },
]

const DATE_FIELD_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  reservations: [
    { value: "check_in_date", label: "Check-in date" },
    { value: "check_out_date", label: "Check-out date" },
    { value: "created_at", label: "Created at" },
  ],
  guests: [{ value: "created_at", label: "Created at" }],
  sites: [{ value: "created_at", label: "Created at" }],
}

const STATUS_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  reservations: [
    { value: "confirmed", label: "Confirmed" },
    { value: "checked_in", label: "Checked In" },
    { value: "checked_out", label: "Checked Out" },
    { value: "cancelled", label: "Cancelled" },
    { value: "no_show", label: "No Show" },
    { value: "pending", label: "Pending" },
  ],
  guests: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  sites: [
    { value: "available", label: "Available" },
    { value: "occupied", label: "Occupied" },
    { value: "maintenance", label: "Maintenance" },
    { value: "blocked", label: "Blocked" },
  ],
}

// ============================================================================
// Types
// ============================================================================

interface ScheduleConfigProps {
  triggerConfig: Record<string, unknown>
  onTriggerConfigChange: (config: Record<string, unknown>) => void
  propertyTimezone?: string
  propertyId?: string
}

// ============================================================================
// Helpers
// ============================================================================

function parseConfig(raw: Record<string, unknown>): {
  schedule: string
  target: ScheduledTriggerConfig["target"]
  dateField: string
  offsetDays: number
  offsetDirection: "before" | "after"
  statuses: string[]
  dedupeWindow: "hour" | "day"
} {
  const offsetRaw = typeof raw.offsetDays === "number" ? raw.offsetDays : 0
  return {
    schedule: typeof raw.schedule === "string" ? raw.schedule : "0 8 * * *",
    target: ["reservations", "guests", "sites", "property"].includes(raw.target as string)
      ? (raw.target as ScheduledTriggerConfig["target"])
      : "reservations",
    dateField: typeof raw.dateField === "string" ? raw.dateField : "",
    offsetDays: Math.abs(offsetRaw),
    offsetDirection: offsetRaw <= 0 ? "before" : "after",
    statuses: Array.isArray(raw.statuses)
      ? (raw.statuses as string[])
      : typeof raw.status === "string" && raw.status.length > 0
        ? (raw.status as string).split(",")
        : [],
    dedupeWindow: raw.dedupeWindow === "hour" ? "hour" : "day",
  }
}

function arraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

// ============================================================================
// Component
// ============================================================================

export function ScheduleConfig({
  triggerConfig,
  onTriggerConfigChange,
  propertyTimezone = "UTC",
  propertyId,
}: ScheduleConfigProps) {
  const parsed = useMemo(() => parseConfig(triggerConfig), [triggerConfig])

  const [schedule, setSchedule] = useState(parsed.schedule)
  const [target, setTarget] = useState(parsed.target)
  const [dateField, setDateField] = useState(parsed.dateField)
  const [offsetDays, setOffsetDays] = useState(parsed.offsetDays)
  const [offsetDirection, setOffsetDirection] = useState<"before" | "after">(parsed.offsetDirection)
  const [statuses, setStatuses] = useState<string[]>(parsed.statuses)
  const [dedupeWindow, setDedupeWindow] = useState<"hour" | "day">(parsed.dedupeWindow)

  // Sync from prop changes (edit mode load)
  const isSyncingFromProps = useRef(false)

  useEffect(() => {
    const willSync =
      schedule !== parsed.schedule ||
      target !== parsed.target ||
      dateField !== parsed.dateField ||
      offsetDays !== parsed.offsetDays ||
      offsetDirection !== parsed.offsetDirection ||
      !arraysEqual(statuses, parsed.statuses) ||
      dedupeWindow !== parsed.dedupeWindow

    if (willSync) {
      isSyncingFromProps.current = true
    }

    setSchedule(prev => prev === parsed.schedule ? prev : parsed.schedule)
    setTarget(prev => prev === parsed.target ? prev : parsed.target)
    setDateField(prev => prev === parsed.dateField ? prev : parsed.dateField)
    setOffsetDays(prev => prev === parsed.offsetDays ? prev : parsed.offsetDays)
    setOffsetDirection(prev => prev === parsed.offsetDirection ? prev : parsed.offsetDirection)
    setStatuses(prev => arraysEqual(prev, parsed.statuses) ? prev : parsed.statuses)
    setDedupeWindow(prev => prev === parsed.dedupeWindow ? prev : parsed.dedupeWindow)
    // Only run when triggerConfig props are parsed again; local field edits emit upward separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed])

  // Skip first render emit so we don't push defaults on mount and
  // falsely trigger the parent's dirty detection.
  const isFirstRender = useRef(true)

  // Build the config and push it up on every field change
  const emitConfig = useCallback(() => {
    const effectiveOffset =
      offsetDays === 0 ? 0 : offsetDirection === "before" ? -offsetDays : offsetDays

    const config: Record<string, unknown> = {
      schedule,
      target,
      dateField: target !== "property" ? dateField || undefined : undefined,
      offsetDays: target !== "property" && effectiveOffset !== 0 ? effectiveOffset : undefined,
      statuses: target !== "property" && statuses.length > 0 ? statuses : undefined,
      status: undefined, // legacy field cleared
      dedupeWindow,
    }

    onTriggerConfigChange(config)
  }, [schedule, target, dateField, offsetDays, offsetDirection, statuses, dedupeWindow, onTriggerConfigChange])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return // Skip emit on mount — don't overwrite loaded/default config
    }
    if (isSyncingFromProps.current) {
      isSyncingFromProps.current = false
      return // Skip emit while hydrating/edit-loading config from props
    }
    emitConfig()
    // Only re-emit when actual field values change, not emitConfig ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, target, dateField, offsetDays, offsetDirection, statuses, dedupeWindow])

  // Cron preview
  const cronPreview = useMemo(() => {
    try {
      const result = evaluateCron(schedule, new Date())
      return { text: result.humanReadable, valid: true }
    } catch {
      return { text: "Invalid cron expression", valid: false }
    }
  }, [schedule])

  const showEntityFields = target !== "property"

  const handlePresetClick = (cron: string) => {
    setSchedule(cron)
  }

  const toggleStatus = (value: string, checked: boolean) => {
    setStatuses(prev =>
      checked ? [...prev, value] : prev.filter(s => s !== value)
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-0">
        <CardTitle className="text-base">Schedule Configuration</CardTitle>
        <CardDescription>
          Define when this automation runs and which records it targets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Cron Expression ────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="schedule-cron">Schedule</Label>
          <Input
            id="schedule-cron"
            placeholder="0 8 * * *"
            value={schedule}
            onChange={e => setSchedule(e.target.value)}
            className="font-mono"
          />
          <p
            className={cn(
              "text-xs",
              cronPreview.valid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            )}
          >
            {cronPreview.text}
          </p>
        </div>

        {/* ── Preset Chips ───────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {SCHEDULE_PRESETS.map(preset => (
            <button
              key={preset.cron}
              type="button"
              onClick={() => handlePresetClick(preset.cron)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                schedule === preset.cron
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* ── Timezone (read-only, from property settings) ──────────── */}
        <div className="space-y-2">
          <Label>Timezone</Label>
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{propertyTimezone}</span>
            {propertyId && (
              <Link
                href={`/dashboard/${propertyId}/settings`}
                className="text-xs text-primary hover:underline"
              >
                Change in Settings
              </Link>
            )}
          </div>
        </div>

        {/* ── Target Entity ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="schedule-target">Target Entity</Label>
          <Select value={target} onValueChange={(v: ScheduledTriggerConfig["target"]) => {
            setTarget(v)
            setDateField("")
            setStatuses([])
          }}>
            <SelectTrigger id="schedule-target">
              <SelectValue placeholder="Select target..." />
            </SelectTrigger>
            <SelectContent>
              {TARGET_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Date Field (hidden for property) ───────────────────────── */}
        {showEntityFields && (
          <div className="space-y-2">
            <Label htmlFor="schedule-date-field">Date Field</Label>
            <Select value={dateField} onValueChange={setDateField}>
              <SelectTrigger id="schedule-date-field">
                <SelectValue placeholder="Select date field..." />
              </SelectTrigger>
              <SelectContent>
                {(DATE_FIELD_OPTIONS[target] ?? []).map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Offset (hidden for property) ───────────────────────────── */}
        {showEntityFields && (
          <div className="space-y-2">
            <Label>Offset</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={365}
                value={offsetDays}
                onChange={e => setOffsetDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
                className="w-24"
              />
              <Select
                value={offsetDirection}
                onValueChange={(v: string) => setOffsetDirection(v as "before" | "after")}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">days before</SelectItem>
                  <SelectItem value="after">days after</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── Status Filter (hidden for property) ────────────────────── */}
        {showEntityFields && (STATUS_OPTIONS[target]?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <Label>Status Filter</Label>
            <div className="flex flex-wrap gap-3">
              {STATUS_OPTIONS[target]?.map(opt => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={statuses.includes(opt.value)}
                    onCheckedChange={(checked) => toggleStatus(opt.value, !!checked)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {statuses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {statuses.map(s => {
                  const label = STATUS_OPTIONS[target]?.find(o => o.value === s)?.label ?? s
                  return (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Deduplication Window ────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="schedule-dedupe">Run Once Per</Label>
          <Select value={dedupeWindow} onValueChange={(v: string) => setDedupeWindow(v as "hour" | "day")}>
            <SelectTrigger id="schedule-dedupe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Per day</SelectItem>
              <SelectItem value="hour">Per hour</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}
