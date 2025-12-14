import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PricingSettings } from "@/components/dashboard/settings/pricing-settings"
import { DepositSettings } from "@/components/dashboard/settings/deposit-settings"
import { BookingRulesSettings } from "@/components/dashboard/settings/booking-rules-settings"
import { RateDiscountsSettings } from "@/components/dashboard/settings/rate-discounts-settings"
import { ReservationTypeSettings } from "@/components/dashboard/settings/reservation-type-settings"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { parseEnabledReservationTypesFromDB, parseReservationTypesConfigFromDB } from "@/lib/config/resolution"
import type { BookingType, SeasonalPeriod } from "@/lib/config/types"

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'

/**
 * Get the current user's property with all configuration fields
 */
async function getCurrentProperty() {
  const supabase = await createClient()

  // Get the currently authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Get the property owned by this user with all config fields
  const { data: property, error } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      owner_id,
      company_id,
      deposit_config,
      pricing_config,
      booking_rules_config,
      rate_discounts_config,
      enabled_reservation_types,
      reservation_type_config
    `)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching property:', error)
    return null
  }

  // Fetch seasonal periods for this property
  const { data: seasonalPeriods } = await supabase
    .from('property_seasonal_periods')
    .select('*')
    .eq('property_id', property.id)
    .order('start_month', { ascending: true })

  return {
    ...property,
    seasonalPeriods: seasonalPeriods || [],
  }
}

export default async function SettingsPage() {
  const property = await getCurrentProperty()

  if (!property) {
    redirect('/auth/login')
  }

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

      <Tabs defaultValue="pricing" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="reservation-types">Rate Types</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="booking-rules">Booking Rules</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-4">
          <PricingSettings
            propertyId={property.id}
            initialConfig={property.pricing_config}
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

        <TabsContent value="deposits" className="space-y-4">
          <DepositSettings
            propertyId={property.id}
            initialConfig={property.deposit_config}
          />
        </TabsContent>

        <TabsContent value="booking-rules" className="space-y-4">
          <BookingRulesSettings
            propertyId={property.id}
            initialConfig={property.booking_rules_config}
          />
        </TabsContent>

        <TabsContent value="discounts" className="space-y-4">
          <RateDiscountsSettings
            propertyId={property.id}
            initialConfig={property.rate_discounts_config}
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
