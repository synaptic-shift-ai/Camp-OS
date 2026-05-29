"use client"

import { useEffect, useState } from "react"
import { Globe } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getDetectedTimezone } from "@/lib/postal-code"
import { cn } from "@/lib/utils"

type TimezoneOption = { value: string; label: string }

type TimezoneSelectFieldProps = {
  id: string
  value: string
  onChange: (timezone: string) => void
  options: TimezoneOption[]
  disabled?: boolean
  triggerClassName?: string
  label?: string
  description?: string
  selectTriggerClassName?: string
}

export function TimezoneSelectField({
  id,
  value,
  onChange,
  options,
  disabled = false,
  triggerClassName,
  label = "Timezone",
  description,
  selectTriggerClassName,
}: TimezoneSelectFieldProps) {
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null)

  useEffect(() => {
    setDetectedTimezone(getDetectedTimezone())
  }, [])

  const handleDetectTimezone = () => {
    const detected = getDetectedTimezone()
    if (detected) onChange(detected)
  }

  const isMatchingDetected = Boolean(
    detectedTimezone && value && detectedTimezone === value,
  )

  return (
    <div className={cn("space-y-2", triggerClassName)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {detectedTimezone && !disabled && (
          <button
            type="button"
            onClick={handleDetectTimezone}
            disabled={isMatchingDetected}
            title={
              isMatchingDetected
                ? `Already using detected timezone (${detectedTimezone})`
                : `Use detected timezone (${detectedTimezone})`
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-medium",
              "border-border bg-muted/40 text-muted-foreground",
              "transition-colors duration-150",
              "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
              isMatchingDetected
                ? "cursor-default opacity-60"
                : "cursor-pointer hover:border-primary/40 hover:bg-primary/10 hover:text-foreground",
            )}
          >
            <Globe className="h-3 w-3" aria-hidden="true" />
            <span>Detect timezone</span>
          </button>
        )}
      </div>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className={selectTriggerClassName}>
          <SelectValue placeholder="Select timezone..." />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {options.map((tz) => (
            <SelectItem key={tz.value} value={tz.value}>
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
