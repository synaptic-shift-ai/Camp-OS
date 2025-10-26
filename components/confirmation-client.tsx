"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  Check,
  Tent,
  Calendar,
  Users,
  MapPin,
  Mail,
  Phone,
  Home,
  TreePine,
  Sparkles,
  Copy,
  CheckCircle2,
  Printer,
  CalendarPlus,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCheckout } from "@/lib/booking/checkout-context"
import type { SiteType, AvailableSite } from "@/lib/booking/types"
import { getSimilarSites } from "@/lib/booking/api"

const siteTypeIcons: Record<SiteType, React.ReactNode> = {
  rv: <Home className="h-4 w-4" />,
  tent: <Tent className="h-4 w-4" />,
  cabin: <TreePine className="h-4 w-4" />,
  glamping: <Sparkles className="h-4 w-4" />,
}

const siteTypeColors: Record<SiteType, string> = {
  rv: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  tent: "bg-green-500/10 text-green-500 border-green-500/20",
  cabin: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  glamping: "bg-purple-500/10 text-purple-500 border-purple-500/20",
}

const steps = [
  { id: 1, name: "Site Selection", status: "complete" },
  { id: 2, name: "Guest Info", status: "complete" },
  { id: 3, name: "Payment", status: "complete" },
  { id: 4, name: "Confirmation", status: "current" },
]

