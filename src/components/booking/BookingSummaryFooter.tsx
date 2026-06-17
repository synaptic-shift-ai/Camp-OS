// "use client"

// import { Check } from "lucide-react"
// import { useCheckout } from "@/lib/booking/checkout-context"

// /**
//  * Shared booking summary footer — renders property-specific reassurance items
//  * below the booking summary card on guest-info and payment pages.
//  * Reads booking rules and cancellation config from CheckoutData context.
//  */
// export function BookingSummaryFooter() {
//   const { checkoutData } = useCheckout()

//   const items: string[] = []

//   // 1. Cancellation guarantee (from cancellation_policy_config refund tiers)
//   const tiers = checkoutData.cancellationPolicyConfig?.refund_tiers
//   if (tiers && tiers.length > 0) {
//     const bestTier = tiers.reduce((best, tier) =>
//       tier.refund_percentage > best.refund_percentage ? tier : best
//     )
//     if (bestTier.refund_percentage === 100) {
//       items.push(`Free cancellation up to ${bestTier.days_before_reservation} days before check-in`)
//     } else if (bestTier.refund_percentage > 0) {
//       items.push(`Partial refund up to ${bestTier.days_before_reservation} days before check-in`)
//     }
//   }

//   // 2. Instant booking (from booking_rules_config)
//   // When undefined/null (legacy data), default to showing (backwards compatible)
//   const instantBooking = checkoutData.bookingRulesConfig?.instant_booking_enabled
//   if (instantBooking === true || instantBooking === undefined) {
//     items.push("Instant booking confirmation")
//   }

//   // 3. Static items (always shown)
//   items.push("Email receipt & details")
//   items.push("Secure payment guarantee")

//   return (
//     <div className="mt-4 space-y-3">
//       {items.map((item) => (
//         <div key={item} className="flex items-center space-x-2 text-sm text-muted-foreground">
//           <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-emerald-500" />
//           <span>{item}</span>
//         </div>
//       ))}
//     </div>
//   )
// }
