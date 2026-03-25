"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type PageSizeSelectorProps = {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  options?: number[]
  className?: string
}

export function PageSizeSelector({
  value,
  onChange,
  disabled = false,
  options = [10, 25, 50, 100],
  className,
}: PageSizeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className ?? ""}`}>
      <span>Show</span>
      <Select
        value={String(value)}
        onValueChange={(val) => {
          const next = Number(val)
          if (!Number.isFinite(next) || next <= 0) return
          onChange(next)
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-[70px] rounded-sm bg-card/50 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>per page</span>
    </div>
  )
}

