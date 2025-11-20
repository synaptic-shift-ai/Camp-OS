"use client"

import { CheckoutProvider } from "@/lib/booking/checkout-context"

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutProvider>{children}</CheckoutProvider>
}
