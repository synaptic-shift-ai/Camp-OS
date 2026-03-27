"use client"

import type { FieldErrors, UseFormRegister } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  register: UseFormRegister<any>
  errors: FieldErrors<any>
}

export function LocationSection({ register, errors }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Location</h3>
        <p className="text-sm text-muted-foreground">Property address and contact info</p>
      </div>
      <div>
        <Label htmlFor="address">Street address *</Label>
        <Input id="address" {...register("address")} placeholder="123 Campground Road" className="mt-1" />
        {errors.address && (
          <p className="mt-1 text-sm text-destructive dark:text-red-300">{String(errors.address.message ?? "")}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="city">City *</Label>
          <Input id="city" {...register("city")} placeholder="City" className="mt-1" />
          {errors.city && (
            <p className="mt-1 text-sm text-destructive dark:text-red-300">{String(errors.city.message ?? "")}</p>
          )}
        </div>
        <div>
          <Label htmlFor="state">State *</Label>
          <Input id="state" {...register("state")} placeholder="CA" maxLength={2} className="mt-1" />
          {errors.state && (
            <p className="mt-1 text-sm text-destructive dark:text-red-300">{String(errors.state.message ?? "")}</p>
          )}
        </div>
        <div>
          <Label htmlFor="zipCode">ZIP *</Label>
          <Input id="zipCode" {...register("zipCode")} placeholder="12345" className="mt-1" />
          {errors.zipCode && (
            <p className="mt-1 text-sm text-destructive dark:text-red-300">{String(errors.zipCode.message ?? "")}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} placeholder="info@campground.com" className="mt-1" />
          {errors.email && (
            <p className="mt-1 text-sm text-destructive dark:text-red-300">{String(errors.email.message ?? "")}</p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" {...register("phone")} placeholder="(555) 123-4567" className="mt-1" />
          {errors.phone && (
            <p className="mt-1 text-sm text-destructive dark:text-red-300">{String(errors.phone.message ?? "")}</p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...register("description")}
          placeholder="Describe your property, amenities, and what makes it special..."
          rows={5}
          className="mt-1"
        />
      </div>
    </div>
  )
}
