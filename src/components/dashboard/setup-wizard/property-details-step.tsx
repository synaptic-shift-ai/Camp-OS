"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Loader2, Save } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const propertyDetailsSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "ZIP code is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone number is required").optional().or(z.literal("")),
  description: z.string().optional(),
  timezone: z.string().default("America/New_York"),
  checkInTime: z.string().default("15:00"),
  checkOutTime: z.string().default("11:00"),
  cancellationPolicy: z.string().optional(),
  customRules: z.string().optional(),
  // Booking rules
  minStayNights: z.coerce.number().int().min(1).default(1),
  maxStayNights: z.coerce.number().int().min(1).optional().or(z.literal("")),
  bookingLeadTimeDays: z.coerce.number().int().min(0).default(365),
})

type PropertyDetailsFormData = z.infer<typeof propertyDetailsSchema>

interface PropertyDetailsStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
}

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time - Arizona (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
]

export function PropertyDetailsStep({ property, onComplete, onSkip }: PropertyDetailsStepProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PropertyDetailsFormData>({
    resolver: zodResolver(propertyDetailsSchema),
    defaultValues: {
      address: property.address || "",
      city: property.city || "",
      state: property.state || "",
      zipCode: property.zipCode || "",
      email: property.email || "",
      phone: property.phone || "",
      description: property.description || "",
      timezone: property.settings?.timezone || "America/New_York",
      checkInTime: property.settings?.checkInTime || "15:00",
      checkOutTime: property.settings?.checkOutTime || "11:00",
      cancellationPolicy: property.settings?.cancellationPolicy || "",
      customRules: property.settings?.customRules || "",
      minStayNights: property.settings?.minStayNights || 1,
      maxStayNights: property.settings?.maxStayNights || "",
      bookingLeadTimeDays: property.settings?.bookingLeadTimeDays || 365,
    },
  })

  const timezone = watch("timezone")

  // Debug: Log validation errors when form submission fails
  const onFormError = (formErrors: Record<string, unknown>) => {
    console.error("[PropertyDetailsStep] Form validation failed:", formErrors)
    setError("Form validation failed. Please check all required fields.")
  }

  const onSubmit = async (data: PropertyDetailsFormData) => {
    console.log("[PropertyDetailsStep] Form submitted with data:", data)
    console.log("[PropertyDetailsStep] Property ID:", property.id)
    try {
      setSaving(true)
      setError(null)

      const requestBody = {
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        email: data.email || null,
        phone: data.phone || null,
        description: data.description || null,
        settings: {
          timezone: data.timezone,
          checkInTime: data.checkInTime,
          checkOutTime: data.checkOutTime,
          cancellationPolicy: data.cancellationPolicy || null,
          customRules: data.customRules || null,
          minStayNights: data.minStayNights || 1,
          maxStayNights: data.maxStayNights || null,
          bookingLeadTimeDays: data.bookingLeadTimeDays ?? 365,
        },
      }

      console.log("[PropertyDetailsStep] Sending PATCH request to:", `/api/v1/properties/${property.id}`)
      console.log("[PropertyDetailsStep] Request body:", JSON.stringify(requestBody, null, 2))

      // Save property details - Migrated to v1 API (Phase 4, Week 13-14)
      // Map form data to v1 API format with nested settings
      const response = await fetch(`/api/v1/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      console.log("[PropertyDetailsStep] Response status:", response.status)
      const result = await response.json()
      console.log("[PropertyDetailsStep] Response body:", result)

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "Failed to save property details")
      }

      // Mark step as complete and continue
      onComplete()
    } catch (err) {
      console.error("[PropertyDetailsStep] Error saving property details:", err)
      setError(err instanceof Error ? err.message : "Failed to save property details")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onFormError)} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Property Details</h2>
          <p className="text-muted-foreground">
            Add basic information and images for {property.name}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Location Information */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Property address and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Street Address *</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="123 Campground Road"
            />
            {errors.address && (
              <p className="text-sm text-destructive mt-1">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input id="city" {...register("city")} placeholder="City" />
              {errors.city && (
                <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="state">State *</Label>
              <Input id="state" {...register("state")} placeholder="CA" maxLength={2} />
              {errors.state && (
                <p className="text-sm text-destructive mt-1">{errors.state.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input id="zipCode" {...register("zipCode")} placeholder="12345" />
              {errors.zipCode && (
                <p className="text-sm text-destructive mt-1">{errors.zipCode.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="info@campground.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                {...register("phone")}
                placeholder="(555) 123-4567"
              />
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Describe your property, amenities, and what makes it special..."
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
          <CardDescription>Check-in and check-out times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={(value) => setValue("timezone", value)}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {US_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="checkInTime">Check-in Time</Label>
              <Input id="checkInTime" type="time" {...register("checkInTime")} />
            </div>

            <div>
              <Label htmlFor="checkOutTime">Check-out Time</Label>
              <Input id="checkOutTime" type="time" {...register("checkOutTime")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Rules</CardTitle>
          <CardDescription>Default stay limits and booking window for your property</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="minStayNights">Minimum Stay (nights)</Label>
              <Input
                id="minStayNights"
                type="number"
                min={1}
                {...register("minStayNights")}
              />
              {errors.minStayNights && (
                <p className="text-sm text-destructive mt-1">{errors.minStayNights.message}</p>
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
              />
              {errors.maxStayNights && (
                <p className="text-sm text-destructive mt-1">{errors.maxStayNights.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="bookingLeadTimeDays">Booking Window (days)</Label>
              <Input
                id="bookingLeadTimeDays"
                type="number"
                min={0}
                {...register("bookingLeadTimeDays")}
              />
              <p className="text-xs text-muted-foreground mt-1">How far in advance guests can book</p>
              {errors.bookingLeadTimeDays && (
                <p className="text-sm text-destructive mt-1">{errors.bookingLeadTimeDays.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Policies & Rules</CardTitle>
          <CardDescription>Guest guidelines and property rules</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
            <Textarea
              id="cancellationPolicy"
              {...register("cancellationPolicy")}
              placeholder="Your cancellation and refund policy..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="customRules">Property Rules</Label>
            <Textarea
              id="customRules"
              {...register("customRules")}
              placeholder="Property rules and regulations..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save & Continue
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onSkip} disabled={saving}>
          Skip for Now
        </Button>
      </div>
    </form>
  )
}
