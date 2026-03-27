'use client'

/**
 * Guest Reservations Sheet
 *
 * Slide-over panel showing all reservations for a specific guest.
 * Fetches from GET /api/v1/properties/[propertyId]/reservations?guestId=[guestId].
 */

import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Loader2,
  CalendarDays,
  AlertCircle,
  BadgeCheck,
  Calendar,
  Phone,
  MapPin,
  Tent,
  CreditCard,
  UserRound,
  Heart,
  Baby,
  TriangleAlert,
  Car,
} from 'lucide-react'
import type { DashboardGuest } from '@/lib/dashboard/queries'
import {
  AmericanExpressFlatRoundedIcon,
  DiscoverFlatRoundedIcon,
  GenericFlatRoundedIcon,
  MastercardFlatRoundedIcon,
  VisaFlatRoundedIcon,
} from 'react-svg-credit-card-payment-icons'
import { Separator } from '@/components/ui/separator'

interface GuestReservationsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: DashboardGuest
  propertyId: string
}

type ReservationItem = {
  id: string
  confirmationNumber: string
  checkInDate: string
  checkOutDate: string
  nights: number
  totalAmountDollars: number
  paidAmountDollars: number
  balanceDollars: number
  status: string
  paymentStatus: string | null
}

type PaymentCardDisplay = {
  brand: string
  last4: string
  exp_month: number
  exp_year: number
}

type ReservationPreview = {
  siteName: string | null
  siteNumber: string | null
}

type EmergencyContactDisplay = {
  name: string
  phone: string
}

