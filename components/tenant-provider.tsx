"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"

interface TenantContextType {
  subdomain: string | null
  isMainSite: boolean
  propertyId: string | null
  propertyName: string | null
  isLoading: boolean
}

const TenantContext = createContext<TenantContextType>({
  subdomain: null,
  isMainSite: true,
  propertyId: null,
  propertyName: null,
  isLoading: true,
})

export function useTenant() {
  return useContext(TenantContext)
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantInfo, setTenantInfo] = useState<TenantContextType>({
    subdomain: null,
    isMainSite: true,
    propertyId: null,
    propertyName: null,
    isLoading: true,
  })

  useEffect(() => {
    async function fetchTenantInfo() {
      try {
        const response = await fetch("/api/tenant")
        if (response.ok) {
          const data = await response.json()
          setTenantInfo({
            ...data,
            isLoading: false,
          })
        } else {
          setTenantInfo((prev) => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error("[v0] Error fetching tenant info:", error)
        setTenantInfo((prev) => ({ ...prev, isLoading: false }))
      }
    }

    fetchTenantInfo()
  }, [])

  return <TenantContext.Provider value={tenantInfo}>{children}</TenantContext.Provider>
}
