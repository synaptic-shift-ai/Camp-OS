import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { resolveDashboardNavVisibility } from "@/lib/dashboard/dashboard-layout-context"
import { resolveModuleActionAccess } from "@/lib/dashboard/module-action-access"
import { TabsContent } from "@/components/ui/tabs"
import { OverflowTabs, type OverflowTabItem } from "@/components/ui/overflow-tabs"
import { FeesSettings } from "@/components/dashboard/settings/fees-settings"
import { DepositSettings } from "@/components/dashboard/settings/deposit-settings"
import { PaymentProcessorSettings } from "@/components/dashboard/settings/payment-processor-settings"
import { BookingRulesSettings } from "@/components/dashboard/settings/booking-rules-settings"
import { DiscountsSettings } from "@/components/dashboard/settings/discounts-settings"
import { ReservationTypeSettings } from "@/components/dashboard/settings/reservation-type-settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PropertySettings } from "@/components/dashboard/settings/property-settings"
import { PropertyImagesSection } from "@/components/dashboard/property-images-section"
import { CancellationPolicySettings } from "@/components/dashboard/settings/cancellation-policy"
import { SiteTypeRateSettings } from "@/components/dashboard/settings/site-type-rate"
import { Info } from "lucide-react"
import { parseEnabledReservationTypesFromDB, parseReservationTypesConfigFromDB } from "@/lib/config/resolution"
import type {
  SeasonalPeriod,
  PricingConfig,
  DepositConfig,
  BookingRulesConfig,
  RateDiscountsConfig,
} from "@/lib/config/types"
import { resolveEnabledPaymentMethodsFromProperty } from "@/lib/config/types"
import { PropertiesAmenities } from "@/components/dashboard/settings/properties-amenities"
import { HousekeepingSettings } from "@/components/dashboard/housekeeping/housekeeping-settings"

export const dynamic = "force-dynamic"

const SETTINGS_TAB_ITEMS: OverflowTabItem[] = [
  { value: "property", label: "Property" },
  { value: "amenities_configuration", label: "Amenities Configuration" },
  { value: "fees", label: "Additional Charges" },
  { value: "reservation-types", label: "Rate Types" },
  { value: "site-types-configuration", label: "Site Types Configuration" },
  { value: "deposits", label: "Deposits" },
  { value: "payment-processor", label: "Payment Processor" },
  { value: "booking-rules", label: "Booking Rules" },
  { value: "cancellation-policy", label: "Terms & Policies" },
  { value: "discounts", label: "Discounts" },
  { value: "housekeeping", label: "Housekeeping" },
]

async function getPropertyWithSeasonal(propertyId: string) {
  const property = await getPropertyForUser(propertyId)
  if (!property) return null

  const supabase = await createClient()
  const { data: seasonalPeriods } = await supabase
    .from("property_seasonal_periods")
    .select("*")
    .eq("property_id", property.id)
    .order("start_month", { ascending: true })

  return {
    ...property,
    seasonalPeriods: seasonalPeriods ?? [],
  }
}

type PageProps = { params: Promise<{ propertyId: string }> }

