"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Tent, Home, TreePine, Sparkles, Circle, MapPin, Plus, Trash2, ArrowRight, Loader2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const siteTypes = ["tent", "rv", "cabin", "glamping", "yurt", "other"] as const
type SiteType = (typeof siteTypes)[number]

const siteSchema = z.object({
  name: z.string().min(1, "Site name is required"),
  type: z.enum(siteTypes, { required_error: "Site type is required" }),
  maxOccupancy: z.coerce.number().min(1, "Must be at least 1").max(50, "Cannot exceed 50"),
  nightlyRate: z.string().min(1, "Nightly rate is required"),
  description: z.string().optional(),
})

type SiteFormData = z.infer<typeof siteSchema>

interface AddedSite extends SiteFormData {
  id: string
  hookups: {
    water: boolean
    electric: boolean
    sewer: boolean
  }
}

function getSiteIcon(type: SiteType) {
  const icons = {
    tent: Tent,
    rv: Home,
    cabin: TreePine,
    glamping: Sparkles,
    yurt: Circle,
    other: MapPin,
  }
  return icons[type] || MapPin
}

function getHookupsSummary(hookups: { water: boolean; electric: boolean; sewer: boolean }) {
  const active = []
  if (hookups.water) active.push("Water")
  if (hookups.electric) active.push("Electric")
  if (hookups.sewer) active.push("Sewer")
  return active.length > 0 ? active.join(", ") : "None"
}

export function AddSitesClient() {
  const router = useRouter()
  const [addedSites, setAddedSites] = useState<AddedSite[]>([])
  const [hookups, setHookups] = useState({ water: false, electric: false, sewer: false })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
  })

  const selectedType = watch("type")

  const onAddSite = async (data: SiteFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const nightlyRateCents = Math.round(Number.parseFloat(data.nightlyRate) * 100)

      const response = await fetch("/api/onboarding/add-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          nightly_rate: nightlyRateCents,
          hookups,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add site")
      }

      const result = await response.json()
      setAddedSites([...addedSites, { ...data, id: result.siteId, hookups: { ...hookups } }])
      reset()
      setHookups({ water: false, electric: false, sewer: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSite = (id: string) => {
    setAddedSites(addedSites.filter((site) => site.id !== id))
  }

  const handleContinue = () => {
    router.push("/onboarding/stripe-connect")
  }

  const SiteIcon = selectedType ? getSiteIcon(selectedType) : Tent

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
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Tent className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">Add Your Campsites</h1>
            <p className="text-xl text-muted-foreground">Create your campsite inventory</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Step 2 of 4</span>
              <span className="text-muted-foreground">Campsite Inventory</span>
            </div>
            <Progress value={50} className="h-2" />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Add Site Form */}
            <Card className="glass-strong shadow-xl">
              <CardHeader>
                <CardTitle>Add a Campsite</CardTitle>
                <CardDescription>Fill in the details for each campsite</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onAddSite)} className="space-y-6">
                  {/* Site Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Site Name/Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="Site A1, RV Spot 15"
                      className={cn(errors.name && "border-destructive")}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>

                  {/* Site Type */}
                  <div className="space-y-2">
                    <Label htmlFor="type">
                      Site Type <span className="text-destructive">*</span>
                    </Label>
                    <Select onValueChange={(value) => setValue("type", value as SiteType)}>
                      <SelectTrigger className={cn(errors.type && "border-destructive")}>
                        <SelectValue placeholder="Select site type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tent">
                          <div className="flex items-center gap-2">
                            <Tent className="h-4 w-4" />
                            <span>Tent</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="rv">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            <span>RV</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="cabin">
                          <div className="flex items-center gap-2">
                            <TreePine className="h-4 w-4" />
                            <span>Cabin</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="glamping">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            <span>Glamping</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="yurt">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4" />
                            <span>Yurt</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="other">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>Other</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
                  </div>

                  {/* Max Occupancy and Nightly Rate */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxOccupancy">
                        Max Occupancy <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="maxOccupancy"
                        type="number"
                        min="1"
                        max="50"
                        {...register("maxOccupancy")}
                        placeholder="4"
                        className={cn(errors.maxOccupancy && "border-destructive")}
                      />
                      {errors.maxOccupancy && <p className="text-sm text-destructive">{errors.maxOccupancy.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nightlyRate">
                        Nightly Rate (USD) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          id="nightlyRate"
                          type="number"
                          step="0.01"
                          {...register("nightlyRate")}
                          placeholder="45.00"
                          className={cn("pl-7", errors.nightlyRate && "border-destructive")}
                        />
                      </div>
                      {errors.nightlyRate && <p className="text-sm text-destructive">{errors.nightlyRate.message}</p>}
                    </div>
                  </div>

                  {/* Hookups */}
                  <div className="space-y-3">
                    <Label>
                      Hookups <span className="text-destructive">*</span>
                    </Label>
                    <div className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="water"
                          checked={hookups.water}
                          onCheckedChange={(checked) => setHookups({ ...hookups, water: checked as boolean })}
                        />
                        <label
                          htmlFor="water"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Water
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="electric"
                          checked={hookups.electric}
                          onCheckedChange={(checked) => setHookups({ ...hookups, electric: checked as boolean })}
                        />
                        <label
                          htmlFor="electric"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Electric (30/50 amp)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="sewer"
                          checked={hookups.sewer}
                          onCheckedChange={(checked) => setHookups({ ...hookups, sewer: checked as boolean })}
                        />
                        <label
                          htmlFor="sewer"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Sewer
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Additional details about this site..."
                      rows={3}
                    />
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Add Site Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Adding Site...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-5 w-5" />
                        Add Site
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right Column - Added Sites List */}
            <div className="space-y-6">
              <Card className="glass-strong shadow-xl">
                <CardHeader>
                  <CardTitle>Added Sites ({addedSites.length})</CardTitle>
                  <CardDescription>Your campsite inventory</CardDescription>
                </CardHeader>
                <CardContent>
                  {addedSites.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-12 text-center">
                      <Tent className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No sites added yet</p>
                      <p className="text-sm text-muted-foreground mt-2">Add your first campsite to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {addedSites.map((site) => {
                        const Icon = getSiteIcon(site.type)
                        return (
                          <div
                            key={site.id}
                            className="border rounded-lg p-4 hover:bg-accent/50 transition-colors space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <Icon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{site.name}</h4>
                                    <Badge variant="outline" className="capitalize">
                                      {site.type}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Max {site.maxOccupancy} guests • ${site.nightlyRate}/night
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    Hookups: {getHookupsSummary(site.hookups)}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSite(site.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Continue Button */}
              {addedSites.length > 0 && (
                <div className="space-y-2">
                  <Button
                    size="lg"
                    className="w-full bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
                    onClick={handleContinue}
                  >
                    Continue to Payment Setup
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    You can add more sites later in your dashboard
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
