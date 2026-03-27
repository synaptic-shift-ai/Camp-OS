"use client"

import type { UseFormRegister } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  register: UseFormRegister<any>
}

export function TermsPoliciesSection({ register }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Terms &amp; policies</h3>
        <p className="text-sm text-muted-foreground">Manage terms and cancellation policy</p>
      </div>
      <div>
        <Label htmlFor="termsAndConditions">Terms and Conditions</Label>
        <Textarea
          id="termsAndConditions"
          {...register("termsAndConditions")}
          placeholder="Write terms and conditions for your property..."
          rows={5}
          className="mt-1"
        />
      </div>
      <div className="border-t border-border pt-4">
        <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
        <Textarea
          id="cancellationPolicy"
          {...register("cancellationPolicy")}
          placeholder="Your cancellation and refund policy..."
          rows={4}
          className="mt-1"
        />
      </div>
    </div>
  )
}
