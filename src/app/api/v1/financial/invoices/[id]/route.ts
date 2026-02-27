/**
 * Financial API v1 - Invoice Details
 *
 * GET /api/v1/financial/invoices/[id] - Get invoice by ID
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { success, error } from '@/lib/api/response'
import { ErrorCodes } from '@/lib/api/errors'
import { GetInvoiceQueryHandler } from '@/modules/Financial/application/queries/GetInvoiceQuery'
import { SupabaseInvoiceRepository } from '@/modules/Financial/infrastructure/SupabaseInvoiceRepository'
import { toInvoiceDTO } from '@/modules/Financial/application/DTOs/InvoiceDTO'

/**
 * GET /api/v1/financial/invoices/[id]
 *
 * Get a single invoice by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
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

    // Execute query
    const repository = new SupabaseInvoiceRepository(supabase)
    const queryHandler = new GetInvoiceQueryHandler(repository)
    const invoice = await queryHandler.execute(invoiceId)

    if (!invoice) {
      return NextResponse.json(
        error(ErrorCodes.RESOURCE_NOT_FOUND, 'Invoice not found'),
        { status: 404 }
      )
    }

    // Verify tenant access (BP-4)
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, company_id')
      .eq('id', invoice.propertyId)
      .single()

    if (propertyError || !property || property.company_id !== company.id) {
      return NextResponse.json(
        error(ErrorCodes.AUTH_003, 'Forbidden - invoice belongs to different company'),
        { status: 403 }
      )
    }

    // Convert to DTO
    const invoiceDTO = toInvoiceDTO(invoice)

    return success(invoiceDTO)
  } catch (err: any) {
    console.error('[Financial API v1] Get invoice error:', err)

    return NextResponse.json(
      error(ErrorCodes.INTERNAL_ERROR, 'Failed to get invoice', {
        message: err.message,
      }),
      { status: 500 }
    )
  }
}
