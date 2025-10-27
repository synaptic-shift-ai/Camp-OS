"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Building2, ArrowRight, Loader2, Tent } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
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

export function OnboardingClient() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
  })

  const onSubmit = async (data: PropertyFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/onboarding/setup-property", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save property information")
      }

      router.push("/onboarding/sites")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
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
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Welcome to CampOS!</h1>
            <p className="text-xl text-muted-foreground">Let's get your campground set up</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Step 1 of 4</span>
              <span className="text-muted-foreground">Property Information</span>
            </div>
            <Progress value={25} className="h-2" />
          </div>

          {/* Form Card */}
          <Card className="glass-strong shadow-xl">
            <CardHeader>
              <CardTitle>Property Information</CardTitle>
              <CardDescription>Tell us about your campground property</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
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
                  <div className="space-y-2 sm:col-span-1">
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
                      type="tel"
                      {...register("phone")}
                      placeholder="(555) 123-4567"
                      className={cn(errors.phone && "border-destructive")}
                    />
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Contact Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      {...register("email")}
                      placeholder="info@pinevalley.com"
                      className={cn(errors.email && "border-destructive")}
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                  </div>
                </div>

                {/* Error Alert */}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
