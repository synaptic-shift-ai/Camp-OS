"use client"

import type { Control, FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form"
import type { Property } from "@/components/property-context"
import { LocationSection } from "./sections/location-section"
import { ImagesSection } from "./sections/images-section"
import { OperatingHoursSection } from "./sections/operating-hours-section"
import { BookingRulesSection } from "./sections/booking-rules-section"
import { PropertyAmenitiesSection } from "./sections/property-amenities-section"
import { SiteAmenitiesSection } from "./sections/site-amenities-section"
import { TaxesSection } from "./sections/taxes-section"
import { AdditionalChargesSection } from "./sections/additional-charges-section"
import { RateTypesSection } from "./sections/rate-types-section"
import { SiteTypesRatesSection } from "./sections/site-types-rates-section"
import { DepositsSection } from "./sections/deposits-section"
import { TermsPoliciesSection } from "./sections/terms-policies-section"
import { DiscountsSection } from "./sections/discounts-section"
import type { PricingConfig, DepositConfig, RateDiscountsConfig } from "@/lib/config/types"

interface WizardPropertyDetailsSectionsProps {
  currentSection: string
  selectedProperty: Property
  register: UseFormRegister<any>
  errors: FieldErrors<any>
  control: Control<any>
  setValue: UseFormSetValue<any>
  timezone: string
  usTimezones: Array<{ value: string; label: string }>
  pricingConfig: Record<string, unknown> | null
  reservationTypeConfigRaw: unknown
  enabledReservationTypesRaw: unknown
  siteTypes: Array<{ siteType: string }>
  allowedSiteTypesFromConfig: string[]
  siteTypeRatesFromConfig: Record<string, unknown>
  depositConfig: Record<string, unknown> | null
  rateDiscountsConfig: Record<string, unknown> | null
}

export function WizardPropertyDetailsSections({
  currentSection,
  selectedProperty,
  register,
  errors,
  control,
  setValue,
  timezone,
  usTimezones,
  pricingConfig,
  reservationTypeConfigRaw,
  enabledReservationTypesRaw,
  siteTypes,
  allowedSiteTypesFromConfig,
  siteTypeRatesFromConfig,
  depositConfig,
  rateDiscountsConfig,
}: WizardPropertyDetailsSectionsProps) {
  if (currentSection === "location") {
    return <LocationSection register={register} errors={errors} control={control} />
  }

  if (currentSection === "images") {
    return <ImagesSection propertyId={selectedProperty.id} initialCoverUrl={selectedProperty.heroImageUrl} />
  }

  if (currentSection === "operating_hours") {
    return (
      <OperatingHoursSection
        register={register}
        setValue={setValue}
        timezone={timezone}
        usTimezones={usTimezones}
      />
    )
  }

  if (currentSection === "booking_rules") {
    return <BookingRulesSection register={register} errors={errors} />
  }

  if (currentSection === "property_amenities") {
    return <PropertyAmenitiesSection propertyId={selectedProperty.id} />
  }

  if (currentSection === "site_amenities") {
    return <SiteAmenitiesSection propertyId={selectedProperty.id} />
  }

  if (currentSection === "taxes") {
    return (
      <TaxesSection
        propertyId={selectedProperty.id}
        initialConfig={pricingConfig as PricingConfig | null}
      />
    )
  }

  if (currentSection === "additional_charges") {
    return (
      <AdditionalChargesSection
        propertyId={selectedProperty.id}
        initialConfig={pricingConfig as PricingConfig | null}
      />
    )
  }

  if (currentSection === "rate_types") {
    return (
      <RateTypesSection
        propertyId={selectedProperty.id}
        reservationTypeConfigRaw={reservationTypeConfigRaw}
        enabledReservationTypesRaw={enabledReservationTypesRaw}
      />
    )
  }

  if (currentSection === "site_types_rates") {
    return (
      <SiteTypesRatesSection
        propertyId={selectedProperty.id}
        siteTypes={siteTypes}
        allowedSiteTypesFromConfig={allowedSiteTypesFromConfig}
        siteTypeRatesFromConfig={siteTypeRatesFromConfig}
        reservationTypeConfigRaw={reservationTypeConfigRaw}
        enabledReservationTypesRaw={enabledReservationTypesRaw}
      />
    )
  }

  if (currentSection === "deposits") {
    return (
      <DepositsSection
        propertyId={selectedProperty.id}
        initialConfig={depositConfig as DepositConfig | null}
      />
    )
  }

  if (currentSection === "terms_policies") {
    return <TermsPoliciesSection register={register} />
  }

  if (currentSection === "discounts") {
    return (
      <DiscountsSection
        propertyId={selectedProperty.id}
        initialConfig={rateDiscountsConfig as RateDiscountsConfig | null}
      />
    )
  }

  return null
}
