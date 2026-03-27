"use client"

import type { FieldErrors, UseFormRegister } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface Props {
  register: UseFormRegister<any>
  errors: FieldErrors<any>
}

export function BookingRulesSection({ register, errors }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Booking rules</h3>
        <p className="text-sm text-muted-foreground">Stay limits and booking window</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="minStayNights">Minimum Stay (nights)</Label>
          <Input id="minStayNights" type="number" min={1} {...register("minStayNights")} className="mt-1" />
          {errors.minStayNights && (
            <p className="mt-1 text-sm text-destructive dark:text-red-300">
              {String(errors.minStayNights.message ?? "")}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="maxStayNights">Maximum Stay (nights)</Label>
          <Input
            id="maxStayNights"
            type="number"
            min={1}
            placeholder="No limit"
            {...register("maxStayNights")}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="bookingLeadTimeDays">Booking Window (days)</Label>
          <Input id="bookingLeadTimeDays" type="number" min={0} {...register("bookingLeadTimeDays")} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">How far in advance guests can book</p>
        </div>
      </div>
    </div>
  )
}
