"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Building2, Loader2, Tent, CheckCircle2, Circle } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const propertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  description: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z
    .string()
    .length(2, "State must be 2 characters")
    .transform((val) => val.toUpperCase()),
  zipCode: z.string().min(5, "Zip code is required"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email("Invalid email address"),
})

type PropertyFormData = z.infer<typeof propertySchema>

type Property = {
  id: string
  name: string
  site_count: number | null
  onboarding_completed: boolean
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  email: string | null
  description: string | null
}

export function MultiPropertyOnboardingClient() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
  })

  // Fetch properties on mount
  useEffect(() => {
    fetchProperties()
  }, [])

  // Load property data when selection changes
  useEffect(() => {
    if (selectedPropertyId) {
      const property = properties.find((p) => p.id === selectedPropertyId)
      if (property) {
        reset({
          name: property.name,
          description: property.description || "",
          address: property.address || "",
          city: property.city || "",
          state: property.state || "",
          zipCode: property.zip_code || "",
          phone: property.phone || "",
          email: property.email || "",
        })
      }
    }
  }, [selectedPropertyId, properties, reset])

  const fetchProperties = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/onboarding/properties")

      if (!response.ok) {
        throw new Error("Failed to fetch properties")
      }

      const data = await response.json()
      const fetchedProperties = data.properties || []

      setProperties(fetchedProperties)

      // Auto-select first incomplete property, or first property if all complete
      const firstIncomplete = fetchedProperties.find((p: Property) => !p.onboarding_completed)
      setSelectedPropertyId(firstIncomplete?.id || fetchedProperties[0]?.id || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load properties")
    } finally {
      setIsLoading(false)
    }
  }

  const onSave = async (data: PropertyFormData, markComplete: boolean = false) => {
    if (!selectedPropertyId) return

    setIsSaving(true)
    setError(null)
    setSaveMessage(null)

    try {
      const response = await fetch("/api/onboarding/update-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          ...data,
          markComplete,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save property")
      }

      // Update local state
      setProperties((prev) =>
        prev.map((p) =>
          p.id === selectedPropertyId
            ? {
                ...p,
                name: data.name,
                description: data.description || null,
                address: data.address,
                city: data.city,
                state: data.state,
                zip_code: data.zipCode,
                phone: data.phone,
                email: data.email,
                onboarding_completed: markComplete || p.onboarding_completed,
              }
            : p
        )
      )

      setSaveMessage(markComplete ? "Property completed!" : "Progress saved!")

      // If marking complete, check if all properties are done
      if (markComplete) {
        const allComplete = properties.every(
          (p) => p.id === selectedPropertyId || p.onboarding_completed
        )

        if (allComplete) {
          // All properties complete - redirect to dashboard
          setTimeout(() => router.push("/dashboard"), 1000)
          return
        }

        // Move to next incomplete property
        const nextIncomplete = properties.find(
          (p) => p.id !== selectedPropertyId && !p.onboarding_completed
        )
        if (nextIncomplete) {
          setSelectedPropertyId(nextIncomplete.id)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSaving(false)
    }
  }

  const currentProperty = properties.find((p) => p.id === selectedPropertyId)
  const completedCount = properties.filter((p) => p.onboarding_completed).length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your properties...</p>
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Properties Found</CardTitle>
            <CardDescription>
              We couldn't find any properties for your account. Please contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Badge variant="secondary">
              {completedCount} of {properties.length} Complete
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Complete Property Setup</h1>
            <p className="text-xl text-muted-foreground">
              Configure each of your {properties.length} {properties.length === 1 ? "property" : "properties"}
            </p>
          </div>

          {/* Property Selector */}
          {properties.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Select Property</CardTitle>
                <CardDescription>Choose which property to configure</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedPropertyId || ""} onValueChange={(value) => setSelectedPropertyId(value || null)}>
                  <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${Math.min(properties.length, 4)}, 1fr)` }}>
                    {properties.map((property) => (
                      <TabsTrigger key={property.id} value={property.id} className="relative">
                        <span className="flex items-center gap-2">
                          {property.onboarding_completed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                          {property.name}
                          {property.site_count && (
                            <Badge variant="outline" className="ml-1">{property.site_count} sites</Badge>
                          )}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
          {saveMessage && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                {saveMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Property Form */}
          {currentProperty && (
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {currentProperty.name}
                  {currentProperty.site_count && (
                    <Badge variant="secondary">{currentProperty.site_count} sites</Badge>
                  )}
                  {currentProperty.onboarding_completed && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Fill out the details for this property</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit((data) => onSave(data, false))} className="space-y-6">
                  {/* Property Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Property Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="Pine Valley Campground"
                      className={cn(errors.name && "border-destructive")}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="A brief description of your campground..."
                      rows={4}
                    />
                  </div>

                  {/* Address */}
                  <div className="space-y-2">
                    <Label htmlFor="address">
                      Address <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="address"
                      {...register("address")}
                      placeholder="123 Mountain Road"
                      className={cn(errors.address && "border-destructive")}
                    />
                    {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
                  </div>

                  {/* City, State, Zip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">
                        City <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="city"
                        {...register("city")}
                        placeholder="Boulder"
                        className={cn(errors.city && "border-destructive")}
                      />
                      {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">
                        State <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="state"
                        {...register("state")}
                        placeholder="CO"
                        maxLength={2}
                        className={cn(errors.state && "border-destructive")}
                      />
                      {errors.state && <p className="text-sm text-destructive">{errors.state.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">
                        Zip Code <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="zipCode"
                        {...register("zipCode")}
                        placeholder="80301"
                        className={cn(errors.zipCode && "border-destructive")}
                      />
                      {errors.zipCode && <p className="text-sm text-destructive">{errors.zipCode.message}</p>}
                    </div>
                  </div>

                  {/* Phone and Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Phone <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        {...register("phone")}
                        placeholder="(555) 123-4567"
                        className={cn(errors.phone && "border-destructive")}
                      />
                      {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        {...register("email")}
                        placeholder="info@campground.com"
                        className={cn(errors.email && "border-destructive")}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={isSaving || !isDirty}
                      className="flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Progress"
                      )}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSubmit((data) => onSave(data, true))}
                      disabled={isSaving}
                      className="flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark Complete & Continue
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