export default async function SettingsPage({ params }: PageProps) {
  const { propertyId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible.settings) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }
  const settingsActions = await resolveModuleActionAccess({
    supabase,
    propertyId,
    userId: user.id,
    moduleKey: "settings",
    actions: ["view", "edit"] as const,
    fallbackForCategory: (role) => {
      if (role === "owner" || role === "admin") return { view: true, edit: true }
      return { view: false, edit: false }
    },
  })
  if (!settingsActions.view) {
    redirect(`/dashboard/${propertyId}/access-denied`)
  }

  const canEditSettings = settingsActions.edit === true

  const property = await getPropertyWithSeasonal(propertyId)

  if (!property) {
    redirect("/auth/login")
  }

  const initialGuestPaymentMethods = resolveEnabledPaymentMethodsFromProperty(
    property.settings as Record<string, unknown> | null | undefined,
    (property as { payment_processor?: string[] | null }).payment_processor ?? undefined,
  )

  const rawSiteTypeConfig = (property.site_type_config ?? null) as
    | {
      allowed_site_types?: string[]
      site_type_rates?: Record<string, any>
      maintenance?: Record<string, boolean>
      housekeeping?: Record<string, boolean>
      [key: string]: unknown
    }
    | null

  const siteypeRatesFromConfig = rawSiteTypeConfig?.site_type_rates ?? {}

  const allowedSiteTypesFromConfig =
    Array.isArray(rawSiteTypeConfig?.allowed_site_types) &&
      rawSiteTypeConfig!.allowed_site_types.length > 0
      ? rawSiteTypeConfig!.allowed_site_types
      : []

  const siteTypes = allowedSiteTypesFromConfig.map((siteType) => ({ siteType }))
  const openPeriodFrom = (() => {
    const s = property.settings as Record<string, unknown> | null | undefined
    const from = s?.openPeriodFrom ?? s?.open_period_from
    return typeof from === "string" ? from : null
  })()
  const openPeriodUntil = (() => {
    const s = property.settings as Record<string, unknown> | null | undefined
    const until = s?.openPeriodUntil ?? s?.open_period_until
    return typeof until === "string" ? until : null
  })()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          {canEditSettings
            ? "Manage your property settings and preferences"
            : "View your property settings (editing is disabled for your role)."}
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {canEditSettings
            ? "Configure your property-wide defaults below. You can override these settings per-site from the Sites page."
            : "You can review property-wide defaults below. Changes are not available with your current access."}
        </AlertDescription>
      </Alert>

      <OverflowTabs defaultValue="property" className="space-y-4" items={SETTINGS_TAB_ITEMS}>
        <TabsContent value="property" className="space-y-4">
          <PropertySettings
            propertyId={property.id}
            canEdit={canEditSettings}
            initial={{
              name: property.name,
              description: property.description ?? null,
              address: property.address,
              city: property.city,
              state: property.state,
              zipCode: property.zip_code,
              phone: property.phone,
              email: property.email,
              checkInTime: property.check_in_time,
              checkOutTime: property.check_out_time,
              timezone: (() => {
                const s = property.settings as Record<string, unknown> | null | undefined
                const tz = s?.timezone
                return typeof tz === "string" ? tz : null
              })(),
              ...(() => {
                const s = property.settings as Record<string, unknown> | null | undefined
                const from = s?.openPeriodFrom ?? s?.open_period_from
                const until = s?.openPeriodUntil ?? s?.open_period_until
                return {
                  openPeriodFrom: typeof from === "string" ? from : null,
                  openPeriodUntil: typeof until === "string" ? until : null,
                }
              })(),
            }}
            stripeConnected={Boolean(property.stripe_account_id)}
            stripeConnectedAt={property.stripe_connected_at}
            stripeAccountId={property.stripe_account_id}
          />
          <PropertyImagesSection
            propertyId={property.id}
            initialCoverUrl={property.hero_image_url ?? null}
            canEdit={canEditSettings}
          />
        </TabsContent>

        <TabsContent value="amenities_configuration" className="space-y-4">
          <PropertiesAmenities propertyId={property.id} canEdit={canEditSettings} />
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <FeesSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            openPeriodFrom={openPeriodFrom}
            openPeriodUntil={openPeriodUntil}
            {...(property.pricing_config != null && {
              initialConfig: property.pricing_config as PricingConfig,
            })}
          />
        </TabsContent>

        <TabsContent value="reservation-types" className="space-y-4">
          <ReservationTypeSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            initialConfig={parseReservationTypesConfigFromDB(property.reservation_type_config)}
            initialEnabledTypes={parseEnabledReservationTypesFromDB(property.enabled_reservation_types)}
            initialSeasonalPeriods={property.seasonalPeriods as SeasonalPeriod[]}
          />
        </TabsContent>

        <TabsContent value="site-types-configuration" className="space-y-4">
          <SiteTypeRateSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            initialSiteTypes={siteTypes}
            initialAllowedSiteTypes={allowedSiteTypesFromConfig}
            initialSiteTypeRates={siteypeRatesFromConfig}
            initialSiteTypeConfig={rawSiteTypeConfig}
          />
        </TabsContent>

        <TabsContent value="deposits" className="space-y-4">
          <DepositSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            {...(property.deposit_config != null && {
              initialConfig: property.deposit_config as DepositConfig,
            })}
          />
        </TabsContent>

        <TabsContent value="payment-processor" className="space-y-4">
          <PaymentProcessorSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            {...(initialGuestPaymentMethods != null && {
              initialEnabledMethods: initialGuestPaymentMethods,
            })}
          />
        </TabsContent>

        <TabsContent value="booking-rules" className="space-y-4">
          <BookingRulesSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            openPeriodFrom={openPeriodFrom}
            openPeriodUntil={openPeriodUntil}
            {...(property.booking_rules_config != null && {
              initialConfig: property.booking_rules_config as BookingRulesConfig,
            })}
          />
        </TabsContent>

        <TabsContent value="cancellation-policy" className="space-y-4">
          <CancellationPolicySettings
            propertyId={property.id}
            canEdit={canEditSettings}
            initialTermsAndConditions={property.terms_and_conditions ?? null}
            initialCancellationPolicy={
              property.cancellation_policy ??
              (property.settings as Record<string, any> | null)?.cancellationPolicy ??
              null
            }
            initialCancellationRules={(
              (property.cancellation_policy_config as { refund_tiers?: Array<{ id?: string; refund_percentage?: number; days_before_reservation?: number; days_operator?: unknown }> } | null)?.refund_tiers ?? []
            ).map((r) => ({
              id: r.id ?? crypto.randomUUID(),
              refund_percentage: r.refund_percentage ?? 0,
              days_before_reservation: r.days_before_reservation ?? 0,
            }))}
          />
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4">
          <DiscountsSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            openPeriodFrom={openPeriodFrom}
            openPeriodUntil={openPeriodUntil}
            {...(property.rate_discounts_config != null && {
              initialConfig: property.rate_discounts_config as RateDiscountsConfig,
            })}
          />
        </TabsContent>

        <TabsContent value="housekeeping" className="space-y-4">
          <HousekeepingSettings
            propertyId={property.id}
            canEdit={canEditSettings}
            initialSettings={
              (property.settings as Record<string, unknown> | null) ?? {}
            }
          />
        </TabsContent>

      </OverflowTabs>

      {/* Coming Soon: Additional Settings */}
      <Card className="mt-8 border-dashed">
        <CardHeader>
          <CardTitle>Additional Settings</CardTitle>
          <CardDescription>
            More configuration options coming soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">General Info</h3>
              <p className="text-sm text-muted-foreground">
                Property name, contact details, address
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">Check-in/out</h3>
              <p className="text-sm text-muted-foreground">
                Check-in times, timezone, instant booking
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">Payments</h3>
              <p className="text-sm text-muted-foreground">
                Payment methods, Stripe integration
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50">
              <h3 className="font-medium mb-1">Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Email alerts, booking reminders
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
