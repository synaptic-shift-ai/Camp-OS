import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  updatePropertyConfigSchema,
  type UpdatePropertyConfigInput,
} from "@/lib/config/schemas"
import { mergePaymentProcessorColumnWithGuestMethods } from "@/lib/config/types"
import { recordActivityLog } from "@/shared/activity-log/record-activity-log"
import {
  canEditPropertySettingsModule,
  canViewPropertySettingsModule,
  PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE,
  PROPERTY_SETTINGS_VIEW_FORBIDDEN_MESSAGE,
} from "@/lib/dashboard/property-settings-module-edit"
import { requirePropertyAccess, isDenied } from "@/lib/rbac"

const CONFIG_PATCH_ACTIVITY_KEYS = [
  "deposit_config",
  "pricing_config",
  "booking_rules_config",
  "rate_discounts_config",
  "reservation_type_config",
  "enabled_reservation_types",
  "site_type_config",
  "enabled_payment_methods",
  "payment_processor",
] as const satisfies readonly (keyof UpdatePropertyConfigInput)[]

const CONFIG_PATCH_ACTIVITY_LABEL: Partial<Record<keyof UpdatePropertyConfigInput, string>> = {
  site_type_config: "site type rate",
  deposit_config: "deposit",
  booking_rules_config: "booking rules",
  rate_discounts_config: "discount",
  pricing_config: "pricing",
  reservation_type_config: "reservation types",
  enabled_reservation_types: "reservation types",
  enabled_payment_methods: "payment methods",
  payment_processor: "payment processor",
}

function buildSettingsPatchActivityDetails(config: UpdatePropertyConfigInput): string {
  const labels: string[] = []
  const seen = new Set<string>()
  for (const key of CONFIG_PATCH_ACTIVITY_KEYS) {
    if (config[key] === undefined) continue
    const label = CONFIG_PATCH_ACTIVITY_LABEL[key] ?? key.replace(/_config$/, "").replaceAll("_", " ")
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  if (labels.length === 0) return "Updated property settings"
  return `Updated property settings (${labels.join(" and ")})`
}

/**
 * PATCH /api/properties/[id]/settings
 * Update property configuration settings
 *
 * Accepts partial updates for:
 * - deposit_config
 * - pricing_config
 * - booking_rules_config
 * - rate_discounts_config
 * - site_type_config
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId } = await params
    const body = await request.json()

    // Validate request body with Zod schema
    const validationResult = updatePropertyConfigSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid configuration data",
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const configUpdates = validationResult.data

    // Create service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Verify property exists and get company_id
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select("id, company_id")
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    const propertyAccess = await requirePropertyAccess(supabase, user.id, {
      propertyId,
      minimumRole: 'staff',
    })
    if (isDenied(propertyAccess)) return propertyAccess

    const canEditSettings = await canEditPropertySettingsModule(supabase, propertyId, user.id)
    if (!canEditSettings) {
      return NextResponse.json(
        { error: PROPERTY_SETTINGS_EDIT_FORBIDDEN_MESSAGE },
        { status: 403 }
      )
    }

    // Build update object with only provided config fields
    const updateData: Record<string, unknown> = {}

    if (configUpdates.deposit_config !== undefined) {
      updateData.deposit_config = configUpdates.deposit_config
    }

    if (configUpdates.pricing_config !== undefined) {
      updateData.pricing_config = configUpdates.pricing_config
    }

    if (configUpdates.booking_rules_config !== undefined) {
      updateData.booking_rules_config = configUpdates.booking_rules_config
    }

    if (configUpdates.rate_discounts_config !== undefined) {
      updateData.rate_discounts_config = configUpdates.rate_discounts_config
    }

    if (configUpdates.reservation_type_config !== undefined) {
      updateData.reservation_type_config = configUpdates.reservation_type_config
    }

    if (configUpdates.enabled_reservation_types !== undefined) {
      updateData.enabled_reservation_types = configUpdates.enabled_reservation_types
    }

    if (configUpdates.site_type_config !== undefined) {
      updateData.site_type_config = configUpdates.site_type_config
    }

    if (configUpdates.payment_processor !== undefined) {
      updateData.payment_processor = configUpdates.payment_processor
    }

    if (configUpdates.enabled_payment_methods !== undefined) {
      const { data: existingProperty } = await supabaseAdmin
        .from("properties")
        .select("settings, payment_processor")
        .eq("id", propertyId)
        .single()

      const existingSettings = (existingProperty?.settings as Record<string, unknown> | null) ?? {}
      updateData.settings = {
        ...existingSettings,
        enabled_payment_methods: configUpdates.enabled_payment_methods,
      }

      const existingProcessors = (existingProperty?.payment_processor as string[] | null) ?? []
      updateData.payment_processor = mergePaymentProcessorColumnWithGuestMethods(
        existingProcessors,
        configUpdates.enabled_payment_methods,
      )
    }

    // Add updated timestamp
    updateData.updated_at = new Date().toISOString()

    // Update property using service role client
    const { data: updatedProperty, error: updateError } = await supabaseAdmin
      .from("properties")
      .update(updateData)
      .eq("id", propertyId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating property settings:", updateError)
      return NextResponse.json(
        { error: "Failed to update property settings" },
        { status: 500 }
      )
    }

    if (property.company_id) {
      const supabaseServiceRole = createServiceRoleClient()
      await recordActivityLog(supabaseServiceRole, {
        companyId: property.company_id,
        propertyId: property.id,
        action: 'update',
        resource: 'settings',
        userId: user.id,
        details: buildSettingsPatchActivityDetails(configUpdates),
      })
    }

    // Revalidate the settings page to reflect changes immediately
    revalidatePath('/dashboard/settings')

    return NextResponse.json({
      success: true,
      property: updatedProperty,
    })
  } catch (error) {
    console.error("Error in PATCH /api/properties/[id]/settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/properties/[id]/settings
 * Retrieve property configuration settings
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: propertyId } = await params

    const propertyAccess = await requirePropertyAccess(supabase, user.id, {
      propertyId,
    })
    if (isDenied(propertyAccess)) return propertyAccess

    const canViewSettings = await canViewPropertySettingsModule(supabase, propertyId, user.id)
    if (!canViewSettings) {
      return NextResponse.json(
        { error: PROPERTY_SETTINGS_VIEW_FORBIDDEN_MESSAGE },
        { status: 403 }
      )
    }

    // Create service role client to bypass RLS
    const supabaseAdmin = createServiceRoleClient()

    // Get property with all config fields
    const { data: property, error: propertyError } = await supabaseAdmin
      .from("properties")
      .select(`
        id,
        name,
        company_id,
        deposit_config,
        pricing_config,
        booking_rules_config,
        rate_discounts_config,
        site_type_config
      `)
      .eq("id", propertyId)
      .single()

    if (propertyError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      property,
    })
  } catch (error) {
    console.error("Error in GET /api/properties/[id]/settings:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
