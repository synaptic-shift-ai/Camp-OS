"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImageOff } from "lucide-react"

export type PropertyAmenityDetails = {
  name: string
  description?: string | null
  iconUrl?: string | null
}

type PropertyAmenitiesDetailsDialogProps = {
  amenity: PropertyAmenityDetails
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function PropertyAmenitiesDetailsDialog({
  amenity,
  children,
  open,
  onOpenChange,
}: PropertyAmenitiesDetailsDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isOpen = open ?? uncontrolledOpen

  const setIsOpen = (nextOpen: boolean) => {
    if (onOpenChange) onOpenChange(nextOpen)
    else setUncontrolledOpen(nextOpen)
  }

  const title = amenity.name?.trim() || "Amenity details"
  const description = (amenity.description ?? "").trim() || "No description provided."
  const iconUrl = (amenity.iconUrl ?? "").trim() || null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent className="max-w-lg gap-0 p-0">
        <div className="space-y-1 border-b border-border/60 px-6 pb-4 pt-6">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconUrl}
                    alt=""
                    className="h-6 w-6 dark:brightness-0 dark:invert"
                  />
                ) : (
                  <ImageOff
                    className="h-5 w-5 text-muted-foreground dark:text-white/80"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl leading-snug">{title}</DialogTitle>
                <DialogDescription className="text-left text-sm leading-snug text-muted-foreground">
                  Property amenity
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Description</h3>
              <p className="text-sm leading-relaxed text-foreground/90 [text-wrap:pretty] whitespace-pre-line">
                {description}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-background px-6 py-4 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

