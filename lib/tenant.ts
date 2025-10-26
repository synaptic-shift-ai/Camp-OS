import { headers } from "next/headers"

export interface TenantInfo {
  subdomain: string | null
  isMainSite: boolean
  propertyId?: string
}

/**
 * Get tenant information from the request headers
 * Supports both subdomain-based and path-based multi-tenancy
 */
export async function getTenantInfo(): Promise<TenantInfo> {
  const headersList = await headers()
  const host = headersList.get("host") || ""

  // Extract subdomain from host
  // Examples:
  // - pinevalley.camp-os.com -> pinevalley
  // - localhost:3000 -> null (main site)
  // - camp-os.com -> null (main site)

  const parts = host.split(".")

  // For localhost or IP addresses
  if (host.includes("localhost") || host.match(/^\d+\.\d+\.\d+\.\d+/)) {
    return {
      subdomain: null,
      isMainSite: true,
    }
  }

  // For production domains (subdomain.camp-os.com)
  if (parts.length >= 3) {
    const subdomain = parts[0]
    // Exclude 'www' as a subdomain
    if (subdomain !== "www") {
      return {
        subdomain,
        isMainSite: false,
      }
    }
  }

  // Main site (www.camp-os.com or camp-os.com)
  return {
    subdomain: null,
    isMainSite: true,
  }
}

/**
 * Check if the current request is for a tenant subdomain
 */
export async function isTenantSite(): Promise<boolean> {
  const tenantInfo = await getTenantInfo()
  return !tenantInfo.isMainSite && tenantInfo.subdomain !== null
}

/**
 * Get the property ID for the current tenant
 * This would typically query the database based on subdomain
 */
export async function getTenantPropertyId(subdomain: string): Promise<string | null> {
  // This will be implemented with actual database query
  // For now, return null - you'll need to query Supabase
  return null
}
