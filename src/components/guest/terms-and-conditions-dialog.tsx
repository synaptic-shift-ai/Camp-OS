"use client"

import { useState } from "react"
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

const PROPERTY_TERMS_AND_CONDITIONS = `
By continuing with this reservation, you acknowledge and agree to the following property terms:

1) Check-in / Check-out
- Check-in begins at 3:00 PM.
- Check-out is no later than 11:00 AM.
- Late check-out may incur additional fees.

2) Occupancy and Visitors
- Maximum occupancy limits for your selected site must be followed at all times.
- Guests are responsible for the behavior of all visitors in their party.

3) Quiet Hours
- Quiet hours are from 10:00 PM to 7:00 AM daily.
- Excessive noise or disruptive behavior may result in removal without refund.

4) Site Care and Safety
- Open fires are only allowed in designated fire rings.
- All trash must be disposed of in designated bins before departure.
- Property management reserves the right to enforce all posted safety rules.

5) Pets
- Pets must remain leashed and attended at all times unless in a designated pet area.
- Owners are responsible for cleaning up after pets.

6) Liability
- Guests assume responsibility for personal belongings and acknowledge use of facilities is at their own risk.
`

type TermsAndConditionsDialogProps = {
  onAccept?: () => void
  termsText?: string | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type TermsBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }

function parseTermsBlocks(text: string): TermsBlock[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const blocks: TermsBlock[] = []
  let currentBullets: string[] = []

  const pushBullets = () => {
    if (currentBullets.length === 0) return
    blocks.push({ type: "bullets", items: currentBullets })
    currentBullets = []
  }

  for (const line of lines) {
    const bulletMatch = line.match(/^(?:[-*•●]\s+)(.+)$/)
    if (bulletMatch?.[1]) {
      currentBullets.push(bulletMatch[1].trim())
      continue
    }

    pushBullets()
    blocks.push({ type: "paragraph", text: line })
  }

  pushBullets()
  return blocks
}

export function TermsAndConditionsDialog({ onAccept, termsText, open, onOpenChange }: TermsAndConditionsDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isOpen = open ?? uncontrolledOpen

  const setIsOpen = (nextOpen: boolean) => {
    if (onOpenChange) onOpenChange(nextOpen)
    else setUncontrolledOpen(nextOpen)
  }
  const resolvedTerms =
    typeof termsText === "string" && termsText.trim().length > 0 ? termsText.trim() : PROPERTY_TERMS_AND_CONDITIONS
  const termsBlocks = parseTermsBlocks(resolvedTerms)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-[#2D5A27] underline dark:text-emerald-400"
          onClick={(event) => event.stopPropagation()}
        >
          terms and conditions
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl">
        <div className="space-y-1 border-b border-border/60 px-6 pb-4 pt-6">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl">Terms and Conditions</DialogTitle>
            <DialogDescription className="text-left text-sm leading-snug text-muted-foreground">
              Please read the following before accepting. Scroll to review the full text.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="max-h-[min(58vh,26rem)] overflow-y-auto overscroll-contain px-6 py-5">
          <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-4 sm:px-5 sm:py-5">
            <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
              {termsBlocks.map((block, index) =>
                block.type === "bullets" ? (
                  <ul key={`list-${index}`} className="list-disc space-y-1.5 pl-5">
                    {block.items.map((item, itemIndex) => (
                      <li key={`item-${index}-${itemIndex}`} className="whitespace-pre-line leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={`paragraph-${index}`} className="whitespace-pre-line [text-wrap:pretty]">
                    {block.text}
                  </p>
                )
              )}
            </div>
          </div>
        </div>
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
