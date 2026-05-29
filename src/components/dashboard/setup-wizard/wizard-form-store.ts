import { create, type StateCreator } from "zustand"

export type PropertyDetailsDraft = {
  address?: string | undefined
  city?: string | undefined
  state?: string | undefined
  zipCode?: string | undefined
  email?: string | undefined
  phone?: string | undefined
  description?: string | undefined
  timezone?: string | undefined
  checkInTime?: string | undefined
  checkOutTime?: string | undefined
  termsAndConditions?: string | undefined
  cancellationPolicy?: string | undefined
  customRules?: string | undefined
  minStayNights?: number | undefined
  maxStayNights?: number | "" | undefined
  bookingLeadTimeDays?: number | undefined
  amenities?: Array<{ id: string; name: string; description: string | null; icon_url?: string | null }> | undefined
  site_amenities?: Array<{ id: string; name: string; description: string | null }> | undefined
  pricingConfig?: Record<string, unknown> | undefined
  reservationTypeConfig?: Record<string, unknown> | undefined
  enabledReservationTypes?: string[] | undefined
  siteTypeConfig?: Record<string, unknown> | undefined
  depositConfig?: Record<string, unknown> | undefined
  rateDiscountsConfig?: Record<string, unknown> | undefined
}

type WizardFormStore = {
  drafts: Record<string, PropertyDetailsDraft>
  saveDraft: (propertyId: string, data: PropertyDetailsDraft) => void
  getDraft: (propertyId: string) => PropertyDetailsDraft | undefined
  clearDraft: (propertyId: string) => void
}

const wizardFormStoreCreator: StateCreator<WizardFormStore> = (set, get) => ({
  drafts: {},
  saveDraft: (propertyId: string, data: PropertyDetailsDraft) =>
    set((state) => ({
      drafts: { ...state.drafts, [propertyId]: data },
    })),
  getDraft: (propertyId: string) => get().drafts[propertyId],
  clearDraft: (propertyId: string) =>
    set((state) => {
      const next = { ...state.drafts }
      delete next[propertyId]
      return { drafts: next }
    }),
})

export const useWizardFormStore = create<WizardFormStore>(wizardFormStoreCreator)
