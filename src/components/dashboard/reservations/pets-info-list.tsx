'use client'

import { useEffect } from 'react'
import { useFieldArray, useFormContext } from 'react-hook-form'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronDown, Plus, Trash2, PawPrint } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PetsInfoListProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  maxPets?: number
  className?: string
}

const PET_TYPE_OPTIONS = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'other', label: 'Other' },
]

export function PetsInfoList({
  isOpen,
  onOpenChange,
  maxPets = 5,
  className,
}: PetsInfoListProps) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext()

  const petsErrors = errors.pets as Array<Record<string, { message?: string }>> | undefined

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'pets',
  })

  const addPet = () => {
    if (fields.length < maxPets) {
      append({
        name: '',
        type: '',
        breed: '',
        weight_lbs: undefined,
        notes: '',
      })
    }
  }

  const petCount = fields.length

  useEffect(() => {
    setValue('numPets', petCount, { shouldDirty: true, shouldValidate: true })
  }, [petCount, setValue])

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onOpenChange}
      className={cn('rounded-lg border', className)}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <PawPrint className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Pets Information</span>
          {petCount > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {petCount} {petCount === 1 ? 'pet' : 'pets'}
            </span>
          )}
          <span className="text-xs text-muted-foreground">(Optional)</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t p-4 space-y-4">
          {fields.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <PawPrint className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pets added yet</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPet}
                className="mt-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Pet
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="relative">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Pet {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove pet</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`pets.${index}.name`}>
                          Pet Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`pets.${index}.name`}
                          placeholder="Pet's name"
                          {...register(`pets.${index}.name`)}
                        />
                        {petsErrors?.[index]?.name && (
                          <p className="text-xs text-destructive">
                            {petsErrors[index].name.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`pets.${index}.type`}>
                          Pet Type <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={watch(`pets.${index}.type`) ?? ''}
                          onValueChange={(value) => {
                            setValue(`pets.${index}.type`, value, { shouldValidate: true })
                          }}
                        >
                          <SelectTrigger id={`pets.${index}.type`}>
                            <SelectValue placeholder="Select pet type" />
                          </SelectTrigger>
                          <SelectContent>
                            {PET_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {petsErrors?.[index]?.type && (
                          <p className="text-xs text-destructive">
                            {petsErrors[index].type.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`pets.${index}.breed`}>Breed (Optional)</Label>
                        <Input
                          id={`pets.${index}.breed`}
                          placeholder="e.g., Labrador"
                          {...register(`pets.${index}.breed`)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`pets.${index}.weight_lbs`}>
                          Weight in lbs (Optional)
                        </Label>
                        <Input
                          id={`pets.${index}.weight_lbs`}
                          type="number"
                          min="0"
                          placeholder="e.g., 35"
                          {...register(`pets.${index}.weight_lbs`, {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`pets.${index}.notes`}>Notes (Optional)</Label>
                      <Textarea
                        id={`pets.${index}.notes`}
                        placeholder="Any behavior notes, accessibility details, or care instructions..."
                        rows={2}
                        {...register(`pets.${index}.notes`)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {fields.length < maxPets && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPet}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Another Pet
                </Button>
              )}

              {fields.length >= maxPets && (
                <p className="text-xs text-muted-foreground text-center">
                  Maximum of {maxPets} pets allowed
                </p>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
