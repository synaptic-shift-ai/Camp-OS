"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type DeletePropertyAmenitiesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  amenityName?: string | undefined
  onConfirm: () => void
}

export function DeletePropertyAmenitiesDialog({
  open,
  onOpenChange,
  amenityName,
  onConfirm,
}: DeletePropertyAmenitiesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this property amenity?</AlertDialogTitle>
          <AlertDialogDescription>
            {amenityName ? (
              <>
                This will remove <span className="font-medium">{amenityName}</span> from your property amenities.
              </>
            ) : (
              "This action will remove the property amenity from the list."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
