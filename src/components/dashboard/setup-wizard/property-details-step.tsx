"use client"

import { useState, forwardRef, useImperativeHandle } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useProperty, type Property } from "@/components/property-context"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Save } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { getApiFailureMessage } from "@/lib/api/get-api-failure-message"
import { PropertyImagesSection } from "@/components/dashboard/property-images-section"

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
  minStayNights: z.coerce.number().int().min(1).default(1),
  maxStayNights: z.coerce.number().int().min(1).optional().or(z.literal("")),
  bookingLeadTimeDays: z.coerce.number().int().min(0).default(365),
})

type PropertyDetailsFormData = z.infer<typeof propertyDetailsSchema>

export interface PropertyDetailsStepHandle {
  submitForm: () => Promise<boolean>
}

interface PropertyDetailsStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
  onSaveStateChange?: (saving: boolean) => void
  onPropertyDetailsSaved?: (propertyId: string) => void
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

// ─── PropertyDetailsStep ──────────────────────────────────────────────────────

const PropertyDetailsStepComponent = (
  { property, onComplete, onSkip, onSaveStateChange, onPropertyDetailsSaved }: PropertyDetailsStepProps,
  ref: React.Ref<PropertyDetailsStepHandle>
) => {
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { refreshProperties } = useProperty()

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

  const buildRequestBody = (data: PropertyDetailsFormData) => ({
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
  })

  const handleSaveOnly = async (data: PropertyDetailsFormData) => {
    try {
      setSaving(true)
      setError(null)
      onSaveStateChange?.(true)

      const response = await fetch(`/api/v1/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(data)),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(getApiFailureMessage(result) || "Failed to save property details")
      }

      await refreshProperties()
      onPropertyDetailsSaved?.(property.id)

      toast({
        title: "Saved",
        description: `${property.name} details saved.`,
        variant: "success",
      })
    } catch (err) {
      console.error("[PropertyDetailsStep] Error saving property details:", err)
      setError(err instanceof Error ? err.message : "Failed to save property details")
    } finally {
      setSaving(false)
      onSaveStateChange?.(false)
    }
  }

  const handleSubmitForNext = async (data: PropertyDetailsFormData): Promise<boolean> => {
    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch(`/api/v1/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(data)),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(getApiFailureMessage(result) || "Failed to save property details")
      }

      await refreshProperties()
      onPropertyDetailsSaved?.(property.id)
      onComplete()
      return true
    } catch (err) {
      console.error("[PropertyDetailsStep] Error saving property details:", err)
      setError(err instanceof Error ? err.message : "Failed to save property details")
      return false
    } finally {
      setSubmitting(false)
    }
  }

  useImperativeHandle(ref, () => ({
    submitForm: (): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        handleSubmit(
          async (data) => {
            const success = await handleSubmitForNext(data)
            resolve(success)
          },
          (formErrors) => {
            console.error("[PropertyDetailsStep] Form validation failed:", formErrors)
            setError("Please fill in all required fields before continuing.")
            resolve(false)
          }
        )()
      })
    },
  }))

  return (
    <form
      onSubmit={handleSubmit(
        (data) => handleSaveOnly(data),
        (formErrors) => {
          console.error("[PropertyDetailsStep] Form validation failed:", formErrors)
          setError("Please fill in all required fields.")
        }
      )}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Property Details</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add basic information and images for {property.name}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location</CardTitle>
          <CardDescription className="text-sm">Property address and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="address">Street Address *</Label>
            <Input id="address" {...register("address")} placeholder="123 Campground Road" />
            {errors.address && <p className="text-sm text-destructive mt-1">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input id="city" {...register("city")} placeholder="City" />
              {errors.city && <p className="text-sm text-destructive mt-1">{errors.city.message}</p>}
            </div>
            <div>
              <Label htmlFor="state">State *</Label>
              <Input id="state" {...register("state")} placeholder="CA" maxLength={2} />
              {errors.state && <p className="text-sm text-destructive mt-1">{errors.state.message}</p>}
            </div>
            <div>
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input id="zipCode" {...register("zipCode")} placeholder="12345" />
              {errors.zipCode && <p className="text-sm text-destructive mt-1">{errors.zipCode.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="info@campground.com" />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...register("phone")} placeholder="(555) 123-4567" />
              {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} placeholder="Describe your property, amenities, and what makes it special..." rows={4} />
            {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Property images */}
      <PropertyImagesSection
        propertyId={property.id}
        initialCoverUrl={property.heroImageUrl}
      />

      {/* Operating Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Operating Hours</CardTitle>
          <CardDescription className="text-sm">Check-in and check-out times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={(value) => setValue("timezone", value)}>
                <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {US_TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
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
          <CardTitle className="text-base">Booking Rules</CardTitle>
          <CardDescription className="text-sm">Default stay limits and booking window for your property</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="minStayNights">Minimum Stay (nights)</Label>
              <Input id="minStayNights" type="number" min={1} {...register("minStayNights")} />
              {errors.minStayNights && <p className="text-sm text-destructive mt-1">{errors.minStayNights.message}</p>}
            </div>
            <div>
              <Label htmlFor="maxStayNights">Maximum Stay (nights)</Label>
              <Input id="maxStayNights" type="number" min={1} placeholder="No limit" {...register("maxStayNights")} />
              {errors.maxStayNights && <p className="text-sm text-destructive mt-1">{errors.maxStayNights.message}</p>}
            </div>
            <div>
              <Label htmlFor="bookingLeadTimeDays">Booking Window (days)</Label>
              <Input id="bookingLeadTimeDays" type="number" min={0} {...register("bookingLeadTimeDays")} />
              <p className="text-xs text-muted-foreground mt-1">How far in advance guests can book</p>
              {errors.bookingLeadTimeDays && <p className="text-sm text-destructive mt-1">{errors.bookingLeadTimeDays.message}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies & Rules</CardTitle>
          <CardDescription className="text-sm">Guest guidelines and property rules</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
            <Textarea id="cancellationPolicy" {...register("cancellationPolicy")} placeholder="Your cancellation and refund policy..." rows={3} />
          </div>
          <div>
            <Label htmlFor="customRules">Property Rules</Label>
            <Textarea id="customRules" {...register("customRules")} placeholder="Property rules and regulations..." rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={saving || submitting}>
          {saving ? "Saving..." : <><Save className="mr-2 h-4 w-4" />Save</>}
        </Button>
      </div>
    </form>
  )
}

export const PropertyDetailsStep = forwardRef(PropertyDetailsStepComponent)