"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

interface EditReservationDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  numPets: number
  trigger?: React.ReactNode
}

export function EditReservationDialog({
  reservationId,
  confirmationNumber,
  guestName,
  checkIn,
  checkOut,
  numAdults,
  numChildren,
  numPets,
  trigger,
}: EditReservationDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Form state
  const [formData, setFormData] = useState({
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numAdults: numAdults,
    numChildren: numChildren,
    numPets: numPets,
    specialRequests: "",
  })

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        checkInDate: checkIn,
        checkOutDate: checkOut,
        numAdults: numAdults,
        numChildren: numChildren,
        numPets: numPets,
        specialRequests: "",
      })
      setError(null)
    }
  }, [open, checkIn, checkOut, numAdults, numChildren, numPets])

  const handleSave = async () => {
    try {
      setLoading(true)
      setError(null)

      // Validate dates
      const checkInDate = new Date(formData.checkInDate)
      const checkOutDate = new Date(formData.checkOutDate)

      if (checkOutDate <= checkInDate) {
        throw new Error("Check-out date must be after check-in date")
      }

      if (formData.numAdults < 1) {
        throw new Error("At least one adult is required")
      }

      const response = await fetch(
        `/api/v1/reservations/${reservationId}/update`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            check_in_date: formData.checkInDate,
            check_out_date: formData.checkOutDate,
            num_adults: formData.numAdults,
            num_children: formData.numChildren,
            num_pets: formData.numPets,
            special_requests: formData.specialRequests.trim() || undefined,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to update reservation")
      }

      // Success - close dialog and refresh the page
      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error("Update reservation error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || <Button variant="outline" size="sm">Edit Reservation</Button>}
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Reservation</SheetTitle>
          <SheetDescription>
            Update reservation details for {guestName}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Reservation Info */}
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Confirmation:</span>{" "}
              <span className="text-muted-foreground">{confirmationNumber}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Guest:</span>{" "}
              <span className="text-muted-foreground">{guestName}</span>
            </div>
          </div>

          {/* Check-in Date */}
          <div className="space-y-2">
            <Label htmlFor="checkInDate">Check-in Date *</Label>
            <Input
              id="checkInDate"
              type="date"
              value={formData.checkInDate}
              onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          {/* Check-out Date */}
          <div className="space-y-2">
            <Label htmlFor="checkOutDate">Check-out Date *</Label>
            <Input
              id="checkOutDate"
              type="date"
              value={formData.checkOutDate}
              onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
              disabled={loading}
              required
            />
          </div>

          {/* Number of Adults */}
          <div className="space-y-2">
            <Label htmlFor="numAdults">Number of Adults *</Label>
            <Input
              id="numAdults"
              type="number"
              min="1"
              value={formData.numAdults}
              onChange={(e) => setFormData({ ...formData, numAdults: parseInt(e.target.value) || 1 })}
              disabled={loading}
              required
            />
          </div>

          {/* Number of Children */}
          <div className="space-y-2">
            <Label htmlFor="numChildren">Number of Children</Label>
            <Input
              id="numChildren"
              type="number"
              min="0"
              value={formData.numChildren}
              onChange={(e) => setFormData({ ...formData, numChildren: parseInt(e.target.value) || 0 })}
              disabled={loading}
            />
          </div>

          {/* Number of Pets */}
          <div className="space-y-2">
            <Label htmlFor="numPets">Number of Pets</Label>
            <Input
              id="numPets"
              type="number"
              min="0"
              value={formData.numPets}
              onChange={(e) => setFormData({ ...formData, numPets: parseInt(e.target.value) || 0 })}
              disabled={loading}
            />
          </div>

          {/* Special Requests */}
          <div className="space-y-2">
            <Label htmlFor="specialRequests">Special Requests (Optional)</Label>
            <Textarea
              id="specialRequests"
              placeholder="e.g., Early check-in requested, Accessible site needed, etc."
              value={formData.specialRequests}
              onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
              rows={4}
              disabled={loading}
            />
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
