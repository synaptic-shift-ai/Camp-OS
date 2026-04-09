"use client"

import type React from "react"

import { Suspense, useState, useEffect, useTransition } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import {
  LayoutDashboard,
  Calendar,
  Tent,
  Users,
  CreditCard,
  Settings,
  Menu,
  LogOut,
  Building2,
  BarChart3,
  Bell,
  Loader2,
  History,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PropertyProvider, useProperty } from "@/components/property-context"
import { PropertySwitcher } from "@/components/dashboard/property-switcher"
import { SetupCheckGate } from "@/components/dashboard/setup-check-gate"
import { SetupCompleteToast } from "@/components/dashboard/setup-complete-toast"
import { QuickTourPrompt } from "@/components/dashboard/quick-tour-prompt"

const NAV_ITEMS = [
  { name: "Overview", path: "", icon: LayoutDashboard },
  { name: "Reservations", path: "/reservations", icon: Calendar },
  { name: "Sites", path: "/sites", icon: Tent },
  { name: "Guests", path: "/guests", icon: Users },
  { name: "Payments", path: "/payments", icon: CreditCard },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Staff Management", path: "/staff-management", icon: Users },
  { name: "Auditing", path: "/auditing", icon: History },
  { name: "Settings", path: "/settings", icon: Settings },
] as const

const COMPANY_DETAILS_UPDATED_EVENT = "company-details-updated"