export function ConfirmationClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkoutData, clearCheckoutData } = useCheckout()
  const [confirmationNumber, setConfirmationNumber] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [similarSites, setSimilarSites] = useState<AvailableSite[]>([])
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false)

  useEffect(() => {
    const number = `CAMP-${Date.now().toString().slice(-8)}`
    setConfirmationNumber(number)
  }, []) // Empty dependency array - only run once

  useEffect(() => {
    if (!checkoutData.site || !checkoutData.guestInfo) {
      console.log("[v0] No checkout data, redirecting to home")
      router.push("/book")
    }
  }, [checkoutData.site, checkoutData.guestInfo, router])

  useEffect(() => {
    setShowConfetti(true)
    const timer = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(timer)
  }, []) // Empty dependency array - only run once

  useEffect(() => {
    if (checkoutData.site) {
      setIsLoadingSimilar(true)
      getSimilarSites(checkoutData.site.id, 3)
        .then(setSimilarSites)
        .catch((err) => console.error("[v0] Failed to load similar sites:", err))
        .finally(() => setIsLoadingSimilar(false))
    }
  }, [checkoutData.site]) // Only depend on site object

  const handleCopyConfirmation = async () => {
    try {
      await navigator.clipboard.writeText(confirmationNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleAddToCalendar = () => {
    if (!checkoutData.checkInDate || !checkoutData.checkOutDate || !checkoutData.site) return

    const formatICSDate = (date: string) => {
      return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    }

    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CampOS//Booking//EN
BEGIN:VEVENT
UID:${confirmationNumber}@campos.com
DTSTAMP:${formatICSDate(new Date().toISOString())}
DTSTART:${formatICSDate(checkoutData.checkInDate)}
DTEND:${formatICSDate(checkoutData.checkOutDate)}
SUMMARY:Camping at ${checkoutData.site.name}
DESCRIPTION:Campsite reservation at ${checkoutData.site.name}\\nConfirmation: ${confirmationNumber}\\nSite: ${checkoutData.site.site_number}
LOCATION:${checkoutData.site.name}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `camping-reservation-${confirmationNumber}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleNewBooking = () => {
    clearCheckoutData()
    router.push("/book")
  }

  if (!checkoutData.site || !checkoutData.guestInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: "-10px",
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"][
                    Math.floor(Math.random() * 5)
                  ],
                }}
              />
            </div>
          ))}
        </div>
      )}

      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 print:hidden">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/book" className="flex items-center gap-2">
            <Tent className="h-6 w-6" />
            <span className="font-bold text-xl">CampOS</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="ghost">Sign In</Button>
          </div>
        </div>
      </nav>

      <div className="border-b bg-background/50 print:hidden">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                      (step.status === "complete" || step.status === "current") &&
                        "bg-primary border-primary text-primary-foreground",
                      step.status === "upcoming" && "bg-muted border-border text-muted-foreground",
                    )}
                  >
                    <Check className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-2 font-medium hidden sm:block",
                      step.status === "current" && "text-foreground",
                      step.status !== "current" && "text-muted-foreground",
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && <div className="h-0.5 flex-1 mx-2 bg-primary" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500 mb-4 animate-scale-in"
              style={{ animationDelay: "0.2s" }}
            >
              <Check className="h-10 w-10 text-green-500 animate-check-draw" />
            </div>
            <h1 className="text-4xl font-bold animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              Booking Confirmed!
            </h1>
            <p className="text-xl text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
              Your reservation has been successfully confirmed. We've sent a confirmation email to{" "}
              <span className="font-medium text-foreground">{checkoutData.guestInfo.email}</span>
            </p>
          </div>

          <Card className="glass-strong animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Confirmation Number</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-3xl font-bold tracking-wider">{confirmationNumber}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyConfirmation}
                    className="print:hidden"
                    title="Copy confirmation number"
                  >
                    {copied ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Save this number for your records</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <CardHeader>
              <CardTitle>Reservation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={checkoutData.site.image_url || "/placeholder.svg"}
                    alt={checkoutData.site.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{checkoutData.site.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">Site #{checkoutData.site.site_number}</p>
                  <Badge className={cn("border", siteTypeColors[checkoutData.site.site_type])}>
                    <span className="mr-1">{siteTypeIcons[checkoutData.site.site_type]}</span>
                    {checkoutData.site.site_type.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Check-in</p>
                    <p className="text-sm text-muted-foreground">
                      {checkoutData.checkInDate && format(new Date(checkoutData.checkInDate), "EEEE, MMM dd, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">After 3:00 PM</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Check-out</p>
                    <p className="text-sm text-muted-foreground">
                      {checkoutData.checkOutDate && format(new Date(checkoutData.checkOutDate), "EEEE, MMM dd, yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Before 11:00 AM</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {checkoutData.numberOfGuests} {checkoutData.numberOfGuests === 1 ? "Guest" : "Guests"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {checkoutData.priceBreakdown?.number_of_nights}{" "}
                    {checkoutData.priceBreakdown?.number_of_nights === 1 ? "night" : "nights"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Guest Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {checkoutData.guestInfo.first_name} {checkoutData.guestInfo.last_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{checkoutData.guestInfo.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{checkoutData.guestInfo.phone}</span>
                  </div>
                  {checkoutData.guestInfo.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p>{checkoutData.guestInfo.address}</p>
                        {checkoutData.guestInfo.city && (
                          <p>
                            {checkoutData.guestInfo.city}, {checkoutData.guestInfo.state}{" "}
                            {checkoutData.guestInfo.zip_code}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Payment Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      ${checkoutData.priceBreakdown?.base_price_per_night} ×{" "}
                      {checkoutData.priceBreakdown?.number_of_nights}{" "}
                      {checkoutData.priceBreakdown?.number_of_nights === 1 ? "night" : "nights"}
                    </span>
                    <span className="font-medium">${checkoutData.priceBreakdown?.subtotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Paid</span>
                    <span className="text-green-600 dark:text-green-500">
                      ${checkoutData.priceBreakdown?.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div
            className="flex flex-col sm:flex-row gap-4 print:hidden animate-fade-in-up"
            style={{ animationDelay: "0.7s" }}
          >
            <Button size="lg" variant="outline" onClick={handleAddToCalendar} className="flex-1 bg-transparent">
              <CalendarPlus className="h-4 w-4 mr-2" />
              Add to Calendar
            </Button>
            <Button size="lg" variant="outline" onClick={handlePrint} className="flex-1 bg-transparent">
              <Printer className="h-4 w-4 mr-2" />
              Print Confirmation
            </Button>
            <Button
              size="lg"
              className="flex-1 bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70"
              onClick={handleNewBooking}
            >
              Make Another Booking
            </Button>
          </div>

          <Card className="glass animate-fade-in-up" style={{ animationDelay: "0.8s" }}>
            <CardHeader>
              <CardTitle>What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Check your email</p>
                    <p className="text-muted-foreground">
                      We've sent a confirmation email with all the details and directions to the campground.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Prepare for your trip</p>
                    <p className="text-muted-foreground">
                      Review the campground amenities and pack accordingly. Don't forget your confirmation number!
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Check in on arrival</p>
                    <p className="text-muted-foreground">
                      Present your confirmation number at the front desk. Check-in starts at 3:00 PM.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {similarSites.length > 0 && (
            <div className="print:hidden animate-fade-in-up" style={{ animationDelay: "0.9s" }}>
              <h2 className="text-2xl font-bold mb-6">Plan Your Next Trip</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {similarSites.map((site) => (
                  <Card key={site.id} className="glass overflow-hidden group hover:shadow-lg transition-all">
                    <div className="aspect-video relative overflow-hidden">
                      <img
                        src={site.image_url || "/placeholder.svg"}
                        alt={site.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-2">{site.name}</h3>
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={cn("border", siteTypeColors[site.site_type])}>
                          <span className="mr-1">{siteTypeIcons[site.site_type]}</span>
                          {site.site_type.toUpperCase()}
                        </Badge>
                        <span className="text-sm font-medium">${site.base_price_per_night}/night</span>
                      </div>
                      <Link href={`/book/${site.id}`}>
                        <Button variant="outline" size="sm" className="w-full bg-transparent">
                          View Details
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes check-draw {
          0% {
            stroke-dashoffset: 100;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }

        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-confetti {
          animation: confetti linear forwards;
        }

        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }

        .animate-check-draw {
          stroke-dasharray: 100;
          animation: check-draw 0.5s ease-out 0.3s forwards;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }

        @media print {
          body {
            background: white !important;
          }

          .print\\:hidden {
            display: none !important;
          }

          .glass,
          .glass-strong {
            background: white !important;
            border: 1px solid #e5e7eb !important;
          }

          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
