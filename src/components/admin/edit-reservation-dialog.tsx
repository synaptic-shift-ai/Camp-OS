"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
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
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { BookingDateRangePicker, type DateRangeValue } from "@/components/guest/booking-date-range-picker"
import { resolveBookingRulesConfig } from "@/lib/config/resolution"
import type { BookingRulesConfig } from "@/lib/config/types"
import {
  extractOpenPeriodFromPropertySettings,
  openPeriodRestrictsBookings,
  isStayWithinOpenPeriodByIsoDates,
  buildOpenPeriodBookingErrorMessage,
} from "@/lib/booking/open-period"
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from "react-svg-credit-card-payment-icons"

interface EditReservationDialogProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  numPets: number
  specialRequests?: string | null
  trigger?: React.ReactNode
}

type PaymentCardDisplay = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

function PaymentCardLogo({ brand }: { brand: string }) {
  const normalized = brand.trim().toLowerCase()
  switch (normalized) {
    case "visa":
      return <VisaFlatRoundedIcon width={56} />
    case "mastercard":
      return <MastercardFlatRoundedIcon width={56} />
    case "amex":
    case "american express":
    case "americanexpress":
      return <AmericanExpressFlatRoundedIcon width={56} />
    case "discover":
      return <DiscoverFlatRoundedIcon width={56} />
    default:
      return <GenericFlatRoundedIcon width={56} />
  }
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
  specialRequests,
  trigger,
}: EditReservationDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [paymentCard, setPaymentCard] = useState<PaymentCardDisplay | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeValue>()
  const [bookingRulesConfig, setBookingRulesConfig] = useState<BookingRulesConfig | null>(null)
  const [propertyName, setPropertyName] = useState<string | null>(null)
  const [openPeriodFrom, setOpenPeriodFrom] = useState<string | null>(null)
  const [openPeriodUntil, setOpenPeriodUntil] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numAdults: numAdults,
    numChildren: numChildren,
    numPets: numPets,
    specialRequests: specialRequests ?? "",
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
        specialRequests: specialRequests ?? "",
      })
      setError(null)
    }
  }, [open, checkIn, checkOut, numAdults, numChildren, numPets, specialRequests])

  useEffect(() => {
    if (!open) return

    const from = formData.checkInDate ? new Date(`${formData.checkInDate}T00:00:00`) : undefined
    const to = formData.checkOutDate ? new Date(`${formData.checkOutDate}T00:00:00`) : undefined
    setDateRange(from ? { from, to } : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!dateRange?.from) return
    setFormData((prev) => ({
      ...prev,
      checkInDate: format(dateRange.from!, "yyyy-MM-dd"),
      checkOutDate: dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : "",
    }))
  }, [dateRange])

  useEffect(() => {
    if (!open || !reservationId) return
    setPreviewLoading(true)
    setPaymentCard(null)
    fetch(`/api/v1/reservations/${reservationId}`)
      .then((res) => res.json())
      .then((json) => {
        const pc = json?.data?.payment_card
        if (
          json?.success === true &&
          pc &&
          typeof pc.last4 === "string" &&
          typeof pc.brand === "string" &&
          typeof pc.exp_month === "number" &&
          typeof pc.exp_year === "number"
        ) {
          setPaymentCard({
            brand: pc.brand,
            last4: pc.last4,
            exp_month: pc.exp_month,
            exp_year: pc.exp_year,
          })
        }
        if (json?.success === true) {
          const data = json.data
          setPropertyName(typeof data?.property_name === "string" ? data.property_name : null)

          const { openPeriodFrom: from, openPeriodUntil: until } =
            extractOpenPeriodFromPropertySettings(data?.property_settings)
          setOpenPeriodFrom(from)
          setOpenPeriodUntil(until)

          setBookingRulesConfig(
            resolveBookingRulesConfig(
              (data?.booking_rules_config as BookingRulesConfig | null) ?? null,
              null
            ).config
          )
        }
      })
      .catch(() => {
        // Keep paymentCard null
      })
      .finally(() => setPreviewLoading(false))
  }, [open, reservationId])

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

      if (
        openPeriodRestrictsBookings(openPeriodFrom, openPeriodUntil) &&
        !isStayWithinOpenPeriodByIsoDates(
          formData.checkInDate,
          formData.checkOutDate,
          openPeriodFrom,
          openPeriodUntil
        )
      ) {
        const fromIso = openPeriodFrom?.trim()
        const untilIso = openPeriodUntil?.trim()
        throw new Error(
          fromIso && untilIso && propertyName
            ? buildOpenPeriodBookingErrorMessage(propertyName, fromIso, untilIso)
            : "Selected dates are outside the property booking season."
        )
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
      toast({
        title: "Reservation updated",
        description: "Reservation changes were saved successfully.",
        className: SEASON_ALERT_TOAST_CLASS,
      })
      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error("Update reservation error:", err)
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive",
        className: SEASON_ALERT_TOAST_CLASS,
      })
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
              <span className="text-muted-foreground capitalize">{guestName}</span>
            </div>
            <div className="flex flex-nowrap items-center gap-2 text-sm">
              <span className="font-medium shrink-0">Payment card:</span>
              {previewLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : paymentCard ? (
                <span className="inline-flex min-w-0 items-center gap-3 align-middle">
                  <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center">
                    <PaymentCardLogo brand={paymentCard.brand} />
                  </span>
                  <span className="min-w-0 truncate font-mono text-base text-foreground">
                    **** **** **** {paymentCard.last4}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No card payment on file for this booking
                </span>
              )}
            </div>
          </div>

          {/* Check-in Date */}
          <div className="space-y-2">
            <input type="hidden" value={formData.checkInDate} readOnly />
            <input type="hidden" value={formData.checkOutDate} readOnly />
            <BookingDateRangePicker
              variant="dashboard"
              label="Check-in & Check-out"
              value={dateRange}
              onChange={setDateRange}
              sameDayBookingEnabled={bookingRulesConfig?.same_day_booking_enabled ?? true}
              blackoutDates={bookingRulesConfig?.blackout_dates ?? []}
              {...(bookingRulesConfig?.booking_window_days != null
                ? { bookingWindowDays: bookingRulesConfig.booking_window_days }
                : {})}
              {...(bookingRulesConfig?.advance_notice_days != null
                ? { advanceNoticeDays: bookingRulesConfig.advance_notice_days }
                : {})}
              openPeriodFrom={openPeriodFrom}
              openPeriodUntil={openPeriodUntil}
              numberOfMonths={1}
              disabled={loading}
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