type CompanyDetailsUpdatedEventDetail = {
  companyId: string
  name: string
  companyLogoUrl: string | null
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [isCompanyLoading, setIsCompanyLoading] = useState(true)
  const [logoLoadFailed, setLogoLoadFailed] = useState(false)
  const { selectedProperty, selectedPropertyId, selectProperty, isLoading } = useProperty()
  const companyId = selectedProperty?.companyId ?? null
  const dashboardTitle = isLoading ? "Loading..." : companyName

  const segments = pathname.split("/").filter(Boolean)
  const propertyIdFromUrl = segments[0] === "dashboard" && segments[1] ? segments[1] : null
  const dashboardBase = propertyIdFromUrl ? `/dashboard/${propertyIdFromUrl}` : "/dashboard"

  useEffect(() => {
    if (propertyIdFromUrl && propertyIdFromUrl !== selectedPropertyId) {
      selectProperty(propertyIdFromUrl)
    }
  }, [propertyIdFromUrl, selectedPropertyId, selectProperty])

  useEffect(() => {
    let isCancelled = false

    async function fetchCompanyName() {
      if (!companyId) {
        setCompanyName(null)
        setCompanyLogoUrl(null)
        setIsCompanyLoading(false)
        setLogoLoadFailed(false)
        return
      }

      setIsCompanyLoading(true)
      try {
        const response = await fetch(`/api/v1/companies/${companyId}`)
        const result = await response.json()

        if (!isCancelled && response.ok && result?.success) {
          setCompanyName(result.data?.name ?? null)
          setCompanyLogoUrl(result.data?.companyLogoUrl ?? null)
          setLogoLoadFailed(false)
        } else if (!isCancelled) {
          setCompanyName(null)
          setCompanyLogoUrl(null)
          setLogoLoadFailed(false)
        }
      } catch (error) {
        console.error("Failed to fetch company name:", error)
        if (!isCancelled) {
          setCompanyName(null)
          setCompanyLogoUrl(null)
          setLogoLoadFailed(false)
        }
      } finally {
        if (!isCancelled) {
          setIsCompanyLoading(false)
        }
      }
    }

    fetchCompanyName()

    return () => {
      isCancelled = true
    }
  }, [companyId])

  useEffect(() => {
    const handleCompanyDetailsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<CompanyDetailsUpdatedEventDetail>
      const detail = customEvent.detail

      if (!detail || detail.companyId !== companyId) {
        return
      }

      setCompanyName(detail.name)
      setCompanyLogoUrl(detail.companyLogoUrl)
      setLogoLoadFailed(false)
    }

    window.addEventListener(COMPANY_DETAILS_UPDATED_EVENT, handleCompanyDetailsUpdated)
    return () => {
      window.removeEventListener(COMPANY_DETAILS_UPDATED_EVENT, handleCompanyDetailsUpdated)
    }
  }, [companyId])

  const handleNavClick = (href: string, closeMobile?: boolean) => {
    if (href === pathname) {
      if (closeMobile) setMobileMenuOpen(false)
      return
    }
    if (closeMobile) setMobileMenuOpen(false)
    startTransition(() => {
      router.push(href)
    })
  }

  const handleLogout = async () => {
    const supabase = createClient()
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (token) {
        await fetch("/api/v1/activity/record-logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch {
      /* audit is best-effort; do not block logout */
    }
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <div className="fixed inset-0 z-0 flex overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:shrink-0 lg:w-64 lg:border-r border-border bg-card/50">
        <div className="flex h-20 items-center justify-center border-b border-border px-6">
          {isLoading || isCompanyLoading ? (
            <span className="font-heading font-semibold text-md">Loading...</span>
          ) : companyLogoUrl && !logoLoadFailed ? (
            <Image
              src={companyLogoUrl}
              alt="Company logo"
              width={60}
              height={60}
              className="rounded-md object-cover shrink-0"
              onError={() => setLogoLoadFailed(true)}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary shrink-0" />
              <span className="font-heading font-semibold text-md">{dashboardTitle}</span>
            </div>
          )}
        </div>
        <PropertySwitcher />
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const href = `${dashboardBase}${item.path}`
              const isActive = pathname === href || (item.path !== "" && pathname.startsWith(href + "/"))
              return (
                <a
                  key={item.name}
                  href={href}
                  onClick={(e) => {
                    if (e.button === 0) {
                      e.preventDefault()
                      handleNavClick(href)
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </a>
              )
            })}
          </nav>
        </ScrollArea>
        <div className="border-t border-border p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={companyLogoUrl ?? undefined} alt={companyName ?? "Company logo"} />
                  <AvatarFallback>
                    {isLoading ? "..." : companyName?.substring(0, 2).toUpperCase() || "CO"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-sm">
                  <span className="font-medium">{isLoading ? "Loading..." : companyName || "Company"}</span>
                  <span className="text-xs text-muted-foreground">Owner</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`${dashboardBase}/account`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-card/50 px-4 lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-0">
              <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
              <div className="flex h-16 items-center gap-2 border-b border-border px-6">
                {isLoading || isCompanyLoading ? (
                  <span className="font-heading font-semibold text-lg">Loading...</span>
                ) : companyLogoUrl && !logoLoadFailed ? (
                  <>
                    <Image
                      src={companyLogoUrl}
                      alt={companyName ?? "Company logo"}
                      width={28}
                      height={28}
                      className="rounded-md object-cover shrink-0"
                      onError={() => setLogoLoadFailed(true)}
                    />
                    <span className="font-heading font-semibold text-lg">{dashboardTitle || "Company"}</span>
                  </>
                ) : (
                  <>
                    <Building2 className="h-6 w-6 text-primary" />
                    <span className="font-heading font-semibold text-lg">{dashboardTitle || "Company"}</span>
                  </>
                )}
              </div>
              <ScrollArea className="flex-1 px-3 py-4">
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const href = `${dashboardBase}${item.path}`
                    const isActive = pathname === href || (item.path !== "" && pathname.startsWith(href + "/"))
                    return (
                      <Link
                        key={item.name}
                        href={href}
                        prefetch={true}
                        onClick={(e) => {
                          if (e.button === 0) {
                            e.preventDefault()
                            handleNavClick(href, true)
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    )
                  })}
                </nav>
              </ScrollArea>
              <div className="border-t border-border p-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start gap-3 px-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={companyLogoUrl ?? undefined} alt={companyName ?? "Company logo"} />
                        <AvatarFallback>
                          {isLoading || isCompanyLoading
                            ? "..."
                            : companyName?.substring(0, 2).toUpperCase() || "CO"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start text-sm">
                        <span className="font-medium">
                          {isLoading || isCompanyLoading ? "Loading..." : companyName || "Company"}
                        </span>
                        <span className="text-xs text-muted-foreground">Owner</span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`${dashboardBase}/account`} onClick={() => setMobileMenuOpen(false)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Bell className="mr-2 h-4 w-4" />
                      Notifications
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        setMobileMenuOpen(false)
                        void handleLogout()
                      }}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            {isLoading || isCompanyLoading ? (
              <span className="font-heading font-semibold text-lg">Loading...</span>
            ) : companyLogoUrl && !logoLoadFailed ? (
              <>
                <Image
                  src={companyLogoUrl}
                  alt={companyName ?? "Company logo"}
                  width={28}
                  height={28}
                  className="rounded-md object-cover shrink-0"
                  onError={() => setLogoLoadFailed(true)}
                />
                <span className="font-heading font-semibold text-lg">{dashboardTitle || "Company"}</span>
              </>
            ) : (
              <>
                <Building2 className="h-6 w-6 text-primary" />
                <span className="font-heading font-semibold text-lg">{dashboardTitle || "Company"}</span>
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
            <QuickTourPrompt />
            {isPending ? (
              <div className="flex min-h-[200px] flex-1 items-center justify-center" aria-busy="true" aria-label="Loading">
                <Loader2 className="h-12 w-12 animate-spin stroke-[1] text-muted-foreground" />
              </div>
            ) : (
              <div className="pb-20">
                {children}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PropertyProvider>
      <SetupCheckGate>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
        <Suspense fallback={null}>
          <SetupCompleteToast />
        </Suspense>
      </SetupCheckGate>
    </PropertyProvider>
  )
}
