"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"

// Property interface matching v1 API PropertyDTO (camelCase)
export interface Property {
  id: string
  name: string
  slug: string
  companyId: string
  ownerId: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  description: string | null
  // Onboarding fields (v1 API format)
  onboardingCompleted: boolean
  onboardingCompletedAt: string | null
  onboardingStatus: string
  // Stripe fields
  stripeConnected: boolean
  stripeConnectedAt: string | null
  stripeAccountId: string | null
  // Booking
  bookingPageSlug: string | null
  canAcceptBookings: boolean
  // Settings (may be null from API)
  settings: {
    checkInTime: string | null
    checkOutTime: string | null
    timezone: string | null
    cancellationPolicy: string | null
    minStayNights: number | null
    maxStayNights: number | null
    bookingLeadTimeDays: number | null
    customRules: string | null
  } | null
  amenities: string[] | null
  // Timestamps
  createdAt: string
  updatedAt: string
  // Optional site count (not always present in API response)
  siteCount?: number
  // Legacy compatibility - mapped from v1 response
  wizardProgress?: Record<string, boolean>
  heroImageUrl: string | null
  galleryImageUrls: string[] | null
}

interface PropertyContextType {
  properties: Property[]
  selectedProperty: Property | null
  selectedPropertyId: string | null
  selectProperty: (id: string) => void
  refreshProperties: () => Promise<void>
  isLoading: boolean
  hasIncompleteSetup: boolean
  incompleteProperties: Property[]
}

const PropertyContext = createContext<PropertyContextType>({
  properties: [],
  selectedProperty: null,
  selectedPropertyId: null,
  selectProperty: () => {},
  refreshProperties: async () => {},
  isLoading: true,
  hasIncompleteSetup: false,
  incompleteProperties: [],
})

export function useProperty() {
  return useContext(PropertyContext)
}

const SELECTED_PROPERTY_KEY = "campos_selected_property_id"

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Track hydration state to prevent SSR/client mismatch
  const [isHydrated, setIsHydrated] = useState(false)

  // Mark as hydrated on mount (client-side only)
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Fetch properties from API
  const fetchProperties = useCallback(async () => {
    // Only fetch after hydration to ensure localStorage is available
    if (typeof window === "undefined") return

    try {
      setIsLoading(true)
      // Migrated to v1 API (Phase 4, Week 13-14)
      const response = await fetch("/api/v1/properties")
      const result = await response.json()

      // Handle both success and error responses gracefully
      // New users may get 404 "Company not found" which is expected
      if (!response.ok) {
        // 404 is expected for new users - just set empty properties
        if (response.status === 404) {
          setProperties([])
          return
        }
        console.error("Failed to fetch properties:", response.status, result)
        return
      }

      // v1 API returns: { success: true, data: { items: [...], pagination: {...} } }
      // Handle both array and object data formats for compatibility
      let items: Property[] = []
      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          // Direct array format
          items = result.data
        } else if (Array.isArray(result.data.items)) {
          // Paginated format with items array
          items = result.data.items
        }
      }

      // Debug: Log what we received
      if (items.length === 0) {
        console.warn("[PropertyContext] No properties found in API response:", result)
      } else {
        console.log("[PropertyContext] Loaded", items.length, "properties")
      }

      setProperties(items)

      // Auto-select property
      if (items.length > 0) {
        // Try to restore from localStorage (safe after hydration)
        const savedPropertyId = localStorage.getItem(SELECTED_PROPERTY_KEY)
        const savedPropertyExists = items.some((p: Property) => p.id === savedPropertyId)

        if (savedPropertyId && savedPropertyExists) {
          setSelectedPropertyId(savedPropertyId)
        } else {
          // Select first property by default
          const firstProperty = items[0]
          if (firstProperty) {
            setSelectedPropertyId(firstProperty.id)
            localStorage.setItem(SELECTED_PROPERTY_KEY, firstProperty.id)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching properties:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch on mount - wait for hydration
  useEffect(() => {
    if (isHydrated) {
      fetchProperties()
    }
  }, [fetchProperties, isHydrated])

  // Handle property selection
  const selectProperty = useCallback((id: string) => {
    setSelectedPropertyId(id)
    localStorage.setItem(SELECTED_PROPERTY_KEY, id)
  }, [])

  // Computed values
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId) || null
  const incompleteProperties = properties.filter((p) => !p.onboardingCompleted)
  const hasIncompleteSetup = incompleteProperties.length > 0

  const value: PropertyContextType = {
    properties,
    selectedProperty,
    selectedPropertyId,
    selectProperty,
    refreshProperties: fetchProperties,
    isLoading,
    hasIncompleteSetup,
    incompleteProperties,
  }

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
}
