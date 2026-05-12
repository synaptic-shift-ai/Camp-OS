'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type VendorDetailDialogTarget = {
  id: string
  displayId: string
  name: string
  service: string
  contact: string
  phone: string | null
  linkedWorkOrders: number | null
}

type VendorDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor: VendorDetailDialogTarget | null
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '—') return null
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function VendorDetailDialog({ open, onOpenChange, vendor }: VendorDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-y-auto bg-background p-6 text-foreground sm:rounded-lg">
        {vendor ? (
          <>
            <DialogHeader className="space-y-2 pb-5 text-left">
              <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
                Vendor Details
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                View details for this vendor.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold text-sm">
                  {vendor.name
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'V'}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{vendor.name}</div>
                  <div className="text-sm text-muted-foreground truncate">{vendor.service}</div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Vendor ID" value={vendor.displayId} />
                <DetailField label="Service" value={vendor.service} />
                <DetailField label="Contact" value={vendor.contact} />
                <DetailField label="Phone" value={vendor.phone} />
                <DetailField
                  label="Linked Work Orders"
                  value={vendor.linkedWorkOrders != null ? String(vendor.linkedWorkOrders) : null}
                />
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
