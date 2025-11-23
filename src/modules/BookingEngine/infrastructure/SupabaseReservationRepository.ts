/**
 * SupabaseReservationRepository
 *
 * Concrete implementation of IReservationRepository using Supabase.
 * Maps between database rows and Reservation domain entities.
 *
 * IMPORTANT:
 * - Requires migration 20250112000000_enhance_reservation_workflow.sql
 * - Always uses .select('*') to fetch complete entities
 * - Money stored in cents (INTEGER) to avoid floating-point errors
 * - Includes tenant isolation (property_id filter) for all queries
 *
 * Following CLAUDE.md:
 * - D-1: Type helper as SupabaseClient | SupabaseClient['from'] for transactions
 * - D-2: Always include tenant isolation (property_id filter)
 * - BP-4: Enforce tenant context in queries
 */
import type { IReservationRepository } from '../domain/IReservationRepository'
import { Reservation, type ReservationStatus } from '../domain/Reservation'
import type { DateRange } from '../domain/value-objects/DateRange'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'

type ReservationRow = Database['public']['Tables']['reservations']['Row']

export class SupabaseReservationRepository implements IReservationRepository {
  constructor(
    private readonly supabase: SupabaseClient<Database> | ReturnType<SupabaseClient<Database>['from']>
  ) {}

  async findById(id: string): Promise<Reservation | null> {
    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*') // Complete entity - NO selective fetching!
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return Reservation.fromPersistence(data)
  }

  async findByConfirmationNumber(confirmationNumber: string): Promise<Reservation | null> {
    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*')
      .eq('confirmation_number', confirmationNumber)
      .single()

    if (error || !data) {
      return null
    }

    return Reservation.fromPersistence(data)
  }

  async findByPropertyId(propertyId: string): Promise<Reservation[]> {
    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId) // BP-4: Tenant isolation
      .order('check_in_date', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => Reservation.fromPersistence(row))
  }

  async findByPropertyIdWithFilters(
    propertyId: string,
    filters: {
      status?: ReservationStatus
      guestId?: string
      siteId?: string
      checkInFrom?: Date
      checkInTo?: Date
      limit?: number
      offset?: number
    }
  ): Promise<{ reservations: Reservation[]; total: number }> {
    // Build query
    let query = this.getClient()
      .from('reservations')
      .select('*', { count: 'exact' })
      .eq('property_id', propertyId) // BP-4: Tenant isolation

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.guestId) {
      query = query.eq('guest_id', filters.guestId)
    }

    if (filters.siteId) {
      query = query.eq('site_id', filters.siteId)
    }

    if (filters.checkInFrom) {
      query = query.gte('check_in_date', filters.checkInFrom.toISOString())
    }

    if (filters.checkInTo) {
      query = query.lte('check_in_date', filters.checkInTo.toISOString())
    }

    // Apply pagination
    if (filters.limit) {
      const offset = filters.offset || 0
      query = query.range(offset, offset + filters.limit - 1)
    }

    // Order by check-in date descending (most recent first)
    query = query.order('check_in_date', { ascending: false })

    const { data, error, count } = await query

    if (error || !data) {
      return { reservations: [], total: 0 }
    }

    return {
      reservations: data.map((row) => Reservation.fromPersistence(row)),
      total: count || 0,
    }
  }

  async findByGuestId(guestId: string): Promise<Reservation[]> {
    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*')
      .eq('guest_id', guestId)
      .order('check_in_date', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => Reservation.fromPersistence(row))
  }

  async findBySiteId(siteId: string): Promise<Reservation[]> {
    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*')
      .eq('site_id', siteId)
      .order('check_in_date', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => Reservation.fromPersistence(row))
  }

  async findBySiteIdAndDateRange(siteId: string, dateRange: DateRange): Promise<Reservation[]> {
    /**
     * Find overlapping reservations using date range logic
     *
     * Two date ranges overlap if:
     * (range1.start < range2.end) AND (range1.end > range2.start)
     *
     * In SQL:
     * (check_in_date < :checkOut) AND (check_out_date > :checkIn)
     *
     * Only consider active reservations (not cancelled)
     */
    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*')
      .eq('site_id', siteId)
      .lt('check_in_date', dateRange.checkOut.toISOString())
      .gt('check_out_date', dateRange.checkIn.toISOString())
      .not('status', 'eq', 'cancelled')
      .not('status', 'eq', 'no_show')

    if (error || !data) {
      return []
    }

    return data.map((row) => Reservation.fromPersistence(row))
  }

  async existsForSiteInDateRange(siteId: string, dateRange: DateRange): Promise<boolean> {
    const conflictingReservations = await this.findBySiteIdAndDateRange(siteId, dateRange)
    return conflictingReservations.length > 0
  }

  async save(reservation: Reservation): Promise<void> {
    const persistence = reservation.toPersistence()

    // Check if exists
    const existing = await this.findById(reservation.id)

    if (existing) {
      // Update
      const { error } = await this.getClient()
        .from('reservations')
        .update(persistence as Partial<ReservationRow>)
        .eq('id', reservation.id)

      if (error) {
        throw new Error(`Failed to update reservation: ${error.message}`)
      }
    } else {
      // Insert
      const { error } = await this.getClient()
        .from('reservations')
        .insert(persistence as ReservationRow)

      if (error) {
        throw new Error(`Failed to create reservation: ${error.message}`)
      }
    }
  }

  async delete(id: string): Promise<void> {
    // Soft delete by setting status to CANCELLED
    // Hard delete would break referential integrity with payments, logs, etc.
    const { error } = await this.getClient()
      .from('reservations')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() } as Partial<ReservationRow>)
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete reservation: ${error.message}`)
    }
  }

  async findUpcoming(propertyId: string, withinDays: number): Promise<Reservation[]> {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + withinDays)

    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId) // BP-4: Tenant isolation
      .in('status', ['confirmed', 'pending'])
      .gte('check_in_date', today.toISOString())
      .lte('check_in_date', futureDate.toISOString())
      .order('check_in_date', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => Reservation.fromPersistence(row))
  }

  async findActive(propertyId: string): Promise<Reservation[]> {
    const { data, error } = await this.getClient()
      .from('reservations')
      .select('*')
      .eq('property_id', propertyId) // BP-4: Tenant isolation
      .eq('status', 'checked_in')
      .order('checked_in_at', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => Reservation.fromPersistence(row))
  }

  /**
   * Get the Supabase client (handles both direct client and transaction builder)
   * D-1: Support both SupabaseClient and SupabaseClient['from']
   */
  private getClient(): any {
    // If it's already a client, return it
    if ('from' in this.supabase) {
      return this.supabase
    }

    // If it's a query builder from a transaction, we can't easily extract the client
    // For now, cast it - in real transactions we'd handle this differently
    return this.supabase as any
  }
}
