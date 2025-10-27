"use client"

import { useState, useEffect } from "react"
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
  propertyCount: z.string().min(1, "Please select number of properties"),
  properties: z.array(propertySchema).min(1, "At least one property is required"),
})

type CompanyDetailsFormData = z.infer<typeof companyDetailsSchema>

export function CompanyDetailsClient() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPropertyCount, setSelectedPropertyCount] = useState<number>(0)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CompanyDetailsFormData>({
    resolver: zodResolver(companyDetailsSchema),
    defaultValues: {
      propertyCount: "",
      properties: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "properties",
  })

  const propertyCount = watch("propertyCount")

  // Update property fields when dropdown changes
  useEffect(() => {
    const count = Number(propertyCount)
    if (count > 0 && count !== fields.length) {
      setSelectedPropertyCount(count)
      // Clear existing fields
      while (fields.length > 0) {
        remove(0)
      }
      // Add new fields based on selected count
      for (let i = 0; i < count; i++) {
        append({ name: "", siteCount: 0 })
      }
    }
  }, [propertyCount, fields.length, append, remove])

  const onSubmit = async (data: CompanyDetailsFormData) => {
    setIsLoading(true)

    // Calculate total sites across all properties
    const totalSites = data.properties.reduce((sum, property) => sum + property.siteCount, 0)

    console.log("[v0] Company details submitted:", { ...data, totalSites })

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Redirect to choose-plan with total site count
    router.push(`/choose-plan?sites=${totalSites}`)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
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