type GuestAddressDisplay = {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

type SpousePartnerDisplay = {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  isAlternateContact: boolean
}

type ChildDisplay = {
  firstName: string
  dateOfBirth: string | null
  specialNeedsAllergies: string | null
}

type VehicleDisplay = {
  id: string
  vehicleType: string
  rvType: string | null
  personalVehicleType: string | null
  year: number | null
  make: string | null
  model: string | null
  color: string | null
  licensePlate: string | null
  licensePlateState: string | null
  isPrimary: boolean
}

function mapChildren(value: unknown): ChildDisplay[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((child) => child && typeof child === 'object' && typeof (child as { first_name?: unknown }).first_name === 'string')
    .map((child) => {
      const c = child as {
        first_name: string
        date_of_birth?: unknown
        special_needs_allergies?: unknown
      }
      return {
        firstName: c.first_name,
        dateOfBirth: typeof c.date_of_birth === 'string' ? c.date_of_birth : null,
        specialNeedsAllergies:
          typeof c.special_needs_allergies === 'string'
            ? c.special_needs_allergies
            : null,
      }
    })
}

function PaymentCardLogo({ brand }: { brand: string }) {
  const normalized = brand.trim().toLowerCase()
  switch (normalized) {
    case 'visa':
      return <VisaFlatRoundedIcon width={56} />
    case 'mastercard':
      return <MastercardFlatRoundedIcon width={56} />
    case 'amex':
    case 'american express':
    case 'americanexpress':
      return <AmericanExpressFlatRoundedIcon width={56} />
    case 'discover':
      return <DiscoverFlatRoundedIcon width={56} />
    default:
      return <GenericFlatRoundedIcon width={56} />
  }
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
}

const statusTextColors: Record<string, string> = {
  pending: 'text-yellow-600',
  confirmed: 'text-blue-600',
  checked_in: 'text-green-600',
  checked_out: 'text-gray-600',
  cancelled: 'text-red-600',
  no_show: 'text-orange-600',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatMoney(dollars: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  if (!first) return '?'
  if (parts.length >= 2) {
    const second = parts[1]
    return ((first[0] ?? '') + (second?.[0] ?? '')).toUpperCase().slice(0, 2)
  }
  return first.slice(0, 2).toUpperCase() || '?'
}

export function GuestReservationsSheet({
  open,
  onOpenChange,
  guest,
  propertyId,
}: GuestReservationsSheetProps) {
  const [reservations, setReservations] = useState<ReservationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [guestDetailsLoading, setGuestDetailsLoading] = useState(false)
  const [paymentCard, setPaymentCard] = useState<PaymentCardDisplay | null>(null)
  const [reservationPreview, setReservationPreview] = useState<ReservationPreview | null>(null)
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContactDisplay | null>(null)
  const [guestAddress, setGuestAddress] = useState<GuestAddressDisplay | null>(null)
  const [spousePartner, setSpousePartner] = useState<SpousePartnerDisplay | null>(null)
  const [children, setChildren] = useState<ChildDisplay[]>([])
  const [vehicles, setVehicles] = useState<VehicleDisplay[]>([])

  useEffect(() => {
    if (!open || !propertyId || !guest?.id) return

    let cancelled = false
    setIsLoading(true)
    setFetchError(null)
    setReservations([])
    setPaymentCard(null)
    setReservationPreview(null)
    setEmergencyContact(null)
    setGuestAddress(null)
    setSpousePartner(null)
    setChildren([])
    setVehicles([])

    const url = `/api/v1/properties/${propertyId}/reservations?guestId=${encodeURIComponent(guest.id)}&limit=50`
    fetch(url)
      .then(async (res) => {
        let json: { data?: { reservations?: unknown }; error?: { message?: string; details?: { message?: string } } }
        try {
          json = await res.json()
        } catch {
          throw new Error('Invalid response from server')
        }
        if (cancelled) return
        if (!res.ok) {
          const msg =
            json?.error?.details && typeof json.error.details === 'object' && 'message' in json.error.details
              ? (json.error.details as { message?: string }).message
              : json?.error?.message
          throw new Error(msg ?? 'Failed to load reservations')
        }
        const list = json?.data?.reservations
        if (!cancelled) {
          setReservations(Array.isArray(list) ? (list as ReservationItem[]) : [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load reservations')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, guest?.id, propertyId])

  useEffect(() => {
    if (!open || !guest?.id) return

    let cancelled = false
    setGuestDetailsLoading(true)

    fetch(`/api/v1/guests/${guest.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        const ec = json?.data?.emergencyContact
        if (
          json?.success === true &&
          ec &&
          typeof ec.name === 'string' &&
          ec.name.trim().length > 0 &&
          typeof ec.phone === 'string' &&
          ec.phone.trim().length > 0
        ) {
          setEmergencyContact({
            name: ec.name,
            phone: ec.phone,
          })
        }

        const address = json?.data?.address
        if (
          json?.success === true &&
          address &&
          typeof address.street === 'string' &&
          typeof address.city === 'string' &&
          typeof address.state === 'string' &&
          typeof address.zipCode === 'string' &&
          typeof address.country === 'string' &&
          [
            address.street,
            address.city,
            address.state,
            address.zipCode,
            address.country,
          ].some((value) => value.trim().length > 0)
        ) {
          setGuestAddress({
            street: address.street,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country,
          })
        }

        const spouseFromGuest = json?.data?.spousePartner
        if (
          json?.success === true &&
          spouseFromGuest &&
          (typeof spouseFromGuest.firstName === 'string' ||
            typeof spouseFromGuest.lastName === 'string' ||
            typeof spouseFromGuest.email === 'string' ||
            typeof spouseFromGuest.phone === 'string')
        ) {
          setSpousePartner({
            firstName: typeof spouseFromGuest.firstName === 'string' ? spouseFromGuest.firstName : null,
            lastName: typeof spouseFromGuest.lastName === 'string' ? spouseFromGuest.lastName : null,
            email: typeof spouseFromGuest.email === 'string' ? spouseFromGuest.email : null,
            phone: typeof spouseFromGuest.phone === 'string' ? spouseFromGuest.phone : null,
            isAlternateContact: spouseFromGuest.isAlternateContact === true,
          })
        }

        const rawVehicles = json?.data?.vehicles
        if (Array.isArray(rawVehicles)) {
          const mappedVehicles = rawVehicles
            .filter((vehicle) => vehicle && typeof vehicle.id === 'string' && typeof vehicle.vehicle_type === 'string')
            .map((vehicle) => ({
              id: vehicle.id as string,
              vehicleType: vehicle.vehicle_type as string,
              rvType: typeof vehicle.rv_type === 'string' ? vehicle.rv_type : null,
              personalVehicleType: typeof vehicle.personal_vehicle_type === 'string' ? vehicle.personal_vehicle_type : null,
              year: typeof vehicle.year === 'number' ? vehicle.year : null,
              make: typeof vehicle.make === 'string' ? vehicle.make : null,
              model: typeof vehicle.model === 'string' ? vehicle.model : null,
              color: typeof vehicle.color === 'string' ? vehicle.color : null,
              licensePlate: typeof vehicle.license_plate === 'string' ? vehicle.license_plate : null,
              licensePlateState: typeof vehicle.license_plate_state === 'string' ? vehicle.license_plate_state : null,
              isPrimary: vehicle.is_primary === true,
            }))
          setVehicles(mappedVehicles)
        }
      })
      .catch(() => {
        // Keep emergency contact null
      })
      .finally(() => {
        if (!cancelled) setGuestDetailsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, guest?.id])

  useEffect(() => {
    const reservationIds = reservations.map((reservation) => reservation.id).filter(Boolean)
    const firstReservationId = reservationIds[0]
    if (!open || !firstReservationId) return

    let cancelled = false
    setPreviewLoading(true)
    setPaymentCard(null)
    setReservationPreview(null)
    setChildren([])

    const loadReservationPreview = async () => {
      let childrenFromAnyReservation: ChildDisplay[] = []

      for (let index = 0; index < reservationIds.length; index += 1) {
        const reservationId = reservationIds[index]
        try {
          const res = await fetch(`/api/v1/reservations/${reservationId}`)
          const json = await res.json()
          if (cancelled || json?.success !== true) continue

          if (index === 0) {
            const pc = json?.data?.payment_card
            if (
              pc &&
              typeof pc.last4 === 'string' &&
              typeof pc.brand === 'string' &&
              typeof pc.exp_month === 'number' &&
              typeof pc.exp_year === 'number'
            ) {
              setPaymentCard({
                brand: pc.brand,
                last4: pc.last4,
                exp_month: pc.exp_month,
                exp_year: pc.exp_year,
              })
            }

            const site = json?.data?.site
            if (site && (typeof site.site_name === 'string' || typeof site.site_number === 'string')) {
              setReservationPreview({
                siteName: typeof site.site_name === 'string' ? site.site_name : null,
                siteNumber: typeof site.site_number === 'string' ? site.site_number : null,
              })
            }
          }

          if (childrenFromAnyReservation.length === 0) {
            childrenFromAnyReservation = mapChildren(json?.data?.children)
          }

          if (childrenFromAnyReservation.length > 0 && index > 0) {
            break
          }
        } catch {
          // Ignore detail failures and try next reservation
        }
      }

      if (!cancelled) {
        setChildren(childrenFromAnyReservation)
      }
    }

    loadReservationPreview()
      .catch(() => {
        // Keep preview values null on failure
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, reservations])

  const latestReservation = reservations[0] ?? null
  const guestStatus = latestReservation?.status === 'cancelled' ? 'Cancelled' : 'Verified'
  const guestStatusClass =
    latestReservation?.status === 'cancelled'
      ? 'text-red-600 border-red-200 bg-red-50 dark:text-red-300 dark:border-red-900/60 dark:bg-red-950/40'
      : 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900/60 dark:bg-emerald-950/40'
  const tripNights = latestReservation?.nights ?? 0
  const siteLabel =
    reservationPreview?.siteName?.trim() ||
    reservationPreview?.siteNumber?.trim() ||
    (latestReservation ? 'Site assigned' : 'No site')
  const showInitialLoader =
    open &&
    (isLoading || guestDetailsLoading || (reservations.length > 0 && previewLoading))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetTitle className="sr-only">Guest reservation profile</SheetTitle>
        <SheetDescription className="sr-only">
          Guest reservation profile details
        </SheetDescription>

        <div className="min-h-full bg-muted/30 p-4">
          <div className="px-1 pb-2 pt-1">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground font-semibold uppercase">
                  {getInitials(guest.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 justify-between">
                  <p className="truncate text-xl font-semibold text-foreground capitalize">{guest.name}</p>
                  <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${guestStatusClass}`}>
                    <BadgeCheck className="h-3 w-3" />
                    {guestStatus}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Guest Profile</p>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {showInitialLoader && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}



          <div className={showInitialLoader ? 'hidden' : 'space-y-3'}>
            {!isLoading && reservations.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground">
                  Reservations ({reservations.length})
                </h3>
                <div className="mt-3 space-y-3">
                  {reservations.map((res) => (
                    <div
                      key={res.id}
                      className="rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-semibold tracking-wide text-foreground">
                            {res.confirmationNumber}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateShort(res.checkInDate)} - {formatDateShort(res.checkOutDate)} · {res.nights}{' '}
                            night{res.nights !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-medium capitalize ${statusTextColors[res.status] ?? 'text-muted-foreground'}`}
                        >
                          {statusLabels[res.status] ?? res.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-background p-2 text-sm">
                        <div>
                          <p className="text-[11px] text-muted-foreground">Total</p>
                          <p className="font-semibold text-foreground">{formatMoney(res.totalAmountDollars)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Paid</p>
                          <p className="font-semibold text-foreground">{formatMoney(res.paidAmountDollars)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">Balance</p>
                          <p className={`font-semibold ${res.balanceDollars > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                            {res.balanceDollars > 0
                              ? `${formatMoney(res.balanceDollars)}`
                              : '--'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Emergency Contact</p>
              {emergencyContact ? (
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">{emergencyContact.name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium text-foreground">{emergencyContact.phone}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No emergency contact on file.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
              {guestAddress ? (
                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="leading-5">
                    {guestAddress.street.trim().length > 0 ? (
                      <p className="text-foreground">{guestAddress.street}</p>
                    ) : null}
                    {(guestAddress.city.trim().length > 0 ||
                      guestAddress.state.trim().length > 0 ||
                      guestAddress.zipCode.trim().length > 0) ? (
                      <p className="text-foreground/80">
                        {[guestAddress.city, guestAddress.state]
                          .map((value) => value.trim())
                          .filter(Boolean)
                          .join(', ')}
                        {guestAddress.zipCode.trim().length > 0
                          ? ` ${guestAddress.zipCode.trim()}`
                          : ''}
                      </p>
                    ) : null}
                    {guestAddress.country.trim().length > 0 ? (
                      <p className="text-muted-foreground">{guestAddress.country}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Address not available.</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Primary Guest</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">Name</p>
                  <p className="text-sm font-medium text-foreground capitalize">{guest.name}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Stays</p>
                  <p className="text-sm font-medium text-foreground">{guest.totalStays}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground break-all">{guest.email}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payment Card</p>
              <div className="mt-3">
                {previewLoading ? (
                  <span className="text-sm text-muted-foreground">Loading card...</span>
                ) : paymentCard ? (
                  <div className="inline-flex items-center gap-2">
                    <span className="inline-flex h-7 w-10 items-center justify-center">
                      <PaymentCardLogo brand={paymentCard.brand} />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      **** **** **** {paymentCard.last4}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    No card payment on file
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40">
                    <Heart className="h-4 w-4 text-rose-500 dark:text-rose-300" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">Spouse / Partner</p>
                </div>
                {spousePartner?.isAlternateContact ? (
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-foreground">
                    Primary Alternate
                  </span>
                ) : null}
              </div>
              {spousePartner ? (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] text-muted-foreground">First Name</p>
                    <p className="text-sm font-medium text-foreground">{spousePartner.firstName ?? '--'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Last Name</p>
                    <p className="text-sm font-medium text-foreground">{spousePartner.lastName ?? '--'}</p>
                  </div>
                  {spousePartner.phone ? (
                    <div>
                      <p className="text-[11px] text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium text-foreground">{spousePartner.phone}</p>
                    </div>
                  ) : null}
                  {spousePartner.email ? (
                    <div>
                      <p className="text-[11px] text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground break-all">{spousePartner.email}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No spouse / partner on file.</p>
              )}
            </div>

            {children.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/40">
                    <Baby className="h-4 w-4 text-violet-500 dark:text-violet-300" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">Children ({children.length})</p>
                </div>
                <div className="mt-3 space-y-2">
                  {children.map((child, index) => (
                    <div
                      key={`${child.firstName}-${index}`}
                      className={`rounded-lg border p-3 ${child.specialNeedsAllergies ? 'border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/20' : 'border-border bg-background/70'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{child.firstName}</p>
                      </div>
                      {child.dateOfBirth ? (
                        <p className="text-xs text-muted-foreground">DOB: {formatDate(child.dateOfBirth)}</p>
                      ) : null}
                      {child.specialNeedsAllergies ? (
                        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                          <TriangleAlert className="h-3 w-3" />
                          {child.specialNeedsAllergies}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="inline-flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-950/40">
                  <Car className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                </span>
                <p className="text-sm font-semibold text-foreground">Vehicles ({vehicles.length})</p>
              </div>
              {vehicles.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="rounded-lg border border-border bg-background/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || vehicle.vehicleType}
                        </p>
                        {vehicle.isPrimary ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[vehicle.vehicleType, vehicle.rvType ?? vehicle.personalVehicleType].filter(Boolean).join(' · ')}
                      </p>
                      {(vehicle.licensePlate || vehicle.color) ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {vehicle.licensePlate ? `Plate: ${vehicle.licensePlate}${vehicle.licensePlateState ? ` (${vehicle.licensePlateState})` : ''}` : ''}
                          {vehicle.licensePlate && vehicle.color ? ' · ' : ''}
                          {vehicle.color ? `Color: ${vehicle.color}` : ''}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No vehicles on file.</p>
              )}
            </div>
          </div>

          {!showInitialLoader && fetchError && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {fetchError}
            </div>
          )}

          {!showInitialLoader && !isLoading && !fetchError && reservations.length === 0 && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
              <CalendarDays className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No reservations</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This guest has no reservations yet.
              </p>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  )
}
