import { create } from "zustand"

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

export const useWizardFormStore = create<WizardFormStore>((set, get) => ({
  drafts: {},
  saveDraft: (propertyId, data) =>
    set((state) => ({ drafts: { ...state.drafts, [propertyId]: data } })),
  getDraft: (propertyId) => get().drafts[propertyId],
  clearDraft: (propertyId) =>
    set((state) => {
      const next = { ...state.drafts }
      delete next[propertyId]
      return { drafts: next }
    }),
}))
