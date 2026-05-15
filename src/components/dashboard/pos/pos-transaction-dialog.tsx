"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2, Search, ShoppingCart } from "lucide-react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { isAccessDeniedError } from "@/lib/utils/is-access-denied-error"
import { useProperty } from "@/components/property-context"
import { PermissionButton } from "@/components/ui/permission-button"
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReservationOption {
  id: string
  guestId: string
  confirmationNumber: string
  guestName: string
  siteName: string
  status: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINKAGE_OPTIONS = [
  { value: "standalone", label: "Standalone (no reservation)" },
  { value: "linked", label: "Link to Reservation" },
] as const

const TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PosTransactionDialog() {
  const router = useRouter()
  const { selectedPropertyId } = useProperty()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form state
  const [linkage, setLinkage] = useState<string>("standalone")
  const [description, setDescription] = useState("")
  const [amountDollars, setAmountDollars] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Reservation search state
  const [reservationSearch, setReservationSearch] = useState("")
  const [reservations, setReservations] = useState<ReservationOption[]>([])
  const [selectedReservationId, setSelectedReservationId] = useState<string>("")
  const [reservationsLoading, setReservationsLoading] = useState(false)
  const cleanFormRef = useRef<string>("")

  const amountCents = Math.round(parseFloat(amountDollars || "0") * 100)
  const selectedReservation = reservations.find((r) => r.id === selectedReservationId)

  const isFormValid =
    description.trim().length > 0 &&
    amountCents >= 1 &&
    (linkage === "standalone" || selectedReservationId !== "")

  const isDirty = JSON.stringify({ linkage, description, amountDollars, selectedReservationId }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({ isDirty, open, onOpenChange: setOpen })

  // Reset form on open/close
  useEffect(() => {
    if (!open) return
    setError(null)
    setLinkage("standalone")
    setDescription("")
    setAmountDollars("")
    setSelectedReservationId("")
    setReservationSearch("")
    setReservations([])
    cleanFormRef.current = JSON.stringify({ linkage: "standalone", description: "", amountDollars: "", selectedReservationId: "" })
  }, [open])

  // Fetch active reservations when linked mode is selected
  const fetchReservations = useCallback(async () => {
    if (!selectedPropertyId || linkage !== "linked") return

    setReservationsLoading(true)
    try {
      const params = new URLSearchParams({
        pageSize: "20",
        status: "confirmed,checked_in",
        sortBy: "checkIn",
        sortOrder: "asc",
      })

      const res = await fetch(
        `/api/v1/properties/${selectedPropertyId}/reservations?${params}`,
      )
      const json = await res.json()

      if (json.success && json.data) {
        const items: ReservationOption[] = (json.data.items ?? json.data ?? []).map(
          (r: Record<string, unknown>) => ({
            id: r.id as string,
            guestId: (r.guest_id ?? "") as string,
            confirmationNumber: (r.confirmation_number ?? "") as string,
            guestName: [
              r.guest_first_name,
              r.guest_last_name,
            ]
              .filter(Boolean)
              .join(" ") as string,
            siteName: (r.site_name ?? "") as string,
            status: (r.status ?? "") as string,
          }),
        )
        setReservations(items)
      }
    } catch {
      setReservations([])
    } finally {
      setReservationsLoading(false)
    }
  }, [selectedPropertyId, linkage])

  useEffect(() => {
    if (open && linkage === "linked") {
      fetchReservations()
    }
  }, [open, linkage, fetchReservations])

  // Filter reservations by search text
  const filteredReservations = reservationSearch.trim()
    ? reservations.filter(
        (r) =>
          r.guestName.toLowerCase().includes(reservationSearch.toLowerCase()) ||
          r.confirmationNumber.toLowerCase().includes(reservationSearch.toLowerCase()) ||
          r.siteName.toLowerCase().includes(reservationSearch.toLowerCase()),
      )
    : reservations

  const handleSubmit = async () => {
    const cents = Math.round(parseFloat(amountDollars || "0") * 100)

    if (!description.trim()) {
      setError("Description is required")
      return
    }
    if (cents < 1) {
      setError("Amount must be at least $0.01")
      return
    }
    if (linkage === "linked" && !selectedReservationId) {
      setError("Please select a reservation")
      return
    }

    try {
      setLoading(true)
      setError(null)

      const reservationId = linkage === "linked" ? selectedReservationId : null
      const guestId = linkage === "linked" ? selectedReservation?.guestId ?? null : null

      // Step 1: Create the charge
      const chargeRes = await fetch("/api/v1/financial/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          guest_id: guestId,
          description: description.trim(),
          amount_cents: cents,
          source: "pos",
        }),
      })

      if (!chargeRes.ok) {
        const data = await chargeRes.json().catch(() => null)
        throw new Error(data?.error?.message ?? "Failed to create charge")
      }

      // Step 2: Record the payment
      const paymentRes = await fetch("/api/v1/financial/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservation_id: reservationId,
          guest_id: guestId,
          amount_cents: cents,
          payment_method: "cash",
          processor: null,
          reference: null,
          source: "pos",
        }),
      })

      if (!paymentRes.ok) {
        const data = await paymentRes.json().catch(() => null)
        throw new Error(data?.error?.message ?? "Failed to record payment")
      }

      toast({
        title: "POS transaction recorded",
        description: `$${(cents / 100).toFixed(2)} charge and payment recorded successfully.`,
        className: TOAST_CLASS,
        variant: "success",
      })
      setOpen(false)
      router.refresh()
    } catch (err) {
      if (isAccessDeniedError(err)) {
        toast({
          title: "Access denied",
          description:
            "You don't have permission for this action. Contact your property administrator.",
          variant: "destructive",
          className: TOAST_CLASS,
        })
        return
      }
      console.error("[PosTransactionDialog] Error recording transaction", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={guardedOnOpenChange}>
      <PermissionButton permission="financial.record_payment" variant="outline" size="sm">
        <SheetTrigger asChild>
          <button type="button" className="inline-flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            POS Transaction
          </button>
        </SheetTrigger>
      </PermissionButton>

      <SheetContent className="w-[90vw] max-w-[90vw] overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>Record POS Transaction</SheetTitle>
          <SheetDescription>
            Record a point-of-sale charge and payment.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Linkage */}
          <div className="space-y-2">
            <Label>Linkage</Label>
            <Select value={linkage} onValueChange={setLinkage} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINKAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reservation selector — only shown when linked */}
          {linkage === "linked" && (
            <div className="space-y-2">
              <Label>Reservation</Label>
              {reservationsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading reservations…
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search by guest, confirmation #, or site…"
                      value={reservationSearch}
                      onChange={(e) => setReservationSearch(e.target.value)}
                      className="pl-9"
                      disabled={loading}
                    />
                  </div>
                  <Select
                    value={selectedReservationId}
                    onValueChange={setSelectedReservationId}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a reservation…" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredReservations.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No active reservations found
                        </SelectItem>
                      ) : (
                        filteredReservations.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs">
                                {r.guestName} — {r.confirmationNumber}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {r.siteName}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pos-description">Description</Label>
            <Input
              id="pos-description"
              type="text"
              placeholder="e.g. Firewood bundle, Snack shop purchase…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              maxLength={500}
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="pos-amount">Amount</Label>
            <Input
              id="pos-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="$ 0.00"
              value={amountDollars}
              onChange={(e) => setAmountDollars(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => guardedOnOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isFormValid}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Recording…" : "Record Transaction"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    {unsavedChangesDialog}
  )
}
