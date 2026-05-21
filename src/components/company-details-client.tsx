"use client"

import { useState, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Tent, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const propertySchema = z.object({
  name: z.string().min(2, "Property name must be at least 2 characters"),
  siteCount: z.coerce.number().min(1, "Must have at least 1 site").max(1000, "Maximum 1000 sites per property"),
})

const companyDetailsSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  propertyCount: z.string().min(1, "Please select number of properties"),
  properties: z.array(propertySchema).min(1, "At least one property is required"),
})

type CompanyDetailsFormData = z.infer<typeof companyDetailsSchema>

const EMPTY_DEFAULTS: CompanyDetailsFormData = {
  companyName: "",
  propertyCount: "",
  properties: [],
}

type StoredCompanyDetails = {
  companyName?: string
  propertyCount?: string | number
  properties?: Array<{ name?: string; siteCount?: number }>
}

function normalizeCompanyDetails(data: StoredCompanyDetails): CompanyDetailsFormData {
  const properties = Array.isArray(data.properties) ? data.properties : []
  const countStr = data.propertyCount != null ? String(data.propertyCount) : properties.length > 0 ? String(properties.length) : ""

  return {
    companyName: data.companyName ?? "",
    propertyCount: countStr,
    properties: properties.map((p) => ({
      name: p.name ?? "",
      siteCount: Number(p.siteCount) || 0,
    })),
  }
}

function getStoredDefaultValues(): CompanyDetailsFormData | null {
  if (typeof window === "undefined") return EMPTY_DEFAULTS
  try {
    const raw = window.localStorage.getItem("signup_company_details")
    if (!raw) return null
    return normalizeCompanyDetails(JSON.parse(raw) as StoredCompanyDetails)
  } catch {
    return null
  }
}

