"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DateRange } from "@/lib/analytics/date-utils"

export interface DateRangeOption {
  value: DateRange
  label: string
}

const dateRangeOptions: DateRangeOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
]

export function DateRangeFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentRange = (searchParams.get("range") as DateRange) || "30d"

  const handleRangeChange = (value: DateRange) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", value)
    router.push(`?${params.toString()}`)
  }

  return (
    <Select value={currentRange} onValueChange={handleRangeChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select date range" />
      </SelectTrigger>
      <SelectContent>
        {dateRangeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
