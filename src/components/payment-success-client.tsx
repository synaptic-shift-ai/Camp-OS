"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle2, Mail, Tent, Check, ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PLANS, type BillingCycle } from "@/lib/constants/plans"

const SIGNUP_COMPANY_DETAILS_KEY = "signup_company_details"

export function PaymentSuccessClient() {
  const searchParams = useSearchParams()

  // Subscription success: clear initial signup onboarding data so it doesn't persist
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SIGNUP_COMPANY_DETAILS_KEY)
    }
  }, [])

  const planId = searchParams.get("plan") || "growth"
  const billingCycle = (searchParams.get("billing") as BillingCycle) || "monthly"
  const email = searchParams.get("email")

  // Find plan with fallback (Growth plan guaranteed to exist at index 1)
  const foundPlan = PLANS.find((p) => p.id === planId)
  const plan = foundPlan ?? PLANS[1]!

  // Calculate pricing
  const monthlyPrice = plan.monthlyPrice
  const annualPrice = Math.round(monthlyPrice * 12 * (1 - plan.annualDiscount / 100))
  const displayPrice = billingCycle === "monthly" ? monthlyPrice : annualPrice

  return (
    <div className="min-h-screen bg-black py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Tent className="w-8 h-8 text-white" />
            <span className="text-2xl font-bold text-white">CampOS</span>
          </div>
        </div>

        {/* Success Icon with Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </motion.div>

        {/* Main Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
          <p className="text-xl text-gray-400">Welcome to CampOS</p>
        </motion.div>

        {/* Plan Details Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-zinc-900 border-zinc-800 p-6 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Plan</p>
                <p className="text-white font-semibold">{plan.name} Plan</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Billing</p>
                <p className="text-white font-semibold">
                  ${displayPrice.toLocaleString()}/{billingCycle === "monthly" ? "month" : "year"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Sites</p>
                <p className="text-white font-semibold">
                  Up to {plan.maxSites === null ? "unlimited" : plan.maxSites} sites
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Bookings</p>
                <p className="text-white font-semibold">{plan.bookingsIncluded} bookings/month</p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Email Confirmation Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Alert className="bg-blue-500/10 border-blue-500/20 mb-6">
            <Mail className="h-5 w-5 text-blue-400" />
            <AlertDescription className="text-gray-300 ml-2">
              <p className="mb-2">We&apos;ve sent a confirmation and onboarding link to your email.</p>
              {email ? (
                <p className="font-mono text-white mb-2">{email}</p>
              ) : null}
              <p className="text-sm text-gray-400 mb-2">
                Check your inbox (and spam folder) for the link, or go directly to onboarding to get started.
              </p>
              <Link
                href="/onboarding"
                className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors underline"
              >
                Go to onboarding →
              </Link>
            </AlertDescription>
          </Alert>
        </motion.div>

        {/* What's Next Timeline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card className="bg-zinc-900 border-zinc-800 p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-6">What to expect:</h2>

            <div className="space-y-6">
              {/* Completed Steps */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="w-0.5 h-full bg-zinc-800 mt-2" />
                </div>
                <div className="pb-6">
                  <p className="text-white font-medium mb-1">Account created</p>
                  <p className="text-sm text-gray-400">Your CampOS account is active</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="w-0.5 h-full bg-zinc-800 mt-2" />
                </div>
                <div className="pb-6">
                  <p className="text-white font-medium mb-1">Payment confirmed</p>
                  <p className="text-sm text-gray-400">Subscription started successfully</p>
                </div>
              </div>

              {/* Upcoming Steps */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <ArrowRightIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-0.5 h-full bg-zinc-800 mt-2" />
                </div>
                <div className="pb-6">
                  <p className="text-white font-medium mb-1">Set up your property</p>
                  <p className="text-sm text-gray-400">Add property details and upload photos (2 min)</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <ArrowRightIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="w-0.5 h-full bg-zinc-800 mt-2" />
                </div>
                <div className="pb-6">
                  <p className="text-white font-medium mb-1">Add campsites</p>
                  <p className="text-sm text-gray-400">Create your sites and set pricing (5 min)</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <ArrowRightIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Connect Stripe</p>
                  <p className="text-sm text-gray-400">Link your Stripe account for payouts (3 min)</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Support Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <p className="text-sm text-gray-400 mb-2">Need help getting started?</p>
          <div className="flex gap-4 justify-center">
            <Link
              href="mailto:support@campos.com"
              className="text-sm text-red-500 hover:text-red-400 transition-colors"
            >
              Contact our team
            </Link>
            <span className="text-gray-600">•</span>
            <Link href="/docs/getting-started" className="text-sm text-red-500 hover:text-red-400 transition-colors">
              View setup guide
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
