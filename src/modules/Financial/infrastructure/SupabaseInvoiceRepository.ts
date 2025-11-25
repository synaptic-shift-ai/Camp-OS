/**
 * SupabaseInvoiceRepository
 *
 * Supabase implementation of IInvoiceRepository.
 * Handles persistence of Invoice aggregates.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { IInvoiceRepository } from '../domain/repositories/IInvoiceRepository'
import { Invoice } from '../domain/aggregates/Invoice'
import { InvoiceNumber } from '../domain/value-objects/InvoiceNumber'
import { InvoiceStatus } from '../domain/value-objects/InvoiceStatus'
import type { SupabaseContext } from '@/shared/infrastructure/database/SupabaseContext'
import type { Database } from '@/contracts/db'

type InvoiceInsert = Database['public']['Tables']['financial_invoices']['Insert']

export class SupabaseInvoiceRepository implements IInvoiceRepository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database> | SupabaseContext) {
    // Normalize to raw client (D-1: Support both SupabaseClient and SupabaseContext)
    this.supabase = 'getRawClient' in client ? client.getRawClient() : client
  }

  async findById(id: string): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from('financial_invoices')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return Invoice.fromPersistence(data)
  }

  async findByInvoiceNumber(invoiceNumber: InvoiceNumber): Promise<Invoice | null> {
    const { data, error } = await this.supabase
      .from('financial_invoices')
      .select('*')
      .eq('invoice_number', invoiceNumber.value)
      .single()

    if (error || !data) {
      return null
    }

    return Invoice.fromPersistence(data)
  }

  async findByReservation(reservationId: string): Promise<Invoice[]> {
    const { data, error } = await this.supabase
      .from('financial_invoices')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => Invoice.fromPersistence(row))
  }

  async findOverdueInvoices(propertyId: string): Promise<Invoice[]> {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await this.supabase
      .from('financial_invoices')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', InvoiceStatus.ISSUED)
      .lt('due_date', today)
      .order('due_date', { ascending: true })

    if (error || !data) {
      return []
    }

    return data.map((row) => Invoice.fromPersistence(row))
  }

  async findByStatus(propertyId: string, status: InvoiceStatus): Promise<Invoice[]> {
    const { data, error } = await this.supabase
      .from('financial_invoices')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error || !data) {
      return []
    }

    return data.map((row) => Invoice.fromPersistence(row))
  }

  async save(invoice: Invoice): Promise<void> {
    const persistence = invoice.toPersistence()

    const { error } = await this.supabase
      .from('financial_invoices')
      .upsert(persistence as InvoiceInsert, { onConflict: 'id' })

    if (error) {
      throw new Error(`Failed to save invoice: ${error.message}`)
    }
  }

  async nextInvoiceSequence(propertyId: string, year: string): Promise<number> {
    // Get the highest sequence number for this property/year
    const { data, error } = await this.supabase
      .from('financial_invoices')
      .select('invoice_number')
      .eq('property_id', propertyId)
      .like('invoice_number', `INV-%-${year}-%`)
      .order('invoice_number', { ascending: false })
      .limit(1)

    if (error) {
      throw new Error(`Failed to get invoice sequence: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return 1 // First invoice for this property/year
    }

    // Parse the last invoice number to get the sequence
    const lastInvoiceNumber = data[0]!.invoice_number
    if (!lastInvoiceNumber) {
      throw new Error('Found invoice with no invoice number, cannot determine sequence.')
    }
    const parsed = InvoiceNumber.parse(lastInvoiceNumber)

    return parsed.sequence + 1
  }
}
