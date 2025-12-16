'use client'

/**
 * Children List Component
 *
 * Dynamic list for capturing children information during manual booking.
 * Supports add/remove functionality with validation.
 */

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
import { ChevronDown, Plus, Trash2, Baby } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChildrenListProps {
  /** Whether the section is expanded */
  isOpen: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Maximum number of children allowed */
  maxChildren?: number
  /** Optional CSS class name */
  className?: string
}

// Age options for dropdown (0-17)
const AGE_OPTIONS = Array.from({ length: 18 }, (_, i) => ({
  value: i.toString(),
  label: i === 0 ? 'Under 1' : `${i} years old`,
}))

export function ChildrenList({
  isOpen,
  onOpenChange,
  maxChildren = 10,
  className,
}: ChildrenListProps) {
  const { register, control, formState: { errors } } = useFormContext()

  // Type-safe access to children errors array
  const childrenErrors = errors.children as Array<Record<string, { message?: string }>> | undefined

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'children',
  })

  const addChild = () => {
    if (fields.length < maxChildren) {
      append({
        first_name: '',
        age: undefined,
        date_of_birth: '',
        special_needs_allergies: '',
      })
    }
  }

  const childCount = fields.length

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onOpenChange}
      className={cn('rounded-lg border', className)}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Baby className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Children Information</span>
          {childCount > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {childCount} {childCount === 1 ? 'child' : 'children'}
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
              <Baby className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No children added yet</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addChild}
                className="mt-3"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Child
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="relative">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        Child {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove child</span>
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* First Name */}
                      <div className="space-y-2">
                        <Label htmlFor={`children.${index}.first_name`}>
                          First Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`children.${index}.first_name`}
                          placeholder="Child's name"
                          {...register(`children.${index}.first_name`)}
                        />
                        {childrenErrors?.[index]?.first_name && (
                          <p className="text-xs text-destructive">
                            {childrenErrors[index].first_name.message}
                          </p>
                        )}
                      </div>

                      {/* Age Dropdown */}
                      <div className="space-y-2">
                        <Label htmlFor={`children.${index}.age`}>Age</Label>
                        <Select
                          onValueChange={(value) => {
                            // Update form value directly
                            const event = {
                              target: {
                                name: `children.${index}.age`,
                                value: parseInt(value, 10),
                              },
                            }
                            register(`children.${index}.age`).onChange(event)
                          }}
                        >
                          <SelectTrigger id={`children.${index}.age`}>
                            <SelectValue placeholder="Select age" />
                          </SelectTrigger>
                          <SelectContent>
                            {AGE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {childrenErrors?.[index]?.age && (
                          <p className="text-xs text-destructive">
                            {childrenErrors[index].age.message}
                          </p>
                        )}
                      </div>

                      {/* Date of Birth (alternative to age) */}
                      <div className="space-y-2">
                        <Label htmlFor={`children.${index}.date_of_birth`}>
                          Date of Birth
                        </Label>
                        <Input
                          id={`children.${index}.date_of_birth`}
                          type="date"
                          {...register(`children.${index}.date_of_birth`)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Or select age above
                        </p>
                      </div>
                    </div>

                    {/* Special Needs / Allergies */}
                    <div className="mt-3 space-y-2">
                      <Label htmlFor={`children.${index}.special_needs_allergies`}>
                        Special Needs / Allergies (Optional)
                      </Label>
                      <Textarea
                        id={`children.${index}.special_needs_allergies`}
                        placeholder="Any medical conditions, allergies, or special requirements..."
                        rows={2}
                        {...register(`children.${index}.special_needs_allergies`)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Add Another Button */}
              {fields.length < maxChildren && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addChild}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Another Child
                </Button>
              )}

              {fields.length >= maxChildren && (
                <p className="text-xs text-muted-foreground text-center">
                  Maximum of {maxChildren} children allowed
                </p>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
