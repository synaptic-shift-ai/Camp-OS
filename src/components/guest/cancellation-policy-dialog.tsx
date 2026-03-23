"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { GuestCancellationPolicyText } from "@/components/guest/guest-cancellation-policy-text"
import {
  GUEST_CANCELLATION_POLICY_FALLBACK,
  type GuestCancellationPolicyApiData,
} from "@/lib/guest/guest-cancellation-policy"
import { useState } from "react"

type CancellationPolicyDialogProps = {
  data: GuestCancellationPolicyApiData | null
  isLoading?: boolean
  onAccept?: () => void
}

export function CancellationPolicyDialog({ data, isLoading = false, onAccept }: CancellationPolicyDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const policyText = data?.policy_display_text ?? GUEST_CANCELLATION_POLICY_FALLBACK

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-[#2D5A27] underline dark:text-emerald-400"
          onClick={(event) => event.stopPropagation()}
        >
          cancellation policy
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <div className="space-y-2 border-b border-border/60 px-6 pb-4 pt-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl">Cancellation policy</DialogTitle>
            <DialogDescription className="text-sm leading-snug text-muted-foreground">
              Please read the following before accepting. Scroll to review the full text.
            </DialogDescription>
          </DialogHeader>
        </div>

        {isLoading ? (
          <div className="px-6 py-6">
            <p className="text-sm text-muted-foreground">Loading cancellation policy…</p>
          </div>
        ) : (
          <div className="max-h-[min(58vh,26rem)] overflow-y-auto overscroll-contain px-6 py-5">
            <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-4">
              <div className="text-sm leading-relaxed text-foreground/90">
                <GuestCancellationPolicyText text={policyText} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border/60 bg-background px-6 py-4 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => {
              onAccept?.()
              setIsOpen(false)
            }}
          >
            Accept and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
