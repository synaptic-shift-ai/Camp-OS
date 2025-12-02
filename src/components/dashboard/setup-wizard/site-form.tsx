"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Save, X } from "lucide-react"
import { siteFormSchema, siteStatuses, toApiFormat, type SiteFormData } from "./site-form-schema"

interface SiteFormProps {
  propertyId: string
  site?: any // For edit mode - existing site data
  onSave: (site: any) => void
  onCancel: () => void
}

export function SiteForm({ propertyId, site, onSave, onCancel }: SiteFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditMode = !!site

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: site
      ? {
          site_number: site.site_number || "",
          site_name: site.site_name || "",
          site_type: site.site_type || "tent",
          max_occupancy: site.max_occupancy || 4,
          max_vehicles: site.max_vehicles || 1,
          size_sqft: site.size_sqft || undefined,
          status: site.status || "available",
          description: site.description || "",
          base_price: site.base_price ? site.base_price / 100 : 0, // Convert cents to dollars
          weekend_price: site.weekend_price_cents
            ? site.weekend_price_cents / 100
            : undefined,
          hookups: {
            water: site.hookups?.includes("water") || false,
            electric: site.hookups?.includes("electric") || false,
            sewer: site.hookups?.includes("sewer") || false,
          },
          amenities: {
            fire_pit: site.site_amenities?.includes("fire_pit") || false,
            picnic_table: site.site_amenities?.includes("picnic_table") || false,
            grill: site.site_amenities?.includes("grill") || false,
            shade: site.site_amenities?.includes("shade") || false,
            pet_friendly: site.site_amenities?.includes("pet_friendly") || false,
            lake_view: site.site_amenities?.includes("lake_view") || false,
            waterfront: site.site_amenities?.includes("waterfront") || false,
          },
          allow_pets: site.allow_pets || false,
          pet_fee: site.pet_fee ? site.pet_fee / 100 : undefined, // Convert cents to dollars
          ada_accessible: site.ada_accessible || false,
          accessibility_features: {
            wheelchair_accessible: site.accessibility_features?.includes("wheelchair_accessible") || false,
            wide_paths: site.accessibility_features?.includes("wide_paths") || false,
            accessible_table: site.accessibility_features?.includes("accessible_table") || false,
            accessible_restroom: site.accessibility_features?.includes("accessible_restroom") || false,
            handrails: site.accessibility_features?.includes("handrails") || false,
            level_ground: site.accessibility_features?.includes("level_ground") || false,
          },
        }
      : {
          site_number: "",
          site_name: "",
          site_type: "tent",
          max_occupancy: 4,
          max_vehicles: 1,
          status: "available",
          description: "",
          base_price: 0,
          hookups: {
            water: false,
            electric: false,
            sewer: false,
          },
          amenities: {
            fire_pit: false,
            picnic_table: false,
            grill: false,
            shade: false,
            pet_friendly: false,
            lake_view: false,
            waterfront: false,
          },
          allow_pets: false,
          pet_fee: undefined,
          ada_accessible: false,
          accessibility_features: {
            wheelchair_accessible: false,
            wide_paths: false,
            accessible_table: false,
            accessible_restroom: false,
            handrails: false,
            level_ground: false,
          },
        },
  })

  const siteType = watch("site_type")
  const hookups = watch("hookups")
  const amenities = watch("amenities")
  const allowPets = watch("allow_pets")
  const adaAccessible = watch("ada_accessible")
  const accessibilityFeatures = watch("accessibility_features")

  const onSubmit = async (data: SiteFormData) => {
    try {
      setSaving(true)
      setError(null)

      const apiData = toApiFormat(data)

      if (isEditMode) {
        // Update existing site - Migrated to v1 API
        const response = await fetch(`/api/v1/sites/${site.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiData),
        })
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to update site")
        }

        onSave(result.data)
      } else {
        // Create new site - Migrated to v1 API (Phase 4, Week 13-14)
        const response = await fetch(`/api/v1/properties/${propertyId}/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiData),
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to create site")
        }

        onSave(result.data)
      }
    } catch (err) {
      console.error("Error saving site:", err)
      setError(err instanceof Error ? err.message : "Failed to save site")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Site identification and capacity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="site_number">Site Number *</Label>
              <Input
                id="site_number"
                {...register("site_number")}
                placeholder="A1, B2, etc."
                disabled={isEditMode} // Don't allow changing site number in edit mode
              />
              {errors.site_number && (
                <p className="text-sm text-destructive mt-1">{errors.site_number.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="site_name">Site Name</Label>
              <Input
                id="site_name"
                {...register("site_name")}
                placeholder="Lakeside Premium (optional)"
              />
              {errors.site_name && (
                <p className="text-sm text-destructive mt-1">{errors.site_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="site_type">Site Type *</Label>
              <Select
                value={siteType}
                onValueChange={(value) => setValue("site_type", value as any)}
              >
                <SelectTrigger id="site_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tent">Tent</SelectItem>
                  <SelectItem value="rv">RV</SelectItem>
                  <SelectItem value="cabin">Cabin</SelectItem>
                  <SelectItem value="glamping">Glamping</SelectItem>
                  <SelectItem value="yurt">Yurt</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.site_type && (
                <p className="text-sm text-destructive mt-1">{errors.site_type.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="max_occupancy">Max Occupancy *</Label>
              <Input
                id="max_occupancy"
                type="number"
                min="1"
                max="50"
                {...register("max_occupancy")}
                placeholder="4"
              />
              {errors.max_occupancy && (
                <p className="text-sm text-destructive mt-1">{errors.max_occupancy.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="max_vehicles">Max Vehicles</Label>
              <Input
                id="max_vehicles"
                type="number"
                min="1"
                max="10"
                {...register("max_vehicles")}
                placeholder="1"
              />
              {errors.max_vehicles && (
                <p className="text-sm text-destructive mt-1">{errors.max_vehicles.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="size_sqft">Size (sq ft)</Label>
              <Input
                id="size_sqft"
                type="number"
                min="0"
                {...register("size_sqft")}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={watch("status")} onValueChange={(value) => setValue("status", value as any)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {siteStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Describe this site, its features, and what makes it special..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Set nightly rates for this site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="base_price">Base Nightly Rate *</Label>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                min="0.01"
                {...register("base_price")}
                placeholder="45.00"
              />
              {errors.base_price && (
                <p className="text-sm text-destructive mt-1">{errors.base_price.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Amount in dollars (e.g., 45.00)</p>
            </div>

            <div>
              <Label htmlFor="weekend_price">Weekend Rate (optional)</Label>
              <Input
                id="weekend_price"
                type="number"
                step="0.01"
                min="0"
                {...register("weekend_price")}
                placeholder="55.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use base rate on weekends
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hookups */}
      <Card>
        <CardHeader>
          <CardTitle>Hookups</CardTitle>
          <CardDescription>Available utility connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hookup_water"
                checked={hookups.water}
                onCheckedChange={(checked) =>
                  setValue("hookups.water", checked as boolean)
                }
              />
              <Label htmlFor="hookup_water" className="font-normal cursor-pointer">
                Water
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hookup_electric"
                checked={hookups.electric}
                onCheckedChange={(checked) =>
                  setValue("hookups.electric", checked as boolean)
                }
              />
              <Label htmlFor="hookup_electric" className="font-normal cursor-pointer">
                Electric
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hookup_sewer"
                checked={hookups.sewer}
                onCheckedChange={(checked) =>
                  setValue("hookups.sewer", checked as boolean)
                }
              />
              <Label htmlFor="hookup_sewer" className="font-normal cursor-pointer">
                Sewer
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader>
          <CardTitle>Amenities</CardTitle>
          <CardDescription>Site-specific features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_fire_pit"
                checked={amenities.fire_pit}
                onCheckedChange={(checked) =>
                  setValue("amenities.fire_pit", checked as boolean)
                }
              />
              <Label htmlFor="amenity_fire_pit" className="font-normal cursor-pointer">
                Fire Pit
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_picnic_table"
                checked={amenities.picnic_table}
                onCheckedChange={(checked) =>
                  setValue("amenities.picnic_table", checked as boolean)
                }
              />
              <Label htmlFor="amenity_picnic_table" className="font-normal cursor-pointer">
                Picnic Table
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_grill"
                checked={amenities.grill}
                onCheckedChange={(checked) =>
                  setValue("amenities.grill", checked as boolean)
                }
              />
              <Label htmlFor="amenity_grill" className="font-normal cursor-pointer">
                Grill
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_shade"
                checked={amenities.shade}
                onCheckedChange={(checked) =>
                  setValue("amenities.shade", checked as boolean)
                }
              />
              <Label htmlFor="amenity_shade" className="font-normal cursor-pointer">
                Shade
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_pet_friendly"
                checked={amenities.pet_friendly}
                onCheckedChange={(checked) =>
                  setValue("amenities.pet_friendly", checked as boolean)
                }
              />
              <Label htmlFor="amenity_pet_friendly" className="font-normal cursor-pointer">
                Pet Friendly
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_lake_view"
                checked={amenities.lake_view}
                onCheckedChange={(checked) =>
                  setValue("amenities.lake_view", checked as boolean)
                }
              />
              <Label htmlFor="amenity_lake_view" className="font-normal cursor-pointer">
                Lake View
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_waterfront"
                checked={amenities.waterfront}
                onCheckedChange={(checked) =>
                  setValue("amenities.waterfront", checked as boolean)
                }
              />
              <Label htmlFor="amenity_waterfront" className="font-normal cursor-pointer">
                Waterfront
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pets & Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle>Pets & Accessibility</CardTitle>
          <CardDescription>Pet policies and ADA accessibility features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pet Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow_pets"
                checked={allowPets}
                onCheckedChange={(checked) =>
                  setValue("allow_pets", checked as boolean)
                }
              />
              <Label htmlFor="allow_pets" className="font-medium cursor-pointer">
                Allow Pets
              </Label>
            </div>

            {allowPets && (
              <div>
                <Label htmlFor="pet_fee">Pet Fee (one-time)</Label>
                <Input
                  id="pet_fee"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("pet_fee")}
                  placeholder="15.00"
                />
                {errors.pet_fee && (
                  <p className="text-sm text-destructive mt-1">{errors.pet_fee.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  One-time fee in dollars (optional, leave empty for no fee)
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ada_accessible"
                checked={adaAccessible}
                onCheckedChange={(checked) =>
                  setValue("ada_accessible", checked as boolean)
                }
              />
              <Label htmlFor="ada_accessible" className="font-medium cursor-pointer">
                ADA Accessible
              </Label>
            </div>

            {adaAccessible && accessibilityFeatures && (
              <div className="ml-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select specific accessibility features available:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_wheelchair"
                      checked={accessibilityFeatures.wheelchair_accessible}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.wheelchair_accessible", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_wheelchair" className="font-normal cursor-pointer">
                      Wheelchair Accessible
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_wide_paths"
                      checked={accessibilityFeatures.wide_paths}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.wide_paths", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_wide_paths" className="font-normal cursor-pointer">
                      Wide Paths
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_table"
                      checked={accessibilityFeatures.accessible_table}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.accessible_table", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_table" className="font-normal cursor-pointer">
                      Accessible Table
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_restroom"
                      checked={accessibilityFeatures.accessible_restroom}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.accessible_restroom", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_restroom" className="font-normal cursor-pointer">
                      Accessible Restroom
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_handrails"
                      checked={accessibilityFeatures.handrails}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.handrails", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_handrails" className="font-normal cursor-pointer">
                      Handrails
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_level_ground"
                      checked={accessibilityFeatures.level_ground}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.level_ground", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_level_ground" className="font-normal cursor-pointer">
                      Level Ground
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? "Update Site" : "Add Site"}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  )
}
