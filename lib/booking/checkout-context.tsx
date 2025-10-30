"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { CheckoutData } from "./types"

interface CheckoutContextType {
  checkoutData: CheckoutData
  setCheckoutData: (data: Partial<CheckoutData>) => void
  clearCheckoutData: () => void
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined)

const initialCheckoutData: CheckoutData = {}
const STORAGE_KEY = "campground-checkout-data"

// Helper to safely parse stored data
function getStoredCheckoutData(): CheckoutData {
  if (typeof window === "undefined") return initialCheckoutData

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return initialCheckoutData

    const parsed = JSON.parse(stored)

    // Convert date strings back to Date objects
    if (parsed.checkInDate) parsed.checkInDate = new Date(parsed.checkInDate)
    if (parsed.checkOutDate) parsed.checkOutDate = new Date(parsed.checkOutDate)

    return parsed
  } catch (error) {
    console.error("Failed to parse checkout data from storage:", error)
    return initialCheckoutData
  }
}

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [checkoutData, setCheckoutDataState] = useState<CheckoutData>(initialCheckoutData)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    setCheckoutDataState(getStoredCheckoutData())
    setIsHydrated(true)
  }, [])

  // Save to sessionStorage whenever data changes
  useEffect(() => {
    if (!isHydrated) return

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(checkoutData))
    } catch (error) {
      console.error("Failed to save checkout data to storage:", error)
    }
  }, [checkoutData, isHydrated])

  const setCheckoutData = (data: Partial<CheckoutData>) => {
    setCheckoutDataState((prev) => ({ ...prev, ...data }))
  }

  const clearCheckoutData = () => {
    setCheckoutDataState(initialCheckoutData)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error("Failed to clear checkout data from storage:", error)
    }
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
