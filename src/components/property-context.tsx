"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"

export interface Property {
  id: string
  name: string
  slug: string
  company_id: string | null
  owner_id: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  description: string | null
  onboarding_completed: boolean
  onboarding_completed_at: string | null
  wizard_step_completed: string
  wizard_progress: Record<string, boolean>
  site_count?: number
  stripe_connected_at: string | null
  booking_page_slug: string | null
  hero_image_url: string | null
  gallery_images: unknown[]
  timezone: string | null
  check_in_time: string | null
  check_out_time: string | null
  check_in_instructions: string | null
  check_out_instructions: string | null
  cancellation_policy: string | null
  house_rules: string | null
  created_at: string
  updated_at: string
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

      if (response.ok) {
        const result = await response.json()

        // v1 API uses standard response envelope: { success: true, data: { items: [...], pagination: {...} } }
        const items = result.success && result.data?.items ? result.data.items : []

        if (result.success && items.length >= 0) {
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
              setSelectedPropertyId(items[0].id)
              localStorage.setItem(SELECTED_PROPERTY_KEY, items[0].id)
            }
          }
        } else {
          console.error("Failed to fetch properties: unexpected response format", result)
        }
      } else {
        console.error("Failed to fetch properties:", response.statusText)
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
  const incompleteProperties = properties.filter((p) => !p.onboarding_completed)
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
