'use client'

/**
 * Add Site Dialog Component
 *
 * Dialog wrapper for the site form to add individual sites.
 * Reuses the existing SiteForm component from the setup wizard.
 */

import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SiteForm } from '@/components/dashboard/setup-wizard/site-form'
import { useToast } from '@/hooks/use-toast'

interface AddSiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

export function AddSiteDialog({
  open,
  onOpenChange,
  propertyId,
}: AddSiteDialogProps) {
  const router = useRouter()
  const { toast } = useToast()

  const handleSave = (site: any) => {
    toast({
      title: 'Site Created',
      description: `Site ${site.site_number} has been created successfully.`,
    })
    onOpenChange(false)
    router.refresh() // Refresh to show new site
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Site</DialogTitle>
          <DialogDescription>
            Create a new site for your property. All fields marked with * are
            required.
          </DialogDescription>
        </DialogHeader>

        <SiteForm
          propertyId={propertyId}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  )
}
