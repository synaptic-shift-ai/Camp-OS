/**
 * Financial API v1 - Invoices
 *
 * POST /api/v1/financial/invoices - Generate an invoice
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { GenerateInvoiceRequestSchema } from '@/types/api/v1/schemas/financial'
import { GenerateInvoiceCommandHandler } from '@/modules/Financial/application/commands/GenerateInvoiceCommand'
import { SupabaseInvoiceRepository } from '@/modules/Financial/infrastructure/SupabaseInvoiceRepository'
import { toInvoiceDTO } from '@/modules/Financial/application/DTOs/InvoiceDTO'

/**
 * POST /api/v1/financial/invoices
 *
 * Generate an invoice for a reservation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_001, 'Unauthorized'),
        { status: 401 }
      )
    }

    // Get user's company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Company not found'),
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    let validatedRequest
    try {
      validatedRequest = GenerateInvoiceRequestSchema.parse(body)
    } catch (validationError: any) {
      return NextResponse.json(
        error(ErrorCodes.VALIDATION_ERROR, 'Invalid request body', {
          errors: validationError.errors,
        }),
        { status: 400 }
      )
    }

    // Verify reservation exists and belongs to company
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, property_id, properties!inner(id, company_id, property_code)')
      .eq('id', validatedRequest.reservationId)
      .single()

    if (reservationError || !reservation) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Reservation not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    if ((reservation as any).properties.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - reservation belongs to different company'),
        { status: 403 }
      )
    }

    // Get property code for invoice numbering
    const propertyCode = (reservation as any).properties.property_code || 'XX'

    // Execute command
    const invoiceRepository = new SupabaseInvoiceRepository(supabase)
    const commandHandler = new GenerateInvoiceCommandHandler(invoiceRepository)

    const invoiceId = crypto.randomUUID()

    const invoice = await commandHandler.execute({
      invoiceId,
      propertyId: reservation.property_id,
      propertyCode,
      reservationId: validatedRequest.reservationId,
      lineItems: validatedRequest.lineItems,
      taxRate: validatedRequest.taxRate,
      dueDate: new Date(validatedRequest.dueDate),
      isInstallment: validatedRequest.isInstallment,
      ...(validatedRequest.isInstallment && validatedRequest.installmentNumber != null && validatedRequest.installmentTotal != null ? {
        installmentNumber: validatedRequest.installmentNumber,
        installmentTotal: validatedRequest.installmentTotal,
      } : {}),
    })

    // Convert to DTO
    const invoiceDTO = toInvoiceDTO(invoice)

    return NextResponse.json(success(invoiceDTO), { status: 201 })
  } catch (err: any) {
    console.error('[Financial API v1] Generate invoice error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to generate invoice', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
