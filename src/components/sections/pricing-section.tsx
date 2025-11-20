"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollReveal } from "@/components/scroll-reveal"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { AnimatedGradientBorder } from "@/components/ui/animated-gradient-border"
import { motion } from "framer-motion"
import Link from "next/link"

export function PricingSection() {
  const plans = [
    {
      name: "Starter",
      slug: "starter",
      description: "Perfect for small campgrounds and seasonal operations",
      price: "$199",
      duration: "per month",
      features: [
        "Up to 50 sites",
        "250 bookings/month included",
        "Online booking portal",
        "Basic site map",
        "Payment processing",
        "Email support",
        "Mobile app access",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Growth",
      slug: "growth",
      description: "Ideal for growing RV parks and glamping sites",
      price: "$399",
      duration: "per month",
      features: [
        "Up to 150 sites",
        "750 bookings/month included",
        "Online booking portal",
        "Interactive site maps",
        "Payment processing",
        "Portfolio pooling",
        "Advanced analytics",
        "Priority support",
        "Custom branding",
      ],
      cta: "Get Started",
      popular: true,
    },
    {
      name: "Pro",
      slug: "pro",
      description: "For large properties and serious operators",
      price: "$799",
      duration: "per month",
      features: [
        "Up to 400 sites",
        "1,800 bookings/month included",
        "Online booking portal",
        "Advanced site maps",
        "Payment processing",
        "Portfolio pooling",
        "Advanced analytics",
        "Advanced integrations",
        "Priority support",
        "Dedicated account manager",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      description: "For multi-property operators and complex operations",
      price: "Custom",
      duration: "contact sales",
      features: [
        "Unlimited sites",
        "Custom booking quotas",
        "Multi-property support",
        "White-glove onboarding",
        "API access",
        "Custom integrations",
        "24/7 support",
        "Dedicated CSM",
        "SLA guarantees",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ]

  return (
    <section id="pricing" className="w-full py-12 md:py-24 lg:py-32">
      <div className="container px-4 md:px-6">
        <ScrollReveal>
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-heading font-bold tracking-tighter sm:text-5xl">
                Simple, Transparent Pricing
              </h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400 opacity-70">
                Choose the plan that fits your property size. Get started today and modernize your campground
                operations.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 py-12 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, index) => (
            <ScrollReveal key={index} delay={index * 0.1}>
              <Card className={`h-full flex flex-col glassmorphic-card ${plan.popular ? "border-glow-red" : ""}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0 -mt-2 -mr-2 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-full">
                    Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="tracking-tight">{plan.name}</CardTitle>
                  <CardDescription className="opacity-70">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-2 opacity-70">{plan.duration}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 mb-8 flex-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center">
                        <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.slug === "enterprise" ? (
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Link href="mailto:sales@campos.com?subject=Enterprise%20Plan%20Inquiry" className="w-full">
                        <Button className="w-full neumorphic-button">{plan.cta}</Button>
                      </Link>
                    </motion.div>
                  ) : plan.popular ? (
                    <AnimatedGradientBorder
                      colors={["#dc2626", "#4b5563", "#dc2626", "#4b5563"]}
                      borderWidth={1}
                      duration={8}
                    >
                      <Link href={`/signup?plan=${plan.slug}`} className="w-full">
                        <Button className="w-full bg-background border-0 text-foreground hover:text-white">
                          {plan.cta}
                        </Button>
                      </Link>
                    </AnimatedGradientBorder>
                  ) : (
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Link href={`/signup?plan=${plan.slug}`} className="w-full">
                        <Button className="w-full neumorphic-button">{plan.cta}</Button>
                      </Link>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