async function getDefaultValues(): Promise<CompanyDetailsFormData> {
  const stored = getStoredDefaultValues()
  if (stored?.companyName || stored?.properties.length || stored?.propertyCount) {
    return stored
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const companyName =
    typeof user?.user_metadata?.company_name === "string"
      ? user.user_metadata.company_name
      : ""

  return {
    ...EMPTY_DEFAULTS,
    companyName,
  }
}

export function CompanyDetailsClient() {
  const [initialValues, setInitialValues] = useState<CompanyDetailsFormData | null>(null)
  const [hasCompany, setHasCompany] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    getDefaultValues()
      .then((values) => {
        if (!cancelled) setInitialValues(values)
      })
      .catch(() => {
        if (!cancelled) setInitialValues(EMPTY_DEFAULTS)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/onboarding/has-company")
      .then((res) => (res.ok ? res.json() : { hasCompany: false }))
      .then((data) => {
        if (!cancelled) setHasCompany(Boolean(data.hasCompany))
      })
      .catch(() => {
        if (!cancelled) setHasCompany(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (initialValues === null || hasCompany === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-foreground">
          <Tent className="h-6 w-6 animate-pulse" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return <CompanyDetailsForm defaultValues={initialValues} hasCompany={hasCompany} />
}

function CompanyDetailsForm({
  defaultValues,
  hasCompany,
}: {
  defaultValues: CompanyDetailsFormData
  hasCompany: boolean
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CompanyDetailsFormData>({
    resolver: zodResolver(companyDetailsSchema),
    defaultValues,
  })

  const { fields, replace } = useFieldArray({
    control,
    name: "properties",
  })

  const propertyCount = watch("propertyCount")
  const watchedValues = watch()

  // Sync property fields to dropdown: when user changes # of properties, add/remove rows
  useEffect(() => {
    const count = Number(propertyCount)
    if (count > 0 && fields.length !== count) {
      replace(
        Array.from({ length: count }, () => ({ name: "", siteCount: 0 }))
      )
    }
  }, [propertyCount, replace, fields.length])

  // Persist to localStorage on change (debounced) so # of properties and all field inputs survive refresh
  useEffect(() => {
    if (typeof window === "undefined") return
    const t = setTimeout(() => {
      const { companyName, propertyCount: pc, properties: props } = watchedValues
      if (!props?.length || !pc) return
      const totalSites = props.reduce((sum, p) => sum + Number(p.siteCount) || 0, 0)
      const normalized = props.map((p) => ({
        name: p?.name ?? "",
        siteCount: Number(p?.siteCount) || 0,
      }))
      window.localStorage.setItem(
        "signup_company_details",
        JSON.stringify({
          companyName: companyName ?? "",
          propertyCount: pc,
          properties: normalized,
          totalSites,
        })
      )
    }, 400)
    return () => clearTimeout(t)
  }, [watchedValues])

  const onSubmit = async (data: CompanyDetailsFormData) => {
    setIsLoading(true)
    try {
      const totalSites = data.properties.reduce((sum, property) => sum + property.siteCount, 0)
      const companyData = {
        companyName: data.companyName,
        propertyCount: data.propertyCount,
        properties: data.properties,
        totalSites,
      }
      localStorage.setItem("signup_company_details", JSON.stringify(companyData))

      if (hasCompany) {
        // Already have company (e.g. after payment): update step and go to onboarding
        await fetch("/api/onboarding/company-progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingStep: "property_details" }),
        })
        router.push("/onboarding")
      } else {
        // No company yet: go to choose plan; company is created by webhook after payment
        router.push("/choose-plan")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Tent className="w-8 h-8 text-foreground" />
            <span className="text-2xl font-bold text-foreground">CampOS</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Company Details</h1>
          <p className="text-muted-foreground">Tell us about your properties</p>
        </div>

        <div className="bg-card rounded-lg p-8 border border-border">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground mb-1">Property Information</h2>
            <p className="text-sm text-muted-foreground">Add details for each of your properties</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Company Name */}
            <div>
              <Label htmlFor="companyName" className="text-foreground mb-2 block">
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="Campgrounds Unlimited, LLC"
                {...register("companyName")}
                className="focus:border-primary"
              />
              {errors.companyName && <p className="text-sm text-destructive mt-1">{errors.companyName.message}</p>}
              <p className="text-xs text-muted-foreground mt-1">Legal entity name for billing purposes</p>
            </div>

            {/* Number of Properties Dropdown */}
            <div>
              <Label htmlFor="propertyCount" className="text-foreground mb-2 block">
                # of Properties
              </Label>
              <Select
                value={propertyCount}
                onValueChange={(value) => setValue("propertyCount", value, { shouldValidate: true })}
              >
                <SelectTrigger className="focus:border-primary">
                  <SelectValue placeholder="Select number of properties" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? "Property" : "Properties"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.propertyCount && <p className="text-sm text-destructive mt-1">{errors.propertyCount.message}</p>}
            </div>

            {/* Dynamic Property Fields */}
            {fields.length > 0 && (
              <div className="space-y-6 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Property Details</h3>
                  <span className="text-sm text-muted-foreground">
                    {fields.length} {fields.length === 1 ? "property" : "properties"}
                  </span>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-muted/40 rounded-lg border border-border space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-md font-medium text-foreground">Property {index + 1}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`properties.${index}.name`} className="text-foreground mb-2 block">
                          Property Name
                        </Label>
                        <Input
                          id={`properties.${index}.name`}
                          placeholder="Pine Valley Campground"
                          {...register(`properties.${index}.name`)}
                          className="focus:border-primary"
                        />
                        {errors.properties?.[index]?.name && (
                          <p className="text-sm text-destructive mt-1">{errors.properties[index]?.name?.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`properties.${index}.siteCount`} className="text-foreground mb-2 block">
                          # of Sites
                        </Label>
                        <Input
                          id={`properties.${index}.siteCount`}
                          type="number"
                          placeholder="50"
                          {...register(`properties.${index}.siteCount`)}
                          className="focus:border-primary"
                        />
                        {errors.properties?.[index]?.siteCount && (
                          <p className="text-sm text-destructive mt-1">{errors.properties[index]?.siteCount?.message}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || fields.length === 0}
              className="w-full h-11 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-medium"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Choose Plan"
              )}
            </Button>
          </form>
        </div>

        <p className="text-xs text-center text-muted-foreground mt-6">You can add more properties later from your dashboard</p>
      </div>
    </div>
  )
}
