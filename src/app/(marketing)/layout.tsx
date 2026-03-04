import type React from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { createClient } from "@/lib/supabase/server"

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const initialUser = user ? { id: user.id } : null

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader initialUser={initialUser} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  )
}
