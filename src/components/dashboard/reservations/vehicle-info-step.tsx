'use client'

/**
 * Vehicle Information Step Component
 *
 * New Step 4 for capturing vehicle details during manual booking.
 * Supports personal vehicles and RV/campers with dynamic add/remove.
 */

import { useFieldArray, useFormContext, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Plus, Trash2, Car, Caravan, ChevronDown, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PERSONAL_VEHICLE_TYPE_LABELS,
  RV_TYPE_LABELS,
  US_STATE_CODES,
} from '@/lib/booking/vehicle-types'
import type { PersonalVehicleType, RVType, VehicleRecordType } from '@/lib/booking/vehicle-types'

interface VehicleInfoStepProps {
  /** Maximum number of vehicles allowed */
  maxVehicles?: number
  /** Whether to show RV section (based on site type) */
  showRVSection?: boolean
  /** Optional CSS class name */
  className?: string
}

// Year options (current year back to 1970)
const currentYear = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: currentYear - 1969 }, (_, i) => currentYear - i)

export function VehicleInfoStep({
  maxVehicles = 5,
  showRVSection = true,
  className,
}: VehicleInfoStepProps) {
  const { register, control, watch, setValue, formState: { errors } } = useFormContext()

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'vehicles',
  })

  const addVehicle = (type: VehicleRecordType) => {
    if (fields.length < maxVehicles) {
      append({
        vehicle_type: type,
        make: '',
        model: '',
        year: undefined,
        color: '',
        license_plate: '',
        license_plate_state: '',
        personal_vehicle_type: type === 'personal' ? 'car' : undefined,
        rv_type: type === 'rv' ? 'travel_trailer' : undefined,
        rv_length_feet: undefined,
        rv_width_feet: undefined,
        num_slide_outs: 0,
        insurance_company: '',
        insurance_policy_number: '',
        is_primary: fields.length === 0, // First vehicle is primary
      })
    }
  }

  const vehicleCount = fields.length
  const personalVehicles = fields.filter((_, i) => {
    const type = watch(`vehicles.${i}.vehicle_type`)
    return type === 'personal' || type === 'tow_vehicle'
  })
  const rvVehicles = fields.filter((_, i) => watch(`vehicles.${i}.vehicle_type`) === 'rv')

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          Vehicle Information
          {vehicleCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({vehicleCount} {vehicleCount === 1 ? 'vehicle' : 'vehicles'})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {fields.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/30">
            <Car className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">
              No vehicles added yet. Add vehicle information for the guest.
            </p>
            <div className="flex justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => addVehicle('personal')}
              >
                <Car className="h-4 w-4 mr-2" />
                Add Personal Vehicle
              </Button>
              {showRVSection && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addVehicle('rv')}
                >
                  <Caravan className="h-4 w-4 mr-2" />
                  Add RV/Camper
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => {
              const vehicleType = watch(`vehicles.${index}.vehicle_type`) as VehicleRecordType
              const isRV = vehicleType === 'rv'

              return (
                <Card key={field.id} className="relative border-l-4 border-l-primary/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {isRV ? (
                          <Caravan className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Car className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">
                          {isRV ? 'RV/Camper' : 'Personal Vehicle'} #{index + 1}
                        </span>
                        {watch(`vehicles.${index}.is_primary`) && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Vehicle Type Selection (for RV) */}
                    {isRV && (
                      <div className="mb-4">
                        <Label>RV Type <span className="text-destructive">*</span></Label>
                        <Controller
                          name={`vehicles.${index}.rv_type`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select RV type" />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(RV_TYPE_LABELS) as [RVType, string][]).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}

                    {/* Personal Vehicle Type (for non-RV) */}
                    {!isRV && (
                      <div className="mb-4">
                        <Label>Vehicle Type</Label>
                        <Controller
                          name={`vehicles.${index}.personal_vehicle_type`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(PERSONAL_VEHICLE_TYPE_LABELS) as [PersonalVehicleType, string][]).map(
                                  ([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    )}

                    {/* Make, Model, Year, Color */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`vehicles.${index}.make`}>Make</Label>
                        <Input
                          id={`vehicles.${index}.make`}
                          placeholder="e.g., Ford"
                          {...register(`vehicles.${index}.make`)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`vehicles.${index}.model`}>Model</Label>
                        <Input
                          id={`vehicles.${index}.model`}
                          placeholder="e.g., F-150"
                          {...register(`vehicles.${index}.model`)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Year</Label>
                        <Controller
                          name={`vehicles.${index}.year`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value?.toString()}
                              onValueChange={(v) => field.onChange(parseInt(v, 10))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Year" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                {YEAR_OPTIONS.map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`vehicles.${index}.color`}>Color</Label>
                        <Input
                          id={`vehicles.${index}.color`}
                          placeholder="e.g., White"
                          {...register(`vehicles.${index}.color`)}
                        />
                      </div>
                    </div>

                    {/* License Plate */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="space-y-1.5">
                        <Label htmlFor={`vehicles.${index}.license_plate`}>
                          License Plate
                        </Label>
                        <Input
                          id={`vehicles.${index}.license_plate`}
                          placeholder="ABC-1234"
                          {...register(`vehicles.${index}.license_plate`)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>State</Label>
                        <Controller
                          name={`vehicles.${index}.license_plate_state`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="State" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                {US_STATE_CODES.map((code) => (
                                  <SelectItem key={code} value={code}>
                                    {code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    {/* RV-specific fields */}
                    {isRV && (
                      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
                        <div className="space-y-1.5">
                          <Label htmlFor={`vehicles.${index}.rv_length_feet`}>
                            Length (ft) <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`vehicles.${index}.rv_length_feet`}
                            type="number"
                            min={10}
                            max={60}
                            placeholder="e.g., 32"
                            {...register(`vehicles.${index}.rv_length_feet`, {
                              valueAsNumber: true,
                            })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`vehicles.${index}.rv_width_feet`}>
                            Width (ft)
                          </Label>
                          <Input
                            id={`vehicles.${index}.rv_width_feet`}
                            type="number"
                            min={6}
                            max={12}
                            placeholder="e.g., 8"
                            {...register(`vehicles.${index}.rv_width_feet`, {
                              valueAsNumber: true,
                            })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Slide-outs</Label>
                          <Controller
                            name={`vehicles.${index}.num_slide_outs`}
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value?.toString() || '0'}
                                onValueChange={(v) => field.onChange(parseInt(v, 10))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="0" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[0, 1, 2, 3, 4, 5].map((num) => (
                                    <SelectItem key={num} value={num.toString()}>
                                      {num}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                    )}

                    {/* Insurance (collapsible) */}
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <Shield className="h-4 w-4" />
                        Insurance Information (Optional)
                        <ChevronDown className="h-3 w-3" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor={`vehicles.${index}.insurance_company`}>
                              Insurance Company
                            </Label>
                            <Input
                              id={`vehicles.${index}.insurance_company`}
                              placeholder="e.g., State Farm"
                              {...register(`vehicles.${index}.insurance_company`)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`vehicles.${index}.insurance_policy_number`}>
                              Policy Number
                            </Label>
                            <Input
                              id={`vehicles.${index}.insurance_policy_number`}
                              placeholder="Policy #"
                              {...register(`vehicles.${index}.insurance_policy_number`)}
                            />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              )
            })}

            {/* Add More Buttons */}
            {fields.length < maxVehicles && (
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addVehicle('personal')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Personal Vehicle
                </Button>
                {showRVSection && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addVehicle('rv')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add RV/Camper
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addVehicle('tow_vehicle')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Tow Vehicle
                </Button>
              </div>
            )}

            {fields.length >= maxVehicles && (
              <p className="text-xs text-muted-foreground text-center">
                Maximum of {maxVehicles} vehicles allowed
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
