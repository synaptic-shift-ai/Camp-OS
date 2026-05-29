"use client"

import type { UseFormRegister, UseFormSetValue } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { TimezoneSelectField } from "@/components/dashboard/timezone-select-field"

interface Props {
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  timezone: string
  usTimezones: Array<{ value: string; label: string }>
}

export function OperatingHoursSection({
  register,
  setValue,
  timezone,
  usTimezones,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Operating hours</h3>
        <p className="text-sm text-muted-foreground">Check-in and check-out times</p>
      </div>
      <TimezoneSelectField
        id="timezone"
        value={timezone}
        onChange={(tz) => setValue("timezone", tz)}
        options={usTimezones}
        selectTriggerClassName="mt-0"
      />
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
