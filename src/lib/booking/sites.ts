/**
 * Site Query Functions
 *
 * Handles site lookups and searches
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { AvailableSite, BookingResult } from './types'

/**
 * Get site details by ID
 *
 * @param siteId - Site ID to fetch
 * @returns Site details in UI-friendly format or error
 */
export async function getSiteById(siteId: string): Promise<BookingResult<AvailableSite>> {
  const supabase = createServiceRoleClient()

  const { data: site, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .single()

  if (error || !site) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Site not found',
      },
    }
  }

  // Transform to AvailableSite format
  const availableSite: AvailableSite = {
    id: site.id,
    name: site.site_name || `Site ${site.site_number}`,
    site_number: site.site_number,
    site_type: site.site_type,
    max_occupancy: site.max_occupancy,
    base_price_per_night: site.base_price,
    amenities: {}, // TODO: Convert amenities array to object
    image_url: site.images?.[0],
  }

  return {
    success: true,
    data: availableSite,
  }
}

/**
 * Get similar sites at the same property
 *
 * @param siteId - Current site ID
 * @param limit - Maximum number of similar sites to return
 * @returns List of similar available sites
 */
export async function getSimilarSites(
  siteId: string,
  limit: number = 4
): Promise<BookingResult<AvailableSite[]>> {
  const supabase = createServiceRoleClient()

  // Get current site to find property and type
  const { data: currentSite, error: siteError } = await supabase
    .from('sites')
    .select('property_id, site_type')
    .eq('id', siteId)
    .single()

  if (siteError || !currentSite) {
    return {
      success: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'Site not found',
      },
    }
  }

  // Get similar sites
  const { data: sites, error } = await supabase
    .from('sites')
    .select('*')
    .eq('property_id', currentSite.property_id)
    .eq('site_type', currentSite.site_type)
    .eq('status', 'available')
    .neq('id', siteId)
    .limit(limit)

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Error fetching similar sites',
      },
    }
  }

  // Convert to AvailableSite format (simplified version)
  const availableSites = (sites || []).map((site: any) => ({
    id: site.id,
    name: site.site_name || `Site ${site.site_number}`,
    site_number: site.site_number,
    site_type: site.site_type,
    max_occupancy: site.max_occupancy,
    base_price_per_night: site.base_price,
    amenities: {}, // TODO: Convert amenities array to object
    image_url: site.images?.[0],
  }))

  return {
    success: true,
    data: availableSites,
  }
}
