import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { getPropertyForUser } from "@/lib/dashboard/property-access"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeesSettings } from "@/components/dashboard/settings/fees-settings"
import { DepositSettings } from "@/components/dashboard/settings/deposit-settings"
import { BookingRulesSettings } from "@/components/dashboard/settings/booking-rules-settings"
import { DiscountsSettings } from "@/components/dashboard/settings/discounts-settings"
import { ReservationTypeSettings } from "@/components/dashboard/settings/reservation-type-settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PropertySettings } from "@/components/dashboard/settings/property-settings"
import { PropertyImagesSection } from "@/components/dashboard/property-images-section"
import { CancellationPolicySettings } from "@/components/dashboard/settings/cancellation-policy"
import type { CancellationRule } from "@/components/dashboard/settings/cancellation-rule-dialog"
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

export const dynamic = "force-dynamic"

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
  const property = await getPropertyWithSeasonal(propertyId)

  if (!property) {
    redirect("/auth/login")
  }

  const rawSiteTypeConfig = (property.site_type_config ?? null) as
    | { allowed_site_types?: string[]; site_type_rates?: Record<string, any> }
    | null
  
  const siteypeRatesFromConfig = rawSiteTypeConfig?.site_type_rates ?? {}

  const allowedSiteTypesFromConfig =
    Array.isArray(rawSiteTypeConfig?.allowed_site_types) &&
    rawSiteTypeConfig!.allowed_site_types.length > 0
      ? rawSiteTypeConfig!.allowed_site_types
      : []

  const siteTypes = allowedSiteTypesFromConfig.map((siteType) => ({ siteType }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your property settings and preferences
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Configure your property-wide defaults below. You can override these settings per-site from the Sites page.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="property" className="space-y-4">
        <TabsList className="grid w-full grid-cols-8 lg:w-auto lg:inline-grid">
          <TabsTrigger value="property">Property</TabsTrigger>
          <TabsTrigger value="fees">Additional Charges</TabsTrigger>
          <TabsTrigger value="reservation-types">Rate Types</TabsTrigger>
          <TabsTrigger value="site-types-rates">Site Types Rates</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="booking-rules">Booking Rules</TabsTrigger>
          <TabsTrigger value="cancellation-policy">Terms & Conditions</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="property" className="space-y-4">
          <PropertySettings
            propertyId={property.id}
            initial={{
              name: property.name,
              address: property.address,
              city: property.city,
              state: property.state,
              zipCode: property.zip_code,
              phone: property.phone,
              email: property.email,
              checkInTime: property.check_in_time,
              checkOutTime: property.check_out_time,
            }}
            stripeConnected={Boolean(property.stripe_account_id)}
            stripeConnectedAt={property.stripe_connected_at}
            stripeAccountId={property.stripe_account_id}
          />
          <PropertyImagesSection
            propertyId={property.id}
            initialCoverUrl={property.hero_image_url ?? null}
          />
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <FeesSettings
            propertyId={property.id}
            {...(property.pricing_config != null && {
              initialConfig: property.pricing_config as PricingConfig,
            })}
          />
        </TabsContent>

        <TabsContent value="reservation-types" className="space-y-4">
          <ReservationTypeSettings
            propertyId={property.id}
            initialConfig={parseReservationTypesConfigFromDB(property.reservation_type_config)}
            initialEnabledTypes={parseEnabledReservationTypesFromDB(property.enabled_reservation_types)}
            initialSeasonalPeriods={property.seasonalPeriods as SeasonalPeriod[]}
          />
        </TabsContent>

        <TabsContent value="site-types-rates" className="space-y-4">
          <SiteTypeRateSettings
            propertyId={property.id}
            initialSiteTypes={siteTypes}
            initialAllowedSiteTypes={allowedSiteTypesFromConfig}
            initialSiteTypeRates={siteypeRatesFromConfig}
          />
        </TabsContent>

        <TabsContent value="deposits" className="space-y-4">
          <DepositSettings
            propertyId={property.id}
            {...(property.deposit_config != null && {
              initialConfig: property.deposit_config as DepositConfig,
            })}
          />
        </TabsContent>

        <TabsContent value="booking-rules" className="space-y-4">
          <BookingRulesSettings
            propertyId={property.id}
            {...(property.booking_rules_config != null && {
              initialConfig: property.booking_rules_config as BookingRulesConfig,
            })}
          />
        </TabsContent>

        <TabsContent value="cancellation-policy" className="space-y-4">
          <CancellationPolicySettings
            propertyId={property.id}
            initialTermsAndConditions={property.terms_and_conditions ?? null}
            initialCancellationPolicy={
              property.cancellation_policy ??
              (property.settings as Record<string, any> | null)?.cancellationPolicy ??
              null
            }
            initialFreeCancellationWindow={
              (property.settings as Record<string, any> | null)?.freeCancellationWindow ?? null
            }
            initialCancellationRefundPercentage={
              (property.settings as Record<string, any> | null)?.cancellationRefundPercentage ?? null
            }
            initialCancellationNonRefundableDays={
              (property.settings as Record<string, any> | null)?.cancellationNonRefundableDays ?? null
            }
            initialRefundEligiblePeriod={
              (property.settings as Record<string, any> | null)?.refundEligiblePeriod ?? null
            }
            initialCancellationRules={(
              (property.cancellation_policy_config as { refund_tiers?: Array<{ id?: string; refund_percentage?: number; days_before_reservation?: number; days_operator?: unknown }> } | null)?.refund_tiers ?? []
            ).map((r) => ({
              id: r.id ?? crypto.randomUUID(),
              refund_percentage: r.refund_percentage ?? 0,
              days_before_reservation: r.days_before_reservation ?? 0,
            }))}
            currentSettings={(property.settings as Record<string, unknown> | null) ?? null}
          />
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4">
          <DiscountsSettings
            propertyId={property.id}
            {...(property.rate_discounts_config != null && {
              initialConfig: property.rate_discounts_config as RateDiscountsConfig,
            })}
          />
        </TabsContent>
      </Tabs>

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
