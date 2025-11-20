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
import { ImageUpload } from "@/components/ui/image-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Loader2, Save } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const propertyDetailsSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  zip_code: z.string().min(5, "ZIP code is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone number is required").optional().or(z.literal("")),
  description: z.string().optional(),
  timezone: z.string().default("America/New_York"),
  check_in_time: z.string().default("15:00"),
  check_out_time: z.string().default("11:00"),
  check_in_instructions: z.string().optional(),
  check_out_instructions: z.string().optional(),
  cancellation_policy: z.string().optional(),
  house_rules: z.string().optional(),
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
  const [heroImage, setHeroImage] = useState<string | null>(property.hero_image_url || null)
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
      zip_code: property.zip_code || "",
      email: property.email || "",
      phone: property.phone || "",
      description: property.description || "",
      timezone: property.timezone || "America/New_York",
      check_in_time: property.check_in_time || "15:00",
      check_out_time: property.check_out_time || "11:00",
      check_in_instructions: property.check_in_instructions || "",
      check_out_instructions: property.check_out_instructions || "",
      cancellation_policy: property.cancellation_policy || "",
      house_rules: property.house_rules || "",
    },
  })

  const timezone = watch("timezone")

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("propertyId", property.id)
    formData.append("imageType", "hero")

    const response = await fetch("/api/upload/property-image", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error("Failed to upload image")
    }

    const data = await response.json()
    return data.url
  }

  const onSubmit = async (data: PropertyDetailsFormData) => {
    try {
      setSaving(true)
      setError(null)

      // Save property details - Migrated to v1 API (Phase 4, Week 13-14)
      const response = await fetch(`/api/v1/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          hero_image_url: heroImage,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || "Failed to save property details")
      }

      // Mark step as complete and continue
      onComplete()
    } catch (err) {
      console.error("Error saving property details:", err)
      setError(err instanceof Error ? err.message : "Failed to save property details")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

      {/* Hero Image */}
      <Card>
        <CardHeader>
          <CardTitle>Property Image</CardTitle>
          <CardDescription>Upload a hero image for your property listing</CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            value={heroImage}
            onChange={setHeroImage}
            onUpload={handleImageUpload}
            placeholder="Upload property hero image"
          />
        </CardContent>
      </Card>

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
              <Label htmlFor="zip_code">ZIP Code *</Label>
              <Input id="zip_code" {...register("zip_code")} placeholder="12345" />
              {errors.zip_code && (
                <p className="text-sm text-destructive mt-1">{errors.zip_code.message}</p>
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
              <Label htmlFor="check_in_time">Check-in Time</Label>
              <Input id="check_in_time" type="time" {...register("check_in_time")} />
            </div>

            <div>
              <Label htmlFor="check_out_time">Check-out Time</Label>
              <Input id="check_out_time" type="time" {...register("check_out_time")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Policies & Instructions</CardTitle>
          <CardDescription>Guest guidelines and property rules</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="check_in_instructions">Check-in Instructions</Label>
            <Textarea
              id="check_in_instructions"
              {...register("check_in_instructions")}
              placeholder="Instructions for guests when they arrive..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="check_out_instructions">Check-out Instructions</Label>
            <Textarea
              id="check_out_instructions"
              {...register("check_out_instructions")}
              placeholder="Instructions for guests when they depart..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="cancellation_policy">Cancellation Policy</Label>
            <Textarea
              id="cancellation_policy"
              {...register("cancellation_policy")}
              placeholder="Your cancellation and refund policy..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="house_rules">House Rules</Label>
            <Textarea
              id="house_rules"
              {...register("house_rules")}
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
