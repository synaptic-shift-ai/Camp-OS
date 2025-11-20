export type BillingCycle = "monthly" | "annual"

export type Plan = {
  id: string
  name: string
  description: string
  monthlyPrice: number
  annualDiscount: number // percentage
  maxSites: number | null
  minSites: number
  bookingsIncluded: number
  features: string[]
  isPopular: boolean
  isEnterprise: boolean
  cta: string
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small campgrounds just getting started",
    monthlyPrice: 199,
    annualDiscount: 10,
    minSites: 1,
    maxSites: 50,
    bookingsIncluded: 250,
    isPopular: false,
    isEnterprise: false,
    cta: "Get Started",
    features: [
      "Up to 50 campsites",
      "250 bookings per month",
      "Online booking system",
      "Basic reporting",
      "Email support",
      "Mobile-friendly interface",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    description: "Ideal for growing campgrounds with multiple properties",
    monthlyPrice: 399,
    annualDiscount: 10,
    minSites: 51,
    maxSites: 150,
    bookingsIncluded: 750,
    isPopular: true,
    isEnterprise: false,
    cta: "Get Started",
    features: [
      "Up to 150 campsites",
      "750 bookings per month",
      "Everything in Starter",
      "Advanced analytics",
      "Dynamic pricing",
      "Priority email support",
      "Custom branding",
      "Portfolio pooling (2+ properties)",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For established campground operations at scale",
    monthlyPrice: 799,
    annualDiscount: 10,
    minSites: 151,
    maxSites: 400,
    bookingsIncluded: 1800,
    isPopular: false,
    isEnterprise: false,
    cta: "Get Started",
    features: [
      "Up to 400 campsites",
      "1,800 bookings per month",
      "Everything in Growth",
      "API access",
      "Webhook integrations",
      "Phone support",
      "Dedicated account manager",
      "Advanced portfolio pooling",
      "White-label options",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large-scale operations",
    monthlyPrice: 0, // Custom pricing
    annualDiscount: 0,
    minSites: 401,
    maxSites: null, // unlimited
    bookingsIncluded: 0, // custom
    isPopular: false,
    isEnterprise: true,
    cta: "Contact Sales",
    features: [
      "Unlimited campsites",
      "Unlimited bookings",
      "Everything in Pro",
      "Custom integrations",
      "SLA guarantees",
      "24/7 phone support",
      "On-premise options",
      "Multi-region support",
      "Custom contract terms",
    ],
  },
]

/**
 * Get the recommended plan based on total site count
 */
export function getRecommendedPlan(siteCount: number): Plan {
  if (siteCount === 0) return PLANS[0]! // Default to Starter

  // Find the first plan where siteCount fits within the range
  const recommendedPlan = PLANS.find((plan) => {
    if (plan.isEnterprise) return siteCount > 400
    return siteCount >= plan.minSites && siteCount <= (plan.maxSites ?? Infinity)
  })

  // Always return a valid plan - fallback to Enterprise if no match
  return recommendedPlan ?? PLANS[PLANS.length - 1]!
}

/**
 * Calculate pricing for a plan based on billing cycle
 */
export function calculatePrice(
  plan: Plan,
  cycle: BillingCycle
): {
  total: number
  monthly: number
} {
  if (plan.isEnterprise) {
    return { total: 0, monthly: 0 } // Custom pricing
  }

  const monthlyPrice = plan.monthlyPrice

  if (cycle === "monthly") {
    return {
      total: monthlyPrice,
      monthly: monthlyPrice,
    }
  }

  // Annual billing
  const annualTotal = Math.round(monthlyPrice * 12 * (1 - plan.annualDiscount / 100))
  const monthlyEquivalent = Math.round(annualTotal / 12)

  return {
    total: annualTotal,
    monthly: monthlyEquivalent,
  }
}
