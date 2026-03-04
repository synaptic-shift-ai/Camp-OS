"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Check, ArrowLeft, Loader2, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AnimatedGradientBorder } from "@/components/ui/animated-gradient-border"
import { PLANS, getRecommendedPlan, calculatePrice, type BillingCycle, type Plan } from "@/lib/constants/plans"

function isPlanRecommended(plan: Plan, siteCount: number): boolean {
  if (siteCount === 0) return false
  if (plan.isEnterprise) return siteCount > 100
  return siteCount >= plan.minSites && siteCount <= (plan.maxSites ?? Infinity)
}

export function ChoosePlanClient() {
  const searchParams = useSearchParams()
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Company data from query params or localStorage
  const companyData = (() => {
    try {
      const encoded = searchParams.get("company")
      if (encoded) {
        const decoded = atob(encoded)
        return JSON.parse(decoded)
      }
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem("signup_company_details")
        if (raw) return JSON.parse(raw)
      }
      return null
    } catch (err) {
      console.error("[Choose Plan] Failed to decode company data:", err)
      return null
    }
  })()

  const siteCountFromParams = Number(searchParams.get("sites")) || 0
  const siteCount = companyData?.totalSites ?? siteCountFromParams
  const recommendedPlan = getRecommendedPlan(siteCount)
  const annualSavings = 10 // percentage

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.isEnterprise) {
      window.location.href = `mailto:sales@campos.com?subject=Enterprise%20Plan%20Inquiry`
      return
    }

    setLoading(plan.id)
    setError(null)

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin", // Ensure cookies are sent
        body: JSON.stringify({
          planId: plan.id,
          billingCycle,
          siteCount,
          companyData, // Include company data for Stripe metadata
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific auth errors
        if (response.status === 401) {
          throw new Error("Session error. Please try logging in again or contact support if this persists.")
        }
        throw new Error(data.error || "Failed to create checkout session")
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error("No checkout URL returned")
      }
    } catch (err) {
      console.error("Checkout error:", err)
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred"
      setError(errorMessage)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Choose Your Plan</h1>
          {siteCount > 0 && (
            <p className="text-gray-400 text-lg">
              Based on your <span className="text-white font-semibold">{siteCount}</span> sites, we recommend the{" "}
              <span className="text-red-500 font-semibold">{recommendedPlan.name}</span> plan.
            </p>
          )}
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex flex-col items-center gap-3 mb-12">
          <Tabs value={billingCycle} onValueChange={(value) => setBillingCycle(value as BillingCycle)}>
            <TabsList className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors">
              <TabsTrigger
                value="monthly"
                className="text-gray-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-600 data-[state=active]:text-white hover:text-gray-200 transition-all cursor-pointer px-6 py-2 font-medium"
              >
                Monthly
              </TabsTrigger>
              <TabsTrigger
                value="annual"
                className="text-gray-400 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-pink-600 data-[state=active]:text-white hover:text-gray-200 transition-all cursor-pointer px-6 py-2 font-medium"
              >
                Annual
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {billingCycle === "annual" && (
            <p className="text-sm text-emerald-400">Save {annualSavings}% with annual billing</p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-8 max-w-2xl mx-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {PLANS.map((plan) => {
            const isRecommended = isPlanRecommended(plan, siteCount)
            const isBestMatch = plan.id === recommendedPlan.id && siteCount > 0
            const price = calculatePrice(plan, billingCycle)
            const isLoadingPlan = loading === plan.id

            const cardContent = (
              <Card
                className={`relative p-6 bg-zinc-900 border-zinc-800 h-full flex flex-col transition-all duration-300 ${isBestMatch ? "border-glow-red" : ""
                  }`}
              >
                {/* Badges */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                  {plan.isPopular && <Badge className="bg-red-500 text-white text-xs px-3 py-1">Most Popular</Badge>}
                  {isRecommended && (
                    <Badge className="bg-emerald-500 text-white text-xs px-3 py-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Recommended
                    </Badge>
                  )}
                </div>

                {/* Plan Name & Description */}
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-sm text-gray-400">{plan.description}</p>
                  {isRecommended && siteCount > 0 && (
                    <p className="text-xs text-emerald-400 mt-2">Perfect fit for {siteCount} sites</p>
                  )}
                </div>

                {/* Pricing */}
                <div className="mb-6">
                  {plan.isEnterprise ? (
                    <div className="text-3xl font-bold text-white">Custom</div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-white">
                        ${billingCycle === "monthly" ? price.total : price.total.toLocaleString()}
                        <span className="text-lg font-normal text-gray-400">
                          /{billingCycle === "monthly" ? "mo" : "yr"}
                        </span>
                      </div>
                      {billingCycle === "annual" && (
                        <p className="text-sm text-gray-400 mt-1">Equivalent to ${price.monthly}/mo</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">billed {billingCycle}</p>
                    </>
                  )}
                </div>

                {/* Features */}
                <div className="flex-1 mb-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div>
                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={isLoadingPlan}
                    className={`w-full h-11 font-medium ${isBestMatch
                      ? "bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white"
                      : "bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                      }`}
                  >
                    {isLoadingPlan ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      plan.cta
                    )}
                  </Button>
                </div>
              </Card>
            )

            return (
              <motion.div
                key={plan.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                {isBestMatch ? (
                  <AnimatedGradientBorder
                    colors={["#dc2626", "#4b5563", "#dc2626", "#4b5563"]}
                    borderWidth={1}
                    duration={8}
                  >
                    {cardContent}
                  </AnimatedGradientBorder>
                ) : (
                  cardContent
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Site Count Info */}
        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            Need to change your site count?{" "}
            <Link href="/signup" className="text-red-500 hover:text-red-400 transition-colors">
              Go back
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
