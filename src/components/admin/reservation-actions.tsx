"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"
import { EditReservationDialog } from "./edit-reservation-dialog"
import { CancelReservationDialog } from "./cancel-reservation-dialog"
import { CheckInButton } from "./check-in-button"
import { CheckOutButton } from "./check-out-button"
import { ExtendDialog } from "./extend-dialog"
import { RenewDialog } from "./renew-dialog"
import { ManualPaymentDialog } from "./manual-payment-dialog"
import { RefundReservationDialog } from "./refund-reservation-dialog"
import { useToast } from "@/hooks/use-toast"
import type { RateDiscountsConfig } from "@/lib/config/types"

interface ReservationActionsProps {
  reservationId: string
  confirmationNumber: string
  guestName: string
  status: string
  checkIn: string
  checkOut: string
  numAdults: number
  numChildren: number
  numPets: number
  specialRequests?: string | null
  siteNumber: string
  siteName?: string | undefined
  pricePerNight: number
  weeklyRateCents: number | null
  monthlyRateCents: number | null
  bookingType?: 'seasonal' | 'monthly' | 'weekly' | 'nightly' | 'long_term' | undefined
  totalAmount: number
  paidAmount: number
  hasOutstandingBalance?: boolean
  canRefund?: boolean
  maxRefundableCents?: number
  rateDiscountsConfig?: RateDiscountsConfig | null | undefined
  blackoutDates?: string[] | undefined
  allowedCheckInDays?: string[] | undefined
  allowedCheckOutDays?: string[] | undefined
  checkInTime?: string | null | undefined
  checkOutTime?: string | null | undefined
}

export function ReservationActions({
  reservationId,
  confirmationNumber,
  guestName,
  status,
  checkIn,
  checkOut,
  numAdults,
  numChildren,
  numPets,
  specialRequests,
  siteNumber,
  siteName,
  pricePerNight,
  weeklyRateCents,
  monthlyRateCents,
  bookingType = 'nightly',
  totalAmount,
  paidAmount,
  hasOutstandingBalance = false,
  canRefund = false,
  maxRefundableCents = 0,
  rateDiscountsConfig,
  blackoutDates,
  allowedCheckInDays,
  allowedCheckOutDays,
  checkInTime,
  checkOutTime,
}: ReservationActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [noShowLoading, setNoShowLoading] = useState(false)

  const handleMarkNoShow = async (e: Event) => {
    e.preventDefault()
    setNoShowLoading(true)
    try {
      const res = await fetch(`/api/v1/reservations/${reservationId}/no-show`, {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error?.message ?? "Failed to mark as no-show"
        toast({ title: "No-show failed", description: msg, variant: "destructive" })
        return
      }
      toast({ title: "Marked as no-show", description: "Reservation status updated." })
      router.refresh()
    } catch (err) {
      console.error("Mark no-show error:", err)
      toast({ title: "Error", description: "Could not mark as no-show.", variant: "destructive" })
    } finally {
      setNoShowLoading(false)
    }
  }
  // Only show extend/renew for confirmed or checked-in reservations
  const canExtendOrRenew = status === 'confirmed' || status === 'checked_in'

  const showCancel = status !== 'cancelled' && status !== 'checked_out' && status !== 'checked_in' && status !== 'no_show'

  // Renewals are primarily for seasonal/monthly bookings
  const showRenew = canExtendOrRenew && ['seasonal', 'monthly', 'long_term'].includes(bookingType)

  const showManualPayment = !!hasOutstandingBalance

  const showRefund = canRefund && maxRefundableCents > 0

  const showNoShowStatus = status === 'pending' || status === 'confirmed'
  const checkInReached = (() => {
    const d = new Date(checkIn)
    const t = new Date()
    d.setHours(0, 0, 0, 0)
    t.setHours(0, 0, 0, 0)
    return d.getTime() <= t.getTime()
  })()
  const showNoShowButton = showNoShowStatus && checkInReached
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <CheckInButton
          reservationId={reservationId}
          status={status}
          reservationCheckInDate={checkIn}
          blackoutDates={blackoutDates}
          allowedCheckInDays={allowedCheckInDays}
          checkInTime={checkInTime}
        />
        <CheckOutButton
          reservationId={reservationId}
          status={status}
          allowedCheckOutDays={allowedCheckOutDays}
          checkOutTime={checkOutTime}
        />
        <EditReservationDialog
          reservationId={reservationId}
          confirmationNumber={confirmationNumber}
          guestName={guestName}
          checkIn={checkIn}
          checkOut={checkOut}
          numAdults={numAdults}
          numChildren={numChildren}
          numPets={numPets}
          specialRequests={specialRequests ?? null}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit Reservation
            </DropdownMenuItem>
          }
        />
        {showManualPayment && (
          <ManualPaymentDialog
            reservationId={reservationId}
            confirmationNumber={confirmationNumber}
            guestName={guestName}
            totalAmountCents={totalAmount}
            paidAmountCents={paidAmount}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Manual Payment
              </DropdownMenuItem>
            }
          />
        )}
        {canExtendOrRenew && (
          <>
            <DropdownMenuSeparator />
            <ExtendDialog
              reservationId={reservationId}
              confirmationNumber={confirmationNumber}
              guestName={guestName}
              currentCheckIn={checkIn}
              currentCheckOut={checkOut}
              siteNumber={siteNumber}
              siteName={siteName}
              pricePerNight={pricePerNight}
              weeklyRateCents={weeklyRateCents ?? null}
              monthlyRateCents={monthlyRateCents ?? null}
              totalAmount={totalAmount}
              status={status}
              rateDiscountsConfig={rateDiscountsConfig}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Extend Stay
                </DropdownMenuItem>
              }
            />
            {showRenew && (
              <RenewDialog
                reservationId={reservationId}
                confirmationNumber={confirmationNumber}
                guestName={guestName}
                currentCheckOut={checkOut}
                bookingType={bookingType}
                siteNumber={siteNumber}
                siteName={siteName}
                pricePerNight={pricePerNight}
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Renew Reservation
                  </DropdownMenuItem>
                }
              />
            )}
          </>
        )}
        {showRefund && (
          <>
            <RefundReservationDialog
              reservationId={reservationId}
              confirmationNumber={confirmationNumber}
              guestName={guestName}
              maxRefundableCents={maxRefundableCents}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Issue Refund
                </DropdownMenuItem>
              }
            />
          </>
        )}
        {showNoShowButton && (
          <>
            <DropdownMenuItem
              onSelect={handleMarkNoShow}
              disabled={noShowLoading}
              className="gap-2"
            >
              Mark as No-Show
            </DropdownMenuItem>
          </>
        )}
        {showCancel && (
          <>
            <DropdownMenuSeparator />
            <CancelReservationDialog
              reservationId={reservationId}
              confirmationNumber={confirmationNumber}
              guestName={guestName}
              paidAmountCents={paidAmount}
              trigger={
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={(e) => e.preventDefault()}
                >
                  Cancel Reservation
                </DropdownMenuItem>
              }
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
