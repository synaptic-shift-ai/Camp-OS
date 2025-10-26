"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { Site, PriceBreakdown, CreateGuestInput } from "./types"

interface CheckoutData {
  site: Site | null
  checkInDate: string | null
  checkOutDate: string | null
  numberOfGuests: number
  priceBreakdown: PriceBreakdown | null
  guestInfo: CreateGuestInput | null
}

interface CheckoutContextType {
  checkoutData: CheckoutData
  setCheckoutData: (data: Partial<CheckoutData>) => void
  clearCheckoutData: () => void
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined)

const initialCheckoutData: CheckoutData = {
  site: null,
  checkInDate: null,
  checkOutDate: null,
  numberOfGuests: 2,
  priceBreakdown: null,
  guestInfo: null,
}

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [checkoutData, setCheckoutDataState] = useState<CheckoutData>(initialCheckoutData)

  const setCheckoutData = (data: Partial<CheckoutData>) => {
    setCheckoutDataState((prev) => ({ ...prev, ...data }))
  }

  const clearCheckoutData = () => {
    setCheckoutDataState(initialCheckoutData)
  }

  return (
    <CheckoutContext.Provider value={{ checkoutData, setCheckoutData, clearCheckoutData }}>
      {children}
    </CheckoutContext.Provider>
  )
}

export function useCheckout() {
  const context = useContext(CheckoutContext)
  if (context === undefined) {
    throw new Error("useCheckout must be used within a CheckoutProvider")
  }
  return context
}
