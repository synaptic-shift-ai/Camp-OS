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

type DeleteAmenitiesConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  amenityName?: string | undefined
  onConfirm: () => void
}

export function DeleteAmenitiesConfirmationDialog({
  open,
  onOpenChange,
  amenityName,
  onConfirm,
}: DeleteAmenitiesConfirmationDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this amenity?</AlertDialogTitle>
          <AlertDialogDescription>
            {amenityName ? (
              <>
                This will remove <span className="font-medium">{amenityName}</span> from your
                property.
              </>
            ) : (
              "This action will remove the amenity from the list."
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
