export type DateRange = "7d" | "30d" | "90d" | "ytd" | "all"

/**
 * Get start date based on selected range
 */
export function getStartDate(range: DateRange): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (range) {
    case "7d":
      return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "30d":
      return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    case "90d":
      return new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
    case "ytd":
      return new Date(now.getFullYear(), 0, 1) // January 1st of current year
    case "all":
      return new Date(2020, 0, 1) // Far past date
    default:
      return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}
