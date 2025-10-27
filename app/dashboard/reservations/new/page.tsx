"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"

// Form validation schema
const manualBookingSchema = z.object({
  siteId: z.string().min(1, "Please select a site"),
  checkInDate: z.string().min(1, "Check-in date is required"),
  checkOutDate: z.string().min(1, "Check-out date is required"),
  numAdults: z.number().min(1, "At least one adult is required"),
  numChildren: z.number().min(0).optional(),
  numPets: z.number().min(0).optional(),
  numVehicles: z.number().min(0).optional(),
  guestFirstName: z.string().min(1, "First name is required"),
  guestLastName: z.string().min(1, "Last name is required"),
  guestEmail: z.string().email("Invalid email address"),
  guestPhone: z.string().min(1, "Phone number is required"),
  guestAddress: z.string().optional(),
  guestCity: z.string().optional(),
  guestState: z.string().optional(),
  guestZipCode: z.string().optional(),
  paymentMethod: z.enum(["cash", "check", "bank_transfer", "other"]),
  paidAmount: z.string().optional(), // Will convert to cents
  specialRequests: z.string().optional(),
  notes: z.string().optional(),
})

type ManualBookingFormData = z.infer<typeof manualBookingSchema>

export default function NewReservationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([])
  const [loadingSites, setLoadingSites] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ManualBookingFormData>({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      numAdults: 1,
      numChildren: 0,
      numPets: 0,
      numVehicles: 0,
      paymentMethod: "cash",
    },
  })

  const selectedSite = watch("siteId")
  const paymentMethod = watch("paymentMethod")

  // Load sites on mount (simplified - in production, this would be an API call)
  useEffect(() => {
    // TODO: Fetch sites from API
    // For now, using placeholder data
    setSites([
      { id: "site-1", name: "Site 1" },
      { id: "site-2", name: "Site 2" },
      { id: "site-3", name: "Site 3" },
    ])
    setLoadingSites(false)
  }, [])

  const onSubmit = async (data: ManualBookingFormData) => {
    try {
      setLoading(true)
      setError(null)

      // Convert paid amount from dollars to cents
      const paidAmountCents = data.paidAmount
        ? Math.round(parseFloat(data.paidAmount) * 100)
        : undefined

      const response = await fetch("/api/admin/reservations/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId: data.siteId,
          checkInDate: data.checkInDate,
          checkOutDate: data.checkOutDate,
          numAdults: data.numAdults,
          numChildren: data.numChildren,
          numPets: data.numPets,
          numVehicles: data.numVehicles,
          guest: {
            firstName: data.guestFirstName,
            lastName: data.guestLastName,
            email: data.guestEmail,
            phone: data.guestPhone,
            address: data.guestAddress,
            city: data.guestCity,
            state: data.guestState,
            zipCode: data.guestZipCode,
          },
          paymentMethod: data.paymentMethod,
          paidAmount: paidAmountCents,
          specialRequests: data.specialRequests,
          notes: data.notes,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create reservation")
      }

      setSuccess(true)

      // Redirect to reservations page after a brief delay
      setTimeout(() => {
        router.push("/dashboard/reservations")
        router.refresh()
      }, 2000)
    } catch (err) {
      console.error("Create reservation error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="container max-w-2xl py-8">
        <Alert className="bg-green-500/10 text-green-500 border-green-500/20">
          <AlertDescription>
            Reservation created successfully! Redirecting...
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/reservations")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reservations
        </Button>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Create Manual Reservation</h1>
        <p className="text-muted-foreground">For phone or walk-in bookings</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Reservation Details */}
        <Card>
          <CardHeader>
            <CardTitle>Reservation Details</CardTitle>
            <CardDescription>Select site and dates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="siteId">Site *</Label>
              <Select
                value={selectedSite}
                onValueChange={(value) => setValue("siteId", value)}
                disabled={loadingSites}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.siteId && (
                <p className="text-sm text-destructive mt-1">{errors.siteId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="checkInDate">Check-in Date *</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  {...register("checkInDate")}
                />
                {errors.checkInDate && (
                  <p className="text-sm text-destructive mt-1">{errors.checkInDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="checkOutDate">Check-out Date *</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  {...register("checkOutDate")}
                />
                {errors.checkOutDate && (
                  <p className="text-sm text-destructive mt-1">{errors.checkOutDate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="numAdults">Adults *</Label>
                <Input
                  id="numAdults"
                  type="number"
                  min="1"
                  {...register("numAdults", { valueAsNumber: true })}
                />
                {errors.numAdults && (
                  <p className="text-sm text-destructive mt-1">{errors.numAdults.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="numChildren">Children</Label>
                <Input
                  id="numChildren"
                  type="number"
                  min="0"
                  {...register("numChildren", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="numPets">Pets</Label>
                <Input
                  id="numPets"
                  type="number"
                  min="0"
                  {...register("numPets", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="numVehicles">Vehicles</Label>
                <Input
                  id="numVehicles"
                  type="number"
                  min="0"
                  {...register("numVehicles", { valueAsNumber: true })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guest Information */}
        <Card>
          <CardHeader>
            <CardTitle>Guest Information</CardTitle>
            <CardDescription>Contact details for the guest</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guestFirstName">First Name *</Label>
                <Input
                  id="guestFirstName"
                  {...register("guestFirstName")}
                />
                {errors.guestFirstName && (
                  <p className="text-sm text-destructive mt-1">{errors.guestFirstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="guestLastName">Last Name *</Label>
                <Input
                  id="guestLastName"
                  {...register("guestLastName")}
                />
                {errors.guestLastName && (
                  <p className="text-sm text-destructive mt-1">{errors.guestLastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="guestEmail">Email *</Label>
                <Input
                  id="guestEmail"
                  type="email"
                  {...register("guestEmail")}
                />
                {errors.guestEmail && (
                  <p className="text-sm text-destructive mt-1">{errors.guestEmail.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="guestPhone">Phone *</Label>
                <Input
                  id="guestPhone"
                  type="tel"
                  {...register("guestPhone")}
                />
                {errors.guestPhone && (
                  <p className="text-sm text-destructive mt-1">{errors.guestPhone.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="guestAddress">Address (Optional)</Label>
              <Input
                id="guestAddress"
                {...register("guestAddress")}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="guestCity">City</Label>
                <Input
                  id="guestCity"
                  {...register("guestCity")}
                />
              </div>
              <div>
                <Label htmlFor="guestState">State</Label>
                <Input
                  id="guestState"
                  {...register("guestState")}
                  maxLength={2}
                  placeholder="CA"
                />
              </div>
              <div>
                <Label htmlFor="guestZipCode">Zip Code</Label>
                <Input
                  id="guestZipCode"
                  {...register("guestZipCode")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
            <CardDescription>Payment method and amount</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="paymentMethod">Payment Method *</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setValue("paymentMethod", value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paidAmount">Amount Paid (Optional)</Label>
              <Input
                id="paidAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register("paidAmount")}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty if payment will be collected later
              </p>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Internal notes about this reservation..."
                rows={3}
                {...register("notes")}
              />
            </div>

            <div>
              <Label htmlFor="specialRequests">Special Requests (Optional)</Label>
              <Textarea
                id="specialRequests"
                placeholder="Guest special requests..."
                rows={3}
                {...register("specialRequests")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard/reservations")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Creating..." : "Create Reservation"}
          </Button>
        </div>
      </form>
    </div>
  )
}
