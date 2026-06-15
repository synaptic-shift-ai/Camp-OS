import { addDays, addMonths, addYears, format, isAfter, parseISO, startOfDay } from 'date-fns'
import {
  computeInitialWeeklyOccurrence,
  dateOnlyFromIsoTimestamp,
} from './preventive-schedule-dates'

export type PreventiveScheduleDueInput = {
  frequency: string
  days?: string | null
  scheduleDate?: string | null
  lastCompletedAt?: string | null
  openWorkOrderScheduledStart?: string | null
  hasOpenWorkOrder?: boolean
  asOf?: Date
}

export function resolvePreventiveScheduleNextDueDate(
  input: PreventiveScheduleDueInput,
): string | null {
  const asOf = input.asOf ?? new Date()

  if (input.openWorkOrderScheduledStart) {
    return dateOnlyFromIsoTimestamp(input.openWorkOrderScheduledStart)
  }

  const scheduleDate = input.scheduleDate?.trim()
  if (scheduleDate) {
    return scheduleDate
  }

  if (input.lastCompletedAt) {
    const lastCompletedDate = new Date(input.lastCompletedAt)
    switch (input.frequency) {
      case 'weekly':
        return format(addDays(lastCompletedDate, 7), 'yyyy-MM-dd')
      case 'monthly':
        return format(addMonths(lastCompletedDate, 1), 'yyyy-MM-dd')
      case 'annual':
        return format(addYears(lastCompletedDate, 1), 'yyyy-MM-dd')
      default:
        return format(addMonths(lastCompletedDate, 1), 'yyyy-MM-dd')
    }
  }

  if (input.frequency === 'weekly' && input.days) {
    try {
      return format(computeInitialWeeklyOccurrence(asOf, input.days), 'yyyy-MM-dd')
    } catch {
      return null
    }
  }

  return null
}

export function isPreventiveScheduleDue(
  nextDueDate: string | null,
  asOf: Date = new Date(),
): boolean {
  if (!nextDueDate) return false
  const due = startOfDay(parseISO(`${nextDueDate}T12:00:00`))
  const today = startOfDay(asOf)
  return !isAfter(due, today)
}

export function shouldGeneratePreventiveWorkOrder(input: PreventiveScheduleDueInput): boolean {
  if (input.hasOpenWorkOrder) return false
  const nextDue = resolvePreventiveScheduleNextDueDate(input)
  return isPreventiveScheduleDue(nextDue, input.asOf)
}
