"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import type { CheckoutData } from "./types"

interface CheckoutContextType {
  checkoutData: CheckoutData
  setCheckoutData: (data: Partial<CheckoutData>) => void
  clearCheckoutData: () => void
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined)

const initialCheckoutData: CheckoutData = {}

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
