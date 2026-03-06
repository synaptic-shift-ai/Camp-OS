"use client"

import { useState, useEffect, useLayoutEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Tent, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
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

function getStoredDefaultValues(): CompanyDetailsFormData {
  if (typeof window === "undefined") return EMPTY_DEFAULTS
  try {
    const raw = window.localStorage.getItem("signup_company_details")
    if (!raw) return EMPTY_DEFAULTS
    const data = JSON.parse(raw) as {
      companyName?: string
      propertyCount?: string | number
      properties: Array<{ name?: string; siteCount?: number }>
    }
    if (!Array.isArray(data.properties) || data.properties.length === 0) return EMPTY_DEFAULTS
    const countStr = data.propertyCount != null ? String(data.propertyCount) : String(data.properties.length)
    return {
      companyName: data.companyName ?? "",
      propertyCount: countStr,
      properties: data.properties.map((p) => ({
        name: p.name ?? "",
        siteCount: Number(p.siteCount) || 0,
      })),
    }
  } catch {
    return EMPTY_DEFAULTS
  }
}

export function CompanyDetailsClient() {
  const [initialValues, setInitialValues] = useState<CompanyDetailsFormData | null>(null)
  const [hasCompany, setHasCompany] = useState<boolean | null>(null)

  useLayoutEffect(() => {
    setInitialValues(getStoredDefaultValues())
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
      <div className="min-h-screen w-[480px] bg-black flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-white">
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
    <div className="min-h-screen w-[480px] bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Tent className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">CampOS</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Company Details</h1>
          <p className="text-gray-400">Tell us about your properties</p>
        </div>

        <div className="bg-zinc-900 rounded-lg p-8 border border-zinc-800">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">Property Information</h2>
            <p className="text-sm text-gray-400">Add details for each of your properties</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Company Name */}
            <div>
              <Label htmlFor="companyName" className="text-white mb-2 block">
                Company Name
              </Label>
              <Input
                id="companyName"
                placeholder="Campgrounds Unlimited, LLC"
                {...register("companyName")}
                className="bg-black border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500"
              />
              {errors.companyName && <p className="text-sm text-red-400 mt-1">{errors.companyName.message}</p>}
              <p className="text-xs text-gray-500 mt-1">Legal entity name for billing purposes</p>
            </div>

            {/* Number of Properties Dropdown */}
            <div>
              <Label htmlFor="propertyCount" className="text-white mb-2 block">
                # of Properties
              </Label>
              <Select
                value={propertyCount}
                onValueChange={(value) => setValue("propertyCount", value, { shouldValidate: true })}
              >
                <SelectTrigger className="bg-black border-zinc-700 text-white focus:border-red-500">
                  <SelectValue placeholder="Select number of properties" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <SelectItem key={num} value={num.toString()} className="text-white hover:bg-zinc-800">
                      {num} {num === 1 ? "Property" : "Properties"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.propertyCount && <p className="text-sm text-red-400 mt-1">{errors.propertyCount.message}</p>}
            </div>

            {/* Dynamic Property Fields */}
            {fields.length > 0 && (
              <div className="space-y-6 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Property Details</h3>
                  <span className="text-sm text-gray-400">
                    {fields.length} {fields.length === 1 ? "property" : "properties"}
                  </span>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-black rounded-lg border border-zinc-800 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-md font-medium text-white">Property {index + 1}</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`properties.${index}.name`} className="text-white mb-2 block">
                          Property Name
                        </Label>
                        <Input
                          id={`properties.${index}.name`}
                          placeholder="Pine Valley Campground"
                          {...register(`properties.${index}.name`)}
                          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500"
                        />
                        {errors.properties?.[index]?.name && (
                          <p className="text-sm text-red-400 mt-1">{errors.properties[index]?.name?.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`properties.${index}.siteCount`} className="text-white mb-2 block">
                          # of Sites
                        </Label>
                        <Input
                          id={`properties.${index}.siteCount`}
                          type="number"
                          placeholder="50"
                          {...register(`properties.${index}.siteCount`)}
                          className="bg-zinc-900 border-zinc-700 text-white placeholder:text-gray-500 focus:border-red-500"
                        />
                        {errors.properties?.[index]?.siteCount && (
                          <p className="text-sm text-red-400 mt-1">{errors.properties[index]?.siteCount?.message}</p>
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

        <p className="text-xs text-center text-gray-500 mt-6">You can add more properties later from your dashboard</p>
      </div>
    </div>
  )
}
