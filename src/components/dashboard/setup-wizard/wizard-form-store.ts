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
  cancellationPolicy?: string | undefined
  customRules?: string | undefined
  minStayNights?: number | undefined
  maxStayNights?: number | "" | undefined
  bookingLeadTimeDays?: number | undefined
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
