import type React from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PageTransition } from "@/components/page-transition"
import { Suspense } from "react"

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <Suspense>
        <PageTransition>
          <div className="flex-1">{children}</div>
        </PageTransition>
      </Suspense>
      <SiteFooter />
    </div>
  )
}
