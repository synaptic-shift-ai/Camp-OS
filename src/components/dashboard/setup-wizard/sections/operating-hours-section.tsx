"use client"

import type { UseFormRegister, UseFormSetValue } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Props {
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  timezone: string
  usTimezones: Array<{ value: string; label: string }>
}

export function OperatingHoursSection({ register, setValue, timezone, usTimezones }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Operating hours</h3>
        <p className="text-sm text-muted-foreground">Check-in and check-out times</p>
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Select value={timezone} onValueChange={(v) => setValue("timezone", v)}>
          <SelectTrigger id="timezone" className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {usTimezones.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="checkInTime">Check-in Time</Label>
          <Input id="checkInTime" type="time" {...register("checkInTime")} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="checkOutTime">Check-out Time</Label>
          <Input id="checkOutTime" type="time" {...register("checkOutTime")} className="mt-1" />
        </div>
      </div>
    </div>
  )
}
